import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DeepseekService } from '../ai/deepseek.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminBroadcastAudienceService } from './admin-broadcast-audience.service';
import { AdminBroadcastQueueService } from './admin-broadcast-queue.service';
import {
  actionTypeForTemplate,
  cannedBroadcastCopy,
  messageTypeForAction,
  type BilingualBroadcastCopy,
} from './admin-broadcast.templates';
import type {
  BroadcastAudienceFiltersDto,
  CreateBroadcastDto,
} from './dto/admin-broadcast.dto';

export interface CampaignRow {
  id: string;
  created_by_user_id: string;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  status: string;
  audience_type: string;
  filters: BroadcastAudienceFiltersDto;
  template_key: string;
  action_type: string;
  source_language: string;
  source_title?: string | null;
  source_body: string;
  title_en: string;
  body_en: string;
  title_fr: string;
  body_fr: string;
  message_hash: string;
  target_count: number;
  eligible_count: number;
  sent_count: number;
  skipped_dedupe_count: number;
  failed_count: number;
  error_message?: string | null;
  created_by_user?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

const CHUNK = 100;
/** Cap per Lambda invocation to stay under the 14-minute HTTP timeout. */
const MAX_USERS_PER_INVOCATION = 250;
/** Reclaim campaigns stuck in processing after a worker crash/timeout. */
const STALE_PROCESSING_MS = 16 * 60 * 1000;

@Injectable()
export class AdminBroadcastService {
  private readonly logger = new Logger(AdminBroadcastService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly audience: AdminBroadcastAudienceService,
    private readonly queue: AdminBroadcastQueueService,
    private readonly deepseek: DeepseekService,
    private readonly notifications: NotificationsService
  ) {}

  async searchUsers(query: string) {
    return this.audience.searchUsersByEmail(query);
  }

  async preview(input: {
    audienceType: CreateBroadcastDto['audienceType'];
    filters?: BroadcastAudienceFiltersDto;
    messageHash?: string;
    templateKey?: CreateBroadcastDto['templateKey'];
    title?: string;
    body?: string;
  }) {
    if (
      input.audienceType === 'user' &&
      !(input.filters?.userIds?.filter(Boolean).length)
    ) {
      return {
        total: 0,
        withPushToken: 0,
        wouldSkipDedupe: 0,
        eligible: 0,
      };
    }
    const users = await this.audience.listAudienceUsers(
      input.audienceType,
      input.filters
    );
    const withPushToken = users.filter((u) => u.hasPushToken).length;
    const messageHash =
      input.messageHash ||
      this.resolvePreviewMessageHash(
        input.templateKey,
        input.title,
        input.body
      );
    const wouldSkipDedupe = messageHash
      ? await this.audience.countDedupeSkips(
          users.map((u) => u.userId),
          messageHash
        )
      : 0;
    return {
      total: users.length,
      withPushToken,
      wouldSkipDedupe,
      eligible: Math.max(0, users.length - wouldSkipDedupe),
    };
  }

  async createCampaign(adminUserId: string, dto: CreateBroadcastDto) {
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Message body is required');
    this.assertAudienceFilters(dto);
    const sourceLanguage = dto.sourceLanguage ?? 'en';
    const title = dto.title?.trim() || undefined;
    const copy = await this.resolveCopy(dto.templateKey, title, body, sourceLanguage);
    const messageHash = this.resolveMessageHash(
      dto.templateKey,
      title,
      body,
      sourceLanguage
    );
    const actionType = actionTypeForTemplate(dto.templateKey);
    const preview = await this.preview({
      audienceType: dto.audienceType,
      filters: dto.filters,
      messageHash,
    });
    const campaignId = await this.insertCampaign({
      adminUserId,
      dto,
      copy,
      messageHash,
      actionType,
      preview,
      sourceLanguage,
      title,
      body,
    });
    await this.startProcessing(campaignId);
    return this.getCampaign(campaignId);
  }

