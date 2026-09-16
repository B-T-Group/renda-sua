import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AwsService } from '../aws/aws.service';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { CreateReelDto, ModerateReelDto, UpdateReelDto } from './dto/reels.dto';
import { ReelMediaQueueService } from './reel-media-queue.service';

interface MerchantBusiness {
  id: string;
  reels_enabled_allowlist: boolean;
}

export interface ReelRow {
  id: string;
  business_id: string;
  source_s3_key?: string | null;
  moderation_status: string;
  processing_status?: string;
  processing_error?: string | null;
  generation_source?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  caption?: string | null;
  subject_type?: string;
  subject_id?: string;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class ReelsService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly aws: AwsService,
    private readonly config: ConfigService<Configuration>,
    private readonly mediaQueue: ReelMediaQueueService
  ) {}

  async listForMerchant(userId: string): Promise<ReelRow[]> {
    const business = await this.requireBusiness(userId);
    const result = await this.hasura.executeQuery<{ reels: ReelRow[] }>(
      `query($businessId:uuid!){
        reels(where:{business_id:{_eq:$businessId}},order_by:{created_at:desc}){
          id business_id subject_type subject_id caption generation_source
          moderation_status processing_status processing_error
          video_url thumbnail_url published_at created_at updated_at
        }
      }`,
      { businessId: business.id }
    );
    return result.reels;
  }

  async create(userId: string, dto: CreateReelDto): Promise<ReelRow> {
    const business = await this.requireAllowedBusiness(userId);
    await this.assertDailyQuota(business.id);
    await this.assertSubjectOwnership(business.id, dto.subjectType, dto.subjectId);
    const result = await this.hasura.executeMutation<{
      insert_reels_one: ReelRow | null;
    }>(
      `mutation($object:reels_insert_input!){insert_reels_one(object:$object){id business_id moderation_status}}`,
      {
        object: {
          business_id: business.id,
          subject_type: dto.subjectType,
          subject_id: dto.subjectId,
          market_country: dto.marketCountry.toUpperCase(),
          caption: dto.caption?.trim() || null,
        },
      }
    );
    if (!result.insert_reels_one) throw new BadRequestException('Failed to create reel');
    return result.insert_reels_one;
  }

  async update(userId: string, reelId: string, dto: UpdateReelDto): Promise<ReelRow> {
    const reel = await this.requireOwnedReel(userId, reelId);
    if (!['draft', 'rejected'].includes(reel.moderation_status)) {
      throw new BadRequestException('Only draft or rejected reels can be edited');
    }
    const result = await this.hasura.executeMutation<{
      update_reels_by_pk: ReelRow | null;
    }>(
      `mutation($id:uuid!,$changes:reels_set_input!){update_reels_by_pk(pk_columns:{id:$id},_set:$changes){id business_id moderation_status}}`,
      { id: reelId, changes: { caption: dto.caption?.trim() || null, updated_at: new Date() } }
    );
    if (!result.update_reels_by_pk) throw new NotFoundException('Reel not found');
    return result.update_reels_by_pk;
  }

  async delete(userId: string, reelId: string): Promise<void> {
    const reel = await this.requireOwnedReel(userId, reelId);
    if (!['draft', 'rejected'].includes(reel.moderation_status)) {
      throw new BadRequestException('Only draft or rejected reels can be deleted');
    }
    await this.hasura.executeMutation(
      `mutation($id:uuid!){delete_reels_by_pk(id:$id){id}}`,
      { id: reelId }
    );
  }

  async createUpload(userId: string, reelId: string, fileName: string, contentType: string) {
    const reel = await this.requireOwnedReel(userId, reelId);
    const bucketName = this.config.get('reels')?.bucketName;
    if (!bucketName) throw new BadRequestException('Reels bucket is not configured');
    const extension = fileName.split('.').pop()?.toLowerCase() || 'mp4';
    const key = `source/${reel.business_id}/${reel.id}/${Date.now()}.${extension}`;
    const signed = await this.aws.generatePresignedUploadUrl({
      bucketName,
      key,
      contentType,
      expiresIn: 900,
    });
    await this.setSourceKey(reelId, key);
    return { ...signed, key };
  }

  async submit(userId: string, reelId: string): Promise<void> {
    const reel = await this.requireOwnedReel(userId, reelId);
    if (!reel.source_s3_key) throw new BadRequestException('Upload reel media first');
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$now:timestamptz!){update_reels_by_pk(pk_columns:{id:$id},_set:{moderation_status:pending,processing_status:queued,submitted_at:$now,updated_at:$now}){id}}`,
      { id: reelId, now: new Date().toISOString() }
    );
    await this.mediaQueue.enqueue(reelId, reel.source_s3_key);
  }

  async retryProcessing(userId: string, reelId: string): Promise<ReelRow> {
    const reel = await this.requireOwnedReel(userId, reelId);
    this.assertRetryable(reel);
    const sourceKind = reel.generation_source === 'ai' ? 'ai' : 'merchant';
    const now = new Date().toISOString();
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$now:timestamptz!){
        update_reels_by_pk(pk_columns:{id:$id},_set:{
          processing_status:queued,processing_error:null,updated_at:$now
        }){id}
      }`,
      { id: reelId, now }
    );
    await this.mediaQueue.enqueue(reelId, reel.source_s3_key!, sourceKind);
    return { ...reel, processing_status: 'queued', processing_error: null };
  }

  private assertRetryable(reel: ReelRow): void {
    if (reel.processing_status !== 'failed') {
      throw new BadRequestException('Only failed reels can be retried');
    }
    if (reel.moderation_status === 'rejected') {
      throw new BadRequestException('Rejected reels cannot be retried');
    }
    if (!reel.source_s3_key) {
      throw new BadRequestException('Missing source media for retry');
    }
  }

  async moderationQueue(limit = 50): Promise<ReelRow[]> {
    const result = await this.hasura.executeQuery<{ reels: ReelRow[] }>(
      `query($limit:Int!){reels(where:{moderation_status:{_in:[pending,ai_reviewing]}},order_by:{submitted_at:asc},limit:$limit){id business_id subject_type subject_id caption moderation_status processing_status video_url thumbnail_url submitted_at}}`,
      { limit: Math.min(Math.max(limit, 1), 100) }
    );
    return result.reels;
  }

  async moderate(reelId: string, userId: string, dto: ModerateReelDto): Promise<void> {
    const approved = dto.status === 'approved';
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$status:reel_moderation_status!,$userId:uuid!,$reason:String,$now:timestamptz!){update_reels_by_pk(pk_columns:{id:$id},_set:{moderation_status:$status,moderated_by_user_id:$userId,moderation_reason:$reason,moderated_at:$now,published_at:${approved ? '$now' : 'null'},updated_at:$now}){id}}`,
      {
        id: reelId,
        status: dto.status,
        userId,
        reason: dto.reason?.trim() || null,
        now: new Date().toISOString(),
      }
    );
  }

  private async requireBusiness(userId: string): Promise<MerchantBusiness> {
    const result = await this.hasura.executeQuery<{ businesses: MerchantBusiness[] }>(
      `query($userId:uuid!){businesses(where:{user_id:{_eq:$userId}},limit:1){id reels_enabled_allowlist}}`,
      { userId }
    );
    const business = result.businesses[0];
    if (!business) throw new ForbiddenException('Merchant business required');
    return business;
  }

  private async requireAllowedBusiness(userId: string): Promise<MerchantBusiness> {
    const business = await this.requireBusiness(userId);
    if (!business.reels_enabled_allowlist) {
      throw new ForbiddenException('Merchant is not allowlisted for reels');
    }
    return business;
  }

  private async requireOwnedReel(userId: string, reelId: string): Promise<ReelRow> {
    const business = await this.requireBusiness(userId);
    const result = await this.hasura.executeQuery<{ reels_by_pk: ReelRow | null }>(
      `query($id:uuid!){
        reels_by_pk(id:$id){
          id business_id source_s3_key moderation_status processing_status
          generation_source processing_error
        }
      }`,
      { id: reelId }
    );
    if (!result.reels_by_pk || result.reels_by_pk.business_id !== business.id) {
      throw new NotFoundException('Reel not found');
    }
    return result.reels_by_pk;
  }

  private async assertDailyQuota(businessId: string): Promise<void> {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const result = await this.hasura.executeQuery<{
      reels_aggregate: { aggregate: { count: number } };
    }>(
      `query($businessId:uuid!,$since:timestamptz!){reels_aggregate(where:{business_id:{_eq:$businessId},created_at:{_gte:$since}}){aggregate{count}}}`,
      { businessId, since: since.toISOString() }
    );
    const quota = this.config.get('reels')?.dailyQuota || 10;
    if (result.reels_aggregate.aggregate.count >= quota) {
      throw new BadRequestException(`Daily reel quota of ${quota} reached`);
    }
  }

  private async assertSubjectOwnership(
    businessId: string,
    type: CreateReelDto['subjectType'],
    subjectId: string
  ): Promise<void> {
    if (type === 'business' && subjectId !== businessId) {
      throw new ForbiddenException('Subject does not belong to this business');
    }
    if (type === 'business') return;
    const table = type === 'item' ? 'items' : 'rental_items';
    const result = await this.hasura.executeQuery<
      Record<string, { id: string } | null>
    >(`query($id:uuid!){subject:${table}_by_pk(id:$id){id business_id}}`, {
      id: subjectId,
    });
    const subject = result.subject as { id: string; business_id?: string } | null;
    if (!subject || subject.business_id !== businessId) {
      throw new ForbiddenException('Subject does not belong to this business');
    }
  }

  private async setSourceKey(reelId: string, key: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$key:String!,$now:timestamptz!){update_reels_by_pk(pk_columns:{id:$id},_set:{source_s3_key:$key,processing_status:awaiting_upload,updated_at:$now}){id}}`,
      { id: reelId, key, now: new Date().toISOString() }
    );
  }
}
