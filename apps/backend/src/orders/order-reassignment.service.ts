import { Injectable, Logger, Optional } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { DedicatedAgentsConfigService } from '../dedicated-agents/dedicated-agents-config.service';
import type { OfferDeclineReason } from '../dedicated-agents/dedicated-agents.constants';
import { runAssignmentWrite } from '../dedicated-agents/dedicated-assignment-write.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { emitServerSiteEvent } from '../site-events/server-site-events.helper';
import { SiteEventsService } from '../site-events/site-events.service';
import { isoCountryCode } from './delivery-pricing.util';
import { OrderEventsService } from './order-events.service';
import { OrderOffersService } from './order-offers.service';
import type { MonitoredPickupOrder } from './order-pickup.types';

/** Why a dedicated auto-assignment release was refused (the controller maps these to 4xx). */
export type DedicatedReleaseRefusal =
  | 'unavailable'
  | 'dedicated_disabled'
  | 'not_assigned'
  | 'not_auto_assigned'
  | 'window_closed'
  | 'release_failed'
  /** QA #608 N1: the release could not complete and another agent claimed the order meanwhile. */
  | 'release_lost';

export type DedicatedReleaseResult =
  | { success: true; message: string }
  | { success: false; refusal: DedicatedReleaseRefusal; message: string };

interface DedicatedReleaseOrder {
  id: string;
  order_number: string;
  current_status: string;
  assigned_agent_id: string | null;
  currency: string;
  assignment_source: string | null;
  dedicated_assignment_id: string | null;
  dedicated_release_until: string | null;
  business_location?: { address?: { country?: string | null } | null } | null;
  assigned_agent?: { id: string; user_id: string | null } | null;
  /** Pickup monitoring state, restored if the release has to be undone (QA #608 N1). */
  pickup_state?: string | null;
  pickup_due_at?: string | null;
  pickup_reminder_sent_at?: string | null;
  pickup_at_risk_at?: string | null;
  pickup_overdue_at?: string | null;
  pickup_extension_minutes?: number | null;
  pickup_paused_at?: string | null;
  pickup_pause_reason?: string | null;
  pickup_pause_remaining_ms?: number | null;
  last_agent_distance_m?: number | null;
  last_agent_progress_at?: string | null;
  agent_arrived_pickup_at?: string | null;
}

/** The pickup columns the release clears; the revert puts them back. */
const PICKUP_MONITOR_FIELDS = [
  'pickup_state',
  'pickup_due_at',
  'pickup_reminder_sent_at',
  'pickup_at_risk_at',
  'pickup_overdue_at',
  'pickup_extension_minutes',
  'pickup_paused_at',
  'pickup_pause_reason',
  'pickup_pause_remaining_ms',
  'last_agent_distance_m',
  'last_agent_progress_at',
  'agent_arrived_pickup_at',
] as const;

/** Unassign only while still auto-assigned to this agent, before pickup, inside the stored window. */
const RELEASE_DEDICATED_AUTO_MUTATION = `
  mutation ReleaseDedicatedAutoAssignment($id: uuid!, $agentId: uuid!, $now: timestamptz!) {
    update_orders(
      where: {
        _and: [
          { id: { _eq: $id } }
          { current_status: { _eq: "assigned_to_agent" } }
          { assigned_agent_id: { _eq: $agentId } }
          { assignment_source: { _eq: "dedicated_auto" } }
          { dedicated_release_until: { _gt: $now } }
        ]
      }
      _set: {
        assigned_agent_id: null
        current_status: "ready_for_pickup"
        assignment_source: null
        dedicated_assignment_id: null
        dedicated_release_until: null
        pickup_state: null
        pickup_due_at: null
        pickup_reminder_sent_at: null
        pickup_at_risk_at: null
        pickup_overdue_at: null
        pickup_extension_minutes: 0
        pickup_paused_at: null
        pickup_pause_reason: null
        pickup_pause_remaining_ms: null
        last_agent_distance_m: null
        last_agent_progress_at: null
        agent_arrived_pickup_at: null
        dispatch_round: 0
        dispatch_exhausted_at: null
        dispatch_ready_at: "now()"
        updated_at: "now()"
      }
    ) {
      affected_rows
    }
  }
`;

/** The released agent's row: a declined dedicated offer, which dispatch skips (PR 6). */
const RECORD_DEDICATED_RELEASE_MUTATION = `
  mutation RecordDedicatedRelease($object: order_offers_insert_input!) {
    insert_order_offers_one(
      object: $object
      on_conflict: {
        constraint: order_offers_order_agent_unique
        update_columns: [status, offer_kind, decline_reason, expires_at, responded_at]
      }
    ) {
      id
    }
  }
`;

/** #608 follow-up: Sentry/Slack money-anomaly marker for an agent hold left withheld. */
export const STRANDED_HOLD_MARKER = 'agent_hold_stranded';
/** QA #622 F3: a strand that is still unresolved when it leaves the look-back window. */
export const STRANDED_HOLD_AGED_OUT_MARKER = 'agent_hold_stranded_aged_out';
/** QA #622 F4: the stranded event could not be written (the alert still went out). */
export const STRANDED_HOLD_EVENT_FAILED_MARKER =
  'agent_hold_stranded_event_failed';

interface StrandedHoldPayload {
  agentId?: string | null;
  agentUserId?: string | null;
  amount?: number;
  currency?: string;
  path?: string;
  holdId?: string;
}

const STRANDED_HOLDS_QUERY = `
  query StrandedAgentHolds($limit: Int!, $since: timestamptz!) {
    order_events(
      where: {
        event_type: { _eq: "agent_hold_stranded" }
        created_at: { _gte: $since }
        _not: { payload: { _has_key: "resolvedAt" } }
      }
      order_by: { created_at: asc }
      limit: $limit
    ) {
      id
      order_id
      created_at
      payload
    }
  }
`;

