import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import sharp from 'sharp';
import { AwsService } from '../aws/aws.service';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { RbacService } from '../rbac/rbac.service';
import { ReelMediaQueueService } from '../reels/reel-media-queue.service';
import type { ReelRow } from '../reels/reels.service';
import {
  reelAiTokenCost,
  type ReelAiVeoTier,
} from '../reel-ai-tokens/reel-ai-tokens.packs';
import { ReelAiTokensService } from '../reel-ai-tokens/reel-ai-tokens.service';
import { ReelMerchantNotifyService } from '../notifications/reel-merchant-notify.service';
import type { GenerateAiReelDto } from './dto/generate-ai-reel.dto';
import {
  buildVeoReelPrompt,
  getReelAiPreset,
  normalizeReelAiPresetId,
  REEL_AI_PRESETS,
} from './reel-ai-presets';
import { VEO_MAX_REFERENCE_IMAGES } from './veo-reel-client';
import { parseVeoReelTier } from './veo-reel-model.util';
import {
  detectImageMime,
  pickOriginalProductImageUrl,
} from './veo-source-image.util';
import { isVideoGenerationError } from './video-generation/video-generation.error';
import { VIDEO_GENERATION_EVENTS } from './video-generation/video-generation-events';
import { VideoGenerationRouter } from './video-generation/video-generation-router.service';
import type {
  GenerateVideoRequest,
  GenerateVideoResponse,
  VideoGenerationProviderId,
  VideoGenerationTier,
  VideoImageInput,
} from './video-generation/video-generation.types';
import { RETRYABLE_ERROR_CATEGORIES } from './video-generation/video-generation.types';

interface ProductSubject {
  name: string;
  description: string | null;
  brand: string | null;
  imageUrls: string[];
}

interface GenerationRow {
  id: string;
  reel_id: string;
  business_id: string;
  gemini_operation_name: string | null;
  provider: string | null;
  provider_job_id: string | null;
  generation_tier: string | null;
  fallback_used: boolean | null;
  original_provider: string | null;
  model: string;
  status: string;
  tokens_reserved: number;
  preset_id: string;
  user_prompt: string | null;
  updated_at?: string | null;
}

/** After claim, allow this long before treating mid-fallback as orphaned. */
const POLL_FALLBACK_CLAIM_STALE_MS = 2 * 60 * 1000;

const QUEUE_GENERATED_REEL = `
  mutation($id:uuid!,$key:String!,$now:timestamptz!){
    update_reels(
      where:{
        id:{_eq:$id}
        processing_status:{_eq:generating}
        deleted_at:{_is_null:true}
        moderation_status:{_in:[draft]}
      }
      _set:{
        source_s3_key:$key,processing_status:queued,moderation_status:pending,
        submitted_at:$now,updated_at:$now
      }
    ){affected_rows}
  }
`;

@Injectable()
export class ReelAiGenerateService {
  private readonly logger = new Logger(ReelAiGenerateService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly config: ConfigService<Configuration>,
    private readonly aws: AwsService,
    private readonly rbac: RbacService,
    private readonly tokens: ReelAiTokensService,
    private readonly videoRouter: VideoGenerationRouter,
    private readonly mediaQueue: ReelMediaQueueService,
    private readonly merchantNotify: ReelMerchantNotifyService
  ) {}

  listPresets() {
    return REEL_AI_PRESETS.map((p) => ({
      id: p.id,
      labelKey: p.labelKey,
      defaultLabel: p.defaultLabel,
    }));
  }

  async generate(userId: string, dto: GenerateAiReelDto): Promise<ReelRow> {
    this.assertPreset(dto);
    const business = await this.requireAllowedBusiness(userId);
    const isSuperuser = (await this.rbac.getEffectiveAccess(userId)).isSuperuser;
    await this.assertDailyQuota(business.id, isSuperuser);
    const product = await this.loadProduct(business.id, dto);
    const options = this.resolveGenerateOptions(dto, isSuperuser);
    const reserved = await this.reserveTokenIfNeeded(
      business.id,
      isSuperuser,
      options.tokenCost
    );
    let reel: ReelRow;
    try {
      reel = await this.insertGeneratingReel(business.id, dto, false);
    } catch (error: any) {
      await this.refundReservedToken(business.id, userId, reserved);
      throw error;
    }
    try {
      await this.startGenerationJob({
        reelId: reel.id,
        businessId: business.id,
        userId,
        dto,
        product,
        tokensReserved: reserved,
        tier: options.tier,
      });
    } catch (error: any) {
      await this.failAndRefund({
        reelId: reel.id,
        businessId: business.id,
        userId,
        tokensReserved: reserved,
        message: error?.message || 'Failed to start AI generation',
      });
      throw this.toHttpError(error);
    }
    return reel;
  }

