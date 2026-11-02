import { AwsService } from '../aws/aws.service';
import { randomUUID } from 'crypto';
import {
  APPEAL_EVIDENCE_MAX_BYTES,
  APPEAL_EVIDENCE_URL_TTL_SECONDS,
  EvidenceStorage,
  evidencePrefix,
  evidencePublicUrl,
  isOwnEvidenceUrl,
  validateEvidenceUpload,
} from './appeal-evidence';
import { HttpException, HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { CLEANUP_TOKEN_COST } from '../business-tokens/business-tokens.packs';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ItemActivationValidationService } from '../image-validation/item-activation-validation.service';
import { RESET_ITEM_PENDING } from '../item-ai-review/item-ai-review.queries';
import { ItemAiReviewService } from '../item-ai-review/item-ai-review.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformPermissions, PlatformRoles } from '../rbac/platform-permissions';
import { emitServerSiteEvent } from '../site-events/server-site-events.helper';
import { SiteEventsService } from '../site-events/site-events.service';
import { appealDecidedCopy, appealReceivedCopy } from './item-appeal-notices';
import {
  APPEAL_EVIDENCE_MAX,
  APPEAL_REASON_MAX,
  APPEAL_REASON_MIN,
  CATEGORY_ACTIONS,
  CONFIG_APPEAL_LIMIT,
  CONFIG_APPEAL_SLA_HOURS,
  DEFAULT_APPEAL_LIMIT,
  DEFAULT_APPEAL_SLA_HOURS,
  ITEM_CONDITIONS,
  ItemCondition,
  RECOVERY_ERRORS,
  REVIEW_SLA_HOURS,
  RejectionCategory,
  WEAR_NOTE_MAX,
  WEAR_NOTE_MIN,
  categoryActions,
  categoryAllows,
  editedSinceRejection,
  isRejectionCategory,
  slaState,
  statusDisplay,
} from './item-recovery.constants';
import * as Q from './item-recovery.queries';
import { ItemRejectionsService } from './item-rejections.service';

type Row = Record<string, any>;

export function recoveryError(status: HttpStatus, code: string, error: string, extra: Row = {}): HttpException {
  return new HttpException({ success: false, code, error, ...extra }, status);
}

/** Pure B4 validation, exported for tests. Returns the trimmed reason and evidence. */
export function validateAppealInput(
  reason: unknown,
  evidenceUrls: unknown,
  evidence: { itemId: string; storage: EvidenceStorage }
): { reason: string; evidenceUrls: string[] } {
  const trimmed = typeof reason === 'string' ? reason.trim() : '';
  if (trimmed.length < APPEAL_REASON_MIN || trimmed.length > APPEAL_REASON_MAX) {
    throw recoveryError(
      HttpStatus.BAD_REQUEST,
      RECOVERY_ERRORS.REASON_LENGTH,
      `Reason must be ${APPEAL_REASON_MIN}–${APPEAL_REASON_MAX} characters`,
      { min: APPEAL_REASON_MIN, max: APPEAL_REASON_MAX }
    );
  }
  const urls = evidenceUrls == null ? [] : evidenceUrls;
  if (!Array.isArray(urls) || urls.length > APPEAL_EVIDENCE_MAX) {
    throw recoveryError(HttpStatus.BAD_REQUEST, RECOVERY_ERRORS.EVIDENCE_LIMIT, `At most ${APPEAL_EVIDENCE_MAX} evidence photos`, {
      max: APPEAL_EVIDENCE_MAX,
    });
  }
  const clean = urls.map((u) => (typeof u === 'string' ? u.trim() : ''));
  if (clean.some((u) => !isOwnEvidenceUrl(u, evidence.storage, evidence.itemId))) {
    throw recoveryError(
      HttpStatus.BAD_REQUEST,
      RECOVERY_ERRORS.EVIDENCE_URL,
      'Evidence must be photos uploaded for this item via the appeal evidence upload URL'
    );
  }
  if (new Set(clean).size !== clean.length) {
    throw recoveryError(HttpStatus.BAD_REQUEST, RECOVERY_ERRORS.EVIDENCE_URL, 'Duplicate evidence photo');
  }
  return { reason: trimmed, evidenceUrls: clean };
}

