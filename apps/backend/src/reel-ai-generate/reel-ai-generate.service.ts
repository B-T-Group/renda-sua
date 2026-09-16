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
import type { GenerateAiReelDto } from './dto/generate-ai-reel.dto';
import {
  buildVeoReelPrompt,
  getReelAiPreset,
  REEL_AI_PRESETS,
} from './reel-ai-presets';
import { VeoReelClient } from './veo-reel-client';
import {
  parseVeoReelTier,
  resolveVeoPersonGeneration,
  resolveVeoReelModel,
} from './veo-reel-model.util';
import {
  detectImageMime,
  pickOriginalProductImageUrl,
} from './veo-source-image.util';

interface ProductSubject {
  name: string;
  description: string | null;
  brand: string | null;
  imageUrl: string;
}

interface GenerationRow {
  id: string;
  reel_id: string;
  business_id: string;
  gemini_operation_name: string | null;
  model: string;
  status: string;
  tokens_reserved: number;
}

@Injectable()
export class ReelAiGenerateService {
  private readonly logger = new Logger(ReelAiGenerateService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly config: ConfigService<Configuration>,
    private readonly aws: AwsService,
    private readonly rbac: RbacService,
    private readonly tokens: ReelAiTokensService,
    private readonly veo: VeoReelClient,
    private readonly mediaQueue: ReelMediaQueueService
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
    await this.assertDailyQuota(business.id);
    const product = await this.loadProduct(business.id, dto);
    const isSuperuser = (await this.rbac.getEffectiveAccess(userId)).isSuperuser;
    const options = this.resolveGenerateOptions(dto, isSuperuser);
    const reserved = await this.reserveTokenIfNeeded(
      business.id,
      isSuperuser,
      options.tokenCost
    );
    let reel: ReelRow;
    try {
      reel = await this.insertGeneratingReel(business.id, dto);
    } catch (error: any) {
      await this.refundReservedToken(business.id, userId, reserved);
      throw error;
    }
    try {
      await this.startVeoJob({
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
      throw error;
    }
    return reel;
  }

  async pollPendingGenerations(): Promise<void> {
    const rows = await this.listPendingGenerations();
    for (const row of rows) {
      try {
        await this.pollOne(row);
      } catch (error: any) {
        this.logger.error(
          `Veo poll failed for reel ${row.reel_id}: ${error?.message || error}`
        );
      }
    }
  }

  private assertPreset(dto: GenerateAiReelDto): void {
    const preset = getReelAiPreset(dto.presetId);
    if (!preset) throw new BadRequestException('Unknown prompt preset');
    if (dto.presetId === 'custom' && !dto.prompt?.trim()) {
      throw new BadRequestException('Custom preset requires a prompt');
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

  private async startVeoJob(params: {
    reelId: string;
    businessId: string;
    userId: string;
    dto: GenerateAiReelDto;
    product: ProductSubject;
    tokensReserved: number;
    tier: ReelAiVeoTier;
  }): Promise<void> {
    const model = this.resolveModelForTier(params.tier);
    const veoCfg = this.config.get('veo')!;
    const prompt = buildVeoReelPrompt({
      presetId: params.dto.presetId,
      userPrompt: params.dto.prompt,
      productName: params.product.name,
      productDescription: params.product.description,
      brand: params.product.brand,
    });
    const image = await this.fetchImageForVeo(params.product.imageUrl);
    const operationName = await this.veo.startImageToVideo({
      model,
      prompt,
      imageBase64: image.imageBase64,
      mimeType: image.mimeType,
      aspectRatio: veoCfg.aspectRatio,
      resolution: veoCfg.resolution,
      durationSeconds: veoCfg.durationSeconds,
      personGeneration: resolveVeoPersonGeneration(model),
    });
    await this.insertGenerationRow({
      reelId: params.reelId,
      businessId: params.businessId,
      operationName,
      model,
      presetId: params.dto.presetId,
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

  private async pollOne(row: GenerationRow): Promise<void> {
    if (!row.gemini_operation_name) return;
    const status = await this.veo.getOperation(row.gemini_operation_name);
    if (!status.done) return;
    if (status.error?.message || !status.videoUri) {
      await this.failAndRefund({
        reelId: row.reel_id,
        businessId: row.business_id,
        tokensReserved: row.tokens_reserved,
        message: status.error?.message || 'Veo generation returned no video',
        generationId: row.id,
      });
      return;
    }
    await this.ingestVideo(row, status.videoUri);
  }

  private async ingestVideo(row: GenerationRow, videoUri: string): Promise<void> {
    const bucket = this.config.get('reels')?.bucketName;
    if (!bucket) throw new Error('Reels bucket is not configured');
    const buffer = await this.veo.downloadVideo(videoUri);
    const key = `source/${row.business_id}/${row.reel_id}/veo.mp4`;
    await this.aws.getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'video/mp4',
      })
    );
    const now = new Date().toISOString();
    const updated = await this.hasura.executeMutation<{
      update_reels: { affected_rows: number };
    }>(
      `mutation($id:uuid!,$key:String!,$now:timestamptz!){
        update_reels(
          where:{id:{_eq:$id},processing_status:{_eq:generating}}
          _set:{
            source_s3_key:$key,processing_status:queued,moderation_status:pending,
            submitted_at:$now,updated_at:$now
          }
        ){affected_rows}
      }`,
      { id: row.reel_id, key, now }
    );
    if (!updated.update_reels?.affected_rows) {
      this.logger.warn(
        `Skipping ingest for reel ${row.reel_id}: no longer generating`
      );
      return;
    }
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$now:timestamptz!){
        update_reel_ai_generations_by_pk(pk_columns:{id:$id},_set:{status:succeeded,updated_at:$now}){id}
      }`,
      { id: row.id, now }
    );
    await this.mediaQueue.enqueue(row.reel_id, key, 'ai');
  }

  private async failAndRefund(params: {
    reelId: string;
    businessId: string;
    userId?: string;
    tokensReserved: number;
    message: string;
    generationId?: string;
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
    params: { reelId: string; generationId?: string },
    err: string,
    now: string
  ): Promise<boolean> {
    const where = params.generationId
      ? { id: { _eq: params.generationId }, status: { _in: ['pending', 'running'] } }
      : {
          reel_id: { _eq: params.reelId },
          status: { _in: ['pending', 'running'] },
        };
    const result = await this.hasura.executeMutation<{
      update_reel_ai_generations: { affected_rows: number };
    }>(
      `mutation($where:reel_ai_generations_bool_exp!,$err:String!,$now:timestamptz!){
        update_reel_ai_generations(
          where:$where
          _set:{status:failed,error:$err,tokens_reserved:0,updated_at:$now}
        ){affected_rows}
      }`,
      { where, err, now }
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

  private resolveModelForTier(tier: ReelAiVeoTier): string {
    const veo = this.config.get('veo');
    return resolveVeoReelModel({
      modelOverride: veo?.modelOverride,
      tierOverride: tier,
    });
  }

  private async loadProduct(
    businessId: string,
    dto: GenerateAiReelDto
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
        item_images: Array<{
          image_url: string;
        }>;
      } | null;
    }>(
      `query($id:uuid!){
        items_by_pk(id:$id){
          id business_id name description
          brand { name }
          item_images(order_by:{display_order:asc},limit:1){
            image_url
          }
        }
      }`,
      { id: itemId }
    );
    const item = result.items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new ForbiddenException('Subject does not belong to this business');
    }
    const imageUrl = pickOriginalProductImageUrl(item.item_images[0]);
    if (!imageUrl) {
      throw new BadRequestException(
        'Add at least one product photo before generating an AI reel'
      );
    }
    return {
      name: item.name,
      description: item.description,
      brand: item.brand?.name ?? null,
      imageUrl,
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
          rental_item_images(order_by:{created_at:asc},limit:1){image_url}
        }
      }`,
      { id: rentalItemId }
    );
    const item = result.rental_items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new ForbiddenException('Subject does not belong to this business');
    }
    const imageUrl = pickOriginalProductImageUrl(item.rental_item_images[0]);
    if (!imageUrl) {
      throw new BadRequestException(
        'Add at least one product photo before generating an AI reel'
      );
    }
    return {
      name: item.name,
      description: item.description,
      brand: null,
      imageUrl,
    };
  }

  private async fetchImageForVeo(
    url: string
  ): Promise<{ imageBase64: string; mimeType: string }> {
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
    dto: GenerateAiReelDto
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
          processing_status: 'generating',
          moderation_status: 'draft',
          prompt_preset: dto.presetId,
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
    operationName: string;
    model: string;
    presetId: string;
    userPrompt: string | null;
    tokensReserved: number;
  }): Promise<void> {
    await this.hasura.executeMutation(
      `mutation($object:reel_ai_generations_insert_input!){
        insert_reel_ai_generations_one(object:$object){id}
      }`,
      {
        object: {
          reel_id: params.reelId,
          business_id: params.businessId,
          gemini_operation_name: params.operationName,
          model: params.model,
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
          id reel_id business_id gemini_operation_name model status tokens_reserved
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

  private async assertDailyQuota(businessId: string): Promise<void> {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const result = await this.hasura.executeQuery<{
      reels_aggregate: { aggregate: { count: number } };
    }>(
      `query($businessId:uuid!,$since:timestamptz!){
        reels_aggregate(where:{business_id:{_eq:$businessId},created_at:{_gte:$since}}){
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