  async listCampaigns(page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const result = await this.hasura.executeQuery<{
      admin_broadcast_campaigns: CampaignRow[];
      admin_broadcast_campaigns_aggregate: { aggregate: { count: number } };
    }>(
      `query List($limit: Int!, $offset: Int!) {
        admin_broadcast_campaigns(
          order_by: { created_at: desc }
          limit: $limit
          offset: $offset
        ) {
          id created_by_user_id created_at started_at completed_at status
          audience_type filters template_key action_type
          source_language source_title source_body
          title_en body_en title_fr body_fr message_hash
          target_count eligible_count sent_count skipped_dedupe_count failed_count
          error_message
          created_by_user { id first_name last_name email }
        }
        admin_broadcast_campaigns_aggregate {
          aggregate { count }
        }
      }`,
      { limit: safeLimit, offset }
    );
    const total = result.admin_broadcast_campaigns_aggregate?.aggregate?.count ?? 0;
    return {
      items: result.admin_broadcast_campaigns ?? [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        hasNext: offset + safeLimit < total,
        hasPrev: safePage > 1,
      },
    };
  }

  async getCampaign(id: string): Promise<CampaignRow> {
    const result = await this.hasura.executeQuery<{
      admin_broadcast_campaigns_by_pk: CampaignRow | null;
    }>(
      `query One($id: uuid!) {
        admin_broadcast_campaigns_by_pk(id: $id) {
          id created_by_user_id created_at started_at completed_at status
          audience_type filters template_key action_type
          source_language source_title source_body
          title_en body_en title_fr body_fr message_hash
          target_count eligible_count sent_count skipped_dedupe_count failed_count
          error_message
          created_by_user { id first_name last_name email }
        }
      }`,
      { id }
    );
    const row = result.admin_broadcast_campaigns_by_pk;
    if (!row) throw new NotFoundException('Campaign not found');
    return row;
  }

  async processCampaign(
    campaignId: string,
    afterUserId?: string | null
  ): Promise<void> {
    const claimed = await this.claimCampaignForProcessing(campaignId);
    if (!claimed) {
      await this.assertClaimSkipOrThrow(campaignId);
      return;
    }
    try {
      await this.runDeliveryBatch(claimed, afterUserId);
    } catch (error: any) {
      this.logger.error(
        `Broadcast ${campaignId} failed: ${error?.message ?? error}`,
        error?.stack
      );
      await this.markStatus(campaignId, 'failed', {
        completed_at: 'now()',
        error_message: error?.message ?? String(error),
      });
      throw error;
    }
  }

  private async runDeliveryBatch(
    claimed: CampaignRow,
    afterUserId?: string | null
  ): Promise<void> {
    const users = await this.audience.listAudienceUsers(
      claimed.audience_type as CreateBroadcastDto['audienceType'],
      (claimed.filters ?? {}) as BroadcastAudienceFiltersDto
    );
    const startIdx = this.resumeStartIndex(users, afterUserId);
    if (startIdx === null) {
      await this.markStatus(claimed.id, 'completed', {
        completed_at: 'now()',
        sent_count: claimed.sent_count ?? 0,
        skipped_dedupe_count: claimed.skipped_dedupe_count ?? 0,
        failed_count: claimed.failed_count ?? 0,
        eligible_count: Math.max(
          0,
          users.length - (claimed.skipped_dedupe_count ?? 0)
        ),
      });
      return;
    }
    let sent = claimed.sent_count ?? 0;
    let skipped = claimed.skipped_dedupe_count ?? 0;
    let failed = claimed.failed_count ?? 0;
    const endIdx = Math.min(startIdx + MAX_USERS_PER_INVOCATION, users.length);
    let lastUserId: string | null = afterUserId ?? null;
    for (let i = startIdx; i < endIdx; i += CHUNK) {
      const chunk = users.slice(i, Math.min(i + CHUNK, endIdx));
      for (const user of chunk) {
        const outcome = await this.deliverToUser(
          claimed,
          user.userId,
          user.preferredLanguage
        );
        if (outcome === 'sent') sent += 1;
        else if (outcome === 'skipped') skipped += 1;
        else failed += 1;
        lastUserId = user.userId;
      }
      await this.updateCounters(claimed.id, { sent, skipped, failed });
    }
    if (endIdx < users.length) {
      await this.continueCampaign(
        claimed.id,
        {
          sent,
          skipped,
          failed,
          eligible: Math.max(0, users.length - skipped),
        },
        lastUserId
      );
      return;
    }
    await this.markStatus(claimed.id, 'completed', {
      completed_at: 'now()',
      sent_count: sent,
      skipped_dedupe_count: skipped,
      failed_count: failed,
      eligible_count: Math.max(0, users.length - skipped),
    });
  }

