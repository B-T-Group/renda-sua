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
import { ReelMerchantNotifyService } from '../notifications/reel-merchant-notify.service';
import { RbacService } from '../rbac/rbac.service';
import {
  CreateReelDto,
  ListMerchantReelsQueryDto,
  ModerateReelDto,
  SetReelActiveDto,
  UpdateReelDto,
} from './dto/reels.dto';
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
  is_active?: boolean;
  subject_title?: string | null;
  published_at?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class ReelsService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly aws: AwsService,
    private readonly config: ConfigService<Configuration>,
    private readonly rbac: RbacService,
    private readonly mediaQueue: ReelMediaQueueService,
    private readonly merchantNotify: ReelMerchantNotifyService
  ) {}

  async listForMerchant(
    userId: string,
    filters: ListMerchantReelsQueryDto = {}
  ): Promise<ReelRow[]> {
    const business = await this.requireBusiness(userId);
    const where = this.buildMerchantListWhere(business.id, filters);
    const result = await this.hasura.executeQuery<{ reels: ReelRow[] }>(
      `query($where:reels_bool_exp!){
        reels(where:$where,order_by:{created_at:desc}){
          id business_id subject_type subject_id caption generation_source
          moderation_status processing_status processing_error is_active
          source_s3_key video_url thumbnail_url published_at created_at updated_at
        }
      }`,
      { where }
    );
    return this.attachSubjectTitles(result.reels ?? []);
  }

  async setActive(
    userId: string,
    reelId: string,
    dto: SetReelActiveDto
  ): Promise<ReelRow> {
    const reel = await this.requireOwnedReel(userId, reelId);
    this.assertCanToggleActive(reel);
    const result = await this.hasura.executeMutation<{
      update_reels_by_pk: ReelRow | null;
    }>(
      `mutation($id:uuid!,$isActive:Boolean!,$now:timestamptz!){
        update_reels_by_pk(pk_columns:{id:$id},_set:{is_active:$isActive,updated_at:$now}){
          id business_id subject_type subject_id caption generation_source
          moderation_status processing_status processing_error is_active
          video_url thumbnail_url published_at created_at updated_at
        }
      }`,
      {
        id: reelId,
        isActive: dto.isActive,
        now: new Date().toISOString(),
      }
    );
    if (!result.update_reels_by_pk) throw new NotFoundException('Reel not found');
    const titles = await this.attachSubjectTitles([result.update_reels_by_pk]);
    return titles[0];
  }

  async create(userId: string, dto: CreateReelDto): Promise<ReelRow> {
    const business = await this.requireAllowedBusiness(userId);
    await this.assertDailyQuota(userId, business.id);
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
    this.assertCanSoftDelete(reel);
    const now = new Date().toISOString();
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$now:timestamptz!){
        update_reels_by_pk(pk_columns:{id:$id},_set:{
          deleted_at:$now,is_active:false,updated_at:$now
        }){id}
      }`,
      { id: reelId, now }
    );
  }

  private assertCanSoftDelete(reel: ReelRow): void {
    const failed = reel.processing_status === 'failed';
    const draftOrRejected = ['draft', 'rejected'].includes(reel.moderation_status);
    if (!failed && !draftOrRejected) {
      throw new BadRequestException(
        'Only failed, draft, or rejected reels can be deleted'
      );
    }
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
      `query($limit:Int!){reels(where:{moderation_status:{_in:[pending,ai_reviewing]},deleted_at:{_is_null:true}},order_by:{submitted_at:asc},limit:$limit){id business_id subject_type subject_id caption moderation_status processing_status video_url thumbnail_url submitted_at}}`,
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
    void this.merchantNotify.notifyModeration(
      reelId,
      approved ? 'approved' : 'rejected'
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
          generation_source processing_error is_active subject_type subject_id
          deleted_at
        }
      }`,
      { id: reelId }
    );
    const reel = result.reels_by_pk;
    if (!reel || reel.business_id !== business.id || reel.deleted_at) {
      throw new NotFoundException('Reel not found');
    }
    return reel;
  }

  private buildMerchantListWhere(
    businessId: string,
    filters: ListMerchantReelsQueryDto
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {
      business_id: { _eq: businessId },
      deleted_at: { _is_null: true },
    };
    if (filters.subjectType) where.subject_type = { _eq: filters.subjectType };
    if (filters.subjectId) where.subject_id = { _eq: filters.subjectId };
    return where;
  }

  private assertCanToggleActive(reel: ReelRow): void {
    if (
      reel.processing_status !== 'ready' ||
      reel.moderation_status !== 'approved'
    ) {
      throw new BadRequestException(
        'Only approved ready reels can be shown or hidden from the feed'
      );
    }
  }

  private async attachSubjectTitles(reels: ReelRow[]): Promise<ReelRow[]> {
    if (!reels.length) return reels;
    const titleByKey = await this.loadSubjectTitles(reels);
    return reels.map((reel) => ({
      ...reel,
      is_active: reel.is_active !== false,
      subject_title:
        titleByKey.get(`${reel.subject_type}:${reel.subject_id}`) ?? null,
    }));
  }

  private async loadSubjectTitles(
    reels: ReelRow[]
  ): Promise<Map<string, string>> {
    const itemIds = this.subjectIdsForType(reels, 'item');
    const rentalIds = this.subjectIdsForType(reels, 'rental');
    const [items, rentals] = await Promise.all([
      this.fetchNamedSubjects('items', itemIds),
      this.fetchNamedSubjects('rental_items', rentalIds),
    ]);
    const map = new Map<string, string>();
    for (const row of items) map.set(`item:${row.id}`, row.name);
    for (const row of rentals) map.set(`rental:${row.id}`, row.name);
    return map;
  }

  private subjectIdsForType(reels: ReelRow[], type: string): string[] {
    return [
      ...new Set(
        reels
          .filter((r) => r.subject_type === type && r.subject_id)
          .map((r) => r.subject_id as string)
      ),
    ];
  }

  private async fetchNamedSubjects(
    table: 'items' | 'rental_items',
    ids: string[]
  ): Promise<Array<{ id: string; name: string }>> {
    if (!ids.length) return [];
    const result = await this.hasura.executeQuery<
      Record<string, Array<{ id: string; name: string }>>
    >(`query($ids:[uuid!]!){rows:${table}(where:{id:{_in:$ids}}){id name}}`, {
      ids,
    });
    return result.rows ?? [];
  }

  private async assertDailyQuota(
    userId: string,
    businessId: string
  ): Promise<void> {
    if ((await this.rbac.getEffectiveAccess(userId)).isSuperuser) return;
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const result = await this.hasura.executeQuery<{
      reels_aggregate: { aggregate: { count: number } };
    }>(
      `query($businessId:uuid!,$since:timestamptz!){reels_aggregate(where:{business_id:{_eq:$businessId},created_at:{_gte:$since},deleted_at:{_is_null:true}}){aggregate{count}}}`,
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