  /**
   * Platform-sponsored AI reel: no token debit, no daily quota.
   * Caller must validate allowlist / eligibility.
   */
  async generatePlatformSponsored(params: {
    businessId: string;
    subjectId: string;
    marketCountry: string;
    presetId?: string;
    tier?: ReelAiVeoTier;
  }): Promise<ReelRow> {
    const dto = this.toSponsoredDto(params);
    this.assertPreset(dto);
    const product = await this.loadProduct(params.businessId, dto);
    const tier = parseVeoReelTier(dto.tier) as ReelAiVeoTier;
    const reel = await this.insertGeneratingReel(params.businessId, dto, true);
    await this.runSponsoredJob(reel, params.businessId, dto, product, tier);
    return reel;
  }

  private toSponsoredDto(params: {
    subjectId: string;
    marketCountry: string;
    presetId?: string;
    tier?: ReelAiVeoTier;
  }): GenerateAiReelDto {
    return {
      subjectType: 'item',
      subjectId: params.subjectId,
      presetId: (params.presetId || 'dynamic') as GenerateAiReelDto['presetId'],
      marketCountry: params.marketCountry.toUpperCase(),
      tier: params.tier || 'fast',
    };
  }

  private async runSponsoredJob(
    reel: ReelRow,
    businessId: string,
    dto: GenerateAiReelDto,
    product: ProductSubject,
    tier: ReelAiVeoTier
  ): Promise<void> {
    try {
      await this.startGenerationJob({
        reelId: reel.id,
        businessId,
        dto,
        product,
        tokensReserved: 0,
        tier,
      });
    } catch (error: any) {
      await this.failAndRefund({
        reelId: reel.id,
        businessId,
        tokensReserved: 0,
        message: error?.message || 'Failed to start AI generation',
      });
      throw this.toHttpError(error);
    }
  }

  async pollPendingGenerations(): Promise<void> {
    const rows = await this.listPendingGenerations();
    for (const row of rows) {
      try {
        await this.pollOne(row);
      } catch (error: any) {
        this.logger.error(
          `Video poll failed for reel ${row.reel_id}: ${error?.message || error}`
        );
      }
    }
  }

  private assertPreset(dto: GenerateAiReelDto): void {
    if (!getReelAiPreset(dto.presetId)) {
      throw new BadRequestException('Unknown prompt preset');
    }
  }

  private resolveGenerateOptions(
    dto: GenerateAiReelDto,
    isSuperuser: boolean
  ): { tier: ReelAiVeoTier; tokenCost: number } {
    const tier = parseVeoReelTier(dto.tier) as ReelAiVeoTier;
    if (isSuperuser) {
      return { tier, tokenCost: 0 };
    }
    return { tier, tokenCost: reelAiTokenCost(tier) };
  }