  private resumeStartIndex(
    users: Array<{ userId: string }>,
    afterUserId?: string | null
  ): number | null {
    if (!afterUserId) return 0;
    const idx = users.findIndex(
      (u) => u.userId.localeCompare(afterUserId) > 0
    );
    return idx >= 0 ? idx : null;
  }

  private async continueCampaign(
    campaignId: string,
    counts: {
      sent: number;
      skipped: number;
      failed: number;
      eligible: number;
    },
    afterUserId: string | null
  ): Promise<void> {
    await this.markStatus(campaignId, 'queued', {
      sent_count: counts.sent,
      skipped_dedupe_count: counts.skipped,
      failed_count: counts.failed,
      eligible_count: counts.eligible,
      error_message: null,
      completed_at: null,
    });
    if (!this.queue.isConfigured()) {
      await this.processCampaign(campaignId, afterUserId);
      return;
    }
    const enqueued = await this.queue.enqueueCampaign(
      campaignId,
      afterUserId
    );
    if (!enqueued) {
      throw new Error(`Failed to re-enqueue broadcast ${campaignId}`);
    }
  }

  private async assertClaimSkipOrThrow(campaignId: string): Promise<void> {
    const row = await this.getCampaignRow(campaignId);
    if (!row) throw new NotFoundException('Campaign not found');
    if (row.status === 'completed' || row.status === 'cancelled') {
      this.logger.log(`Broadcast ${campaignId} skipped — ${row.status}`);
      return;
    }
    // Keep SQS message visible so a stuck/crashed worker can be retried
    // until stale reclaim succeeds.
    throw new Error(
      `Could not claim broadcast ${campaignId} (status=${row.status})`
    );
  }

  private async getCampaignRow(campaignId: string): Promise<CampaignRow | null> {
    const result = await this.hasura.executeQuery<{
      admin_broadcast_campaigns_by_pk: CampaignRow | null;
    }>(
      `query GetRow($id: uuid!) {
        admin_broadcast_campaigns_by_pk(id: $id) {
          id created_by_user_id created_at started_at completed_at status
          audience_type filters template_key action_type
          source_language source_title source_body
          title_en body_en title_fr body_fr message_hash
          target_count eligible_count sent_count skipped_dedupe_count failed_count
          error_message
        }
      }`,
      { id: campaignId }
    );
    return result.admin_broadcast_campaigns_by_pk;
  }

  /** Atomically claim a campaign so only one worker processes it. */
  private async claimCampaignForProcessing(
    campaignId: string
  ): Promise<CampaignRow | null> {
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
    const startedAt = new Date().toISOString();
    const result = await this.hasura.executeMutation<{
      update_admin_broadcast_campaigns: {
        returning: CampaignRow[];
      };
    }>(
      `mutation Claim($id: uuid!, $startedAt: timestamptz!, $staleBefore: timestamptz!) {
        update_admin_broadcast_campaigns(
          where: {
            id: { _eq: $id }
            _or: [
              { status: { _in: [queued, failed] } }
              {
                status: { _eq: processing }
                started_at: { _lt: $staleBefore }
              }
            ]
          }
          _set: {
            status: processing
            started_at: $startedAt
            error_message: null
            completed_at: null
          }
        ) {
          returning {
            id created_by_user_id created_at started_at completed_at status
            audience_type filters template_key action_type
            source_language source_title source_body
            title_en body_en title_fr body_fr message_hash
            target_count eligible_count sent_count skipped_dedupe_count failed_count
            error_message
          }
        }
      }`,
      { id: campaignId, startedAt, staleBefore }
    );
    return result.update_admin_broadcast_campaigns?.returning?.[0] ?? null;
  }

  private assertAudienceFilters(dto: CreateBroadcastDto): void {
    if (dto.audienceType === 'user') {
      this.assertUserAudienceFilters(dto.filters);
    }
  }

  private assertUserAudienceFilters(
    filters?: BroadcastAudienceFiltersDto
  ): void {
    const ids = filters?.userIds?.filter(Boolean) ?? [];
    if (ids.length === 0) {
      throw new BadRequestException(
        'Select at least one user when audience type is user'
      );
    }
  }