/** Pure condition/wear-note rule (wear note required unless new). Returns the value to store. */
export function validateCondition(condition: unknown, wearNote: unknown): { condition: ItemCondition; wearNote: string | null } {
  if (!(ITEM_CONDITIONS as readonly string[]).includes(condition as string)) {
    throw recoveryError(HttpStatus.BAD_REQUEST, RECOVERY_ERRORS.ACTION_NOT_ALLOWED, 'Unknown condition');
  }
  if (condition === 'new') return { condition: 'new', wearNote: null };
  const note = typeof wearNote === 'string' ? wearNote.trim() : '';
  if (!note) {
    throw recoveryError(HttpStatus.BAD_REQUEST, RECOVERY_ERRORS.WEAR_NOTE_REQUIRED, 'Describe the wear for used/refurbished items');
  }
  if (note.length < WEAR_NOTE_MIN || note.length > WEAR_NOTE_MAX) {
    throw recoveryError(HttpStatus.BAD_REQUEST, RECOVERY_ERRORS.WEAR_NOTE_LENGTH, `Wear note must be ${WEAR_NOTE_MIN}–${WEAR_NOTE_MAX} characters`, {
      min: WEAR_NOTE_MIN,
      max: WEAR_NOTE_MAX,
    });
  }
  return { condition: condition as ItemCondition, wearNote: note };
}

/** Overturn target: edited items always go back through review (spec edge case). */
export function overturnTarget(overturnTo: 'approve' | 're_review' | undefined, edited: boolean): 'approved' | 'pending' {
  return edited || overturnTo === 're_review' ? 'pending' : 'approved';
}

@Injectable()
export class ItemAppealsService {
  private readonly logger = new Logger(ItemAppealsService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly rejections: ItemRejectionsService,
    private readonly notifications: NotificationsService,
    private readonly aiReview: ItemAiReviewService,
    private readonly activationValidation: ItemActivationValidationService,
    private readonly merchantLifecycle: MerchantLifecycleService,
    private readonly aws: AwsService,
    @Optional() private readonly siteEvents?: SiteEventsService
  ) {}

  /** Same bucket/host the backend writes item images to (see AI image cleanup). */
  evidenceStorage(): EvidenceStorage {
    const bucket = this.aws.getDefaultBucketName() || process.env.S3_BUCKET_NAME || 'rendasua-uploads';
    return { bucket, region: this.aws.getBucketRegion() };
  }

  /**
   * B4 evidence upload: validates type (no SVG) + size, then issues a short-lived
   * PUT URL that pins Content-Type and Content-Length, under
   * items/{itemId}/appeal-evidence/ for an item the caller owns and that is rejected.
   */
  async createEvidenceUploadUrl(businessId: string, itemId: string, body: { contentType?: unknown; fileSize?: unknown }) {
    const file = validateEvidenceUpload(body?.contentType, body?.fileSize);
    const { item } = await this.loadOwnedItem(businessId, itemId);
    this.assertRejected(item);
    const storage = this.evidenceStorage();
    const key = `${evidencePrefix(item.id)}${randomUUID()}.${file.ext}`;
    const signed = await this.aws.generateStrictUploadUrl({
      bucketName: storage.bucket,
      key,
      contentType: file.contentType,
      contentLength: file.size,
      expiresIn: APPEAL_EVIDENCE_URL_TTL_SECONDS,
    });
    return {
      uploadUrl: signed.url,
      method: 'PUT' as const,
      headers: { 'Content-Type': file.contentType, 'Content-Length': String(file.size) },
      key,
      evidenceUrl: evidencePublicUrl(storage, key),
      expiresAt: signed.expiresAt.toISOString(),
      maxBytes: APPEAL_EVIDENCE_MAX_BYTES,
    };
  }

