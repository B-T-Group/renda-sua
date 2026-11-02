import { HttpException, HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { emitServerSiteEvent } from '../site-events/server-site-events.helper';
import { SiteEventsService } from '../site-events/site-events.service';
import {
  RECOVERY_ERRORS,
  RejectionCategory,
  categoryAllows,
  isRejectionCategory,
} from './item-recovery.constants';
import * as Q from './item-recovery.queries';

export interface RecordRejectionParams {
  itemId: string;
  category: RejectionCategory;
  reason: string;
  /** NULL for AI decisions. */
  reviewerId: string | null;
  source: 'admin' | 'ai';
}

interface ResubmitGateItem {
  id: string;
  moderation_status: string;
  rejection_category: string | null;
  current_rejection: { id: string; category: string; created_at: string } | null;
  appeals: Array<{ id: string; status: string }>;
}

const RESUBMIT_GATE = `
  query ItemResubmitGate($id: uuid!) {
    items_by_pk(id: $id) {
      id moderation_status rejection_category
      current_rejection { id category created_at }
      appeals(where: { status: { _eq: pending } }) { id status }
    }
  }
`;

/**
 * B2 rejection records + the resubmit edge-case rules shared by every rejection
 * and resubmit path (admin reject, AI reject, AI-proposal force reject, business
 * edit, explicit resubmit, CSV).
 */
@Injectable()
export class ItemRejectionsService {
  private readonly logger = new Logger(ItemRejectionsService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    @Optional() private readonly siteEvents?: SiteEventsService
  ) {}

  /** Called after the item status flipped to rejected (category set in that same write). */
  async recordRejection(params: RecordRejectionParams): Promise<{ rejectionId: string }> {
    if (!isRejectionCategory(params.category)) {
      throw new HttpException(
        { success: false, code: RECOVERY_ERRORS.CATEGORY_REQUIRED, error: 'A valid rejection category is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    const snapshot = await this.loadSnapshot(params.itemId);
    const rejectionId = randomUUID();
    await this.hasura.executeMutation(Q.RECORD_ITEM_REJECTION, {
      rejection: {
        id: rejectionId,
        item_id: params.itemId,
        category: params.category,
        reason: params.reason ?? '',
        reviewer_id: params.reviewerId,
        source: params.source,
        item_snapshot: snapshot,
      },
      itemId: params.itemId,
      rejectionId,
      category: params.category,
      audit: {
        item_id: params.itemId,
        rejection_id: rejectionId,
        actor_user_id: params.reviewerId,
        action: 'rejected',
        details: { category: params.category, source: params.source },
      },
    });
    emitServerSiteEvent(this.siteEvents, 'item_moderation.rejected', {
      itemId: params.itemId,
      rejectionId,
      category: params.category,
      source: params.source,
      ...(params.reviewerId ? { reviewerId: params.reviewerId } : {}),
    });
    return { rejectionId };
  }

  /**
   * Gate for any rejected -> pending transition the business triggers.
   * - Not-allowed categories (prohibited/counterfeit) never resubmit: returns false.
   * - A pending appeal needs explicit confirmation (it is withdrawn by the DB trigger).
   * Returns true when the caller should resubmit.
   */
  async assertResubmitAllowed(
    itemId: string,
    opts: { confirmWithdrawAppeal?: boolean; strict?: boolean }
  ): Promise<{ resubmit: boolean; withdrawsAppealId: string | null; category: string | null; rejectedAt: string | null }> {
    const item = await this.loadGate(itemId);
    if (!item || item.moderation_status !== 'rejected') {
      return { resubmit: false, withdrawsAppealId: null, category: null, rejectedAt: null };
    }
    const category = item.rejection_category ?? item.current_rejection?.category ?? null;
    const rejectedAt = item.current_rejection?.created_at ?? null;
    if (!categoryAllows(category, 'resubmit')) {
      if (opts.strict) {
        throw new HttpException(
          {
            success: false,
            code: RECOVERY_ERRORS.ACTION_NOT_ALLOWED,
            error: 'This item cannot be resubmitted; you can appeal the decision instead',
          },
          HttpStatus.CONFLICT
        );
      }
      return { resubmit: false, withdrawsAppealId: null, category, rejectedAt };
    }
    const pending = item.appeals?.[0] ?? null;
    if (pending && !opts.confirmWithdrawAppeal) {
      throw new HttpException(
        {
          success: false,
          code: RECOVERY_ERRORS.WITHDRAW_CONFIRM_REQUIRED,
          error: 'Resubmitting will withdraw your pending appeal. Confirm to continue.',
          appealId: pending.id,
        },
        HttpStatus.CONFLICT
      );
    }
    return { resubmit: true, withdrawsAppealId: pending?.id ?? null, category, rejectedAt };
  }

  /** Audit + metrics after a resubmit landed (the DB trigger already withdrew the appeal). */
  async noteResubmitted(
    itemId: string,
    gate: { withdrawsAppealId: string | null; category: string | null; rejectedAt: string | null },
    actorUserId: string | null
  ): Promise<void> {
    const hours = gate.rejectedAt ? (Date.now() - new Date(gate.rejectedAt).getTime()) / 3_600_000 : null;
    await this.audit({
      item_id: itemId,
      appeal_id: gate.withdrawsAppealId,
      actor_user_id: actorUserId,
      action: 'resubmitted',
      details: { category: gate.category, withdrewAppeal: !!gate.withdrawsAppealId },
    });
    emitServerSiteEvent(this.siteEvents, 'item_moderation.resubmitted', {
      itemId,
      category: gate.category,
      hoursSinceRejection: hours == null ? null : Math.round(hours * 10) / 10,
      withdrewAppeal: !!gate.withdrawsAppealId,
    });
    if (gate.withdrawsAppealId) {
      emitServerSiteEvent(this.siteEvents, 'item_appeal.withdrawn', {
        itemId,
        appealId: gate.withdrawsAppealId,
        reason: 'resubmitted',
      });
    }
  }

  /** Approved after a rejection (any path): recovery metric. */
  async noteApproved(itemId: string, via: 'admin' | 'ai' | 'appeal' | 'business_accept'): Promise<void> {
    try {
      const r = await this.hasura.executeQuery<{
        items_by_pk: { current_rejection: { id: string; category: string; created_at: string } | null } | null;
      }>(`query ItemLastRejection($id: uuid!) { items_by_pk(id: $id) { current_rejection { id category created_at } } }`, {
        id: itemId,
      });
      const rej = r.items_by_pk?.current_rejection;
      if (!rej) return;
      const hours = (Date.now() - new Date(rej.created_at).getTime()) / 3_600_000;
      emitServerSiteEvent(this.siteEvents, 'item_moderation.recovered', {
        itemId,
        rejectionId: rej.id,
        category: rej.category,
        via,
        hoursToRecover: Math.round(hours * 10) / 10,
        within7Days: hours <= 24 * 7,
      });
    } catch (e: any) {
      this.logger.warn(`noteApproved(${itemId}) skipped: ${e?.message ?? e}`);
    }
  }

  /** B10 "deleted after rejection" + appeal withdrawn metrics (DB trigger did the withdraw). */
  async noteDeleted(itemId: string): Promise<void> {
    try {
      const r = await this.hasura.executeQuery<{
        items_by_pk: {
          moderation_status: string;
          rejection_category: string | null;
          appeals: Array<{ id: string }>;
        } | null;
      }>(
        `query ItemDeletedAfterRejection($id: uuid!) {
          items_by_pk(id: $id) {
            moderation_status rejection_category
            appeals(where: { status: { _eq: withdrawn }, withdrawn_reason: { _eq: "item_deleted" } }) { id }
          }
        }`,
        { id: itemId }
      );
      const item = r.items_by_pk;
      if (!item || item.moderation_status !== 'rejected') return;
      emitServerSiteEvent(this.siteEvents, 'item_moderation.deleted_after_rejection', {
        itemId,
        category: item.rejection_category,
      });
      for (const a of item.appeals ?? []) {
        emitServerSiteEvent(this.siteEvents, 'item_appeal.withdrawn', { itemId, appealId: a.id, reason: 'item_deleted' });
      }
    } catch (e: any) {
      this.logger.warn(`noteDeleted(${itemId}) skipped: ${e?.message ?? e}`);
    }
  }

  async audit(object: Record<string, unknown>): Promise<void> {
    try {
      await this.hasura.executeMutation(Q.INSERT_AUDIT, { object });
    } catch (e: any) {
      this.logger.error(`item moderation audit insert failed: ${e?.message ?? e}`);
    }
  }

  private async loadGate(itemId: string): Promise<ResubmitGateItem | null> {
    const r = await this.hasura.executeQuery<{ items_by_pk: ResubmitGateItem | null }>(RESUBMIT_GATE, { id: itemId });
    return r.items_by_pk ?? null;
  }

  private async loadSnapshot(itemId: string): Promise<Record<string, unknown> | null> {
    try {
      const r = await this.hasura.executeQuery<{ items_by_pk: Record<string, unknown> | null }>(
        Q.ITEM_SNAPSHOT_FOR_REJECTION,
        { id: itemId }
      );
      return r.items_by_pk ?? null;
    } catch (e: any) {
      this.logger.warn(`rejection snapshot for ${itemId} failed: ${e?.message ?? e}`);
      return null;
    }
  }
}