  private resolvePreviewMessageHash(
    templateKey?: CreateBroadcastDto['templateKey'],
    title?: string,
    body?: string
  ): string | undefined {
    if (!templateKey || !body?.trim()) return undefined;
    const canned = cannedBroadcastCopy(templateKey);
    if (
      canned &&
      this.isUnmodifiedCanned(canned, title, body.trim(), 'en')
    ) {
      return this.audience.hashMessage(
        templateKey,
        canned.bodyEn,
        canned.titleEn
      );
    }
    if (
      canned &&
      this.isUnmodifiedCanned(canned, title, body.trim(), 'fr')
    ) {
      return this.audience.hashMessage(
        templateKey,
        canned.bodyEn,
        canned.titleEn
      );
    }
    return this.audience.hashMessage(templateKey, body.trim(), title?.trim());
  }

  private resolveMessageHash(
    templateKey: CreateBroadcastDto['templateKey'],
    title: string | undefined,
    body: string,
    sourceLanguage: 'en' | 'fr'
  ): string {
    const canned = cannedBroadcastCopy(templateKey);
    if (canned && this.isUnmodifiedCanned(canned, title, body, sourceLanguage)) {
      return this.audience.hashMessage(
        templateKey,
        canned.bodyEn,
        canned.titleEn
      );
    }
    return this.audience.hashMessage(templateKey, body, title);
  }

  private async startProcessing(campaignId: string): Promise<void> {
    if (!this.queue.isConfigured()) {
      void this.processCampaign(campaignId).catch((error: any) => {
        this.logger.error(
          `In-process broadcast ${campaignId} failed: ${error?.message ?? error}`
        );
      });
      return;
    }
    const enqueued = await this.queue.enqueueCampaign(campaignId);
    if (!enqueued) {
      await this.markStatus(campaignId, 'failed', {
        completed_at: 'now()',
        error_message: 'Failed to enqueue broadcast job',
      });
      throw new BadRequestException('Failed to enqueue broadcast job');
    }
  }

  private async resolveCopy(
    templateKey: CreateBroadcastDto['templateKey'],
    title: string | undefined,
    body: string,
    sourceLanguage: 'en' | 'fr'
  ): Promise<BilingualBroadcastCopy> {
    const canned = cannedBroadcastCopy(templateKey);
    if (canned && this.isUnmodifiedCanned(canned, title, body, sourceLanguage)) {
      return canned;
    }
    if (canned && !title && !body.trim()) {
      return canned;
    }
    return this.translateCustom(
      title ?? (canned ? this.cannedTitle(canned, sourceLanguage) : 'Rendasua'),
      body || (canned ? this.cannedBody(canned, sourceLanguage) : ''),
      sourceLanguage
    );
  }

  private isUnmodifiedCanned(
    canned: BilingualBroadcastCopy,
    title: string | undefined,
    body: string,
    sourceLanguage: 'en' | 'fr'
  ): boolean {
    const expectedBody = this.cannedBody(canned, sourceLanguage);
    const expectedTitle = this.cannedTitle(canned, sourceLanguage);
    const bodyMatches =
      body.trim() === expectedBody ||
      body.trim() === canned.bodyEn ||
      body.trim() === canned.bodyFr;
    const titleMatches =
      !title ||
      title.trim() === expectedTitle ||
      title.trim() === canned.titleEn ||
      title.trim() === canned.titleFr;
    return bodyMatches && titleMatches;
  }

  private cannedBody(copy: BilingualBroadcastCopy, lang: 'en' | 'fr'): string {
    return lang === 'fr' ? copy.bodyFr : copy.bodyEn;
  }

  private cannedTitle(copy: BilingualBroadcastCopy, lang: 'en' | 'fr'): string {
    return lang === 'fr' ? copy.titleFr : copy.titleEn;
  }