  // ---------------------------------------------------------------- business

  rejectionActions() {
    return { categories: CATEGORY_ACTIONS, reviewSlaHours: REVIEW_SLA_HOURS };
  }

  async getRecovery(businessId: string, itemId: string) {
    const { item, cleanupTokens } = await this.loadOwnedItem(businessId, itemId);
    const config = await this.loadConfig();
    const rejection = item.current_rejection ?? null;
    const category: string | null = item.moderation_status === 'rejected' ? item.rejection_category ?? rejection?.category ?? null : null;
    const forRejection = (item.appeals ?? []).filter((a: Row) => rejection && a.rejection_id === rejection.id);
    const used = forRejection.filter((a: Row) => a.status !== 'withdrawn').length;
    const pending = forRejection.find((a: Row) => a.status === 'pending') ?? null;
    const latest = forRejection[0] ?? null;
    const rejected = item.moderation_status === 'rejected';
    const balance = await this.tokenBalance(item.business_id);
    const actions = rejected ? categoryActions(category) : null;
    return {
      item: {
        id: item.id,
        name: item.name,
        moderationStatus: item.moderation_status,
        statusDisplay: statusDisplay(item.moderation_status, category),
        condition: item.condition,
        wearNote: item.wear_note,
      },
      rejection:
        rejected && rejection
          ? {
              id: rejection.id,
              category,
              reason: rejection.reason,
              source: rejection.source,
              decidedBy: rejection.reviewer_id ? 'admin' : 'ai',
              createdAt: rejection.created_at,
            }
          : null,
      actions: actions?.actions ?? [],
      resubmitEditLink: actions?.resubmitEditLink ?? null,
      appeal: latest ? this.appealView(latest) : null,
      appealsUsed: used,
      appealLimit: config.limit,
      canAppeal: rejected && !!rejection && !pending && used < config.limit,
      canResubmit: rejected && categoryAllows(category, 'resubmit'),
      resubmitWithdrawsAppeal: !!pending,
      aiCleanup: { costPerImage: CLEANUP_TOKEN_COST, tokenBalance: balance, tokensSpentOnItem: cleanupTokens },
      reviewSlaHours: REVIEW_SLA_HOURS,
      appealSlaHours: config.slaHours,
    };
  }

  async cleanupQuote(businessId: string, itemId: string, imageCount: number) {
    const { item } = await this.loadOwnedItem(businessId, itemId);
    const count = Math.max(1, Math.min(20, Math.floor(Number(imageCount) || 0)));
    const total = count * CLEANUP_TOKEN_COST;
    const balance = await this.tokenBalance(item.business_id);
    const sufficient = balance >= total;
    if (!sufficient) {
      emitServerSiteEvent(this.siteEvents, 'item_recovery.buy_tokens_prompted', { itemId, needed: total - balance });
    }
    return {
      imageCount: count,
      costPerImage: CLEANUP_TOKEN_COST,
      totalCost: total,
      tokenBalance: balance,
      sufficient,
      shortfall: Math.max(0, total - balance),
      code: sufficient ? null : RECOVERY_ERRORS.INSUFFICIENT_AI_TOKENS,
    };
  }