const AGED_OUT_STRANDED_HOLDS_QUERY = `
  query AgedOutStrandedAgentHolds($since: timestamptz!) {
    order_events(
      where: {
        event_type: { _eq: "agent_hold_stranded" }
        created_at: { _lt: $since }
        _not: { _or: [{ payload: { _has_key: "resolvedAt" } }, { payload: { _has_key: "agedOutAlertedAt" } }] }
      }
      order_by: { created_at: asc }
      limit: 50
    ) {
      id
      order_id
      created_at
      payload
    }
  }
`;

/** Marks a strand (resolved / aged-out alerted) on the stranded event itself, so the queries above can filter it. */
const MARK_STRANDED_HOLD_MUTATION = `
  mutation MarkStrandedAgentHold($id: uuid!, $patch: jsonb!) {
    update_order_events(where: { id: { _eq: $id } }, _append: { payload: $patch }) {
      affected_rows
    }
  }
`;

/** Stranded-hold events older than this are left to finance (they keep their alert). */
const STRANDED_HOLD_LOOKBACK_DAYS = 30;

/** #622: release min(net, cap) under the account row lock (migration 20261019230000). */
const RELEASE_AGENT_ORDER_HOLD_MUTATION = `
  mutation ReleaseAgentOrderHold($accountId: uuid!, $orderId: uuid!, $cap: numeric, $memo: String!) {
    release_agent_order_hold(
      args: { p_account_id: $accountId, p_order_id: $orderId, p_cap: $cap, p_memo: $memo }
    ) {
      id
      amount
    }
  }
`;

/** #622: the net held for reporting (one statement, so one snapshot). */
export const AGENT_HOLD_LEDGER_QUERY = `
  query AgentHoldLedger($accountId: uuid!, $orderId: uuid!) {
    holds: account_transactions(
      where: { account_id: { _eq: $accountId }, reference_id: { _eq: $orderId }, transaction_type: { _eq: hold } }
    ) {
      amount
    }
    releases: account_transactions(
      where: { account_id: { _eq: $accountId }, reference_id: { _eq: $orderId }, transaction_type: { _eq: release } }
    ) {
      amount
    }
  }
`;

const STRANDED_HOLD_ORDER_QUERY = `
  query StrandedHoldOrder($id: uuid!) {
    orders_by_pk(id: $id) { id order_number assigned_agent_id }
  }
`;

@Injectable()
export class OrderReassignmentService {
  private readonly logger = new Logger(OrderReassignmentService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly orderEvents: OrderEventsService,
    private readonly notifications: NotificationsService,
    private readonly orderOffers: OrderOffersService,
    // Unused since #622 (agent hold releases go through release_agent_order_hold); kept so the
    // constructor positions (and every caller) stay unchanged.
    _accountsService: AccountsService,
    @Optional()
    private readonly dedicatedConfig?: DedicatedAgentsConfigService,
    @Optional()
    private readonly siteEventsService?: SiteEventsService
  ) {}