  private async translateCustom(
    title: string,
    body: string,
    sourceLanguage: 'en' | 'fr'
  ): Promise<BilingualBroadcastCopy> {
    try {
      const response = await this.deepseek.chatCompletions(
        {
          model: this.deepseek.defaultChatModel,
          messages: [
            {
              role: 'system',
              content:
                'You translate short mobile push notifications. Return ONLY valid JSON with keys title_en, body_en, title_fr, body_fr. Keep meaning, tone, and brevity. Do not add marketing fluff.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                source_language: sourceLanguage,
                title,
                body,
              }),
            },
          ],
          max_tokens: 500,
          temperature: 0.2,
        },
        30000
      );
      const raw = response.choices?.[0]?.message?.content;
      const parsed = this.parseTranslationJson(
        typeof raw === 'string' ? raw : ''
      );
      if (parsed) return parsed;
    } catch (error: any) {
      this.logger.warn(
        `Broadcast translation failed, mirroring source: ${error?.message ?? error}`
      );
    }
    return this.mirrorSource(title, body, sourceLanguage);
  }

  private parseTranslationJson(raw: string): BilingualBroadcastCopy | null {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const obj = JSON.parse(match[0]) as Record<string, string>;
      if (!obj.title_en || !obj.body_en || !obj.title_fr || !obj.body_fr) {
        return null;
      }
      return {
        titleEn: obj.title_en.trim(),
        bodyEn: obj.body_en.trim(),
        titleFr: obj.title_fr.trim(),
        bodyFr: obj.body_fr.trim(),
      };
    } catch {
      return null;
    }
  }

  private mirrorSource(
    title: string,
    body: string,
    sourceLanguage: 'en' | 'fr'
  ): BilingualBroadcastCopy {
    if (sourceLanguage === 'fr') {
      return { titleEn: title, bodyEn: body, titleFr: title, bodyFr: body };
    }
    return { titleEn: title, bodyEn: body, titleFr: title, bodyFr: body };
  }

  private async insertCampaign(params: {
    adminUserId: string;
    dto: CreateBroadcastDto;
    copy: BilingualBroadcastCopy;
    messageHash: string;
    actionType: string;
    preview: { total: number; eligible: number };
    sourceLanguage: string;
    title?: string;
    body: string;
  }): Promise<string> {
    const result = await this.hasura.executeMutation<{
      insert_admin_broadcast_campaigns_one: { id: string };
    }>(
      `mutation Ins($obj: admin_broadcast_campaigns_insert_input!) {
        insert_admin_broadcast_campaigns_one(object: $obj) { id }
      }`,
      {
        obj: {
          created_by_user_id: params.adminUserId,
          status: 'queued',
          audience_type: params.dto.audienceType,
          filters: params.dto.filters ?? {},
          template_key: params.dto.templateKey,
          action_type: params.actionType,
          source_language: params.sourceLanguage,
          source_title: params.title ?? null,
          source_body: params.body,
          title_en: params.copy.titleEn,
          body_en: params.copy.bodyEn,
          title_fr: params.copy.titleFr,
          body_fr: params.copy.bodyFr,
          message_hash: params.messageHash,
          target_count: params.preview.total,
          eligible_count: params.preview.eligible,
        },
      }
    );
    const id = result.insert_admin_broadcast_campaigns_one?.id;
    if (!id) throw new BadRequestException('Failed to create campaign');
    return id;
  }

  private async deliverToUser(
    campaign: CampaignRow,
    userId: string,
    preferredLanguage: 'en' | 'fr'
  ): Promise<'sent' | 'skipped' | 'failed'> {
    try {
      if (await this.audience.wasRecentlyTargeted(userId, campaign.message_hash)) {
        return 'skipped';
      }
      const existingId = await this.findExistingMessage(campaign.id, userId);
      if (existingId) {
        await this.safeUpsertRetarget(userId, campaign.message_hash, campaign.id);
        return 'skipped';
      }
      const title =
        preferredLanguage === 'en' ? campaign.title_en : campaign.title_fr;
      const body =
        preferredLanguage === 'en' ? campaign.body_en : campaign.body_fr;
      const messageType = messageTypeForAction(
        campaign.action_type as 'generic' | 'app_upgrade' | 'business_account_setup'
      );
      const messageId = await this.insertUserMessage({
        userId,
        campaignId: campaign.id,
        messageType,
        title,
        body,
        campaign,
      });
      await this.safeUpsertRetarget(userId, campaign.message_hash, campaign.id);
      await this.safePush(campaign, userId, title, body, messageId);
      return 'sent';
    } catch (error: any) {
      this.logger.warn(
        `Deliver failed campaign=${campaign.id} user=${userId}: ${error?.message ?? error}`
      );
      return 'failed';
    }
  }

  private async safeUpsertRetarget(
    userId: string,
    messageHash: string,
    campaignId: string
  ): Promise<void> {
    try {
      await this.upsertRetarget(userId, messageHash, campaignId);
    } catch (error: any) {
      this.logger.warn(
        `Retarget upsert failed campaign=${campaignId} user=${userId}: ${error?.message ?? error}`
      );
    }
  }

  private async safePush(
    campaign: CampaignRow,
    userId: string,
    title: string,
    body: string,
    messageId: string
  ): Promise<void> {
    try {
      await this.notifications.sendAdminBroadcastPush({
        userId,
        title,
        body,
        campaignId: campaign.id,
        actionType: campaign.action_type,
        messageId,
      });
    } catch (pushError: any) {
      this.logger.warn(
        `Push failed campaign=${campaign.id} user=${userId}: ${pushError?.message ?? pushError}`
      );
    }
  }

  private async findExistingMessage(
    campaignId: string,
    userId: string
  ): Promise<string | null> {
    const result = await this.hasura.executeQuery<{
      user_messages: Array<{ id: string }>;
    }>(
      `query Existing($userId: uuid!, $campaignId: uuid!) {
        user_messages(
          where: {
            user_id: { _eq: $userId }
            entity_type: { _eq: admin_broadcast }
            entity_id: { _eq: $campaignId }
          }
          limit: 1
        ) { id }
      }`,
      { userId, campaignId }
    );
    return result.user_messages?.[0]?.id ?? null;
  }

  private async insertUserMessage(params: {
    userId: string;
    campaignId: string;
    messageType: string;
    title: string;
    body: string;
    campaign: CampaignRow;
  }): Promise<string> {
    const payload = {
      action_type: params.campaign.action_type,
      campaign_id: params.campaignId,
      message_hash: params.campaign.message_hash,
      title_en: params.campaign.title_en,
      body_en: params.campaign.body_en,
      title_fr: params.campaign.title_fr,
      body_fr: params.campaign.body_fr,
      title: params.title,
    };
    const result = await this.hasura.executeMutation<{
      insert_user_messages_one: { id: string };
    }>(
      `mutation InsMsg(
        $userId: uuid!
        $entityId: uuid!
        $message: String!
        $messageType: String!
        $payload: jsonb!
      ) {
        insert_user_messages_one(
          object: {
            user_id: $userId
            entity_type: admin_broadcast
            entity_id: $entityId
            message: $message
            message_type: $messageType
            message_payload: $payload
            is_immutable: true
          }
        ) { id }
      }`,
      {
        userId: params.userId,
        entityId: params.campaignId,
        message: `${params.title}\n\n${params.body}`,
        messageType: params.messageType,
        payload,
      }
    );
    return result.insert_user_messages_one.id;
  }

  private async upsertRetarget(
    userId: string,
    messageHash: string,
    campaignId: string
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation Upsert(
        $userId: uuid!
        $hash: String!
        $campaignId: uuid!
        $sentAt: timestamptz!
      ) {
        insert_admin_broadcast_retargets_one(
          object: {
            user_id: $userId
            message_hash: $hash
            last_campaign_id: $campaignId
            last_sent_at: $sentAt
          }
          on_conflict: {
            constraint: admin_broadcast_retargets_pkey
            update_columns: [last_sent_at, last_campaign_id]
          }
        ) { user_id }
      }`,
      {
        userId,
        hash: messageHash,
        campaignId,
        sentAt: new Date().toISOString(),
      }
    );
  }

  private async markStatus(
    id: string,
    status: string,
    extras: Record<string, unknown> = {}
  ): Promise<void> {
    const set: Record<string, unknown> = { status, ...extras };
    if (set.started_at === 'now()') set.started_at = new Date().toISOString();
    if (set.completed_at === 'now()') set.completed_at = new Date().toISOString();
    await this.hasura.executeMutation(
      `mutation Up($id: uuid!, $set: admin_broadcast_campaigns_set_input!) {
        update_admin_broadcast_campaigns_by_pk(pk_columns: { id: $id }, _set: $set) { id }
      }`,
      { id, set }
    );
  }

  private async updateCounters(
    id: string,
    counts: { sent: number; skipped: number; failed: number }
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation Up(
        $id: uuid!
        $sent: Int!
        $skipped: Int!
        $failed: Int!
      ) {
        update_admin_broadcast_campaigns_by_pk(
          pk_columns: { id: $id }
          _set: {
            sent_count: $sent
            skipped_dedupe_count: $skipped
            failed_count: $failed
          }
        ) { id }
      }`,
      {
        id,
        sent: counts.sent,
        skipped: counts.skipped,
        failed: counts.failed,
      }
    );
  }
}