  async createAppeal(businessId: string, userId: string, itemId: string, body: { reason?: unknown; evidenceUrls?: unknown }) {
    const { item } = await this.loadOwnedItem(businessId, itemId);
    const input = validateAppealInput(body?.reason, body?.evidenceUrls, {
      itemId: item.id,
      storage: this.evidenceStorage(),
    });
    this.assertRejected(item);
    const rejection = item.current_rejection;
    if (!rejection) {
      throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.ITEM_NOT_REJECTED, 'No rejection on record for this item');
    }
    const forRejection = (item.appeals ?? []).filter((a: Row) => a.rejection_id === rejection.id);
    if (forRejection.some((a: Row) => a.status === 'pending')) {
      throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.APPEAL_PENDING, 'An appeal is already pending');
    }
    const config = await this.loadConfig();
    if (forRejection.filter((a: Row) => a.status !== 'withdrawn').length >= config.limit) {
      throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.APPEAL_LIMIT_REACHED, 'Appeal limit reached for this decision', {
        limit: config.limit,
      });
    }
    const now = new Date();
    const slaDueAt = new Date(now.getTime() + config.slaHours * 3_600_000).toISOString();
    let created: Row;
    try {
      const res = await this.hasura.executeMutation<{ insert_item_appeals_one: Row }>(Q.INSERT_APPEAL, {
        object: {
          rejection_id: rejection.id,
          item_id: item.id,
          business_id: item.business_id,
          submitted_by_user_id: userId,
          reason: input.reason,
          evidence_urls: input.evidenceUrls,
          sla_due_at: slaDueAt,
        },
        audit: {
          item_id: item.id,
          rejection_id: rejection.id,
          actor_user_id: userId,
          action: 'appeal_created',
          details: { evidenceCount: input.evidenceUrls.length },
        },
      });
      created = res.insert_item_appeals_one;
    } catch (e: any) {
      if (/item_appeals_one_pending_per_rejection|uniqueness|unique/i.test(String(e?.message ?? ''))) {
        throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.APPEAL_PENDING, 'An appeal is already pending');
      }
      throw e;
    }
    emitServerSiteEvent(this.siteEvents, 'item_appeal.created', {
      itemId: item.id,
      appealId: created.id,
      category: item.rejection_category,
      evidenceCount: input.evidenceUrls.length,
    });
    emitServerSiteEvent(this.siteEvents, 'item_recovery.action_used', { itemId: item.id, action: 'appeal', category: item.rejection_category });
    await this.noticeReceived(item, created.id, config.slaHours);
    return this.appealView(created);
  }

  async withdrawAppeal(businessId: string, userId: string, itemId: string, appealId: string) {
    await this.loadOwnedItem(businessId, itemId);
    const res = await this.hasura.executeMutation<{ update_item_appeals: { affected_rows: number } }>(
      `mutation WithdrawItemAppeal($id: uuid!, $itemId: uuid!) {
        update_item_appeals(
          where: { id: { _eq: $id }, item_id: { _eq: $itemId }, status: { _eq: pending } }
          _set: { status: withdrawn, withdrawn_reason: "business" }
        ) { affected_rows }
      }`,
      { id: appealId, itemId }
    );
    if (!res.update_item_appeals?.affected_rows) {
      throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.APPEAL_NOT_PENDING, 'This appeal is no longer pending');
    }
    await this.rejections.audit({ item_id: itemId, appeal_id: appealId, actor_user_id: userId, action: 'appeal_withdrawn', details: { reason: 'business' } });
    emitServerSiteEvent(this.siteEvents, 'item_appeal.withdrawn', { itemId, appealId, reason: 'business' });
    return { appealId, status: 'withdrawn' as const };
  }

  async resubmit(businessId: string, userId: string, itemId: string, body: { confirmWithdrawAppeal?: boolean }) {
    const { item } = await this.loadOwnedItem(businessId, itemId);
    this.assertRejected(item);
    const gate = await this.rejections.assertResubmitAllowed(itemId, {
      confirmWithdrawAppeal: body?.confirmWithdrawAppeal === true,
      strict: true,
    });
    const reset = await this.hasura.executeMutation<{ update_items_by_pk: { id: string } | null }>(RESET_ITEM_PENDING, { id: itemId });
    if (!reset.update_items_by_pk) {
      throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.ITEM_NOT_REJECTED, 'Item could not be resubmitted');
    }
    await this.rejections.noteResubmitted(itemId, gate, userId);
    void this.aiReview.requestReview(itemId);
    return { itemId, moderationStatus: 'pending' as const, withdrewAppealId: gate.withdrawsAppealId };
  }

  async setCondition(businessId: string, userId: string, itemId: string, body: { condition?: unknown; wearNote?: unknown }) {
    const value = validateCondition(body?.condition, body?.wearNote);
    const { item } = await this.loadOwnedItem(businessId, itemId);
    if (item.moderation_status === 'rejected' && !categoryAllows(item.rejection_category, 'condition')) {
      throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.ACTION_NOT_ALLOWED, 'Condition cannot be changed for this decision');
    }
    const res = await this.hasura.executeMutation<{ update_items_by_pk: Row }>(Q.SET_ITEM_CONDITION, {
      id: itemId,
      condition: value.condition,
      wearNote: value.wearNote,
    });
    if (item.moderation_status === 'rejected') {
      emitServerSiteEvent(this.siteEvents, 'item_recovery.action_used', { itemId, action: 'condition', category: item.rejection_category });
      await this.rejections.audit({ item_id: itemId, actor_user_id: userId, action: 'condition_changed', details: { condition: value.condition } });
    }
    const row = res.update_items_by_pk;
    return { itemId, condition: row.condition, wearNote: row.wear_note, isUsed: row.is_used };
  }

  // ------------------------------------------------------------------- admin

  async listQueue(q: { status?: string; category?: string; businessId?: string; limit?: number; offset?: number }) {
    const where: Row = { status: { _eq: q.status ?? 'pending' } };
    if (q.category) {
      if (!isRejectionCategory(q.category)) throw recoveryError(HttpStatus.BAD_REQUEST, RECOVERY_ERRORS.CATEGORY_REQUIRED, 'Unknown category');
      where.rejection = { category: { _eq: q.category } };
    }
    if (q.businessId) where.business_id = { _eq: q.businessId };
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 100);
    const offset = Math.max(Number(q.offset) || 0, 0);
    const res = await this.hasura.executeQuery<{ item_appeals: Row[]; item_appeals_aggregate: { aggregate: { count: number } } }>(
      Q.APPEALS_QUEUE,
      { where, limit, offset }
    );
    const now = new Date();
    return {
      total: res.item_appeals_aggregate?.aggregate?.count ?? 0,
      appeals: (res.item_appeals ?? []).map((a) => ({
        ...this.appealView(a, now),
        item: { id: a.item?.id, name: a.item?.name, moderationStatus: a.item?.moderation_status, imageUrl: a.item?.item_images?.[0]?.image_url ?? null },
        business: a.business ? { id: a.business.id, name: a.business.name } : null,
        rejection: a.rejection ? this.rejectionView(a.rejection) : null,
      })),
    };
  }

  async counts() {
    const res = await this.hasura.executeQuery<Row>(Q.APPEALS_COUNTS, { now: new Date().toISOString() });
    return { pending: res.pending?.aggregate?.count ?? 0, breached: res.breached?.aggregate?.count ?? 0 };
  }

  async detail(appealId: string, adminUserId: string) {
    const a = await this.loadAppeal(appealId);
    const history = await this.hasura.executeQuery<{ item_moderation_audit: Row[]; item_rejections: Row[] }>(Q.ITEM_HISTORY, {
      itemId: a.item_id,
    });
    const selfReview = !!a.rejection?.reviewer_id && a.rejection.reviewer_id === adminUserId;
    return {
      appeal: this.appealView(a),
      rejection: a.rejection ? { ...this.rejectionView(a.rejection), itemSnapshot: a.rejection.item_snapshot ?? null } : null,
      item: a.item,
      business: a.business ? { id: a.business.id, name: a.business.name } : null,
      editedSinceRejection: a.rejection ? editedSinceRejection(a.rejection.created_at, a.item ?? {}) : false,
      selfReview,
      history: { audit: history.item_moderation_audit ?? [], rejections: (history.item_rejections ?? []).map((r) => this.rejectionView(r)) },
    };
  }

  async decide(
    appealId: string,
    adminUserId: string,
    body: { decision?: string; note?: string; overturnTo?: 'approve' | 're_review'; correctedCategory?: string }
  ) {
    if (body?.decision !== 'uphold' && body?.decision !== 'overturn') {
      throw recoveryError(HttpStatus.BAD_REQUEST, RECOVERY_ERRORS.ACTION_NOT_ALLOWED, 'decision must be uphold or overturn');
    }
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (body.decision === 'uphold' && !note) {
      throw recoveryError(HttpStatus.BAD_REQUEST, RECOVERY_ERRORS.UPHOLD_NOTE_REQUIRED, 'A note is required to uphold');
    }
    if (body.correctedCategory != null && !isRejectionCategory(body.correctedCategory)) {
      throw recoveryError(HttpStatus.BAD_REQUEST, RECOVERY_ERRORS.CATEGORY_REQUIRED, 'Unknown category');
    }
    const a = await this.loadAppeal(appealId);
    if (a.status !== 'pending') {
      throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.APPEAL_NOT_PENDING, 'This appeal was already decided or withdrawn', { status: a.status });
    }
    const warnings = await this.assertNotSelfReview(a, adminUserId);
    const decidedAt = new Date().toISOString();
    let outcome: 'upheld' | 'approved' | 'pending';
    if (body.decision === 'uphold') {
      const res = await this.hasura.executeMutation<{ update_item_appeals: { affected_rows: number } }>(Q.UPHOLD_APPEAL, {
        appealId,
        appealSet: { status: 'upheld', admin_id: adminUserId, admin_note: note, decided_at: decidedAt, corrected_category: body.correctedCategory ?? null },
      });
      if (!res.update_item_appeals?.affected_rows) {
        throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.APPEAL_NOT_PENDING, 'This appeal was already decided or withdrawn');
      }
      if (body.correctedCategory && body.correctedCategory !== a.rejection?.category) {
        await this.hasura.executeMutation(Q.CORRECT_CATEGORY, { itemId: a.item_id, rejectionId: a.rejection_id, category: body.correctedCategory });
      }
      outcome = 'upheld';
    } else {
      const edited = a.rejection ? editedSinceRejection(a.rejection.created_at, a.item ?? {}) : false;
      const target = overturnTarget(body.overturnTo, edited);
      if (target === 'approved') await this.activationValidation.assertItemCanActivateAsSystem(a.item_id);
      const itemSet =
        target === 'approved'
          ? { moderation_status: 'approved', is_active: true, moderated_at: decidedAt, moderated_by_user_id: adminUserId, moderation_source: 'admin' }
          : { moderation_status: 'pending', is_active: false, moderated_at: null, moderated_by_user_id: null, moderation_source: null };
      const res = await this.hasura.executeMutation<{ appeal: { affected_rows: number }; item: { affected_rows: number } }>(Q.OVERTURN_APPEAL, {
        appealId,
        itemId: a.item_id,
        itemSet,
        appealSet: { status: 'overturned', admin_id: adminUserId, admin_note: note || null, decided_at: decidedAt, outcome_moderation_status: target },
      });
      if (!res.appeal?.affected_rows || !res.item?.affected_rows) {
        // Both run in one transaction; a partial result means a race we cannot repair here.
        throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.APPEAL_NOT_PENDING, 'This appeal was already decided or the item changed');
      }
      outcome = target;
      if (target === 'pending') void this.aiReview.requestReview(a.item_id);
      else {
        void this.rejections.noteApproved(a.item_id, 'appeal');
        void this.merchantLifecycle.recompute(a.business_id, 'item_approved').catch(() => undefined);
      }
    }
    await this.rejections.audit({
      item_id: a.item_id,
      rejection_id: a.rejection_id,
      appeal_id: appealId,
      actor_user_id: adminUserId,
      action: body.decision === 'uphold' ? 'appeal_upheld' : 'appeal_overturned',
      details: { outcome, correctedCategory: body.correctedCategory ?? null, warnings },
    });
    const hours = (Date.parse(decidedAt) - Date.parse(a.created_at)) / 3_600_000;
    emitServerSiteEvent(this.siteEvents, 'item_appeal.decided', {
      itemId: a.item_id,
      appealId,
      decision: body.decision,
      outcome,
      category: a.rejection?.category ?? null,
      hoursToDecision: Math.round(hours * 10) / 10,
      slaBreached: Date.parse(decidedAt) >= Date.parse(a.sla_due_at),
    });
    await this.noticeDecided(a, outcome, note);
    return { appealId, status: body.decision === 'uphold' ? 'upheld' : 'overturned', itemModerationStatus: outcome === 'upheld' ? 'rejected' : outcome, warnings };
  }

  // ----------------------------------------------------------------- helpers

  private async assertNotSelfReview(a: Row, adminUserId: string): Promise<string[]> {
    if (!a.rejection?.reviewer_id || a.rejection.reviewer_id !== adminUserId) return [];
    const others = await this.hasura.executeQuery<{ user_roles: Row[]; user_permissions: Row[] }>(Q.OTHER_ITEM_MODERATORS, {
      userId: adminUserId,
      permissionKey: PlatformPermissions.MODERATE_ITEMS,
      superuser: PlatformRoles.SUPERUSER,
    });
    if ((others.user_roles?.length ?? 0) + (others.user_permissions?.length ?? 0) > 0) {
      throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.SELF_REVIEW_BLOCKED, 'Another moderator must review an appeal of your own decision');
    }
    return ['SELF_REVIEW_NO_OTHER_ADMIN'];
  }

  private async loadOwnedItem(businessId: string, itemId: string): Promise<{ item: Row; cleanupTokens: number }> {
    const res = await this.hasura.executeQuery<{ items_by_pk: Row | null; ai_image_cleanup_jobs_aggregate: Row }>(Q.ITEM_RECOVERY_STATE, { id: itemId });
    const item = res.items_by_pk;
    if (!item || item.status === 'deleted') {
      throw recoveryError(HttpStatus.NOT_FOUND, 'ITEM_NOT_FOUND', 'Item not found');
    }
    if (item.business_id !== businessId) {
      throw recoveryError(HttpStatus.FORBIDDEN, RECOVERY_ERRORS.NOT_OWNER, 'This item belongs to another business');
    }
    return { item, cleanupTokens: Number(res.ai_image_cleanup_jobs_aggregate?.aggregate?.sum?.tokens_consumed ?? 0) };
  }

  private assertRejected(item: Row): void {
    if (item.moderation_status === 'rejected') return;
    if (item.moderation_status === 'pending' || item.moderation_status === 'ai_reviewing') {
      throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.RESUBMIT_PENDING, 'This item is already in review');
    }
    throw recoveryError(HttpStatus.CONFLICT, RECOVERY_ERRORS.ITEM_NOT_REJECTED, 'This item is not rejected');
  }

  private async loadAppeal(appealId: string): Promise<Row> {
    const res = await this.hasura.executeQuery<{ item_appeals_by_pk: Row | null }>(Q.APPEAL_DETAIL, { id: appealId });
    if (!res.item_appeals_by_pk) throw recoveryError(HttpStatus.NOT_FOUND, 'ITEM_APPEAL_NOT_FOUND', 'Appeal not found');
    return res.item_appeals_by_pk;
  }

  async loadConfig(): Promise<{ limit: number; slaHours: number }> {
    try {
      const res = await this.hasura.executeQuery<{ application_configurations: Array<{ config_key: string; number_value: number | null }> }>(
        Q.APPEAL_CONFIG,
        { keys: [CONFIG_APPEAL_LIMIT, CONFIG_APPEAL_SLA_HOURS] }
      );
      const get = (k: string) => res.application_configurations?.find((r) => r.config_key === k)?.number_value;
      const limit = Number(get(CONFIG_APPEAL_LIMIT));
      const sla = Number(get(CONFIG_APPEAL_SLA_HOURS));
      return {
        limit: Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : DEFAULT_APPEAL_LIMIT,
        slaHours: Number.isFinite(sla) && sla > 0 ? sla : DEFAULT_APPEAL_SLA_HOURS,
      };
    } catch (e: any) {
      this.logger.warn(`appeal config fallback: ${e?.message ?? e}`);
      return { limit: DEFAULT_APPEAL_LIMIT, slaHours: DEFAULT_APPEAL_SLA_HOURS };
    }
  }

  private async tokenBalance(businessId: string): Promise<number> {
    const res = await this.hasura.executeQuery<{ businesses_by_pk: { ai_tokens: number } | null }>(Q.BUSINESS_TOKEN_BALANCE, { id: businessId });
    return Number(res.businesses_by_pk?.ai_tokens ?? 0);
  }

  private appealView(a: Row, now = new Date()) {
    return {
      id: a.id,
      rejectionId: a.rejection_id,
      itemId: a.item_id,
      businessId: a.business_id,
      reason: a.reason,
      evidenceUrls: a.evidence_urls ?? [],
      status: a.status,
      adminNote: a.admin_note ?? null,
      outcomeModerationStatus: a.outcome_moderation_status ?? null,
      correctedCategory: a.corrected_category ?? null,
      withdrawnReason: a.withdrawn_reason ?? null,
      decidedAt: a.decided_at ?? null,
      slaDueAt: a.sla_due_at,
      slaState: a.status === 'pending' && a.created_at && a.sla_due_at ? slaState(a.created_at, a.sla_due_at, now) : null,
      createdAt: a.created_at,
    };
  }

  private rejectionView(r: Row) {
    return {
      id: r.id,
      category: r.category as RejectionCategory,
      reason: r.reason,
      source: r.source,
      decidedBy: r.reviewer_id ? 'admin' : 'ai',
      reviewerId: r.reviewer_id ?? null,
      createdAt: r.created_at,
    };
  }

  private async userLanguage(userId: string): Promise<string | null> {
    try {
      const res = await this.hasura.executeQuery<{ users_by_pk: { preferred_language: string | null } | null }>(Q.USER_FOR_NOTICE, { id: userId });
      return res.users_by_pk?.preferred_language ?? null;
    } catch {
      return null;
    }
  }

  private async noticeReceived(item: Row, appealId: string, slaHours: number) {
    const userId = item.business?.user_id;
    if (!userId) return;
    const copy = appealReceivedCopy(await this.userLanguage(userId), item.name, slaHours);
    await this.notifications.sendItemAppealNotice({
      userId,
      itemId: item.id,
      appealId,
      messageType: 'item_appeal_received',
      title: copy.title,
      body: copy.body,
      path: `/business/items/${item.id}`,
      event: 'item_appeal_received',
      emailTemplateKey: 'business_item_appeal_received',
      emailVariables: { itemId: item.id, itemName: item.name, slaHours },
    });
  }

  private async noticeDecided(a: Row, outcome: 'upheld' | 'approved' | 'pending', note: string) {
    const userId = a.business?.user_id;
    if (!userId) return;
    const copy = appealDecidedCopy(await this.userLanguage(userId), a.item?.name ?? '', outcome);
    await this.notifications.sendItemAppealNotice({
      userId,
      itemId: a.item_id,
      appealId: a.id,
      messageType: 'item_appeal_decided',
      title: copy.title,
      body: note ? `${copy.body}\n\n${note}` : copy.body,
      path: `/business/items/${a.item_id}`,
      event: 'item_appeal_decided',
      emailTemplateKey: 'business_item_appeal_decided',
      emailVariables: { itemId: a.item_id, itemName: a.item?.name ?? '', outcome: copy.outcomeText, adminNote: note || '' },
    });
  }
}