  /**
   * #594 PR 6 (AC-A6b): an internal agent auto-assigned a dedicated order may
   * release it while `now < orders.dedicated_release_until` (the stored window,
   * `dedicated_auto_assign_release_seconds`, 120 s). No strike, no reliability
   * or reassignment-count penalty. The release is stored as a declined
   * dedicated offer row, which every later dispatch round and the dedicated
   * fallback skip, then dispatch restarts at round 1 without this agent.
   */
  async releaseDedicatedAutoAssignment(
    orderId: string,
    agentId: string,
    reason: OfferDeclineReason | null,
    now: Date = new Date()
  ): Promise<DedicatedReleaseResult> {
    const order = await this.fetchDedicatedReleaseOrder(orderId);
    const country = isoCountryCode(order?.business_location?.address?.country);
    const log = (outcome: string, extra: Record<string, unknown> = {}) =>
      this.logRelease(
        outcome,
        { orderId, agentId, reason, country, ...extra },
        order,
        now
      );
    if (!order) {
      log('refused', { refusal: 'unavailable' });
      return this.refuse(
        'unavailable',
        'Dedicated release is not available for this order'
      );
    }
    // QA #608 N3: the kill switch only stops new dedicated assignments. A window
    // opened while the flag was on is honoured; the release only gives work back.
    const flagOn = this.dedicatedConfig
      ? await this.dedicatedConfig.isEnabled(country).catch(() => false)
      : false;
    if (
      order.current_status !== 'assigned_to_agent' ||
      order.assigned_agent_id !== agentId
    ) {
      log('refused', { refusal: 'not_assigned' });
      return this.refuse(
        'not_assigned',
        'This order is not assigned to you, or it was already picked up'
      );
    }
    if (order.assignment_source !== 'dedicated_auto') {
      log('refused', { refusal: 'not_auto_assigned' });
      return this.refuse(
        'not_auto_assigned',
        'Only an automatic dedicated assignment can be released'
      );
    }
    const until = order.dedicated_release_until
      ? new Date(order.dedicated_release_until).getTime()
      : 0;
    if (!(until > now.getTime())) {
      log('refused', { refusal: 'window_closed', cause: 'expired' });
      return this.refuse(
        'window_closed',
        'The release window for this order has closed'
      );
    }
    const userId = order.assigned_agent?.user_id;
    if (!userId) {
      log('failed', { refusal: 'release_failed', cause: 'agent_user_missing' });
      return this.refuse('release_failed', 'Agent user missing');
    }

    const nowIso = now.toISOString();
    // QA #608 N1: write the exclusion row first (idempotent upsert), so the order
    // is never unassigned without it; then the CAS on the stored window.
    const exclusion = {
      order_id: order.id,
      agent_id: agentId,
      user_id: userId,
      status: 'declined',
      offer_kind: 'dedicated',
      decline_reason: reason,
      expires_at: nowIso,
      created_at: nowIso,
      responded_at: nowIso,
    };
    try {
      await runAssignmentWrite(() =>
        this.hasura.executeMutation(RECORD_DEDICATED_RELEASE_MUTATION, {
          object: exclusion,
        })
      );
    } catch (error: unknown) {
      this.logger.error(
        `Dedicated release of ${
          order.order_number
        }: exclusion not recorded, nothing released: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      log('failed', {
        refusal: 'release_failed',
        cause: 'exclusion_write_failed',
      });
      return this.refuse('release_failed', 'Could not release the order');
    }
    // CAS on the stored window: the database refuses a release once it has passed.
    const released = await runAssignmentWrite(() =>
      this.hasura.executeMutation<{
        update_orders: { affected_rows: number } | null;
      }>(RELEASE_DEDICATED_AUTO_MUTATION, {
        id: order.id,
        agentId,
        now: nowIso,
      })
    ).catch(async (error: unknown) => {
      await this.dropExclusion(order.id, agentId, nowIso);
      throw error;
    });
    if ((released?.update_orders?.affected_rows ?? 0) !== 1) {
      // The agent keeps the order: the exclusion row of this attempt goes away.
      await this.dropExclusion(order.id, agentId, nowIso);
      log('refused', { refusal: 'window_closed', cause: 'cas_lost' });
      return this.refuse(
        'window_closed',
        'The release window for this order has closed'
      );
    }
    const holdResult = await this.releaseHoldDetailed(
      order as unknown as MonitoredPickupOrder
    );
    if (!holdResult.released) {
      const restored = await this.revertDedicatedRelease(order);
      if (restored) await this.dropExclusion(order.id, agentId, nowIso);
      if (!restored) {
        await this.recordStrandedHold(
          order as unknown as MonitoredPickupOrder,
          holdResult.hold,
          'dedicated_release'
        );
        log('failed', {
          refusal: 'release_lost',
          cause: 'hold_release_failed_and_reclaimed',
        });
        return this.refuse(
          'release_lost',
          'The order was released and another agent has taken it'
        );
      }
      log('failed', {
        refusal: 'release_failed',
        cause: 'hold_release_failed',
      });
      return this.refuse('release_failed', 'Could not release the order');
    }
    await this.insertAgentHistory(
      order.id,
      userId,
      'Dedicated agent released the automatic assignment (no strike); dispatch restarted without this agent'
    );
    await this.orderEvents.recordEvent({
      orderId: order.id,
      eventType: 'reassignment_started',
      actorType: 'agent',
      actorId: agentId,
      payload: { reason: 'dedicated_auto_release', declineReason: reason },
    });
    emitServerSiteEvent(
      this.siteEventsService,
      'dedicated.auto_assign_released',
      {
        orderId: order.id,
        agentId,
        assignmentId: order.dedicated_assignment_id,
        reason,
        secondsLeft: Math.max(0, Math.floor((until - now.getTime()) / 1000)),
      }
    );
    log('released', {
      flagOn,
      secondsLeft: Math.max(0, Math.floor((until - now.getTime()) / 1000)),
    });
    await this.redispatch(order.id);
    return {
      success: true,
      message: 'Order released; dispatch restarted without you',
    };
  }

  /**
   * #594 PR 6: one structured line per release attempt (PE: no reliability
   * signal, but measurable later): `{"event":"dedicated.auto_assign_release",
   * "outcome":"released"|"refused"|"failed", ...}`.
   */
  private logRelease(
    outcome: string,
    fields: Record<string, unknown>,
    order: DedicatedReleaseOrder | null,
    now: Date
  ): void {
    const line = {
      event: 'dedicated.auto_assign_release',
      outcome,
      ...fields,
      orderNumber: order?.order_number ?? null,
      assignmentId: order?.dedicated_assignment_id ?? null,
      assignmentSource: order?.assignment_source ?? null,
      releaseUntil: order?.dedicated_release_until ?? null,
      at: now.toISOString(),
    };
    if (outcome === 'failed') this.logger.warn(JSON.stringify(line));
    else this.logger.log(JSON.stringify(line));
  }

  private refuse(
    refusal: DedicatedReleaseRefusal,
    message: string
  ): DedicatedReleaseResult {
    return { success: false, refusal, message };
  }

  private async fetchDedicatedReleaseOrder(
    orderId: string
  ): Promise<DedicatedReleaseOrder | null> {
    const res = await this.hasura.executeQuery<{
      orders_by_pk: DedicatedReleaseOrder | null;
    }>(
      `query DedicatedReleaseOrder($id: uuid!) {
        orders_by_pk(id: $id) {
          id order_number current_status assigned_agent_id currency
          assignment_source dedicated_assignment_id dedicated_release_until
          pickup_state pickup_due_at pickup_reminder_sent_at pickup_at_risk_at pickup_overdue_at
          pickup_extension_minutes pickup_paused_at pickup_pause_reason pickup_pause_remaining_ms
          last_agent_distance_m last_agent_progress_at agent_arrived_pickup_at
          business_location { address { country } }
          assigned_agent { id user_id }
        }
      }`,
      { id: orderId }
    );
    return res?.orders_by_pk ?? null;
  }

  /**
   * Puts the agent back on the order when the release could not complete, with
   * its pickup timers restored (QA #608 N1). Returns false when the order was
   * claimed by someone else in between (affected_rows 0), which is logged.
   */
  private async revertDedicatedRelease(
    order: DedicatedReleaseOrder
  ): Promise<boolean> {
    const pickup: Record<string, unknown> = {};
    for (const f of PICKUP_MONITOR_FIELDS)
      pickup[f] = order[f] ?? (f === 'pickup_extension_minutes' ? 0 : null);
    const res = await this.hasura
      .executeMutation<{ update_orders: { affected_rows: number } | null }>(
        `mutation RevertDedicatedRelease(
          $id: uuid!, $agentId: uuid!, $assignmentId: uuid, $releaseUntil: timestamptz, $pickup: orders_set_input!
        ) {
          update_orders(
            where: {
              id: { _eq: $id }
              assigned_agent_id: { _is_null: true }
              current_status: { _eq: ready_for_pickup }
            }
            _set: $pickup
          ) { affected_rows }
          restore: update_orders(
            where: { id: { _eq: $id }, assigned_agent_id: { _is_null: true }, current_status: { _eq: ready_for_pickup } }
            _set: {
              assigned_agent_id: $agentId
              current_status: assigned_to_agent
              assignment_source: "dedicated_auto"
              dedicated_assignment_id: $assignmentId
              dedicated_release_until: $releaseUntil
              updated_at: "now()"
            }
          ) { affected_rows }
        }`,
        {
          id: order.id,
          agentId: order.assigned_agent_id,
          assignmentId: order.dedicated_assignment_id,
          releaseUntil: order.dedicated_release_until,
          pickup,
        }
      )
      .catch((error: unknown) => {
        this.logger.error(
          `RevertDedicatedRelease ${order.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return null;
      });
    const restored =
      ((res as { restore?: { affected_rows?: number } } | null)?.restore
        ?.affected_rows ?? 0) === 1;
    if (!restored) {
      this.logger.error(
        JSON.stringify({
          event: 'dedicated.release_revert_failed',
          orderId: order.id,
          agentId: order.assigned_agent_id,
          orderNumber: order.order_number,
        })
      );
    }
    return restored;
  }

  /** Removes this attempt's exclusion row (matched on its responded_at) when the agent keeps the order. */
  private async dropExclusion(
    orderId: string,
    agentId: string,
    at: string
  ): Promise<void> {
    await this.hasura
      .executeMutation(
        `mutation DropDedicatedReleaseExclusion($orderId: uuid!, $agentId: uuid!, $at: timestamptz!) {
          delete_order_offers(
            where: {
              order_id: { _eq: $orderId }
              agent_id: { _eq: $agentId }
              offer_kind: { _eq: "dedicated" }
              status: { _eq: declined }
              responded_at: { _eq: $at }
            }
          ) { affected_rows }
        }`,
        { orderId, agentId, at }
      )
      .catch((error: unknown) =>
        this.logger.warn(
          `DropDedicatedReleaseExclusion ${orderId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
  }

  private async insertAgentHistory(
    orderId: string,
    userId: string,
    notes: string
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation DedicatedReleaseHistory($orderId: uuid!, $userId: uuid!, $notes: String!) {
        insert_order_status_history(objects: [{
          order_id: $orderId
          status: ready_for_pickup
          notes: $notes
          changed_by_type: "agent"
          changed_by_user_id: $userId
        }]) { affected_rows }
      }`,
      { orderId, userId, notes }
    );
  }

  async reassignOrder(
    orderId: string,
    reason: string,
    options?: { skipReliabilityPenalty?: boolean; maxReassignments?: number }
  ): Promise<{ success: boolean; message: string }> {
    const order = await this.fetchAssignedOrder(orderId);
    if (!order) {
      return { success: false, message: 'Order not assigned' };
    }
    const max = options?.maxReassignments ?? 2;
    if ((order.reassignment_count || 0) >= max) {
      return this.escalateStrikeOut(order);
    }
    const previousAgentId = order.assigned_agent_id!;
    const dropped = await this.systemDrop(order);
    if (!dropped) {
      return { success: false, message: 'Could not unassign agent' };
    }
    await this.afterDrop(order, previousAgentId, reason, options);
    return { success: true, message: 'Order reassigned to open pool' };
  }

  /**
   * Re-opens dispatch for a delivery order sitting in `ready_for_pickup` with no
   * agent. Clears the exhausted/round state so the offer rounds start over, which
   * is the only recovery path once the original rounds found nobody.
   */
  async redispatchUnassignedOrder(
    orderId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    const reset = await this.resetDispatchState(orderId);
    if (!reset) {
      return {
        success: false,
        message: 'Order is not awaiting an agent in ready_for_pickup',
      };
    }
    await this.orderEvents.recordEvent({
      orderId,
      eventType: 'reassignment_started',
      actorType: 'system',
      payload: { reason, mode: 'redispatch_unassigned' },
    });
    await this.redispatch(orderId);
    return { success: true, message: 'Order redispatched to nearby agents' };
  }

  private async resetDispatchState(orderId: string): Promise<boolean> {
    const result = await this.hasura.executeMutation(
      `mutation ResetOrderDispatch($id: uuid!) {
        update_orders(
          where: {
            _and: [
              { id: { _eq: $id } }
              { current_status: { _eq: "ready_for_pickup" } }
              { assigned_agent_id: { _is_null: true } }
              { fulfillment_method: { _neq: "pickup" } }
            ]
          }
          _set: {
            dispatch_round: 0
            dispatch_exhausted_at: null
            dispatch_ready_at: "now()"
            updated_at: "now()"
          }
        ) { affected_rows }
      }`,
      { id: orderId }
    );
    return (result?.update_orders?.affected_rows ?? 0) === 1;
  }

  async reportIssueAndRelease(
    orderId: string,
    agentId: string,
    issueReason: string
  ): Promise<{ success: boolean; message: string }> {
    const order = await this.fetchAssignedOrder(orderId);
    if (!order || order.assigned_agent_id !== agentId) {
      return { success: false, message: 'Not assigned to this agent' };
    }
    await this.orderEvents.recordEvent({
      orderId,
      eventType: 'agent_reported_issue',
      actorType: 'agent',
      actorId: agentId,
      payload: { reason: issueReason },
    });
    await this.bumpIssueCount(agentId);
    return this.reassignOrder(orderId, `agent_issue:${issueReason}`, {
      skipReliabilityPenalty: true,
    });
  }

  private async afterDrop(
    order: MonitoredPickupOrder,
    previousAgentId: string,
    reason: string,
    options?: { skipReliabilityPenalty?: boolean }
  ): Promise<void> {
    await this.orderEvents.recordEvent({
      orderId: order.id,
      eventType: 'reassignment_started',
      actorType: 'system',
      actorId: previousAgentId,
      payload: { reason },
    });
    if (!options?.skipReliabilityPenalty) {
      await this.bumpReassignedCount(previousAgentId);
    }
    await this.notifyParties(order, previousAgentId);
    await this.redispatch(order.id);
  }

  private async systemDrop(order: MonitoredPickupOrder): Promise<boolean> {
    const nextCount = (order.reassignment_count || 0) + 1;
    const result = await this.hasura.executeMutation(
      `mutation SystemDropOrder($id: uuid!, $agentId: uuid!, $count: Int!) {
        update_orders(
          where: {
            _and: [
              { id: { _eq: $id } }
              { current_status: { _eq: "assigned_to_agent" } }
              { assigned_agent_id: { _eq: $agentId } }
            ]
          }
          _set: {
            assigned_agent_id: null
            current_status: "ready_for_pickup"
            pickup_state: null
            pickup_due_at: null
            pickup_reminder_sent_at: null
            pickup_at_risk_at: null
            pickup_overdue_at: null
            pickup_extension_minutes: 0
            pickup_paused_at: null
            pickup_pause_reason: null
            pickup_pause_remaining_ms: null
            last_agent_distance_m: null
            last_agent_progress_at: null
            agent_arrived_pickup_at: null
            dispatch_round: 0
            dispatch_exhausted_at: null
            dispatch_ready_at: "now()"
            reassignment_count: $count
          }
        ) {
          affected_rows
        }
      }`,
      {
        id: order.id,
        agentId: order.assigned_agent_id,
        count: nextCount,
      }
    );
    const affected = result?.update_orders?.affected_rows ?? 0;
    if (affected !== 1) return false;
    const holdResult = await this.releaseHoldDetailed(order);
    if (!holdResult.released) {
      const restored = await this.revertSystemDrop(order);
      if (!restored)
        await this.recordStrandedHold(
          order,
          holdResult.hold,
          'pickup_reassignment'
        );
      return false;
    }
    await this.insertHistory(
      order.id,
      'System reassigned order after pickup SLA'
    );
    return true;
  }

  /** The hold read before the credit is returned, so a failure can be recorded with it. */
  private async releaseHoldDetailed(
    order: MonitoredPickupOrder
  ): Promise<{
    released: boolean;
    hold: { id: string; agent_hold_amount: number } | null;
  }> {
    const hold = await this.fetchActiveAgentHold(order.id);
    if (!hold) return { released: true, hold: null };
    const credited = await this.creditHoldRelease(order, hold);
    if (!credited) {
      this.logger.error(
        `Hold row left active for order ${order.order_number}: release failed`
      );
      return { released: false, hold };
    }
    await this.cancelHoldRow(hold.id);
    return { released: true, hold };
  }

  /**
   * #608 follow-up: the hold credit failed AND the order could not be given back
   * (another agent claimed it in the window). The releasing agent's withheld funds
   * are stranded: the shared order_holds row (UNIQUE order_id) is rewritten for the
   * new agent's claim, so the amount and agent are captured here, at failure time.
   * One money-anomaly alert (Sentry, fingerprinted), plus an `agent_hold_stranded`
   * order event that reconcileStrandedAgentHolds works from.
   */
  private async recordStrandedHold(
    order: MonitoredPickupOrder,
    hold: { id: string; agent_hold_amount: number } | null,
    path: 'dedicated_release' | 'pickup_reassignment'
  ): Promise<void> {
    const amount = Number(hold?.agent_hold_amount ?? 0);
    if (!hold || !(amount > 0)) return; // no money held (e.g. internal agent): nothing stranded
    const agentId = order.assigned_agent_id;
    const agentUserId = order.assigned_agent?.user_id ?? null;
    const currency = (order as { currency?: string }).currency || 'XAF';
    reportMoneyAnomaly(
      this.logger,
      STRANDED_HOLD_MARKER,
      `Agent hold stranded for order ${order.order_number}: release failed and another agent took the order`,
      {
        orderId: order.id,
        orderNumber: order.order_number,
        holdId: hold.id,
        agentId,
        agentUserId,
        amount,
        currency,
        path,
      }
    );
    // QA #622 F4: never let this break the release / reassignment on the request path.
    try {
      await this.orderEvents.recordEventStrict({
        orderId: order.id,
        eventType: 'agent_hold_stranded',
        actorType: 'system',
        payload: {
          agentId,
          agentUserId,
          amount,
          currency,
          path,
          holdId: hold.id,
        },
      });
    } catch (error: unknown) {
      reportMoneyAnomaly(
        this.logger,
        STRANDED_HOLD_EVENT_FAILED_MARKER,
        `Stranded agent hold for order ${
          order.order_number
        } not queued for the reconciler: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { orderId: order.id, holdId: hold.id, agentId, amount, currency, path }
      );
    }
  }

  /**
   * #608 follow-up reconciler (run by the pickup monitor cron). For each
   * `agent_hold_stranded` event without an `agent_hold_stranded_released` one:
   * - skipped while that agent holds the order again (its hold is live, not stranded);
   * - otherwise the agent's withheld amount is released with
   *   registerReleaseIfNotExists (keyed on account + order: a retry or a run racing
   *   another never credits twice), then the resolution event is written.
   * A failed release is logged and retried on the next run.
   */
  async reconcileStrandedAgentHolds(
    limit = 50
  ): Promise<{ released: number; skipped: number; failed: number }> {
    const out = { released: 0, skipped: 0, failed: 0 };
    // F2 (QA #622): no overlapping runs in this process. Across processes (and
    // against a live release), release_agent_order_hold's account row lock is the guard.
    if (this.reconcilingStrandedHolds) return out;
    this.reconcilingStrandedHolds = true;
    try {
      const since = new Date(
        Date.now() - STRANDED_HOLD_LOOKBACK_DAYS * 86_400_000
      ).toISOString();
      // QA N2: an alert-query failure must not stop the reconcile pass itself.
      try {
        await this.alertAgedOutStrandedHolds(since);
      } catch (error: unknown) {
        this.logger.error(
          `Stranded agent hold aged-out alert check failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      // F3: unresolved only, oldest first, so a backlog can't starve older strands.
      const res = await this.hasura.executeQuery<{
        order_events: Array<{
          id: string;
          order_id: string;
          created_at?: string;
          payload: StrandedHoldPayload | null;
        }>;
      }>(STRANDED_HOLDS_QUERY, { limit, since });
      for (const ev of res?.order_events ?? []) {
        const r = await this.reconcileOneStrandedHold(ev);
        out[r]++;
      }
      return out;
    } finally {
      this.reconcilingStrandedHolds = false;
    }
  }

  private reconcilingStrandedHolds = false;

  /**
   * One strand. QA #622:
   * - F1: release min(net held for this account and order, stranded amount), never
   *   a reference-only dedupe.
   * - F2 / PE blocker: the credit is `release_agent_order_hold` (see
   *   releaseNetAgentHold): under the agent account row lock it recomputes the net
   *   and writes balance + ledger row together, so two runs, two pods, or a run and a
   *   live creditHoldRelease credit the held money once. Both paths use the same
   *   function-derived key (QA N1), so there is one key scheme, not two.
   * - The strand is marked resolved only after its credit exists (written now, or
   *   found by its key), or when the net held is confirmed 0.
   */
  private async reconcileOneStrandedHold(ev: {
    id: string;
    order_id: string;
    payload: StrandedHoldPayload | null;
  }): Promise<'released' | 'skipped' | 'failed'> {
    const p = ev.payload ?? ({} as StrandedHoldPayload);
    const amount = Number(p.amount);
    if (!p.agentUserId || !(amount > 0)) return 'skipped';
    try {
      const order = await this.hasura.executeQuery<{
        orders_by_pk: {
          id: string;
          order_number: string;
          assigned_agent_id: string | null;
        } | null;
      }>(STRANDED_HOLD_ORDER_QUERY, { id: ev.order_id });
      const o = order?.orders_by_pk;
      if (!o || (p.agentId && o.assigned_agent_id === p.agentId))
        return 'skipped';
      const account = await this.hasura.getAccount(
        p.agentUserId,
        p.currency || 'XAF'
      );
      if (!account) throw new Error('agent account missing');
      const released = await this.releaseNetAgentHold(
        account.id,
        ev.order_id,
        `Hold released for order ${o.order_number}. Stranded after release (reconciled).`,
        { cap: amount }
      );
      if (!released.success)
        throw new Error(released.error || 'release failed');
      const resolution = {
        resolvedAt: new Date().toISOString(),
        released: released.released,
        net: released.net,
        
      };
      await this.hasura.executeMutation(MARK_STRANDED_HOLD_MUTATION, {
        id: ev.id,
        patch: resolution,
      });
      await this.orderEvents.recordEvent({
        orderId: ev.order_id,
        eventType: 'agent_hold_stranded_released',
        actorType: 'system',
        payload: {
          strandedEventId: ev.id,
          agentId: p.agentId,
          amount,
          ...resolution,
        },
      });
      this.logger.log(
        `Stranded agent hold reconciled for order ${o.order_number}: released ${
          released.released
        } (net ${released.net}, stranded ${amount}) ${p.currency || 'XAF'}`
      );
      return 'released';
    } catch (error: unknown) {
      this.logger.warn(
        `Stranded agent hold for order ${ev.order_id} not released yet: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 'failed';
    }
  }

  /** F3: a strand older than the look-back that is still unresolved alerts once. */
  private async alertAgedOutStrandedHolds(since: string): Promise<void> {
    const res = await this.hasura.executeQuery<{
      order_events: Array<{
        id: string;
        order_id: string;
        created_at?: string;
        payload: StrandedHoldPayload | null;
      }>;
    }>(AGED_OUT_STRANDED_HOLDS_QUERY, { since });
    for (const ev of res?.order_events ?? []) {
      reportMoneyAnomaly(
        this.logger,
        STRANDED_HOLD_AGED_OUT_MARKER,
        `Stranded agent hold for order ${ev.order_id} unresolved after ${STRANDED_HOLD_LOOKBACK_DAYS} days; reconcile by hand`,
        {
          orderId: ev.order_id,
          strandedEventId: ev.id,
          agentId: ev.payload?.agentId,
          amount: ev.payload?.amount,
          currency: ev.payload?.currency,
        }
      );
      await this.hasura.executeMutation(MARK_STRANDED_HOLD_MUTATION, {
        id: ev.id,
        patch: { agedOutAlertedAt: new Date().toISOString() },
      });
    }
  }

  /** True when the order went back to this agent (false: someone claimed it meanwhile). */
  private async revertSystemDrop(
    order: MonitoredPickupOrder
  ): Promise<boolean> {
    const res = await this.hasura.executeMutation<{
      update_orders?: { affected_rows?: number } | null;
    }>(
      `mutation RevertSystemDrop($id: uuid!, $agentId: uuid!) {
        update_orders(
          where: {
            id: { _eq: $id }
            assigned_agent_id: { _is_null: true }
            current_status: { _eq: ready_for_pickup }
          }
          _set: {
            assigned_agent_id: $agentId
            current_status: assigned_to_agent
            updated_at: "now()"
          }
        ) { affected_rows }
      }`,
      { id: order.id, agentId: order.assigned_agent_id }
    );
    return (res?.update_orders?.affected_rows ?? 0) === 1;
  }

  private async fetchActiveAgentHold(
    orderId: string
  ): Promise<{ id: string; agent_hold_amount: number } | null> {
    const holdRes = await this.hasura.executeQuery(
      `query OrderHold($id: uuid!) {
        order_holds(
          where: {
            order_id: { _eq: $id }
            status: { _eq: active }
          }
          limit: 1
        ) {
          id agent_hold_amount agent_id status
        }
      }`,
      { id: orderId }
    );
    return holdRes.order_holds?.[0] ?? null;
  }

  private async creditHoldRelease(
    order: MonitoredPickupOrder,
    hold: { agent_hold_amount: number }
  ): Promise<boolean> {
    if (Number(hold.agent_hold_amount) <= 0) return true;
    const userId = order.assigned_agent?.user_id;
    if (!userId) {
      this.logger.error(
        `Hold funds not credited for order ${order.order_number}: agent user missing`
      );
      return false;
    }
    const account = await this.hasura.getAccount(
      userId,
      (order as any).currency || 'XAF'
    );
    if (!account) {
      this.logger.error(
        `Hold funds not credited for order ${order.order_number}: agent account missing`
      );
      return false;
    }
    // #622: release the agent's NET hold on this order (holds - releases), not the
    // row amount behind a reference check: after claim -> release -> re-claim, the
    // reference check saw the first release and credited nothing.
    const released = await this.releaseNetAgentHold(
      account.id,
      order.id,
      `Hold released for order ${order.order_number}. System reassignment.`
    );
    if (!released.success) {
      this.logger.error(
        `Hold release failed for order ${order.order_number}: ${released.error}`
      );
      return false;
    }
    return true;
  }

  /**
   * #622: release what this agent account still holds for this order (holds minus
   * releases), capped at `opts.cap`, in ONE database transaction:
   * `release_agent_order_hold` locks the account row FOR NO KEY UPDATE, computes the
   * net from account_transactions, and writes the balance change and the ledger row
   * together. A live creditHoldRelease and the stranded-hold reconciler serialise on
   * that lock, and the second one computes the net after the first one's row is
   * committed, so a hold is credited once whichever wins. The balance can no longer
   * move before its ledger row exists.
   *
   * Idempotency (QA N1): one key scheme for every caller. The function derives
   * `agent-hold-release:<order>:<account>:h<#holds>:r<#releases>` under the lock; no
   * caller-supplied key exists, so the live path and the reconciler cannot credit the
   * same hold under two different keys. `released` is what this call credited (0 when
   * the net was already 0 or the key existed); `net` is the net held after the call.
   */
  private async releaseNetAgentHold(
    accountId: string,
    orderId: string,
    memo: string,
    opts: { cap?: number } = {}
  ): Promise<{ success: boolean; released: number; net: number; error?: string }> {
    try {
      const res = await this.hasura.executeMutation<{
        release_agent_order_hold: Array<{ id: string; amount: number }>;
      }>(RELEASE_AGENT_ORDER_HOLD_MUTATION, {
        accountId,
        orderId,
        cap: opts.cap ?? null,
        memo,
      });
      const released = Number(res?.release_agent_order_hold?.[0]?.amount ?? 0);
      const { net } = await this.agentHoldLedger(accountId, orderId);
      return { success: true, released, net };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const { net } = await this.agentHoldLedger(accountId, orderId).catch(() => ({ net: NaN }));
      return { success: false, released: 0, net, error: message };
    }
  }

  private async agentHoldLedger(accountId: string, orderId: string) {
    const ledger = await this.hasura.executeQuery<{
      holds: Array<{ amount: number | string }>;
      releases: Array<{ amount: number | string }>;
    }>(AGENT_HOLD_LEDGER_QUERY, { accountId, orderId });
    const holds = ledger?.holds ?? [];
    const releases = ledger?.releases ?? [];
    const sum = (rows: Array<{ amount: number | string }>) =>
      rows.reduce((t, r) => t + Number(r.amount || 0), 0);
    return {
      holds,
      releases,
      net: Number((sum(holds) - sum(releases)).toFixed(2)),
    };
  }

  private async cancelHoldRow(holdId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation CancelHold($id: uuid!) {
        update_order_holds(
          where: {
            _and: [
              { id: { _eq: $id } }
              { status: { _eq: active } }
            ]
          }
          _set: { status: "cancelled" }
        ) { affected_rows }
      }`,
      { id: holdId }
    );
  }

  private async redispatch(orderId: string): Promise<void> {
    try {
      await this.orderOffers.runDispatchRound(orderId, 1);
    } catch (error: any) {
      this.logger.error(`Redispatch failed for ${orderId}: ${error?.message}`);
      await this.orderEvents.recordEvent({
        orderId,
        eventType: 'reassignment_pool_empty',
        actorType: 'system',
        payload: { error: error?.message },
      });
    }
  }

  private async notifyParties(
    order: MonitoredPickupOrder,
    previousAgentId: string
  ): Promise<void> {
    const agentUserId =
      order.assigned_agent?.user_id ||
      (await this.fetchAgentUserId(previousAgentId));
    await this.notifications.sendPickupReassignedAgentPush({
      agentUserId,
      orderId: order.id,
      orderNumber: order.order_number,
      preferredLanguage: order.assigned_agent?.user?.preferred_language,
    });
    await this.notifications.sendPickupReassignedBusinessPush({
      businessUserId: order.business?.user_id,
      orderId: order.id,
      orderNumber: order.order_number,
      preferredLanguage: order.business?.user?.preferred_language,
    });
    await this.notifications.sendPickupReassignedCustomerPush({
      clientUserId: order.client?.user_id,
      orderId: order.id,
      orderNumber: order.order_number,
      preferredLanguage: order.client?.user?.preferred_language,
    });
  }

  private async escalateStrikeOut(
    order: MonitoredPickupOrder
  ): Promise<{ success: boolean; message: string }> {
    const previousAgentId = order.assigned_agent_id!;
    const dropped = await this.systemDrop(order);
    if (!dropped) return this.alreadyEscalatedResult();
    this.logger.warn(
      `Pickup reassignment strike-out for order ${order.order_number}`
    );
    await this.recordAndNotifyStrikeOut(order, previousAgentId);
    return {
      success: true,
      message: 'Agent released; escalated to support (max reassignments)',
    };
  }

  private alreadyEscalatedResult(): { success: boolean; message: string } {
    return {
      success: false,
      message: 'Max reassignments reached; already escalated',
    };
  }

  private async recordAndNotifyStrikeOut(
    order: MonitoredPickupOrder,
    previousAgentId: string
  ): Promise<void> {
    await this.orderEvents.recordEvent({
      orderId: order.id,
      eventType: 'reassignment_pool_empty',
      actorType: 'system',
      payload: { reason: 'max_reassignments' },
    });
    const agentUserId =
      order.assigned_agent?.user_id ||
      (await this.fetchAgentUserId(previousAgentId));
    await this.notifications.sendPickupReassignedAgentPush({
      agentUserId,
      orderId: order.id,
      orderNumber: order.order_number,
      preferredLanguage: order.assigned_agent?.user?.preferred_language,
    });
    await this.notifications.sendPickupReassignmentEscalationPush({
      businessUserId: order.business?.user_id,
      clientUserId: order.client?.user_id,
      orderId: order.id,
      orderNumber: order.order_number,
    });
  }

  private async fetchAssignedOrder(
    orderId: string
  ): Promise<(MonitoredPickupOrder & { currency?: string }) | null> {
    const res = await this.hasura.executeQuery(
      `query ReassignOrder($id: uuid!) {
        orders_by_pk(id: $id) {
          id order_number current_status assigned_agent_id currency
          reassignment_count pickup_state business_id
          client { user_id user { preferred_language email } }
          business { user_id name user { preferred_language email } }
          assigned_agent {
            id user_id user { preferred_language first_name }
          }
        }
      }`,
      { id: orderId }
    );
    const order = res.orders_by_pk;
    if (!order || order.current_status !== 'assigned_to_agent') return null;
    if (!order.assigned_agent_id) return null;
    return order;
  }

  private async fetchAgentUserId(agentId: string): Promise<string | undefined> {
    const res = await this.hasura.executeQuery(
      `query AgentUser($id: uuid!) {
        agents_by_pk(id: $id) { user_id }
      }`,
      { id: agentId }
    );
    return res.agents_by_pk?.user_id;
  }

  private async bumpReassignedCount(agentId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation BumpReassigned($id: uuid!) {
        update_agents_by_pk(
          pk_columns: { id: $id }
          _inc: { pickups_reassigned_count: 1 }
        ) { id pickups_reassigned_count pickups_completed_count }
      }`,
      { id: agentId }
    );
    await this.recomputeReliability(agentId);
  }

  private async bumpIssueCount(agentId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation BumpIssue($id: uuid!) {
        update_agents_by_pk(
          pk_columns: { id: $id }
          _inc: { pickup_issues_reported_count: 1 }
        ) { id }
      }`,
      { id: agentId }
    );
  }

  private async recomputeReliability(agentId: string): Promise<void> {
    const res = await this.hasura.executeQuery(
      `query AgentRel($id: uuid!) {
        agents_by_pk(id: $id) {
          pickups_completed_count pickups_reassigned_count
        }
      }`,
      { id: agentId }
    );
    const a = res.agents_by_pk;
    if (!a) return;
    const completed = a.pickups_completed_count || 0;
    const reassigned = a.pickups_reassigned_count || 0;
    const denom = Math.max(1, completed + reassigned);
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round((completed / denom) * 100 - (reassigned / denom) * 40)
      )
    );
    await this.hasura.executeMutation(
      `mutation SetPickupRel($id: uuid!, $score: numeric!) {
        update_agents_by_pk(
          pk_columns: { id: $id }
          _set: { pickup_reliability_score: $score }
        ) { id }
      }`,
      { id: agentId, score }
    );
  }

  private async insertHistory(orderId: string, notes: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation Hist($orderId: uuid!, $notes: String!) {
        insert_order_status_history(objects: [{
          order_id: $orderId
          status: ready_for_pickup
          notes: $notes
          changed_by_type: "system"
        }]) { affected_rows }
      }`,
      { orderId, notes }
    );
  }
}
