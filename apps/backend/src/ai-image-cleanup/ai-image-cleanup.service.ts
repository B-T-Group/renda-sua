import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { AiService } from '../ai/ai.service';
import { AwsService } from '../aws/aws.service';
import { CLEANUP_TOKEN_COST } from '../business-tokens/business-tokens.packs';
import { BusinessTokensService } from '../business-tokens/business-tokens.service';
import { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { ImageThumbnailsService } from '../image-thumbnails/image-thumbnails.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isActivePersona } from '../users/persona.util';
import { AiImageCleanupQueueService } from './ai-image-cleanup-queue.service';
import * as Q from './ai-image-cleanup.queries';
import type {
  AiImageCleanupJobRow,
  AiImageCleanupResultRow,
  CleanupEligibleImage,
} from './ai-image-cleanup.types';

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
    private readonly imageThumbnails: ImageThumbnailsService
  ) {}

  onModuleInit(): void {
    this.queue.registerLocalHandler(async (jobId) => {
      await this.processJob(jobId);
    });
  }

  async requestCleanup(
    itemId: string,
    imageIds?: string[]
  ): Promise<{ job: AiImageCleanupJobRow; ai_tokens_remaining: number }> {
    const { businessId, userId } = await this.requireBusinessContext();
    await this.assertNoOpenJobForItem(itemId);
    const images = await this.loadEligibleItemImages(
      itemId,
      businessId,
      imageIds
    );
    return this.enqueueCleanupJob({
      businessId,
      userId,
      itemId,
      itemVariantId: null,
      images,
    });
  }

  async requestVariantCleanup(
    variantId: string,
    imageIds?: string[]
  ): Promise<{ job: AiImageCleanupJobRow; ai_tokens_remaining: number }> {
    const { businessId, userId } = await this.requireBusinessContext();
    await this.assertNoOpenJobForVariant(variantId);
    const { itemId, images } = await this.loadEligibleVariantImages(
      variantId,
      businessId,
      imageIds
    );
    return this.enqueueCleanupJob({
      businessId,
      userId,
      itemId,
      itemVariantId: variantId,
      images,
    });
  }

  private async enqueueCleanupJob(args: {
    businessId: string;
    userId: string;
    itemId: string;
    itemVariantId: string | null;
    images: CleanupEligibleImage[];
  }): Promise<{ job: AiImageCleanupJobRow; ai_tokens_remaining: number }> {
    const { businessId, userId, itemId, itemVariantId, images } = args;
    const tokenCost = images.length * CLEANUP_TOKEN_COST;
    const balanceAfter = await this.tokens.tryReserveTokens(
      businessId,
      tokenCost
    );
    if (balanceAfter === null) {
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
    let job: AiImageCleanupJobRow | null = null;
    try {
      job = await this.createJob(
        businessId,
        itemId,
        userId,
        tokenCost,
        itemVariantId
      );
      await this.createResults(job.id, images);
      await this.tokens.recordCleanupUsage({
        businessId,
        userId,
        subjectType: 'ai_image_cleanup',
        subjectId: job.id,
        tokensConsumed: tokenCost,
      });
      await this.queue.enqueueJob(job.id);
      return { job, ai_tokens_remaining: balanceAfter };
    } catch (error: any) {
      await this.rollbackFailedRequest(businessId, tokenCost, job?.id);
      throw error;
    }
  }

  /** Refund reserved tokens (and cancel the job if created) when setup fails. */
  private async rollbackFailedRequest(
    businessId: string,
    tokenCost: number,
    jobId?: string
  ): Promise<void> {
    try {
      await this.tokens.refundTokens(businessId, tokenCost);
      if (jobId) {
        await this.setJobStatus(jobId, 'cancelled');
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
    const jobs = data.ai_image_cleanup_jobs ?? [];
    const pendingResultCount = jobs.reduce(
      (sum, j) => sum + (j.results?.length ?? 0),
      0
    );
    return { jobs, pendingResultCount };
  }

  async getJob(jobId: string): Promise<AiImageCleanupJobRow> {
    const { businessId } = await this.requireBusinessContext();
    const job = await this.loadJob(jobId);
    this.assertJobOwned(job, businessId);
    return job;
  }

  async acceptResult(resultId: string): Promise<{ success: boolean }> {
    const { businessId } = await this.requireBusinessContext();
    const result = await this.loadResult(resultId);
    this.assertResultOwned(result, businessId);
    if (result.status !== 'ready') {
      throw new HttpException('Result is not ready to accept', HttpStatus.BAD_REQUEST);
    }
    if (!result.cleaned_image_url) {
      throw new HttpException('No cleaned image available', HttpStatus.BAD_REQUEST);
    }
    const patch = {
      image_url: result.cleaned_image_url,
      s3_key: result.cleaned_s3_key,
      is_ai_cleaned: true,
    };
    if (result.item_variant_image_id) {
      await this.hasura.executeMutation(Q.UPDATE_VARIANT_IMAGE, {
        id: result.item_variant_image_id,
        _set: patch,
      });
      void this.imageThumbnails.regenerate(
        'item_variant_image',
        result.item_variant_image_id
      );
    } else if (result.business_image_id) {
      await this.hasura.executeMutation(Q.UPDATE_ITEM_IMAGE, {
        id: result.business_image_id,
        _set: patch,
      });
      void this.imageThumbnails.regenerate('item_image', result.business_image_id);
    } else {
      throw new HttpException('Result has no source image', HttpStatus.BAD_REQUEST);
    }
    await this.markResult(resultId, 'accepted');
    await this.maybeCompleteJob(result.job_id);
    return { success: true };
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
    // Accepted results stay applied; if any exist, mark completed rather than
    // cancelled so history reflects that some cleaned images were kept.
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
    return { success: true };
  }

  async rejectResult(resultId: string): Promise<{ success: boolean }> {
    const { businessId } = await this.requireBusinessContext();
    const result = await this.loadResult(resultId);
    this.assertResultOwned(result, businessId);
    if (result.status !== 'ready' && result.status !== 'failed') {
      throw new HttpException('Result cannot be rejected', HttpStatus.BAD_REQUEST);
    }
    await this.markResult(resultId, 'rejected');
    await this.maybeCompleteJob(result.job_id);
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
      throw new HttpException('Only rejected or failed results can be retried', HttpStatus.BAD_REQUEST);
    }
    const balanceAfter = await this.tokens.tryReserveTokens(
      businessId,
      CLEANUP_TOKEN_COST
    );
    if (balanceAfter === null) {
      throw new HttpException(
        {
          success: false,
          error: 'No AI tokens remaining.',
          code: 'INSUFFICIENT_AI_TOKENS',
        },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    const inserted = await this.insertRetryResult(result);
    // Hide the superseded failure/reject so the review list only shows the new attempt.
    if (result.status === 'failed' || result.status === 'rejected') {
      await this.markResult(result.id, 'rejected');
    }
    await this.tokens.recordCleanupUsage({
      businessId,
      userId,
      subjectType: 'ai_image_cleanup',
      subjectId: inserted.id,
      tokensConsumed: CLEANUP_TOKEN_COST,
      imageUrl: result.original_image_url,
    });
    await this.bumpJobTokens(result.job_id, CLEANUP_TOKEN_COST);
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
    const pending = (job.results ?? []).filter((r) => r.status === 'queued');
    let consumed = 0;
    let refunded = 0;
    for (const result of pending) {
      const outcome = await this.processOneResult(job, result);
      if (outcome === 'ready') consumed += CLEANUP_TOKEN_COST;
      if (outcome === 'failed') refunded += CLEANUP_TOKEN_COST;
    }
    await this.finalizeJobAfterProcess(job, consumed, refunded);
    return { success: true };
  }

  /** Atomically move the job from queued to processing; false if another worker owns it. */
  private async claimJob(jobId: string): Promise<boolean> {
    const data = await this.hasura.executeMutation<{
      update_ai_image_cleanup_jobs: { affected_rows: number };
    }>(Q.CLAIM_JOB, { id: jobId, updatedAt: new Date().toISOString() });
    return (data.update_ai_image_cleanup_jobs?.affected_rows ?? 0) > 0;
  }

  /** Atomically move a result from queued to processing; false if already claimed. */
  private async claimResult(resultId: string): Promise<boolean> {
    const data = await this.hasura.executeMutation<{
      update_ai_image_cleanup_results: { affected_rows: number };
    }>(Q.CLAIM_RESULT, { id: resultId, updatedAt: new Date().toISOString() });
    return (data.update_ai_image_cleanup_results?.affected_rows ?? 0) > 0;
  }

  private async processOneResult(
    job: AiImageCleanupJobRow,
    result: AiImageCleanupResultRow
  ): Promise<'ready' | 'failed' | 'skipped'> {
    const claimed = await this.claimResult(result.id);
    if (!claimed) return 'skipped';
    try {
      const uploaded = await this.cleanupAndUpload(
        job.business_id,
        job.item_id,
        result.original_image_url
      );
      await this.hasura.executeMutation(Q.UPDATE_RESULT, {
        id: result.id,
        _set: {
          status: 'ready',
          cleaned_image_url: uploaded.url,
          cleaned_s3_key: uploaded.key,
          error_message: null,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
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
      await this.tokens.refundTokens(job.business_id, CLEANUP_TOKEN_COST);
      return 'failed';
    }
  }

  private async finalizeJobAfterProcess(
    job: AiImageCleanupJobRow,
    consumed: number,
    refunded: number
  ): Promise<void> {
    const refreshed = await this.loadJob(job.id);
    const readyCount = (refreshed.results ?? []).filter(
      (r) => r.status === 'ready'
    ).length;
    const status = readyCount > 0 ? 'ready_for_review' : 'failed';
    await this.hasura.executeMutation(Q.UPDATE_JOB, {
      id: job.id,
      _set: {
        status,
        tokens_consumed: (job.tokens_consumed ?? 0) + consumed,
        tokens_refunded: (job.tokens_refunded ?? 0) + refunded,
        updated_at: new Date().toISOString(),
      },
    });
    const forNotify = await this.loadJob(job.id);
    await this.notifyProcessed(forNotify, status === 'ready_for_review');
  }

  private async notifyProcessed(
    job: AiImageCleanupJobRow,
    anyReady: boolean
  ): Promise<void> {
    const data = await this.hasura.executeQuery<{
      businesses_by_pk: {
        user_id: string;
        user?: { preferred_language?: string } | null;
      } | null;
    }>(Q.GET_BUSINESS_USER, { businessId: job.business_id });
    const userId = data.businesses_by_pk?.user_id;
    if (!userId) return;
    const readyCount = (job.results ?? []).filter((r) => r.status === 'ready')
      .length;
    const lang =
      data.businesses_by_pk?.user?.preferred_language?.toLowerCase() ?? 'en';
    const isFr = lang.startsWith('fr');
    const itemName =
      job.item_variant?.name ??
      job.item?.name ??
      (isFr ? 'votre article' : 'your item');
    const title = anyReady
      ? isFr
        ? 'Photos nettoyées prêtes'
        : 'AI-cleaned photos ready'
      : isFr
        ? 'Échec du nettoyage des photos'
        : 'Photo cleanup failed';
    const body = anyReady
      ? isFr
        ? `${readyCount} photo(s) prêtes à examiner pour « ${itemName} ».`
        : `${readyCount} photo(s) ready to review for “${itemName}”.`
      : isFr
        ? `Le nettoyage IA a échoué pour « ${itemName} ». Vos jetons ont été remboursés. Vous pouvez réessayer.`
        : `AI cleanup failed for “${itemName}”. Your tokens were refunded. You can retry.`;
    try {
      await this.notifications.sendAiImageCleanupReadyPush({
        userId,
        title,
        body,
        data: {
          type: 'ai_image_cleanup_ready',
          jobId: job.id,
          itemId: job.item_id,
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
    imageUrl: string
  ): Promise<{ url: string; key: string }> {
    const cleaned = await this.aiService.cleanupProductImage(imageUrl);
    const buffer = Buffer.from(cleaned.b64_json, 'base64');
    const bucket =
      this.awsService.getDefaultBucketName() ||
      process.env.S3_BUCKET_NAME ||
      'rendasua-uploads';
    const region = this.configService.get('aws')?.region || 'ca-central-1';
    const key = `businesses/${businessId}/ai-cleanup/${itemId}/${Date.now()}.png`;
    await this.awsService.getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
      })
    );
    return {
      url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
      key,
    };
  }

  private async requireBusinessContext(): Promise<{
    businessId: string;
    userId: string;
  }> {
    const user = await this.hasuraUser.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException('Business profile required', HttpStatus.FORBIDDEN);
    }
    return { businessId: user.business.id, userId: user.id };
  }

  private async assertNoOpenJobForItem(itemId: string): Promise<void> {
    const data = await this.hasura.executeQuery<{
      ai_image_cleanup_jobs: { id: string }[];
    }>(Q.GET_OPEN_JOB_FOR_ITEM, { itemId });
    if (data.ai_image_cleanup_jobs?.length) {
      throw new HttpException(
        'An AI cleanup job is already in progress for this item',
        HttpStatus.CONFLICT
      );
    }
  }

  private async assertNoOpenJobForVariant(variantId: string): Promise<void> {
    const data = await this.hasura.executeQuery<{
      ai_image_cleanup_jobs: { id: string }[];
    }>(Q.GET_OPEN_JOB_FOR_VARIANT, { variantId });
    if (data.ai_image_cleanup_jobs?.length) {
      throw new HttpException(
        'An AI cleanup job is already in progress for this variant',
        HttpStatus.CONFLICT
      );
    }
  }

  private async loadEligibleItemImages(
    itemId: string,
    businessId: string,
    imageIds?: string[]
  ): Promise<CleanupEligibleImage[]> {
    const data = await this.hasura.executeQuery<{
      items_by_pk: { id: string; business_id: string } | null;
      item_images: Array<{
        id: string;
        image_url: string;
        s3_key: string | null;
        is_ai_cleaned: boolean;
        business_id: string;
      }>;
    }>(Q.GET_ITEM_IMAGES, { itemId, businessId });
    if (!data.items_by_pk || data.items_by_pk.business_id !== businessId) {
      throw new HttpException('Item not found', HttpStatus.NOT_FOUND);
    }
    let images = (data.item_images ?? []).filter((i) => !i.is_ai_cleaned);
    if (imageIds != null) {
      const wanted = new Set(imageIds);
      images = images.filter((i) => wanted.has(i.id));
    }
    if (!images.length) {
      throw new HttpException(
        'No eligible images to clean',
        HttpStatus.BAD_REQUEST
      );
    }
    return images.map((img) => ({
      id: img.id,
      image_url: img.image_url,
      s3_key: img.s3_key,
      source: 'item_image' as const,
    }));
  }

  private async loadEligibleVariantImages(
    variantId: string,
    businessId: string,
    imageIds?: string[]
  ): Promise<{ itemId: string; images: CleanupEligibleImage[] }> {
    const data = await this.hasura.executeQuery<{
      item_variants_by_pk: {
        id: string;
        item_id: string;
        item: { id: string; business_id: string } | null;
      } | null;
      item_variant_images: Array<{
        id: string;
        image_url: string;
        s3_key: string | null;
        is_ai_cleaned: boolean;
      }>;
    }>(Q.GET_VARIANT_IMAGES, { variantId });
    const variant = data.item_variants_by_pk;
    if (!variant?.item || variant.item.business_id !== businessId) {
      throw new HttpException('Variant not found', HttpStatus.NOT_FOUND);
    }
    let images = (data.item_variant_images ?? []).filter((i) => !i.is_ai_cleaned);
    if (imageIds != null) {
      const wanted = new Set(imageIds);
      images = images.filter((i) => wanted.has(i.id));
    }
    if (!images.length) {
      throw new HttpException(
        'No eligible images to clean',
        HttpStatus.BAD_REQUEST
      );
    }
    return {
      itemId: variant.item_id,
      images: images.map((img) => ({
        id: img.id,
        image_url: img.image_url,
        s3_key: img.s3_key,
        source: 'variant_image' as const,
      })),
    };
  }

  private async createJob(
    businessId: string,
    itemId: string,
    userId: string,
    tokensReserved: number,
    itemVariantId: string | null
  ): Promise<AiImageCleanupJobRow> {
    const data = await this.hasura.executeMutation<{
      insert_ai_image_cleanup_jobs_one: AiImageCleanupJobRow;
    }>(Q.INSERT_JOB, {
      object: {
        business_id: businessId,
        item_id: itemId,
        item_variant_id: itemVariantId,
        requested_by_user_id: userId,
        status: 'queued',
        tokens_reserved: tokensReserved,
      },
    });
    return data.insert_ai_image_cleanup_jobs_one;
  }

  private async createResults(
    jobId: string,
    images: CleanupEligibleImage[]
  ): Promise<void> {
    await this.hasura.executeMutation(Q.INSERT_RESULTS, {
      objects: images.map((img) => ({
        job_id: jobId,
        business_image_id: img.source === 'item_image' ? img.id : null,
        item_variant_image_id: img.source === 'variant_image' ? img.id : null,
        original_image_url: img.image_url,
        original_s3_key: img.s3_key,
        status: 'queued',
      })),
    });
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
    status: AiImageCleanupResultRow['status']
  ): Promise<void> {
    await this.hasura.executeMutation(Q.UPDATE_RESULT, {
      id: resultId,
      _set: {
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'accepted' || status === 'rejected'
          ? { completed_at: new Date().toISOString() }
          : {}),
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
}
