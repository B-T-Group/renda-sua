import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import axios from 'axios';
import sharp from 'sharp';
import { AiService } from '../ai/ai.service';
import { AwsService } from '../aws/aws.service';
import { CLEANUP_TOKEN_COST } from '../business-tokens/business-tokens.packs';
import { BusinessTokensService } from '../business-tokens/business-tokens.service';
import { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { ImageThumbnailsService } from '../image-thumbnails/image-thumbnails.service';
import { ItemAiReviewService } from '../item-ai-review/item-ai-review.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RentalListingAiReviewService } from '../rental-listing-ai-review/rental-listing-ai-review.service';
import { isActivePersona } from '../users/persona.util';
import { AiImageCleanupQueueService } from './ai-image-cleanup-queue.service';
import * as Q from './ai-image-cleanup.queries';
import type {
  AiImageCleanupConfidenceTier,
  AiImageCleanupJobMode,
  AiImageCleanupJobRow,
  AiImageCleanupJobSource,
  AiImageCleanupKind,
  AiImageCleanupResultRow,
  CleanupEligibleImage,
  CleanupImageSelection,
  ImageActiveVersion,
  VersionedImageRow,
} from './ai-image-cleanup.types';
import { EnhancementConfidenceService } from './enhancement-confidence.service';
import {
  buildApplyPatch,
  buildRevertPatch,
  buildSelectVersionPatch,
  hasExistingVersion,
  shouldSkipAutoApply,
} from './image-versioning.helpers';
import {
  countAiSelections,
  normalizeCleanupSelections,
} from './cleanup-selection.util';
import {
  DEFAULT_OPENAI_IMAGE_CLEANUP_MODEL,
  extractValidationCodes,
  OPENAI_IMAGE_CLEANUP_MODEL_CONFIG_KEY,
  parseOpenAiImageCleanupModel,
  routeCleanupModel,
  type OpenAiImageCleanupModel,
} from './cleanup-model-routing.util';
import { analyzeLocalImageQuality } from './local-image-quality.util';
import type { CleanupProductImageIssue } from '../ai/ai.service';
import { RembgCleanupService } from './rembg-cleanup.service';

@Injectable()
export class AiImageCleanupService implements OnModuleInit {
  private readonly logger = new Logger(AiImageCleanupService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly hasuraUser: HasuraUserService,
    private readonly tokens: BusinessTokensService,
    private readonly aiService: AiService,
    private readonly awsService: AwsService,
    private readonly queue: AiImageCleanupQueueService,
    private readonly notifications: NotificationsService,
    private readonly configService: ConfigService<Configuration>,
    private readonly imageThumbnails: ImageThumbnailsService,
    private readonly confidence: EnhancementConfidenceService,
    private readonly itemAiReview: ItemAiReviewService,
    private readonly rentalListingAiReview: RentalListingAiReviewService,
    private readonly rembgCleanup: RembgCleanupService
  ) {}

  onModuleInit(): void {
    this.queue.registerLocalHandler(async (jobId) => {
      await this.processJob(jobId);
    });
  }

  async requestCleanup(
    itemId: string,
    imageIds?: string[],
    source: AiImageCleanupJobSource = 'creation',
    selections?: CleanupImageSelection[]
  ): Promise<{ job: AiImageCleanupJobRow; ai_tokens_remaining: number }> {
    const { businessId, userId } = await this.requireBusinessContext();
    const images = await this.loadEligibleItemImages(
      itemId,
      businessId,
      normalizeCleanupSelections({ imageIds, selections })
    );
    return this.enqueueCleanupJob({
      businessId,
      userId,
      itemId,
      itemVariantId: null,
      images,
      source,
    });
  }

  /**
   * Platform admin/superuser trigger from sale-item moderation.
   * Does not require a business persona and does not charge merchant AI tokens.
   */
  async requestAdminItemCleanup(
    itemId: string,
    adminUserId: string,
    imageIds?: string[]
  ): Promise<{
    job: AiImageCleanupJobRow;
    ai_tokens_remaining: number;
    appliedExistingReview: boolean;
  }> {
    const item = await this.loadItemBusiness(itemId);
    const open = await this.findOpenJobForItem(itemId);
    if (open?.status === 'queued' || open?.status === 'processing') {
      throw new HttpException(
        'An AI cleanup job is already in progress for this item',
        HttpStatus.CONFLICT
      );
    }
    const appliedOpenJobId =
      open?.status === 'ready_for_review' ? open.id : null;
    if (appliedOpenJobId) {
      await this.adminForceApplyOpenJob(appliedOpenJobId);
    }
    try {
      const images = await this.loadEligibleItemImages(
        itemId,
        item.businessId,
        normalizeCleanupSelections({ imageIds })
      );
      const queued = await this.enqueueCleanupJob({
        businessId: item.businessId,
        userId: adminUserId,
        itemId,
        itemVariantId: null,
        images,
        source: 'admin_moderation',
        chargeTokens: false,
      });
      return { ...queued, appliedExistingReview: !!appliedOpenJobId };
    } catch (error: any) {
      if (appliedOpenJobId) {
        // Prior review job was closed; always resume if we did not queue a replacement.
        await this.maybeResumeModeration(await this.loadJob(appliedOpenJobId));
      }
      if (
        appliedOpenJobId &&
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.BAD_REQUEST &&
        String(error.message).includes('No eligible images')
      ) {
        const balance = await this.tokens.getBalance(item.businessId);
        return {
          job: await this.loadJob(appliedOpenJobId),
          ai_tokens_remaining: balance,
          appliedExistingReview: true,
        };
      }
      throw error;
    }
  }

  /** Apply pending review results so a new admin cleanup (or review resume) can proceed. */
  private async adminForceApplyOpenJob(jobId: string): Promise<void> {
    const job = await this.loadJob(jobId);
    const ready = (job.results ?? []).filter((r) => r.status === 'ready');
    for (const result of ready) {
      const applied = await this.applyEnhancement(result, { force: true });
      if (applied) {
        await this.markResult(result.id, 'accepted', {
          applied_at: new Date().toISOString(),
        });
      } else {
        await this.markResult(result.id, 'rejected');
      }
    }
    const now = new Date().toISOString();
    await this.hasura.executeMutation(Q.UPDATE_JOB, {
      id: jobId,
      _set: {
        status: 'completed',
        completed_at: now,
        updated_at: now,
      },
    });
  }

  async requestVariantCleanup(
    variantId: string,
    imageIds?: string[],
    selections?: CleanupImageSelection[]
  ): Promise<{ job: AiImageCleanupJobRow; ai_tokens_remaining: number }> {
    const { businessId, userId } = await this.requireBusinessContext();
    const { itemId, images } = await this.loadEligibleVariantImages(
      variantId,
      businessId,
      normalizeCleanupSelections({ imageIds, selections })
    );
    return this.enqueueCleanupJob({
      businessId,
      userId,
      itemId,
      itemVariantId: variantId,
      images,
      source: 'variant',
    });
  }

  /** Enqueue async cleanup for a single library/item image (replaces sync 180s path). */
  async requestLibraryImageCleanup(
    imageId: string,
    source: AiImageCleanupJobSource = 'library',
    kind: AiImageCleanupKind = 'ai'
  ): Promise<{ job: AiImageCleanupJobRow; ai_tokens_remaining: number }> {
    const { businessId, userId } = await this.requireBusinessContext();
    const image = await this.loadItemImageRow(imageId);
    if (!image || image.business_id !== businessId) {
      throw new HttpException('Image not found', HttpStatus.NOT_FOUND);
    }
    if (hasExistingVersion(image, kind)) {
      throw new HttpException(
        kind === 'rembg'
          ? 'Image already has a background-removed version'
          : 'Image was already cleaned with AI',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.assertNoOpenJobForImage('item_image', imageId, kind);
    return this.enqueueCleanupJob({
      businessId,
      userId,
      itemId: image.item_id,
      itemVariantId: null,
      images: [
        {
          id: image.id,
          image_url: image.original_image_url || image.image_url,
          s3_key: image.original_s3_key || image.s3_key,
          content_hash: image.content_hash,
          source: 'item_image',
          kind,
          width: image.width,
          height: image.height,
          validation_warnings: image.validation_warnings,
          validation_errors: image.validation_errors,
          quality_score: image.quality_score,
        },
      ],
      source,
    });
  }

  async requestRentalImageCleanup(
    imageId: string,
    kind: AiImageCleanupKind = 'ai'
  ): Promise<{ job: AiImageCleanupJobRow; ai_tokens_remaining: number }> {
    const { businessId, userId } = await this.requireBusinessContext();
    const image = await this.loadRentalImageRow(imageId);
    if (!image || image.business_id !== businessId) {
      throw new HttpException('Image not found', HttpStatus.NOT_FOUND);
    }
    if (hasExistingVersion(image, kind)) {
      throw new HttpException(
        kind === 'rembg'
          ? 'Image already has a background-removed version'
          : 'Image was already cleaned with AI',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.assertNoOpenJobForImage('rental_image', imageId, kind);
    return this.enqueueCleanupJob({
      businessId,
      userId,
      itemId: null,
      itemVariantId: null,
      images: [
        {
          id: image.id,
          image_url: image.original_image_url || image.image_url,
          s3_key: image.original_s3_key || image.s3_key,
          content_hash: image.content_hash,
          source: 'rental_image',
          kind,
          width: image.width,
          height: image.height,
          validation_warnings: image.validation_warnings,
          validation_errors: image.validation_errors,
          quality_score: image.quality_score,
        },
      ],
      source: 'rental',
    });
  }

  private async enqueueCleanupJob(args: {
    businessId: string;
    userId: string;
    itemId: string | null;
    itemVariantId: string | null;
    images: CleanupEligibleImage[];
    source: AiImageCleanupJobSource;
    /** When false (admin moderation), skip merchant token reservation. Default true. */
    chargeTokens?: boolean;
  }): Promise<{ job: AiImageCleanupJobRow; ai_tokens_remaining: number }> {
    const {
      businessId,
      userId,
      itemId,
      itemVariantId,
      images,
      source,
      chargeTokens = true,
    } = args;
    await this.assertNoOpenKindLocks(images);
    const classified = await this.classifyByContentHash(businessId, images);
    if (!classified.toProcess.length && classified.reusable.length) {
      return this.completeReuseOnlyJob({
        businessId,
        userId,
        itemId,
        itemVariantId,
        source,
        reusable: classified.reusable,
      });
    }

    const adminModel = await this.getAdminCleanupModel();
    const needingEdit: CleanupEligibleImage[] = [];
    const skippedIneligible: CleanupEligibleImage[] = [];
    for (const img of classified.toProcess) {
      if (img.kind === 'rembg') {
        needingEdit.push(img);
        continue;
      }
      const enriched = await this.ensureValidationForCleanup(img);
      const decision = routeCleanupModel({
        adminDefaultModel: adminModel,
        issueCodes: extractValidationCodes(enriched.validation_warnings),
        errorCodes: extractValidationCodes(enriched.validation_errors),
        qualityScore: enriched.quality_score,
        width: enriched.width,
        height: enriched.height,
        explicitRequest: true,
      });
      if (decision === 'skip') {
        this.logger.log(
          `Skipping AI cleanup for image ${img.id}: not eligible`
        );
        skippedIneligible.push(enriched);
        continue;
      }
      needingEdit.push(enriched);
    }

    if (!needingEdit.length) {
      throw new HttpException(
        'Image is not eligible for AI cleanup',
        HttpStatus.BAD_REQUEST
      );
    }

    const aiCount = countAiSelections(needingEdit);
    const tokenCost =
      chargeTokens && source !== 'admin_moderation'
        ? aiCount * CLEANUP_TOKEN_COST
        : 0;
    let balanceAfter = await this.tokens.getBalance(businessId);
    if (tokenCost > 0) {
      const reserved = await this.tokens.tryReserveTokens(
        businessId,
        tokenCost
      );
      if (reserved === null) {
        throw new HttpException(
          {
            success: false,
            error:
              'No AI tokens remaining. Purchase more tokens to use image cleanup.',
            code: 'INSUFFICIENT_AI_TOKENS',
          },
          HttpStatus.PAYMENT_REQUIRED
        );
      }
      balanceAfter = reserved;
    }
    let job: AiImageCleanupJobRow | null = null;
    /** Only cancel on rollback when this request created the job (not an append). */
    let createdNewJob = false;
    let appendCompleted = false;
    try {
      const mode =
        source === 'admin_moderation' ? 'auto_apply' : 'review_all';
      const openJob = await this.findAppendableOpenJob(itemId, itemVariantId);
      if (openJob) {
        job = await this.appendResultsToOpenJob({
          openJob,
          images: needingEdit,
          skippedIneligible,
          tokenCost,
          businessId,
          userId,
          chargeTokens: tokenCost > 0,
        });
        appendCompleted = true;
      } else {
        // Re-check open job to reduce duplicate-job races under concurrency.
        const raced = await this.findAppendableOpenJob(itemId, itemVariantId);
        if (raced) {
          job = await this.appendResultsToOpenJob({
            openJob: raced,
            images: needingEdit,
            skippedIneligible,
            tokenCost,
            businessId,
            userId,
            chargeTokens: tokenCost > 0,
          });
          appendCompleted = true;
        } else {
          createdNewJob = true;
          job = await this.createJob({
            businessId,
            itemId,
            userId,
            tokensReserved: tokenCost,
            itemVariantId,
            mode,
            source,
          });
          await this.createResults(job.id, needingEdit);
          if (skippedIneligible.length) {
            await this.createIneligibleResults(job.id, skippedIneligible);
          }
          if (tokenCost > 0) {
            await this.tokens.recordCleanupUsage({
              businessId,
              userId,
              subjectType: 'ai_image_cleanup',
              subjectId: job.id,
              tokensConsumed: tokenCost,
            });
          }
          await this.queue.enqueueJob(job.id);
        }
      }
      if (classified.reusable.length) {
        try {
          await this.applyReusableEnhancements(job.id, classified.reusable);
        } catch (reuseError: any) {
          this.logger.warn(
            `Hash-reuse apply failed for job ${job.id}: ${reuseError?.message ?? reuseError}`
          );
        }
      }
      await this.trackEvent('enhancement_requested', job.id, {
        source,
        mode: job.mode ?? mode,
        image_count: needingEdit.length,
        ai_count: aiCount,
        rembg_count: needingEdit.length - aiCount,
        reused_count: classified.reusable.length,
        skipped_ineligible: skippedIneligible.length,
        charge_tokens: chargeTokens,
      });
      return { job, ai_tokens_remaining: balanceAfter };
    } catch (error: any) {
      if (createdNewJob) {
        await this.rollbackFailedRequest(businessId, tokenCost, job?.id);
      } else if (!appendCompleted) {
        // Append cleaned up its own partial inserts; refund reservation only.
        await this.rollbackFailedRequest(businessId, tokenCost);
      }
      // Append succeeded then a later step failed: keep results + tokens.
      throw error;
    }
  }

  private async findAppendableOpenJob(
    itemId: string | null,
    itemVariantId: string | null
  ): Promise<{ id: string; status: string } | null> {
    if (itemVariantId) {
      const data = await this.hasura.executeQuery<{
        ai_image_cleanup_jobs: { id: string; status: string }[];
      }>(Q.GET_OPEN_JOB_FOR_VARIANT, { variantId: itemVariantId });
      return data.ai_image_cleanup_jobs?.[0] ?? null;
    }
    if (itemId) {
      return this.findOpenJobForItem(itemId);
    }
    return null;
  }

  private async appendResultsToOpenJob(args: {
    openJob: { id: string; status: string };
    images: CleanupEligibleImage[];
    skippedIneligible: CleanupEligibleImage[];
    tokenCost: number;
    businessId: string;
    userId: string;
    chargeTokens: boolean;
  }): Promise<AiImageCleanupJobRow> {
    let createdIds: string[] = [];
    let tokensBumped = false;
    try {
      createdIds = await this.createResults(args.openJob.id, args.images);
      if (args.skippedIneligible.length) {
        const ineligibleIds = await this.createIneligibleResults(
          args.openJob.id,
          args.skippedIneligible
        );
        createdIds = createdIds.concat(ineligibleIds);
      }
      if (args.chargeTokens && args.tokenCost > 0) {
        await this.bumpJobTokens(args.openJob.id, args.tokenCost);
        tokensBumped = true;
        await this.tokens.recordCleanupUsage({
          businessId: args.businessId,
          userId: args.userId,
          subjectType: 'ai_image_cleanup',
          subjectId: args.openJob.id,
          tokensConsumed: args.tokenCost,
        });
      }
      // Always return to queued so newly appended results are claimable, even if
      // an in-flight worker still holds processing (finalize re-checks queued).
      // listPending still surfaces jobs with ready results while status is queued.
      if (
        args.openJob.status === 'ready_for_review' ||
        args.openJob.status === 'queued' ||
        args.openJob.status === 'processing'
      ) {
        await this.setJobStatus(args.openJob.id, 'queued');
        await this.queue.enqueueJob(args.openJob.id);
      }
      return this.loadJob(args.openJob.id);
    } catch (error: any) {
      if (createdIds.length) {
        await this.hasura
          .executeMutation(Q.DELETE_RESULTS_BY_IDS, { ids: createdIds })
          .catch(() => undefined);
      }
      if (tokensBumped) {
        await this.bumpJobTokens(args.openJob.id, -args.tokenCost).catch(
          () => undefined
        );
      }
      throw error;
    }
  }

  private async completeReuseOnlyJob(args: {
    businessId: string;
    userId: string;
    itemId: string | null;
    itemVariantId: string | null;
    source: AiImageCleanupJobSource;
    reusable: Array<{ img: CleanupEligibleImage; existing: VersionedImageRow }>;
  }): Promise<{ job: AiImageCleanupJobRow; ai_tokens_remaining: number }> {
    const balanceAfter = await this.tokens.getBalance(args.businessId);
    const mode =
      args.source === 'admin_moderation' ? 'auto_apply' : 'review_all';
    const job = await this.createJob({
      businessId: args.businessId,
      itemId: args.itemId,
      userId: args.userId,
      tokensReserved: 0,
      itemVariantId: args.itemVariantId,
      mode,
      source: args.source,
    });
    await this.applyReusableEnhancements(job.id, args.reusable);
    const now = new Date().toISOString();
    await this.hasura.executeMutation(Q.UPDATE_JOB, {
      id: job.id,
      _set: {
        status: 'completed',
        completed_at: now,
        updated_at: now,
      },
    });
    await this.trackEvent('enhancement_requested', job.id, {
      source: args.source,
      mode,
      image_count: 0,
      reused_count: args.reusable.length,
    });
    const completed = await this.loadJob(job.id);
    await this.maybeResumeModeration(completed);
    return { job: completed, ai_tokens_remaining: balanceAfter };
  }

  private async applyReusableEnhancements(
    jobId: string,
    reusable: Array<{ img: CleanupEligibleImage; existing: VersionedImageRow }>
  ): Promise<void> {
    const now = new Date().toISOString();
    for (const entry of reusable) {
      await this.hasura.executeMutation(Q.INSERT_RESULTS, {
        objects: [
          {
            job_id: jobId,
            business_image_id:
              entry.img.source === 'item_image' ? entry.img.id : null,
            item_variant_image_id:
              entry.img.source === 'variant_image' ? entry.img.id : null,
            rental_item_image_id:
              entry.img.source === 'rental_image' ? entry.img.id : null,
            original_image_url: entry.img.image_url,
            original_s3_key: entry.img.s3_key,
            kind: entry.img.kind,
            cleaned_image_url:
              entry.img.kind === 'rembg'
                ? entry.existing.rembg_image_url
                : entry.existing.enhanced_image_url,
            cleaned_s3_key:
              entry.img.kind === 'rembg'
                ? entry.existing.rembg_s3_key
                : entry.existing.enhanced_s3_key,
            status: 'accepted',
            confidence_tier: 'high',
            confidence_score: 1,
            changes: [
              entry.img.kind === 'rembg'
                ? 'Reused identical prior background removal'
                : 'Reused identical prior enhancement',
            ],
            applied_at: now,
            completed_at: now,
            provider: 'dedupe',
            provider_model: 'content_hash',
          },
        ],
      });
      await this.reuseEnhancement(entry.img, entry.existing);
    }
  }

  private async classifyByContentHash(
    businessId: string,
    images: CleanupEligibleImage[]
  ): Promise<{
    toProcess: CleanupEligibleImage[];
    reusable: Array<{ img: CleanupEligibleImage; existing: VersionedImageRow }>;
  }> {
    const toProcess: CleanupEligibleImage[] = [];
    const reusable: Array<{
      img: CleanupEligibleImage;
      existing: VersionedImageRow;
    }> = [];
    for (const img of images) {
      const hash =
        img.content_hash ||
        (await this.computeContentHash(img.image_url).catch(() => null));
      if (hash) {
        img.content_hash = hash;
        const existing = await this.findVersionByHash(
          businessId,
          hash,
          img.kind
        );
        const hasReuse =
          img.kind === 'rembg'
            ? !!existing?.rembg_image_url
            : !!existing?.enhanced_image_url;
        if (hasReuse && existing) {
          reusable.push({ img, existing });
          continue;
        }
      }
      toProcess.push(img);
    }
    return { toProcess, reusable };
  }

  private async reuseEnhancement(
    img: CleanupEligibleImage,
    existing: VersionedImageRow
  ): Promise<void> {
    const now = new Date().toISOString();
    const rembgUrl = existing.rembg_image_url;
    let rembgDims: { width?: number; height?: number } = {};
    if (img.kind === 'rembg' && rembgUrl) {
      if (existing.width && existing.height && existing.active_version === 'rembg') {
        rembgDims = { width: existing.width, height: existing.height };
      } else {
        const probed = await this.probeImageDimensions(rembgUrl);
        if (probed) rembgDims = probed;
      }
    }
    const patch =
      img.kind === 'rembg'
        ? {
            original_image_url: img.image_url,
            original_s3_key: img.s3_key,
            rembg_image_url: rembgUrl,
            rembg_s3_key: existing.rembg_s3_key,
            image_url: rembgUrl,
            s3_key: existing.rembg_s3_key,
            active_version: 'rembg' as const,
            is_rembg_cleaned: true,
            rembg_at: now,
            reverted_at: null,
            content_hash: img.content_hash,
            ...rembgDims,
          }
        : {
            original_image_url: img.image_url,
            original_s3_key: img.s3_key,
            enhanced_image_url: existing.enhanced_image_url,
            enhanced_s3_key: existing.enhanced_s3_key,
            image_url: existing.enhanced_image_url,
            s3_key: existing.enhanced_s3_key,
            active_version: 'enhanced' as const,
            is_ai_cleaned: true,
            enhanced_at: now,
            reverted_at: null,
            content_hash: img.content_hash,
            width: 1024,
            height: 1024,
          };
    if (img.source === 'item_image') {
      await this.hasura.executeMutation(Q.UPDATE_ITEM_IMAGE, {
        id: img.id,
        _set: patch,
      });
      void this.imageThumbnails.regenerate('item_image', img.id);
    } else if (img.source === 'variant_image') {
      await this.hasura.executeMutation(Q.UPDATE_VARIANT_IMAGE, {
        id: img.id,
        _set: patch,
      });
      void this.imageThumbnails.regenerate('item_variant_image', img.id);
    } else {
      await this.hasura.executeMutation(Q.UPDATE_RENTAL_IMAGE, {
        id: img.id,
        _set: patch,
      });
      void this.imageThumbnails.regenerate('rental_item_image', img.id);
    }
  }

  private async rollbackFailedRequest(
    businessId: string,
    tokenCost: number,
    jobId?: string
  ): Promise<void> {
    try {
      await this.tokens.refundTokens(businessId, tokenCost);
      if (jobId) {
        await this.setJobStatus(jobId, 'cancelled');
        await this.maybeResumeModeration(await this.loadJob(jobId));
      }
    } catch (rollbackError: any) {
      this.logger.error(
        `Failed to roll back cleanup request (job ${jobId ?? 'n/a'}): ${rollbackError?.message}`
      );
    }
  }

  async listPending(): Promise<{
    jobs: AiImageCleanupJobRow[];
    pendingResultCount: number;
  }> {
    const { businessId } = await this.requireBusinessContext();
    const data = await this.hasura.executeQuery<{
      ai_image_cleanup_jobs: AiImageCleanupJobRow[];
    }>(Q.GET_PENDING_JOBS, { businessId });
    const jobs = (data.ai_image_cleanup_jobs ?? []).map((job) => ({
      ...job,
      results: (job.results ?? []).filter((r) => {
        if (r.status === 'failed') return true;
        if (r.status !== 'ready') return false;
        // Hold for review: low tier, missing tier, review_all mode, or auto-apply skipped.
        if (job.mode === 'review_all') return true;
        if (!r.confidence_tier || r.confidence_tier === 'low') return true;
        if (!r.applied_at) return true;
        return false;
      }),
    }));
    const withPending = jobs.filter((j) => (j.results?.length ?? 0) > 0);
    const pendingResultCount = withPending.reduce(
      (sum, j) => sum + (j.results?.length ?? 0),
      0
    );
    return { jobs: withPending, pendingResultCount };
  }

  async listActivity(): Promise<{ results: AiImageCleanupResultRow[] }> {
    const { businessId } = await this.requireBusinessContext();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const data = await this.hasura.executeQuery<{
      ai_image_cleanup_results: AiImageCleanupResultRow[];
    }>(Q.GET_RECENT_ACTIVITY, { businessId, since });
    return { results: data.ai_image_cleanup_results ?? [] };
  }

  async getJob(jobId: string): Promise<AiImageCleanupJobRow> {
    const { businessId } = await this.requireBusinessContext();
    const job = await this.loadJob(jobId);
    this.assertJobOwned(job, businessId);
    return job;
  }

  async getAutoEnhancePreference(): Promise<{
    auto_enhance_enabled: boolean;
    ai_tokens: number;
  }> {
    const { businessId } = await this.requireBusinessContext();
    const data = await this.hasura.executeQuery<{
      businesses_by_pk: {
        auto_enhance_enabled: boolean;
        ai_tokens: number;
      } | null;
    }>(Q.GET_BUSINESS_AUTO_ENHANCE, { businessId });
    return {
      auto_enhance_enabled: data.businesses_by_pk?.auto_enhance_enabled ?? true,
      ai_tokens: data.businesses_by_pk?.ai_tokens ?? 0,
    };
  }

  async setAutoEnhancePreference(
    enabled: boolean
  ): Promise<{ auto_enhance_enabled: boolean }> {
    const { businessId } = await this.requireBusinessContext();
    const data = await this.hasura.executeMutation<{
      update_businesses_by_pk: { id: string; auto_enhance_enabled: boolean };
    }>(Q.UPDATE_BUSINESS_AUTO_ENHANCE, { id: businessId, enabled });
    await this.trackEvent(
      enabled ? 'enhancement_opted_in' : 'enhancement_opted_out',
      businessId,
      {}
    );
    return {
      auto_enhance_enabled:
        data.update_businesses_by_pk?.auto_enhance_enabled ?? enabled,
    };
  }

  async acceptResult(resultId: string): Promise<{ success: boolean }> {
    const { businessId } = await this.requireBusinessContext();
    const result = await this.loadResult(resultId);
    this.assertResultOwned(result, businessId);
    if (result.status !== 'ready') {
      throw new HttpException(
        'Result is not ready to accept',
        HttpStatus.BAD_REQUEST
      );
    }
    const applied = await this.applyEnhancement(result, { force: true });
    if (!applied) {
      throw new HttpException(
        'Could not apply enhancement (image changed or already reverted)',
        HttpStatus.CONFLICT
      );
    }
    await this.markResult(resultId, 'accepted', {
      applied_at: new Date().toISOString(),
    });
    await this.maybeCompleteJob(result.job_id);
    await this.trackEvent('enhancement_approved', resultId, {
      job_id: result.job_id,
      tier: result.confidence_tier,
    });
    return { success: true };
  }

  async revertResult(resultId: string): Promise<{ success: boolean }> {
    const { businessId } = await this.requireBusinessContext();
    const result = await this.loadResult(resultId);
    this.assertResultOwned(result, businessId);
    if (result.status !== 'accepted') {
      throw new HttpException(
        'Only accepted enhancements can be reverted',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.revertEnhancement(result);
    const now = new Date().toISOString();
    await this.hasura.executeMutation(Q.UPDATE_RESULT, {
      id: resultId,
      _set: { reverted_at: now, updated_at: now },
    });
    await this.trackEvent('enhancement_reverted', resultId, {
      job_id: result.job_id,
      tier: result.confidence_tier,
    });
    return { success: true };
  }

  async reapplyResult(resultId: string): Promise<{ success: boolean }> {
    const { businessId } = await this.requireBusinessContext();
    const result = await this.loadResult(resultId);
    this.assertResultOwned(result, businessId);
    if (result.status !== 'accepted' || !result.cleaned_image_url) {
      throw new HttpException(
        'Nothing to reapply',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.reapplyEnhancement(result);
    await this.hasura.executeMutation(Q.UPDATE_RESULT, {
      id: resultId,
      _set: {
        reverted_at: null,
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    await this.trackEvent('enhancement_reapplied', resultId, {
      job_id: result.job_id,
    });
    return { success: true };
  }

  /**
   * Pointer-flip apply: preserve original_*, set enhanced_*, flip live URL.
   * Skips if merchant already reverted or source image was replaced.
   */
  async applyEnhancement(
    result: AiImageCleanupResultRow,
    opts: { force?: boolean } = {}
  ): Promise<boolean> {
    if (!result.cleaned_image_url) return false;
    const row = await this.loadSourceImage(result);
    if (!row) return false;
    if (
      shouldSkipAutoApply({
        revertedAt: row.reverted_at,
        liveS3Key: row.s3_key,
        activeVersion: row.active_version,
        expectedOriginalKey: result.original_s3_key,
        force: opts.force,
      })
    ) {
      return false;
    }
    const patch = buildApplyPatch({
      result,
      row,
      contentHash: row.content_hash,
      now: new Date().toISOString(),
      kind: result.kind ?? 'ai',
    });
    if ((result.kind ?? 'ai') === 'rembg' && result.cleaned_image_url) {
      const dims = await this.probeImageDimensions(result.cleaned_image_url);
      if (dims) {
        (patch as { width?: number; height?: number }).width = dims.width;
        (patch as { height?: number }).height = dims.height;
      }
    }
    if (!patch.content_hash && result.original_image_url) {
      const hash = await this.computeContentHash(result.original_image_url).catch(
        () => null
      );
      if (hash) {
        (patch as { content_hash?: string }).content_hash = hash;
      }
    }
    await this.updateSourceImage(result, patch);
    this.regenerateThumb(result);
    return true;
  }

  private async revertEnhancement(
    result: AiImageCleanupResultRow
  ): Promise<void> {
    const row = await this.loadSourceImage(result);
    if (!row) {
      throw new HttpException('Source image not found', HttpStatus.NOT_FOUND);
    }
    const originalUrl = row.original_image_url || result.original_image_url;
    const originalKey =
      row.original_s3_key ?? result.original_s3_key ?? null;
    if (!originalUrl) {
      throw new HttpException('Original image missing', HttpStatus.CONFLICT);
    }
    const patch = buildRevertPatch({
      originalUrl,
      originalKey,
      now: new Date().toISOString(),
    });
    await this.updateSourceImage(result, patch);
    this.regenerateThumb(result);
  }

  private async reapplyEnhancement(
    result: AiImageCleanupResultRow
  ): Promise<void> {
    const row = await this.loadSourceImage(result);
    const kind = result.kind ?? 'ai';
    if (kind === 'rembg') {
      if (!row?.rembg_image_url && !result.cleaned_image_url) {
        throw new HttpException('Rembg image missing', HttpStatus.CONFLICT);
      }
      await this.updateSourceImage(result, {
        image_url: row?.rembg_image_url || result.cleaned_image_url,
        s3_key: row?.rembg_s3_key ?? result.cleaned_s3_key ?? null,
        active_version: 'rembg',
        reverted_at: null,
      });
    } else {
      if (!row?.enhanced_image_url && !result.cleaned_image_url) {
        throw new HttpException('Enhanced image missing', HttpStatus.CONFLICT);
      }
      await this.updateSourceImage(result, {
        image_url: row?.enhanced_image_url || result.cleaned_image_url,
        s3_key: row?.enhanced_s3_key ?? result.cleaned_s3_key ?? null,
        active_version: 'enhanced',
        reverted_at: null,
      });
    }
    this.regenerateThumb(result);
  }

  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    const { businessId } = await this.requireBusinessContext();
    const job = await this.loadJob(jobId);
    this.assertJobOwned(job, businessId);
    if (job.status !== 'ready_for_review' && job.status !== 'failed') {
      throw new HttpException(
        'Only ready or failed cleanup jobs can be cancelled',
        HttpStatus.BAD_REQUEST
      );
    }
    const now = new Date().toISOString();
    await this.hasura.executeMutation(Q.REJECT_ACTIONABLE_RESULTS, {
      jobId,
      updatedAt: now,
      completedAt: now,
    });
    const refreshed = await this.loadJob(jobId);
    const anyAccepted = (refreshed.results ?? []).some(
      (r) => r.status === 'accepted'
    );
    await this.hasura.executeMutation(Q.UPDATE_JOB, {
      id: jobId,
      _set: {
        status: anyAccepted ? 'completed' : 'cancelled',
        completed_at: now,
        updated_at: now,
      },
    });
    await this.maybeResumeModeration(await this.loadJob(jobId));
    return { success: true };
  }

  async rejectResult(resultId: string): Promise<{ success: boolean }> {
    const { businessId } = await this.requireBusinessContext();
    const result = await this.loadResult(resultId);
    this.assertResultOwned(result, businessId);
    if (result.status !== 'ready' && result.status !== 'failed') {
      throw new HttpException(
        'Result cannot be rejected',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.markResult(resultId, 'rejected');
    await this.maybeCompleteJob(result.job_id);
    await this.trackEvent('enhancement_rejected', resultId, {
      job_id: result.job_id,
      tier: result.confidence_tier,
    });
    return { success: true };
  }

  async retryResult(resultId: string): Promise<{
    success: boolean;
    result: AiImageCleanupResultRow;
    ai_tokens_remaining: number;
  }> {
    const { businessId, userId } = await this.requireBusinessContext();
    const result = await this.loadResult(resultId);
    this.assertResultOwned(result, businessId);
    if (result.status !== 'rejected' && result.status !== 'failed') {
      throw new HttpException(
        'Only rejected or failed results can be retried',
        HttpStatus.BAD_REQUEST
      );
    }
    const kind = result.kind ?? 'ai';
    const tokenCost = kind === 'ai' ? CLEANUP_TOKEN_COST : 0;
    let balanceAfter = await this.tokens.getBalance(businessId);
    if (tokenCost > 0) {
      const reserved = await this.tokens.tryReserveTokens(
        businessId,
        tokenCost
      );
      if (reserved === null) {
        throw new HttpException(
          {
            success: false,
            error: 'No AI tokens remaining.',
            code: 'INSUFFICIENT_AI_TOKENS',
          },
          HttpStatus.PAYMENT_REQUIRED
        );
      }
      balanceAfter = reserved;
    }
    const inserted = await this.insertRetryResult(result);
    if (result.status === 'failed' || result.status === 'rejected') {
      await this.markResult(result.id, 'rejected');
    }
    if (tokenCost > 0) {
      await this.tokens.recordCleanupUsage({
        businessId,
        userId,
        subjectType: 'ai_image_cleanup',
        subjectId: inserted.id,
        tokensConsumed: tokenCost,
        imageUrl: result.original_image_url,
      });
      await this.bumpJobTokens(result.job_id, tokenCost);
    }
    await this.setJobStatus(result.job_id, 'queued');
    await this.queue.enqueueJob(result.job_id);
    return { success: true, result: inserted, ai_tokens_remaining: balanceAfter };
  }

  async processJob(jobId: string): Promise<{ success: boolean }> {
    const claimed = await this.claimJob(jobId);
    if (!claimed) {
      this.logger.log(
        `Job ${jobId} not claimable (already processing or finished); skipping`
      );
      return { success: true };
    }
    const job = await this.loadJob(jobId);
    const pending = (job.results ?? []).filter((r) =>
      this.isClaimableResultStatus(r.status, r.updated_at)
    );
    let consumed = 0;
    let refunded = 0;
    for (const result of pending) {
      const tokenUnit = this.tokenUnitForResult(job, result);
      const outcome = await this.processOneResult(job, result, tokenUnit);
      if (outcome === 'ready') consumed += tokenUnit;
      if (outcome === 'failed') refunded += tokenUnit;
    }
    await this.finalizeJobAfterProcess(job, consumed, refunded);
    return { success: true };
  }

  /** Called when SQS moves a cleanup message to the DLQ after maxReceiveCount. */
  async failJobAfterQueueExhaustion(
    jobId: string,
    messageTimestamp?: string
  ): Promise<{ success: boolean }> {
    const job = await this.loadJobOrIgnore(jobId);
    if (!job) return { success: true };
    if (job.status !== 'queued' && job.status !== 'processing') {
      return { success: true };
    }
    if (this.isSupersededEnqueue(job, messageTimestamp)) {
      return { success: true };
    }
    await this.assertExclusiveForExhaustion(job);
    if (await this.hasFreshProcessingResults(jobId)) {
      throw new HttpException(
        'Cleanup results still processing',
        HttpStatus.CONFLICT
      );
    }
    const refunded = await this.failPendingResults(job);
    await this.finalizeJobAfterProcess(job, 0, refunded);
    return { success: true };
  }

  private async loadJobOrIgnore(
    jobId: string
  ): Promise<AiImageCleanupJobRow | null> {
    try {
      return await this.loadJob(jobId);
    } catch (error: any) {
      if (error instanceof HttpException && error.getStatus() === 404) {
        return null;
      }
      throw error;
    }
  }

  /** Stale DLQ must not fail a job re-queued after the original message. */
  private isSupersededEnqueue(
    job: AiImageCleanupJobRow,
    messageTimestamp?: string
  ): boolean {
    if (job.status !== 'queued' || !messageTimestamp || !job.updated_at) {
      return false;
    }
    return Date.parse(messageTimestamp) < Date.parse(job.updated_at);
  }

  private async assertExclusiveForExhaustion(
    job: AiImageCleanupJobRow
  ): Promise<void> {
    if (job.status === 'queued') return;
    const claimed = await this.claimStaleProcessingJob(job.id);
    if (!claimed) {
      throw new HttpException(
        'Cleanup job still processing',
        HttpStatus.CONFLICT
      );
    }
  }

  private async claimStaleProcessingJob(jobId: string): Promise<boolean> {
    const data = await this.hasura.executeMutation<{
      update_ai_image_cleanup_jobs: { affected_rows: number };
    }>(Q.CLAIM_STALE_PROCESSING_JOB, {
      id: jobId,
      updatedAt: new Date().toISOString(),
      staleBefore: this.exhaustionStaleBeforeIso(),
    });
    return (data.update_ai_image_cleanup_jobs?.affected_rows ?? 0) > 0;
  }

  /**
   * Longer than Lambda/SQS attempt budget so in-flight Nest /process
   * (which outlives the SQS client timeout) is not failed mid-flight.
   */
  private exhaustionStaleBeforeIso(): string {
    return new Date(Date.now() - 30 * 60 * 1000).toISOString();
  }

  private async hasFreshProcessingResults(jobId: string): Promise<boolean> {
    const job = await this.loadJob(jobId);
    const staleBefore = Date.parse(this.exhaustionStaleBeforeIso());
    return (job.results ?? []).some((r) => {
      if (r.status !== 'processing') return false;
      if (!r.updated_at) return true;
      return Date.parse(r.updated_at) >= staleBefore;
    });
  }

  private async failPendingResults(job: AiImageCleanupJobRow): Promise<number> {
    const now = new Date().toISOString();
    const data = await this.hasura.executeMutation<{
      update_ai_image_cleanup_results: {
        affected_rows: number;
        returning: Array<{ id: string; kind?: string | null }>;
      };
    }>(Q.FAIL_OPEN_RESULTS, {
      jobId: job.id,
      updatedAt: now,
      completedAt: now,
      staleBefore: this.exhaustionStaleBeforeIso(),
      errorMessage: 'Cleanup failed after queue retries',
    });
    const justFailed =
      data.update_ai_image_cleanup_results?.returning ?? [];
    if (!justFailed.length || (job.tokens_reserved ?? 0) <= 0) return 0;
    const aiFailed = justFailed.filter((r) => (r.kind ?? 'ai') === 'ai').length;
    const refunded = aiFailed * CLEANUP_TOKEN_COST;
    if (refunded <= 0) return 0;
    await this.tokens.refundTokens(job.business_id, refunded);
    return refunded;
  }

  private staleBeforeIso(): string {
    return new Date(Date.now() - 10 * 60 * 1000).toISOString();
  }

  private isClaimableResultStatus(
    status: string,
    updatedAt?: string | null
  ): boolean {
    if (status === 'queued') return true;
    if (status !== 'processing' || !updatedAt) return false;
    return new Date(updatedAt).getTime() < Date.now() - 10 * 60 * 1000;
  }

  private async claimJob(jobId: string): Promise<boolean> {
    const data = await this.hasura.executeMutation<{
      update_ai_image_cleanup_jobs: { affected_rows: number };
    }>(Q.CLAIM_JOB, {
      id: jobId,
      updatedAt: new Date().toISOString(),
      staleBefore: this.staleBeforeIso(),
    });
    return (data.update_ai_image_cleanup_jobs?.affected_rows ?? 0) > 0;
  }

  private async claimResult(resultId: string): Promise<boolean> {
    const data = await this.hasura.executeMutation<{
      update_ai_image_cleanup_results: { affected_rows: number };
    }>(Q.CLAIM_RESULT, {
      id: resultId,
      updatedAt: new Date().toISOString(),
      staleBefore: this.staleBeforeIso(),
    });
    return (data.update_ai_image_cleanup_results?.affected_rows ?? 0) > 0;
  }

  private async processOneResult(
    job: AiImageCleanupJobRow,
    result: AiImageCleanupResultRow,
    tokenUnit: number
  ): Promise<'ready' | 'failed' | 'skipped'> {
    const claimed = await this.claimResult(result.id);
    if (!claimed) return 'skipped';
    const kind = result.kind ?? 'ai';
    try {
      const uploaded =
        kind === 'rembg'
          ? await this.cleanupWithRembg(
              job.business_id,
              job.item_id ?? 'library',
              result.original_image_url
            )
          : await this.cleanupWithOpenAi(job, result);
      const assessment = await this.confidence.assess(
        result.original_image_url,
        uploaded.url
      );
      const now = new Date().toISOString();
      await this.hasura.executeMutation(Q.UPDATE_RESULT, {
        id: result.id,
        _set: {
          status: 'ready',
          cleaned_image_url: uploaded.url,
          cleaned_s3_key: uploaded.key,
          error_message: null,
          confidence_score: assessment.score,
          confidence_tier: assessment.tier,
          confidence_signals: assessment.signals,
          changes: assessment.changes,
          provider: uploaded.provider,
          provider_model:
            uploaded.provider === 'rembg' ? 'u2net' : uploaded.model,
          completed_at: now,
          updated_at: now,
        },
      });
      await this.trackEvent('enhancement_completed', result.id, {
        job_id: job.id,
        tier: assessment.tier,
        score: assessment.score,
        mode: job.mode,
        kind,
        model: uploaded.model,
      });

      const refreshed = {
        ...result,
        kind,
        cleaned_image_url: uploaded.url,
        cleaned_s3_key: uploaded.key,
        confidence_tier: assessment.tier,
      };
      if (
        job.mode === 'auto_apply' &&
        (assessment.tier === 'high' || assessment.tier === 'medium')
      ) {
        const applied = await this.applyEnhancement(refreshed);
        if (applied) {
          await this.markResult(result.id, 'accepted', {
            applied_at: now,
          });
          await this.trackEvent('enhancement_auto_applied', result.id, {
            job_id: job.id,
            tier: assessment.tier,
            kind,
          });
        } else {
          await this.trackEvent('enhancement_held_for_review', result.id, {
            job_id: job.id,
            tier: assessment.tier,
            reason: 'apply_skipped',
            kind,
          });
        }
      } else if (assessment.tier === 'low' || job.mode === 'review_all') {
        await this.trackEvent('enhancement_held_for_review', result.id, {
          job_id: job.id,
          tier: assessment.tier,
          kind,
        });
      }
      return 'ready';
    } catch (error: any) {
      this.logger.warn(
        `Cleanup failed for result ${result.id}: ${error?.message ?? error}`
      );
      await this.hasura.executeMutation(Q.UPDATE_RESULT, {
        id: result.id,
        _set: {
          status: 'failed',
          error_message: error?.message ?? 'Cleanup failed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
      if (tokenUnit > 0) {
        await this.tokens.refundTokens(job.business_id, tokenUnit);
      }
      await this.trackEvent('enhancement_failed', result.id, {
        job_id: job.id,
        error: error?.message,
        kind,
      });
      return 'failed';
    }
  }

  private async cleanupWithOpenAi(
    job: AiImageCleanupJobRow,
    result: AiImageCleanupResultRow
  ): Promise<{
    url: string;
    key: string;
    provider: 'openai';
    model: OpenAiImageCleanupModel;
  }> {
    const source = await this.loadSourceImage(result);
    const adminModel = await this.getAdminCleanupModel();
    let warningCodes = extractValidationCodes(source?.validation_warnings);
    const errorCodes = extractValidationCodes(source?.validation_errors);
    let qualityScore = source?.quality_score;
    let width = source?.width;
    let height = source?.height;
    if (!warningCodes.length && !errorCodes.length) {
      try {
        const buffer = await this.downloadImageBuffer(
          result.original_image_url
        );
        const local = await analyzeLocalImageQuality(buffer);
        warningCodes = local.issues.map((i) => i.code);
        qualityScore = qualityScore ?? local.qualityScore;
        width = width || local.width;
        height = height || local.height;
      } catch (error: any) {
        this.logger.warn(
          `Process-time local validation failed for ${result.id}: ${error?.message ?? error}`
        );
      }
    }
    const model = routeCleanupModel({
      adminDefaultModel: adminModel,
      issueCodes: warningCodes,
      errorCodes,
      qualityScore,
      width,
      height,
      explicitRequest: true,
    });
    if (model === 'skip') {
      throw new Error('Image is not eligible for AI cleanup');
    }
    const issues = this.issuesFromCodes(warningCodes);
    const uploaded = await this.cleanupAndUpload(
      job.business_id,
      job.item_id ?? 'library',
      result.original_image_url,
      { model, issues }
    );
    return { ...uploaded, provider: 'openai', model };
  }

  /** Per-result token accounting; rembg and uncharged admin jobs are 0. */
  private tokenUnitForResult(
    job: AiImageCleanupJobRow,
    result: AiImageCleanupResultRow
  ): number {
    if ((job.tokens_reserved ?? 0) <= 0) return 0;
    if ((result.kind ?? 'ai') === 'rembg') return 0;
    return CLEANUP_TOKEN_COST;
  }

  private async finalizeJobAfterProcess(
    job: AiImageCleanupJobRow,
    consumed: number,
    refunded: number
  ): Promise<void> {
    const refreshed = await this.loadJob(job.id);
    const stillPending = (refreshed.results ?? []).some((r) =>
      this.isClaimableResultStatus(r.status, r.updated_at)
    );
    const tokenPatch = {
      tokens_consumed: (job.tokens_consumed ?? 0) + consumed,
      tokens_refunded: (job.tokens_refunded ?? 0) + refunded,
      updated_at: new Date().toISOString(),
    };
    // Results appended while this run was in-flight — re-queue instead of closing.
    if (stillPending) {
      await this.hasura.executeMutation(Q.UPDATE_JOB, {
        id: job.id,
        _set: { ...tokenPatch, status: 'queued' },
      });
      await this.queue.enqueueJob(job.id);
      return;
    }
    const readyForReview = (refreshed.results ?? []).filter(
      (r) => r.status === 'ready'
    );
    const anyAccepted = (refreshed.results ?? []).some(
      (r) => r.status === 'accepted'
    );
    const anyFailed = (refreshed.results ?? []).some(
      (r) => r.status === 'failed'
    );
    let status: AiImageCleanupJobRow['status'];
    if (readyForReview.length > 0) {
      status = 'ready_for_review';
    } else if (anyAccepted) {
      status = 'completed';
    } else if (anyFailed) {
      status = 'failed';
    } else {
      status = 'completed';
    }
    const now = tokenPatch.updated_at;
    const finalized = await this.hasura.executeMutation<{
      update_ai_image_cleanup_jobs: { affected_rows: number };
    }>(Q.FINALIZE_JOB_IF_PROCESSING, {
      id: job.id,
      _set: {
        status,
        ...tokenPatch,
        ...(status === 'completed' || status === 'failed'
          ? { completed_at: now }
          : {}),
      },
    });
    if ((finalized.update_ai_image_cleanup_jobs?.affected_rows ?? 0) === 0) {
      // Append flipped job to queued (or another worker claimed) — keep going.
      await this.hasura.executeMutation(Q.UPDATE_JOB, {
        id: job.id,
        _set: tokenPatch,
      });
      const latest = await this.loadJob(job.id);
      const needsWork = (latest.results ?? []).some((r) =>
        this.isClaimableResultStatus(r.status, r.updated_at)
      );
      if (needsWork || latest.status === 'queued') {
        if (latest.status !== 'queued') {
          await this.setJobStatus(job.id, 'queued');
        }
        await this.queue.enqueueJob(job.id);
      }
      return;
    }
    const forNotify = await this.loadJob(job.id);
    const needsReview = readyForReview.length > 0;
    const autoAppliedCount = (forNotify.results ?? []).filter(
      (r) => r.status === 'accepted' && r.applied_at
    ).length;
    await this.notifyProcessed(forNotify, needsReview, autoAppliedCount);
    await this.maybeResumeModeration(forNotify);
  }

  /**
   * When cleanup is no longer open, resume AI moderation that was deferred
   * (or re-review if it already rejected on cluttered originals).
   */
  private async maybeResumeModeration(
    job: AiImageCleanupJobRow
  ): Promise<void> {
    if (['queued', 'processing', 'ready_for_review'].includes(job.status)) {
      return;
    }
    try {
      await this.resumeItemReviewIfNeeded(job);
      await this.resumeRentalReviewsIfNeeded(job);
    } catch (error: any) {
      this.logger.warn(
        `Failed to resume AI review after cleanup ${job.id}: ${error?.message}`
      );
    }
  }

  private async resumeItemReviewIfNeeded(
    job: AiImageCleanupJobRow
  ): Promise<void> {
    if (!job.item_id || job.item_variant_id) return;
    await this.itemAiReview.resumeReviewAfterCleanup(job.item_id);
  }

  private async resumeRentalReviewsIfNeeded(
    job: AiImageCleanupJobRow
  ): Promise<void> {
    const rentalItemIds = await this.rentalItemIdsForJob(job);
    for (const rentalItemId of rentalItemIds) {
      await this.rentalListingAiReview.resumeReviewsForRentalItem(rentalItemId);
    }
  }

  private async rentalItemIdsForJob(
    job: AiImageCleanupJobRow
  ): Promise<string[]> {
    const imageIds = [
      ...new Set(
        (job.results ?? [])
          .map((r) => r.rental_item_image_id)
          .filter((id): id is string => !!id)
      ),
    ];
    if (!imageIds.length) return [];
    const data = await this.hasura.executeQuery<{
      rental_item_images: Array<{ rental_item_id: string }>;
    }>(Q.GET_RENTAL_ITEM_IDS_FOR_IMAGES, { ids: imageIds });
    return [
      ...new Set(
        (data.rental_item_images ?? []).map((row) => row.rental_item_id)
      ),
    ];
  }

  private async notifyProcessed(
    job: AiImageCleanupJobRow,
    needsReview: boolean,
    autoAppliedCount: number
  ): Promise<void> {
    const data = await this.hasura.executeQuery<{
      businesses_by_pk: {
        user_id: string;
        user?: { preferred_language?: string } | null;
      } | null;
    }>(Q.GET_BUSINESS_USER, { businessId: job.business_id });
    const userId = data.businesses_by_pk?.user_id;
    if (!userId) return;
    const lang =
      data.businesses_by_pk?.user?.preferred_language?.toLowerCase() ?? 'en';
    const isFr = lang.startsWith('fr');
    const itemName =
      job.item_variant?.name ??
      job.item?.name ??
      (isFr ? 'votre article' : 'your item');
    const readyResults = (job.results ?? []).filter((r) => r.status === 'ready');
    const onlyRembg =
      readyResults.length > 0 &&
      readyResults.every((r) => (r.kind ?? 'ai') === 'rembg');
    let title: string;
    let body: string;
    let type: string;
    if (needsReview) {
      const readyCount = readyResults.length;
      title = isFr ? 'Photos à examiner' : 'Photos need review';
      body = isFr
        ? onlyRembg
          ? `${readyCount} photo(s) sans fond prêtes à examiner pour « ${itemName} ».`
          : `${readyCount} photo(s) nécessitent votre avis pour « ${itemName} ».`
        : onlyRembg
          ? `${readyCount} background-removed photo(s) ready to review for “${itemName}”.`
          : `${readyCount} photo(s) need your review for “${itemName}”.`;
      type = 'ai_image_cleanup_ready';
    } else if (autoAppliedCount > 0) {
      title = isFr ? 'Photos mises à jour' : 'Photos updated';
      body = isFr
        ? `${autoAppliedCount} photo(s) mises à jour pour « ${itemName} ».`
        : `${autoAppliedCount} photo(s) updated for “${itemName}”.`;
      type = 'ai_image_cleanup_applied';
    } else {
      title = isFr
        ? 'Échec du traitement des photos'
        : 'Photo processing failed';
      const refundedAny = (job.tokens_refunded ?? 0) > 0;
      if (refundedAny) {
        body = isFr
          ? `Le traitement des photos a échoué pour « ${itemName} ». Vos jetons ont été remboursés.`
          : `Photo processing failed for “${itemName}”. Your tokens were refunded.`;
      } else {
        body = isFr
          ? `Le traitement des photos a échoué pour « ${itemName} ».`
          : `Photo processing failed for “${itemName}”.`;
      }
      type = 'ai_image_cleanup_ready';
    }
    try {
      await this.notifications.sendAiImageCleanupReadyPush({
        userId,
        title,
        body,
        data: {
          type,
          jobId: job.id,
          itemId: job.item_id ?? '',
          ...(job.item_variant_id ? { variantId: job.item_variant_id } : {}),
          url: `/business/items/ai-image-cleanup/${job.id}`,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Cleanup ready push failed: ${error?.message}`);
    }
  }

  private async cleanupAndUpload(
    businessId: string,
    itemId: string,
    imageUrl: string,
    options: {
      model: OpenAiImageCleanupModel;
      issues?: CleanupProductImageIssue[];
    }
  ): Promise<{ url: string; key: string }> {
    const cleaned = await this.aiService.cleanupProductImage({
      imageUrl,
      model: options.model,
      issues: options.issues,
    });
    const buffer = Buffer.from(cleaned.b64_json, 'base64');
    const bucket =
      this.awsService.getDefaultBucketName() ||
      process.env.S3_BUCKET_NAME ||
      'rendasua-uploads';
    const region = this.configService.get('aws')?.region || 'ca-central-1';
    const key = `businesses/${businessId}/ai-cleanup/${itemId}/${Date.now()}.jpg`;
    await this.awsService.getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
      })
    );
    return {
      url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
      key,
    };
  }

  /** Process image cleanup using REMBG Lambda only (no OpenAI fallback). */
  private async cleanupWithRembg(
    businessId: string,
    itemId: string,
    imageUrl: string
  ): Promise<{ url: string; key: string; provider: 'rembg'; model: 'u2net' }> {
    const { data } = await axios.get<ArrayBuffer>(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 25000,
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
    });

    // Downscale before invoke: smaller payload + faster u2net inference.
    const jpegBuffer = await sharp(Buffer.from(data))
      .rotate()
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    const result = await this.rembgCleanup.removeBackground({
      imageBase64: jpegBuffer.toString('base64'),
      format: 'jpeg',
    });

    if (!result.success || !result.imageBase64) {
      throw new Error(result.error || 'REMBG processing failed');
    }

    const buffer = Buffer.from(result.imageBase64, 'base64');
    const bucket =
      this.awsService.getDefaultBucketName() ||
      process.env.S3_BUCKET_NAME ||
      'rendasua-uploads';
    const region = this.configService.get('aws')?.region || 'ca-central-1';
    const key = `businesses/${businessId}/rembg-cleanup/${itemId}/${Date.now()}.jpg`;

    await this.awsService.getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
      })
    );

    return {
      url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
      key,
      provider: 'rembg',
      model: 'u2net',
    };
  }

  private async getAdminCleanupModel(): Promise<OpenAiImageCleanupModel> {
    try {
      const res = await this.hasura.executeQuery<{
        application_configurations: Array<{ string_value?: string | null }>;
      }>(
        `query OpenAiImageCleanupModel($key: String!) {
          application_configurations(
            where: {
              config_key: { _eq: $key }
              status: { _eq: "active" }
            }
            limit: 1
          ) { string_value }
        }`,
        { key: OPENAI_IMAGE_CLEANUP_MODEL_CONFIG_KEY }
      );
      return parseOpenAiImageCleanupModel(
        res.application_configurations?.[0]?.string_value
      );
    } catch (error: any) {
      this.logger.warn(
        `getAdminCleanupModel: ${error?.message ?? String(error)}`
      );
      return DEFAULT_OPENAI_IMAGE_CLEANUP_MODEL;
    }
  }

  private async ensureValidationForCleanup(
    img: CleanupEligibleImage
  ): Promise<CleanupEligibleImage> {
    const warningCodes = extractValidationCodes(img.validation_warnings);
    const errorCodes = extractValidationCodes(img.validation_errors);
    const hasStoredIssues = warningCodes.length > 0 || errorCodes.length > 0;
    if (hasStoredIssues && img.quality_score != null) {
      return img;
    }
    try {
      const buffer = await this.downloadImageBuffer(img.image_url);
      const local = await analyzeLocalImageQuality(buffer);
      const next: CleanupEligibleImage = {
        ...img,
        width: local.width || img.width,
        height: local.height || img.height,
        validation_warnings:
          warningCodes.length > 0 ? img.validation_warnings : local.issues,
        quality_score: img.quality_score ?? local.qualityScore,
      };
      if (warningCodes.length === 0) {
        await this.persistLocalValidation(
          next,
          local.issues,
          local.qualityScore
        );
      }
      return next;
    } catch (error: any) {
      this.logger.warn(
        `Local validation failed for ${img.id}: ${error?.message ?? error}`
      );
      return img;
    }
  }

  private async persistLocalValidation(
    img: CleanupEligibleImage,
    issues: CleanupProductImageIssue[],
    qualityScore: number
  ): Promise<void> {
    // Variant images have no validation_* columns; keep routing data in-memory only.
    if (img.source === 'variant_image') {
      return;
    }
    const patch = {
      validation_warnings: issues,
      quality_score: qualityScore,
      width: img.width,
      height: img.height,
      validated_at: new Date().toISOString(),
    };
    if (img.source === 'rental_image') {
      await this.hasura.executeMutation(Q.UPDATE_RENTAL_IMAGE, {
        id: img.id,
        _set: patch,
      });
      return;
    }
    await this.hasura.executeMutation(Q.UPDATE_ITEM_IMAGE, {
      id: img.id,
      _set: patch,
    });
  }

  private async downloadImageBuffer(url: string): Promise<Buffer> {
    const { data, status } = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 25000,
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
      validateStatus: (s) => s === 200,
    });
    if (status !== 200 || !data) {
      throw new Error('Could not download image for local validation');
    }
    return Buffer.from(data);
  }

  private issuesFromCodes(codes: string[]): CleanupProductImageIssue[] {
    return codes.map((code) => ({ code }));
  }

  private mapVersionedToEligible(
    img: VersionedImageRow,
    source: CleanupEligibleImage['source'],
    kind: AiImageCleanupKind
  ): CleanupEligibleImage {
    return {
      id: img.id,
      image_url: img.original_image_url || img.image_url,
      s3_key: img.original_s3_key || img.s3_key,
      content_hash: img.content_hash,
      source,
      kind,
      width: img.width,
      height: img.height,
      validation_warnings: img.validation_warnings,
      validation_errors: img.validation_errors,
      quality_score: img.quality_score,
    };
  }

  private async requireBusinessContext(): Promise<{
    businessId: string;
    userId: string;
  }> {
    const user = await this.hasuraUser.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException(
        'Business profile required',
        HttpStatus.FORBIDDEN
      );
    }
    return { businessId: user.business.id, userId: user.id };
  }

  private async loadItemBusiness(
    itemId: string
  ): Promise<{ businessId: string }> {
    const data = await this.hasura.executeQuery<{
      items_by_pk: { id: string; business_id: string } | null;
    }>(
      `query($id: uuid!) { items_by_pk(id: $id) { id business_id } }`,
      { id: itemId }
    );
    if (!data.items_by_pk?.business_id) {
      throw new HttpException('Item not found', HttpStatus.NOT_FOUND);
    }
    return { businessId: data.items_by_pk.business_id };
  }

  /** Public check used by AI proposal UI to hide cleanup CTA when a job is open. */
  async getOpenJobForItem(
    itemId: string
  ): Promise<{ open: boolean; jobId: string | null; status: string | null }> {
    const { businessId } = await this.requireBusinessContext();
    const data = await this.hasura.executeQuery<{
      items_by_pk: { id: string; business_id: string } | null;
    }>(
      `query($id: uuid!) { items_by_pk(id: $id) { id business_id } }`,
      { id: itemId }
    );
    if (!data.items_by_pk || data.items_by_pk.business_id !== businessId) {
      throw new HttpException('Item not found', HttpStatus.NOT_FOUND);
    }
    const open = await this.findOpenJobForItem(itemId);
    return {
      open: !!open,
      jobId: open?.id ?? null,
      status: open?.status ?? null,
    };
  }

  private async findOpenJobForItem(
    itemId: string
  ): Promise<{ id: string; status: string } | null> {
    const data = await this.hasura.executeQuery<{
      ai_image_cleanup_jobs: { id: string; status: string }[];
    }>(Q.GET_OPEN_JOB_FOR_ITEM, { itemId });
    return data.ai_image_cleanup_jobs?.[0] ?? null;
  }

  private async assertNoOpenKindLocks(
    images: CleanupEligibleImage[]
  ): Promise<void> {
    for (const img of images) {
      await this.assertNoOpenJobForImage(img.source, img.id, img.kind);
    }
  }

  private async assertNoOpenJobForImage(
    source: CleanupEligibleImage['source'],
    imageId: string,
    kind: AiImageCleanupKind
  ): Promise<void> {
    const query =
      source === 'item_image'
        ? Q.GET_OPEN_JOB_FOR_ITEM_IMAGE
        : source === 'variant_image'
          ? Q.GET_OPEN_JOB_FOR_VARIANT_IMAGE
          : Q.GET_OPEN_JOB_FOR_RENTAL_IMAGE;
    const data = await this.hasura.executeQuery<{
      ai_image_cleanup_results: { id: string }[];
    }>(query, { imageId, kind });
    if (data.ai_image_cleanup_results?.length) {
      throw new HttpException(
        `A ${kind} cleanup job is already in progress for this image`,
        HttpStatus.CONFLICT
      );
    }
  }

  private async loadEligibleItemImages(
    itemId: string,
    businessId: string,
    selections: CleanupImageSelection[] | null
  ): Promise<CleanupEligibleImage[]> {
    const data = await this.hasura.executeQuery<{
      items_by_pk: { id: string; business_id: string } | null;
      item_images: Array<
        VersionedImageRow & { item_id: string; business_id: string }
      >;
    }>(Q.GET_ITEM_IMAGES, { itemId, businessId });
    if (!data.items_by_pk || data.items_by_pk.business_id !== businessId) {
      throw new HttpException('Item not found', HttpStatus.NOT_FOUND);
    }
    const rows = data.item_images ?? [];
    const planned: CleanupImageSelection[] =
      selections ??
      rows.map((r) => ({ imageId: r.id, kind: 'ai' as const }));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const images: CleanupEligibleImage[] = [];
    for (const sel of planned) {
      const row = byId.get(sel.imageId);
      if (!row) continue;
      if (hasExistingVersion(row, sel.kind)) continue;
      images.push(this.mapVersionedToEligible(row, 'item_image', sel.kind));
    }
    if (!images.length) {
      throw new HttpException(
        'No eligible images to clean',
        HttpStatus.BAD_REQUEST
      );
    }
    return images;
  }

  private async loadEligibleVariantImages(
    variantId: string,
    businessId: string,
    selections: CleanupImageSelection[] | null
  ): Promise<{ itemId: string; images: CleanupEligibleImage[] }> {
    const data = await this.hasura.executeQuery<{
      item_variants_by_pk: {
        id: string;
        item_id: string;
        item: { id: string; business_id: string } | null;
      } | null;
      item_variant_images: VersionedImageRow[];
    }>(Q.GET_VARIANT_IMAGES, { variantId });
    const variant = data.item_variants_by_pk;
    if (!variant?.item || variant.item.business_id !== businessId) {
      throw new HttpException('Variant not found', HttpStatus.NOT_FOUND);
    }
    const rows = data.item_variant_images ?? [];
    const planned: CleanupImageSelection[] =
      selections ??
      rows.map((r) => ({ imageId: r.id, kind: 'ai' as const }));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const images: CleanupEligibleImage[] = [];
    for (const sel of planned) {
      const row = byId.get(sel.imageId);
      if (!row) continue;
      if (hasExistingVersion(row, sel.kind)) continue;
      images.push(this.mapVersionedToEligible(row, 'variant_image', sel.kind));
    }
    if (!images.length) {
      throw new HttpException(
        'No eligible images to clean',
        HttpStatus.BAD_REQUEST
      );
    }
    return { itemId: variant.item_id, images };
  }

  private async createJob(args: {
    businessId: string;
    itemId: string | null;
    userId: string;
    tokensReserved: number;
    itemVariantId: string | null;
    mode: AiImageCleanupJobMode;
    source: AiImageCleanupJobSource;
  }): Promise<AiImageCleanupJobRow> {
    const data = await this.hasura.executeMutation<{
      insert_ai_image_cleanup_jobs_one: AiImageCleanupJobRow;
    }>(Q.INSERT_JOB, {
      object: {
        business_id: args.businessId,
        item_id: args.itemId,
        item_variant_id: args.itemVariantId,
        requested_by_user_id: args.userId,
        status: 'queued',
        tokens_reserved: args.tokensReserved,
        mode: args.mode,
        source: args.source,
      },
    });
    return data.insert_ai_image_cleanup_jobs_one;
  }

  private async createResults(
    jobId: string,
    images: CleanupEligibleImage[]
  ): Promise<string[]> {
    const data = await this.hasura.executeMutation<{
      insert_ai_image_cleanup_results: { returning: { id: string }[] };
    }>(Q.INSERT_RESULTS, {
      objects: images.map((img) => ({
        job_id: jobId,
        business_image_id: img.source === 'item_image' ? img.id : null,
        item_variant_image_id: img.source === 'variant_image' ? img.id : null,
        rental_item_image_id: img.source === 'rental_image' ? img.id : null,
        kind: img.kind,
        original_image_url: img.image_url,
        original_s3_key: img.s3_key,
        status: 'queued',
      })),
    });
    return (
      data.insert_ai_image_cleanup_results?.returning?.map((r) => r.id) ?? []
    );
  }

  private async createIneligibleResults(
    jobId: string,
    images: CleanupEligibleImage[]
  ): Promise<string[]> {
    const now = new Date().toISOString();
    const data = await this.hasura.executeMutation<{
      insert_ai_image_cleanup_results: { returning: { id: string }[] };
    }>(Q.INSERT_RESULTS, {
      objects: images.map((img) => ({
        job_id: jobId,
        business_image_id: img.source === 'item_image' ? img.id : null,
        item_variant_image_id: img.source === 'variant_image' ? img.id : null,
        rental_item_image_id: img.source === 'rental_image' ? img.id : null,
        kind: img.kind,
        original_image_url: img.image_url,
        original_s3_key: img.s3_key,
        status: 'failed',
        error_message: 'Image is not eligible for AI cleanup',
        provider: 'skip',
        provider_model: 'ineligible',
        completed_at: now,
      })),
    });
    return (
      data.insert_ai_image_cleanup_results?.returning?.map((r) => r.id) ?? []
    );
  }

  private async loadJob(jobId: string): Promise<AiImageCleanupJobRow> {
    const data = await this.hasura.executeQuery<{
      ai_image_cleanup_jobs_by_pk: AiImageCleanupJobRow | null;
    }>(Q.GET_JOB_WITH_RESULTS, { id: jobId });
    if (!data.ai_image_cleanup_jobs_by_pk) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
    return data.ai_image_cleanup_jobs_by_pk;
  }

  private async loadResult(
    resultId: string
  ): Promise<AiImageCleanupResultRow & { job: AiImageCleanupJobRow }> {
    const data = await this.hasura.executeQuery<{
      ai_image_cleanup_results_by_pk:
        | (AiImageCleanupResultRow & { job: AiImageCleanupJobRow })
        | null;
    }>(Q.GET_RESULT, { id: resultId });
    if (!data.ai_image_cleanup_results_by_pk) {
      throw new HttpException('Result not found', HttpStatus.NOT_FOUND);
    }
    return data.ai_image_cleanup_results_by_pk;
  }

  private assertJobOwned(job: AiImageCleanupJobRow, businessId: string): void {
    if (job.business_id !== businessId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  private assertResultOwned(
    result: AiImageCleanupResultRow & { job: AiImageCleanupJobRow },
    businessId: string
  ): void {
    if (result.job.business_id !== businessId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  private async markResult(
    resultId: string,
    status: AiImageCleanupResultRow['status'],
    extra: Record<string, unknown> = {}
  ): Promise<void> {
    await this.hasura.executeMutation(Q.UPDATE_RESULT, {
      id: resultId,
      _set: {
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'accepted' || status === 'rejected'
          ? { completed_at: new Date().toISOString() }
          : {}),
        ...extra,
      },
    });
  }

  private async setJobStatus(
    jobId: string,
    status: AiImageCleanupJobRow['status']
  ): Promise<void> {
    await this.hasura.executeMutation(Q.UPDATE_JOB, {
      id: jobId,
      _set: { status, updated_at: new Date().toISOString() },
    });
  }

  private async maybeCompleteJob(jobId: string): Promise<void> {
    const job = await this.loadJob(jobId);
    const open = (job.results ?? []).some((r) =>
      ['queued', 'processing', 'ready', 'failed'].includes(r.status)
    );
    if (open) return;
    await this.hasura.executeMutation(Q.UPDATE_JOB, {
      id: jobId,
      _set: {
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    await this.maybeResumeModeration(await this.loadJob(jobId));
  }

  private async insertRetryResult(
    result: AiImageCleanupResultRow
  ): Promise<AiImageCleanupResultRow> {
    const data = await this.hasura.executeMutation<{
      insert_ai_image_cleanup_results: {
        returning: AiImageCleanupResultRow[];
      };
    }>(Q.INSERT_RESULTS, {
      objects: [
        {
          job_id: result.job_id,
          business_image_id: result.business_image_id,
          item_variant_image_id: result.item_variant_image_id,
          rental_item_image_id: result.rental_item_image_id ?? null,
          kind: result.kind ?? 'ai',
          original_image_url: result.original_image_url,
          original_s3_key: result.original_s3_key,
          status: 'queued',
          retry_of_result_id: result.id,
        },
      ],
    });
    return data.insert_ai_image_cleanup_results.returning[0];
  }

  private async bumpJobTokens(jobId: string, amount: number): Promise<void> {
    const job = await this.loadJob(jobId);
    await this.hasura.executeMutation(Q.UPDATE_JOB, {
      id: jobId,
      _set: {
        tokens_reserved: job.tokens_reserved + amount,
        updated_at: new Date().toISOString(),
      },
    });
  }

  private async loadItemImageRow(
    id: string
  ): Promise<(VersionedImageRow & { item_id: string | null; business_id: string }) | null> {
    const data = await this.hasura.executeQuery<{
      item_images_by_pk:
        | (VersionedImageRow & {
            item_id: string | null;
            business_id: string;
          })
        | null;
    }>(Q.GET_ITEM_IMAGE_BY_ID, { id });
    return data.item_images_by_pk;
  }

  private async loadRentalImageRow(
    id: string
  ): Promise<(VersionedImageRow & { business_id: string }) | null> {
    const data = await this.hasura.executeQuery<{
      rental_item_images_by_pk:
        | (VersionedImageRow & { business_id: string })
        | null;
    }>(Q.GET_RENTAL_IMAGE_BY_ID, { id });
    return data.rental_item_images_by_pk;
  }

  private async loadSourceImage(
    result: AiImageCleanupResultRow
  ): Promise<VersionedImageRow | null> {
    if (result.item_variant_image_id) {
      const data = await this.hasura.executeQuery<{
        item_variant_images_by_pk: VersionedImageRow | null;
      }>(
        `query($id: uuid!) { item_variant_images_by_pk(id: $id) { ${Q.VERSION_IMAGE_FIELDS} } }`,
        { id: result.item_variant_image_id }
      );
      return data.item_variant_images_by_pk;
    }
    if (result.rental_item_image_id) {
      return this.loadRentalImageRow(result.rental_item_image_id);
    }
    if (result.business_image_id) {
      return this.loadItemImageRow(result.business_image_id);
    }
    return null;
  }

  private async updateSourceImage(
    result: AiImageCleanupResultRow,
    patch: Record<string, unknown>
  ): Promise<void> {
    if (result.item_variant_image_id) {
      await this.hasura.executeMutation(Q.UPDATE_VARIANT_IMAGE, {
        id: result.item_variant_image_id,
        _set: patch,
      });
      return;
    }
    if (result.rental_item_image_id) {
      await this.hasura.executeMutation(Q.UPDATE_RENTAL_IMAGE, {
        id: result.rental_item_image_id,
        _set: patch,
      });
      return;
    }
    if (result.business_image_id) {
      await this.hasura.executeMutation(Q.UPDATE_ITEM_IMAGE, {
        id: result.business_image_id,
        _set: patch,
      });
      return;
    }
    throw new HttpException('Result has no source image', HttpStatus.BAD_REQUEST);
  }

  private regenerateThumb(result: AiImageCleanupResultRow): void {
    if (result.item_variant_image_id) {
      void this.imageThumbnails.regenerate(
        'item_variant_image',
        result.item_variant_image_id
      );
    } else if (result.rental_item_image_id) {
      void this.imageThumbnails.regenerate(
        'rental_item_image',
        result.rental_item_image_id
      );
    } else if (result.business_image_id) {
      void this.imageThumbnails.regenerate(
        'item_image',
        result.business_image_id
      );
    }
  }

  private async findVersionByHash(
    businessId: string,
    contentHash: string,
    kind: AiImageCleanupKind
  ): Promise<VersionedImageRow | null> {
    const data = await this.hasura.executeQuery<{
      item_images: VersionedImageRow[];
    }>(
      kind === 'rembg' ? Q.FIND_REMBG_BY_HASH : Q.FIND_ENHANCED_BY_HASH,
      { businessId, contentHash }
    );
    return data.item_images?.[0] ?? null;
  }

  private async computeContentHash(imageUrl: string): Promise<string> {
    const res = await axios.get<ArrayBuffer>(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 25 * 1024 * 1024,
    });
    return createHash('sha256').update(Buffer.from(res.data)).digest('hex');
  }

  private async probeImageDimensions(
    imageUrl: string
  ): Promise<{ width: number; height: number } | null> {
    try {
      const res = await axios.get<ArrayBuffer>(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 25 * 1024 * 1024,
      });
      const meta = await sharp(Buffer.from(res.data)).metadata();
      if (!meta.width || !meta.height) return null;
      return { width: meta.width, height: meta.height };
    } catch {
      return null;
    }
  }

  private async trackEvent(
    eventType: string,
    subjectId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.hasura.executeMutation(Q.INSERT_SITE_EVENT, {
        object: {
          event_type: eventType,
          subject_type: 'ai_image_cleanup',
          subject_id: subjectId,
          metadata,
          viewer_type: 'system',
          viewer_id: 'ai-image-cleanup',
        },
      });
    } catch (error: any) {
      this.logger.warn(`Analytics event ${eventType} failed: ${error?.message}`);
    }
  }

  async setImageActiveVersion(
    source: CleanupEligibleImage['source'],
    imageId: string,
    version: ImageActiveVersion
  ): Promise<{ image: VersionedImageRow }> {
    const { businessId } = await this.requireBusinessContext();
    const row = await this.loadOwnedVersionedImage(source, imageId, businessId);
    const originalUrl = row.original_image_url || row.image_url;
    if (!originalUrl) {
      throw new HttpException('Original image missing', HttpStatus.CONFLICT);
    }
    try {
      const patch = buildSelectVersionPatch({
        version,
        originalUrl,
        originalKey: row.original_s3_key ?? row.s3_key,
        rembgUrl: row.rembg_image_url ?? null,
        rembgKey: row.rembg_s3_key ?? null,
        enhancedUrl: row.enhanced_image_url ?? null,
        enhancedKey: row.enhanced_s3_key ?? null,
      });
      await this.updateImageBySource(source, imageId, patch);
      this.regenerateThumbBySource(source, imageId);
      const updated = await this.loadOwnedVersionedImage(
        source,
        imageId,
        businessId
      );
      return { image: updated };
    } catch (error: any) {
      throw new HttpException(
        error?.message || 'Cannot select image version',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async loadOwnedVersionedImage(
    source: CleanupEligibleImage['source'],
    imageId: string,
    businessId: string
  ): Promise<VersionedImageRow> {
    if (source === 'item_image') {
      const row = await this.loadItemImageRow(imageId);
      if (!row || row.business_id !== businessId) {
        throw new HttpException('Image not found', HttpStatus.NOT_FOUND);
      }
      return row;
    }
    if (source === 'rental_image') {
      const row = await this.loadRentalImageRow(imageId);
      if (!row || row.business_id !== businessId) {
        throw new HttpException('Image not found', HttpStatus.NOT_FOUND);
      }
      return row;
    }
    const data = await this.hasura.executeQuery<{
      item_variant_images_by_pk:
        | (VersionedImageRow & {
            item_variant?: { item?: { business_id?: string } | null } | null;
          })
        | null;
    }>(
      `query($id: uuid!) {
        item_variant_images_by_pk(id: $id) {
          ${Q.VERSION_IMAGE_FIELDS}
          item_variant { item { business_id } }
        }
      }`,
      { id: imageId }
    );
    const row = data.item_variant_images_by_pk;
    if (!row || row.item_variant?.item?.business_id !== businessId) {
      throw new HttpException('Image not found', HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async updateImageBySource(
    source: CleanupEligibleImage['source'],
    imageId: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    if (source === 'item_image') {
      await this.hasura.executeMutation(Q.UPDATE_ITEM_IMAGE, {
        id: imageId,
        _set: patch,
      });
      return;
    }
    if (source === 'rental_image') {
      await this.hasura.executeMutation(Q.UPDATE_RENTAL_IMAGE, {
        id: imageId,
        _set: patch,
      });
      return;
    }
    await this.hasura.executeMutation(Q.UPDATE_VARIANT_IMAGE, {
      id: imageId,
      _set: patch,
    });
  }

  private regenerateThumbBySource(
    source: CleanupEligibleImage['source'],
    imageId: string
  ): void {
    if (source === 'item_image') {
      void this.imageThumbnails.regenerate('item_image', imageId);
    } else if (source === 'rental_image') {
      void this.imageThumbnails.regenerate('rental_item_image', imageId);
    } else {
      void this.imageThumbnails.regenerate('item_variant_image', imageId);
    }
  }

  /** Exposed for unit tests: tier computation without I/O. */
  computeTierForTest(
    signals: Parameters<EnhancementConfidenceService['computeTier']>[0]
  ): AiImageCleanupConfidenceTier {
    return this.confidence.computeTier(signals);
  }
}