  private async reserveTokenIfNeeded(
    businessId: string,
    isSuperuser: boolean,
    tokenCost: number
  ): Promise<number> {
    if (isSuperuser || tokenCost <= 0) return 0;
    const balanceAfter = await this.tokens.tryReserveTokens(
      businessId,
      tokenCost
    );
    if (balanceAfter === null) {
      throw new HttpException(
        {
          success: false,
          error: 'No AI reel tokens remaining. Purchase more to generate.',
          code: 'INSUFFICIENT_AI_REEL_TOKENS',
        },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    return tokenCost;
  }

  private async startGenerationJob(params: {
    reelId: string;
    businessId: string;
    userId?: string;
    dto: GenerateAiReelDto;
    product: ProductSubject;
    tokensReserved: number;
    tier: ReelAiVeoTier;
  }): Promise<void> {
    const presetId = normalizeReelAiPresetId(params.dto.presetId);
    const request = await this.buildGenerateRequest(params, presetId);
    const response = await this.videoRouter.submit(request);
    await this.insertGenerationRow({
      reelId: params.reelId,
      businessId: params.businessId,
      response,
      presetId,
      userPrompt: params.dto.prompt?.trim() || null,
      tokensReserved: params.tokensReserved,
    });
    if (params.tokensReserved > 0) {
      await this.tokens.recordUsage({
        businessId: params.businessId,
        userId: params.userId,
        reelId: params.reelId,
        tokensConsumed: params.tokensReserved,
        operationType: 'generate',
      });
    }
  }

  private async buildGenerateRequest(
    params: {
      reelId: string;
      businessId: string;
      dto: GenerateAiReelDto;
      product: ProductSubject;
      tier: ReelAiVeoTier;
    },
    presetId: string
  ): Promise<GenerateVideoRequest> {
    const veoCfg = this.config.get('veo')!;
    const prompt = buildVeoReelPrompt({
      presetId,
      userPrompt: params.dto.prompt,
      productName: params.product.name,
      productDescription: params.product.description,
      brand: params.product.brand,
      marketCountry: params.dto.marketCountry,
    });
    const images = await this.fetchImagesForGeneration(
      params.product.imageUrls
    );
    return {
      prompt,
      images,
      aspectRatio: veoCfg.aspectRatio,
      resolution: veoCfg.resolution,
      durationSeconds: veoCfg.durationSeconds,
      tier: params.tier as VideoGenerationTier,
      metadata: {
        reelId: params.reelId,
        businessId: params.businessId,
      },
    };
  }

  private async pollOne(row: GenerationRow): Promise<void> {
    const jobId = row.provider_job_id || row.gemini_operation_name;
    if (!jobId) return;
    const providerId = this.resolveProviderId(row);
    const status = await this.videoRouter.getJobStatus(providerId, jobId);
    if (status.status === 'QUEUED' || status.status === 'PROCESSING') {
      return;
    }
    if (status.status === 'COMPLETED' && status.videoUri) {
      await this.ingestVideo(row, providerId, status.videoUri);
      return;
    }
    await this.handleFailedJob(row, providerId, status);
  }

  private async handleFailedJob(
    row: GenerationRow,
    providerId: VideoGenerationProviderId,
    status: { errorMessage?: string | null; failureCategory?: string }
  ): Promise<void> {
    // Claim sets fallback_used before provider/job_id switch. Skip fail while a
    // peer is mid Runway submit; if the claim is stale, treat as orphaned.
    if (row.fallback_used && providerId === 'google') {
      if (!this.isStalePollFallbackClaim(row)) return;
      await this.failAndRefund({
        reelId: row.reel_id,
        businessId: row.business_id,
        tokensReserved: row.tokens_reserved,
        message:
          status.errorMessage ||
          'Video generation fallback timed out after primary failure',
        generationId: row.id,
        failureCategory: status.failureCategory,
      });
      return;
    }
    const category = status.failureCategory;
    const canFallback =
      !row.fallback_used &&
      providerId === 'google' &&
      category != null &&
      RETRYABLE_ERROR_CATEGORIES.has(category as never) &&
      this.config.get('videoGeneration')?.enableFallback !== false;
    if (canFallback) {
      const retried = await this.tryPollTimeFallback(
        row,
        category || 'UNKNOWN_PROVIDER_ERROR'
      );
      if (retried) return;
    }
    await this.failAndRefund({
      reelId: row.reel_id,
      businessId: row.business_id,
      tokensReserved: row.tokens_reserved,
      message: status.errorMessage || 'Video generation returned no video',
      generationId: row.id,
      failureCategory: category,
    });
  }

  private isStalePollFallbackClaim(row: GenerationRow): boolean {
    if (!row.updated_at) return true;
    const ageMs = Date.now() - new Date(row.updated_at).getTime();
    return ageMs > POLL_FALLBACK_CLAIM_STALE_MS;
  }

  private async tryPollTimeFallback(
    row: GenerationRow,
    failureCategory: string
  ): Promise<boolean> {
    const claimed = await this.claimPollFallback(row.id);
    if (!claimed) {
      // Another sweeper already claimed fallback; do not fail/refund.
      return true;
    }
    try {
      const request = await this.rebuildRequestFromRow(row);
      const response = await this.videoRouter.fallbackAfterPrimaryJobFailure({
        request,
        originalProvider: 'google',
        failureCategory,
      });
      await this.updateGenerationForFallback(row.id, response);
      return true;
    } catch (error: any) {
      this.logger.warn(
        `Poll-time fallback failed for reel ${row.reel_id}: ${
          error?.message || error
        }`
      );
      return false;
    }
  }

  private async claimPollFallback(generationId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.hasura.executeMutation<{
      update_reel_ai_generations: { affected_rows: number };
    }>(
      `mutation($id:uuid!,$now:timestamptz!){
        update_reel_ai_generations(
          where:{
            id:{_eq:$id}
            fallback_used:{_eq:false}
            status:{_in:[pending,running]}
          }
          _set:{fallback_used:true,updated_at:$now}
        ){affected_rows}
      }`,
      { id: generationId, now }
    );
    return (result.update_reel_ai_generations?.affected_rows ?? 0) > 0;
  }

  private async rebuildRequestFromRow(
    row: GenerationRow
  ): Promise<GenerateVideoRequest> {
    const reel = await this.loadReelForFallback(row.reel_id);
    if (!reel) throw new Error('Reel not found for fallback');
    const dto = {
      subjectType: reel.subject_type as 'item' | 'rental',
      subjectId: reel.subject_id,
      presetId: row.preset_id as GenerateAiReelDto['presetId'],
      marketCountry: reel.market_country,
      prompt: row.user_prompt || undefined,
    };
    const product = await this.loadProduct(row.business_id, dto);
    return this.buildGenerateRequest(
      {
        reelId: row.reel_id,
        businessId: row.business_id,
        dto: dto as GenerateAiReelDto,
        product,
        tier: (row.generation_tier || 'fast') as ReelAiVeoTier,
      },
      normalizeReelAiPresetId(row.preset_id)
    );
  }

  private async loadReelForFallback(reelId: string): Promise<{
    subject_type: string;
    subject_id: string;
    market_country: string;
  } | null> {
    const result = await this.hasura.executeQuery<{
      reels_by_pk: {
        subject_type: string;
        subject_id: string;
        market_country: string;
      } | null;
    }>(
      `query($id:uuid!){
        reels_by_pk(id:$id){subject_type subject_id market_country}
      }`,
      { id: reelId }
    );
    return result.reels_by_pk;
  }

  private async updateGenerationForFallback(
    generationId: string,
    response: GenerateVideoResponse
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.hasura.executeMutation(
      `mutation(
        $id:uuid!,$provider:String!,$jobId:String!,$model:String!,
        $original:String,$now:timestamptz!
      ){
        update_reel_ai_generations_by_pk(
          pk_columns:{id:$id}
          _set:{
            provider:$provider
            provider_job_id:$jobId
            model:$model
            fallback_used:true
            original_provider:$original
            status:running
            error:null
            updated_at:$now
          }
        ){id}
      }`,
      {
        id: generationId,
        provider: response.provider,
        jobId: response.jobId,
        model: response.providerModel,
        original: response.originalProvider || 'google',
        now,
      }
    );
  }

  private async ingestVideo(
    row: GenerationRow,
    providerId: VideoGenerationProviderId,
    videoUri: string
  ): Promise<void> {
    const key = await this.uploadGeneratedVideo(row, providerId, videoUri);
    const queued = await this.queueGeneratedReel(row.reel_id, key);
    if (!queued) {
      await this.abandonUnpublishableIngest(row);
      return;
    }
    await this.markGenerationSucceeded(row.id);
    this.logger.log(
      JSON.stringify({
        event: VIDEO_GENERATION_EVENTS.COMPLETED,
        generationId: row.id,
        provider: providerId,
        model: row.model,
        fallbackUsed: Boolean(row.fallback_used),
        reelId: row.reel_id,
      })
    );
    await this.mediaQueue.enqueue(row.reel_id, key, 'ai');
  }

  private async uploadGeneratedVideo(
    row: GenerationRow,
    providerId: VideoGenerationProviderId,
    videoUri: string
  ): Promise<string> {
    const bucket = this.config.get('reels')?.bucketName;
    if (!bucket) throw new Error('Reels bucket is not configured');
    const buffer = await this.videoRouter.retrieveVideo(providerId, videoUri);
    const key = `source/${row.business_id}/${row.reel_id}/generated.mp4`;
    await this.aws.getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'video/mp4',
      })
    );
    return key;
  }

  private async queueGeneratedReel(
    reelId: string,
    key: string
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const updated = await this.hasura.executeMutation<{
      update_reels: { affected_rows: number };
    }>(QUEUE_GENERATED_REEL, { id: reelId, key, now });
    return (updated.update_reels?.affected_rows ?? 0) > 0;
  }

  private async markGenerationSucceeded(generationId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$now:timestamptz!){
        update_reel_ai_generations_by_pk(pk_columns:{id:$id},_set:{status:succeeded,updated_at:$now}){id}
      }`,
      { id: generationId, now: new Date().toISOString() }
    );
  }

  private async abandonUnpublishableIngest(row: GenerationRow): Promise<void> {
    const reel = await this.loadIngestReel(row.reel_id);
    if (!this.shouldRefundAbandonedIngest(reel)) {
      this.logger.warn(
        `Skipping ingest for reel ${row.reel_id}: no longer generating`
      );
      return;
    }
    await this.failAndRefund({
      reelId: row.reel_id,
      businessId: row.business_id,
      tokensReserved: row.tokens_reserved,
      message: 'Generation cancelled before ingest',
      generationId: row.id,
    });
  }

  private shouldRefundAbandonedIngest(
    reel: { deleted_at?: string | null; moderation_status?: string } | null
  ): boolean {
    if (!reel) return true;
    return Boolean(reel.deleted_at) || reel.moderation_status === 'rejected';
  }

  private async loadIngestReel(reelId: string): Promise<{
    deleted_at?: string | null;
    moderation_status?: string;
  } | null> {
    const result = await this.hasura.executeQuery<{
      reels_by_pk: {
        deleted_at?: string | null;
        moderation_status?: string;
      } | null;
    }>(
      `query($id:uuid!){reels_by_pk(id:$id){deleted_at moderation_status}}`,
      { id: reelId }
    );
    return result.reels_by_pk;
  }

  private async failAndRefund(params: {
    reelId: string;
    businessId: string;
    userId?: string;
    tokensReserved: number;
    message: string;
    generationId?: string;
    failureCategory?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const err = params.message.slice(0, 500);
    await this.markReelFailed(params.reelId, err, now);
    const claimed = await this.claimFailedGeneration(params, err, now);
    if (params.generationId && !claimed) return;
    await this.refundReservedToken(
      params.businessId,
      params.userId,
      params.tokensReserved,
      params.reelId
    );
    void this.merchantNotify.notifyFailed(params.reelId);
  }

  private async markReelFailed(
    reelId: string,
    err: string,
    now: string
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$err:String!,$now:timestamptz!){
        update_reels_by_pk(pk_columns:{id:$id},_set:{
          processing_status:failed,processing_error:$err,updated_at:$now
        }){id}
      }`,
      { id: reelId, err, now }
    );
  }

  private async claimFailedGeneration(
    params: {
      reelId: string;
      generationId?: string;
      failureCategory?: string;
    },
    err: string,
    now: string
  ): Promise<boolean> {
    const where = params.generationId
      ? {
          id: { _eq: params.generationId },
          status: { _in: ['pending', 'running'] },
        }
      : {
          reel_id: { _eq: params.reelId },
          status: { _in: ['pending', 'running'] },
        };
    const result = await this.hasura.executeMutation<{
      update_reel_ai_generations: { affected_rows: number };
    }>(
      `mutation(
        $where:reel_ai_generations_bool_exp!,$err:String!,
        $category:String,$now:timestamptz!
      ){
        update_reel_ai_generations(
          where:$where
          _set:{
            status:failed,error:$err,failure_category:$category,
            tokens_reserved:0,updated_at:$now
          }
        ){affected_rows}
      }`,
      {
        where,
        err,
        category: params.failureCategory || null,
        now,
      }
    );
    return (result.update_reel_ai_generations?.affected_rows ?? 0) > 0;
  }

  private async refundReservedToken(
    businessId: string,
    userId: string | undefined,
    tokensReserved: number,
    reelId?: string
  ): Promise<void> {
    if (tokensReserved <= 0) return;
    await this.tokens.refundTokens(businessId, tokensReserved);
    await this.tokens.recordUsage({
      businessId,
      userId,
      reelId: reelId ?? null,
      tokensConsumed: tokensReserved,
      operationType: 'refund',
    });
  }

  private resolveProviderId(row: GenerationRow): VideoGenerationProviderId {
    if (row.provider === 'runway') return 'runway';
    return 'google';
  }

  private toHttpError(error: unknown): Error {
    if (!isVideoGenerationError(error)) {
      return error instanceof Error ? error : new Error(String(error));
    }
    if (
      error.category === 'RATE_LIMITED' ||
      error.category === 'QUOTA_EXCEEDED'
    ) {
      return new HttpException(
        'AI reel generation is busy. Please try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    if (
      error.category === 'INVALID_REQUEST' ||
      error.category === 'UNSUPPORTED_CONFIGURATION'
    ) {
      return new BadRequestException(
        'Could not start AI reel generation. Try a different product photo.'
      );
    }
    return new HttpException(
      'AI video generation is temporarily unavailable. Please try again.',
      HttpStatus.BAD_GATEWAY
    );
  }

  private async loadProduct(
    businessId: string,
    dto: Pick<
      GenerateAiReelDto,
      'subjectType' | 'subjectId' | 'presetId' | 'marketCountry' | 'prompt'
    >
  ): Promise<ProductSubject> {
    if (dto.subjectType === 'item') {
      return this.loadSaleItem(businessId, dto.subjectId);
    }
    return this.loadRentalItem(businessId, dto.subjectId);
  }

  private async loadSaleItem(
    businessId: string,
    itemId: string
  ): Promise<ProductSubject> {
    const result = await this.hasura.executeQuery<{
      items_by_pk: {
        id: string;
        business_id: string;
        name: string;
        description: string | null;
        brand: { name: string } | null;
        item_images: Array<{ image_url: string }>;
      } | null;
    }>(
      `query($id:uuid!){
        items_by_pk(id:$id){
          id business_id name description
          brand { name }
          item_images(order_by:{display_order:asc},limit:3){image_url}
        }
      }`,
      { id: itemId }
    );
    const item = result.items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new ForbiddenException('Subject does not belong to this business');
    }
    const imageUrls = item.item_images
      .map((row) => pickOriginalProductImageUrl(row))
      .filter((url): url is string => Boolean(url))
      .slice(0, VEO_MAX_REFERENCE_IMAGES);
    if (!imageUrls.length) {
      throw new BadRequestException(
        'Add at least one product photo before generating an AI reel'
      );
    }
    return {
      name: item.name,
      description: item.description,
      brand: item.brand?.name ?? null,
      imageUrls,
    };
  }

  private async loadRentalItem(
    businessId: string,
    rentalItemId: string
  ): Promise<ProductSubject> {
    const result = await this.hasura.executeQuery<{
      rental_items_by_pk: {
        id: string;
        business_id: string;
        name: string;
        description: string | null;
        rental_item_images: Array<{ image_url: string }>;
      } | null;
    }>(
      `query($id:uuid!){
        rental_items_by_pk(id:$id){
          id business_id name description
          rental_item_images(order_by:{created_at:asc},limit:3){image_url}
        }
      }`,
      { id: rentalItemId }
    );
    const item = result.rental_items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new ForbiddenException('Subject does not belong to this business');
    }
    const imageUrls = item.rental_item_images
      .map((row) => pickOriginalProductImageUrl(row))
      .filter((url): url is string => Boolean(url))
      .slice(0, VEO_MAX_REFERENCE_IMAGES);
    if (!imageUrls.length) {
      throw new BadRequestException(
        'Add at least one product photo before generating an AI reel'
      );
    }
    return {
      name: item.name,
      description: item.description,
      brand: null,
      imageUrls,
    };
  }

  private async fetchImagesForGeneration(
    urls: string[]
  ): Promise<VideoImageInput[]> {
    const images: VideoImageInput[] = [];
    for (const url of urls.slice(0, VEO_MAX_REFERENCE_IMAGES)) {
      try {
        images.push(await this.fetchImageForGeneration(url));
      } catch (error: any) {
        this.logger.warn(
          `Skipping reference image ${url}: ${error?.message || error}`
        );
      }
    }
    if (!images.length) {
      throw new BadRequestException(
        'Could not load product photos for AI reel generation'
      );
    }
    return images;
  }

  private async fetchImageForGeneration(url: string): Promise<VideoImageInput> {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 30_000,
    });
    const buffer = Buffer.from(response.data);
    const mime = detectImageMime(buffer, response.headers['content-type']);
    if (mime !== 'image/webp') {
      return { imageBase64: buffer.toString('base64'), mimeType: mime };
    }
    const jpeg = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
    return { imageBase64: jpeg.toString('base64'), mimeType: 'image/jpeg' };
  }

  private async insertGeneratingReel(
    businessId: string,
    dto: GenerateAiReelDto,
    platformSponsored: boolean
  ): Promise<ReelRow> {
    const result = await this.hasura.executeMutation<{
      insert_reels_one: ReelRow | null;
    }>(
      `mutation($object:reels_insert_input!){
        insert_reels_one(object:$object){
          id business_id moderation_status processing_status
        }
      }`,
      {
        object: {
          business_id: businessId,
          subject_type: dto.subjectType,
          subject_id: dto.subjectId,
          market_country: dto.marketCountry.toUpperCase(),
          caption: dto.caption?.trim() || null,
          generation_source: 'ai',
          platform_sponsored: platformSponsored,
          processing_status: 'generating',
          moderation_status: 'draft',
          prompt_preset: normalizeReelAiPresetId(dto.presetId),
          generation_prompt: dto.prompt?.trim() || null,
        },
      }
    );
    if (!result.insert_reels_one) {
      throw new BadRequestException('Failed to create AI reel');
    }
    return result.insert_reels_one;
  }

  private async insertGenerationRow(params: {
    reelId: string;
    businessId: string;
    response: GenerateVideoResponse;
    presetId: string;
    userPrompt: string | null;
    tokensReserved: number;
  }): Promise<void> {
    const isGoogle = params.response.provider === 'google';
    await this.hasura.executeMutation(
      `mutation($object:reel_ai_generations_insert_input!){
        insert_reel_ai_generations_one(object:$object){id}
      }`,
      {
        object: {
          reel_id: params.reelId,
          business_id: params.businessId,
          gemini_operation_name: isGoogle ? params.response.jobId : null,
          provider: params.response.provider,
          provider_job_id: params.response.jobId,
          generation_tier: params.response.tier,
          fallback_used: params.response.fallbackUsed,
          original_provider: params.response.originalProvider || null,
          model: params.response.providerModel,
          preset_id: params.presetId,
          user_prompt: params.userPrompt,
          status: 'running',
          tokens_reserved: params.tokensReserved,
        },
      }
    );
  }

  private async listPendingGenerations(): Promise<GenerationRow[]> {
    const result = await this.hasura.executeQuery<{
      reel_ai_generations: GenerationRow[];
    }>(
      `query{
        reel_ai_generations(
          where:{status:{_in:[pending,running]}}
          order_by:{created_at:asc}
          limit:25
        ){
          id reel_id business_id gemini_operation_name
          provider provider_job_id generation_tier fallback_used original_provider
          model status tokens_reserved preset_id user_prompt updated_at
        }
      }`
    );
    return result.reel_ai_generations ?? [];
  }

  private async requireAllowedBusiness(
    userId: string
  ): Promise<{ id: string }> {
    const result = await this.hasura.executeQuery<{
      businesses: Array<{ id: string; reels_enabled_allowlist: boolean }>;
    }>(
      `query($userId:uuid!){
        businesses(where:{user_id:{_eq:$userId}},limit:1){
          id reels_enabled_allowlist
        }
      }`,
      { userId }
    );
    const business = result.businesses[0];
    if (!business) throw new ForbiddenException('Merchant business required');
    if (!business.reels_enabled_allowlist) {
      throw new ForbiddenException('Merchant is not allowlisted for reels');
    }
    return business;
  }

  private async assertDailyQuota(
    businessId: string,
    isSuperuser: boolean
  ): Promise<void> {
    if (isSuperuser) return;
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const result = await this.hasura.executeQuery<{
      reels_aggregate: { aggregate: { count: number } };
    }>(
      `query($businessId:uuid!,$since:timestamptz!){
        reels_aggregate(where:{business_id:{_eq:$businessId},created_at:{_gte:$since},deleted_at:{_is_null:true}}){
          aggregate{count}
        }
      }`,
      { businessId, since: since.toISOString() }
    );
    const quota = this.config.get('reels')?.dailyQuota || 10;
    if (result.reels_aggregate.aggregate.count >= quota) {
      throw new BadRequestException(`Daily reel quota of ${quota} reached`);
    }
  }
}
