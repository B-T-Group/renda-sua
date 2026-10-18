import { Injectable, Logger } from '@nestjs/common';
import { AgentContractGateService } from '../agent-contracts/agent-contract-gate.service';
import { AgentHoldService } from '../agents/agent-hold.service';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { DEFAULT_DELIVERY_SLOT_STATE } from '../delivery/delivery-slots.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { MID_FULFILLMENT_STATUSES } from '../orders/order-cleanup.constants';
import { resolveTimeZone } from '../restock-alerts/restock-time.util';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import type { DedicatedAgentsConfig, DedicatedSlotKey } from './dedicated-agents.constants';
import {
  DEDICATED_AGENT_BALANCES_QUERY,
  DEDICATED_AGENT_LOAD_QUERY,
  DEDICATED_DELIVERY_SLOTS_QUERY,
  DEDICATED_LOCATION_CONTEXT_QUERY,
  DEDICATED_SLOT_ASSIGNMENTS_QUERY,
} from './dedicated-coverage.queries';
import {
  dedicatedBalanceIneligibleReason,
  dedicatedProfileIneligibleReason,
  isDedicatedEligibleOrder,
  requiresBalanceCheck,
  type DedicatedAgentFacts,
  type DedicatedIneligibleReason,
  type DedicatedRail,
} from './dedicated-eligibility.util';
import {
  localDateTimeAt,
  resolveSlotForLocalTime,
  toDedicatedSlotBounds,
  type DeliveryTimeSlotRow,
} from './dedicated-slot.util';

/**
 * Orders an agent is working on: the same list the agent's Active orders
 * count uses (`HasuraSystemService.countAgentActiveOrders`,
 * `agents.controller` active count), across all rails and assignment sources.
 */
export const DEDICATED_ACTIVE_ORDER_STATUSES: readonly string[] = MID_FULFILLMENT_STATUSES;

export interface ResolvedDedicatedSlot {
  slotKey: DedicatedSlotKey;
  slotId: string;
  startTime: string;
  endTime: string;
  /** Local date (YYYY-MM-DD) in the country timezone. */
  date: string;
  timeZone: string;
}

export type ResolveDedicatedSlotParams =
  | { locationId: string; preferredDate: string; windowStart: string }
  | { locationId: string; at: Date };

export interface DedicatedEligibilityParams {
  locationId: string;
  slotKey: DedicatedSlotKey;
  /** AC-E1 inputs: anything but a scheduled order with a delivery window gets no coverage. */
  fulfillmentTiming: string | null | undefined;
  hasDeliveryWindow: boolean;
  windowConfirmed?: boolean | null;
  requireConfirmedWindow?: boolean;
  rail: DedicatedRail;
  /** Order subtotal at dispatch, cart subtotal at checkout (hold base). */
  subtotal: number;
  currency: string;
  verifiedAgentDelivery: boolean;
  /** Re-check at offer/claim: don't count this order's own outstanding dedicated offer. */
  excludeOrderId?: string | null;
  now?: Date;
}

export interface DedicatedEligibleAgent {
  agentId: string;
  userId: string | null;
  assignmentId: string;
  isInternal: boolean;
  activeOrders: number;
  outstandingDedicatedOffers: number;
  holdAmount: number;
  /** Null when no balance check applies (internal agent or Stripe). */
  availableBalance: number | null;
}

export interface DedicatedRejectedAgent {
  agentId: string;
  assignmentId: string;
  reason: DedicatedIneligibleReason;
}

export interface DedicatedEligibilityResult {
  eligible: DedicatedEligibleAgent[];
  rejected: DedicatedRejectedAgent[];
}

interface LocationContextRow {
  id: string;
  address: { country?: string | null; state?: string | null } | null;
  pickup_slots: Array<{ slot_key: string; is_enabled: boolean }>;
}

interface AssignmentRow {
  id: string;
  agent_id: string;
  status: string;
  off_today_date: string | null;
  agent: {
    id: string;
    user_id: string | null;
    is_verified: boolean | null;
    is_internal: boolean | null;
    status: string | null;
    focus: string | null;
  } | null;
}

interface LocationContext {
  country: string;
  state: string;
  disabledSlots: Set<string>;
  config: DedicatedAgentsConfig;
  timeZone: string;
}

/**
 * #594 PR 2: AC-E1/E2/E5 core. Answers "which dedicated agents can take this
 * scheduled order for this location-slot", and maps a window to its slot in
 * the country timezone (D12). No callers yet; checkout (PR 4) and the
 * scheduled dispatch gate (PR 5) use it. Everything is behind
 * `dedicated_agents_enabled` (off): flag off -> no slot, no agents.
 */
@Injectable()
export class DedicatedCoverageService {
  private readonly logger = new Logger(DedicatedCoverageService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly configService: DedicatedAgentsConfigService,
    private readonly agentHoldService: AgentHoldService,
    private readonly agentContractGate: AgentContractGateService,
    private readonly deliveryConfigService: DeliveryConfigService
  ) {}

  /**
   * Slot for a scheduled window (`preferred_date` + local `time_slot_start`)
   * or for an instant (converted to the country timezone). Null when the flag
   * is off, the location is unknown, the time is outside every standard slot
   * (plus end grace), or the business turned that slot off.
   */
  async resolveSlot(params: ResolveDedicatedSlotParams): Promise<ResolvedDedicatedSlot | null> {
    const ctx = await this.loadLocationContext(params.locationId);
    if (!ctx) return null;
    const local =
      'at' in params
        ? localDateTimeAt(params.at, ctx.timeZone)
        : { date: params.preferredDate, time: params.windowStart };
    const slots = await this.loadSlotBounds(ctx.country, ctx.state);
    const slot = resolveSlotForLocalTime(slots, local.time, ctx.config.slotEndGraceMinutes);
    if (!slot || ctx.disabledSlots.has(slot.slotKey)) return null;
    return {
      slotKey: slot.slotKey,
      slotId: slot.slotId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      date: local.date,
      timeZone: ctx.timeZone,
    };
  }

  async eligibleAgents(params: DedicatedEligibilityParams): Promise<DedicatedEligibleAgent[]> {
    return (await this.evaluate(params)).eligible;
  }

  /** Eligible agents plus the reason each other assigned agent was skipped (logs, admin views). */
  async evaluate(params: DedicatedEligibilityParams): Promise<DedicatedEligibilityResult> {
    const empty: DedicatedEligibilityResult = { eligible: [], rejected: [] };
    if (!isDedicatedEligibleOrder(params)) return empty;
    const ctx = await this.loadLocationContext(params.locationId);
    if (!ctx || ctx.disabledSlots.has(params.slotKey)) return empty;

    const assignments = await this.loadAssignments(params.locationId, params.slotKey);
    if (assignments.length === 0) return empty;

    const now = params.now ?? new Date();
    const agentIds = [...new Set(assignments.map((a) => a.agent_id))];
    const [load, signedIds] = await Promise.all([
      this.loadAgentLoad(agentIds, now, params.excludeOrderId ?? null),
      this.agentContractGate.signedIdsOrSkip(agentIds),
    ]);
    const eligibilityCtx = {
      localToday: localDateTimeAt(now, ctx.timeZone).date,
      maxActiveOrders: ctx.config.maxActiveOrders,
      rail: params.rail,
      verifiedAgentDelivery: params.verifiedAgentDelivery,
    };

    const result: DedicatedEligibilityResult = { eligible: [], rejected: [] };
    const needMoney: Array<{ row: AssignmentRow; facts: DedicatedAgentFacts }> = [];
    for (const row of assignments) {
      const agent = row.agent;
      const facts: DedicatedAgentFacts = {
        assignmentStatus: row.status,
        offTodayDate: row.off_today_date,
        isVerified: agent?.is_verified === true,
        isInternal: agent?.is_internal === true,
        agentStatus: agent?.status ?? null,
        focus: agent?.focus ?? null,
        contractSigned: !signedIds || signedIds.has(row.agent_id),
        activeOrders: load.active.get(row.agent_id) ?? 0,
        outstandingDedicatedOffers: load.offers.get(row.agent_id) ?? 0,
      };
      const reason = agent ? dedicatedProfileIneligibleReason(facts, eligibilityCtx) : 'not_verified';
      if (reason) {
        result.rejected.push({ agentId: row.agent_id, assignmentId: row.id, reason });
      } else if (requiresBalanceCheck(facts.isInternal, params.rail)) {
        needMoney.push({ row, facts });
      } else {
        result.eligible.push(this.toEligible(row, facts, 0, null));
      }
    }

    if (needMoney.length > 0) {
      const balances = await this.loadBalances(
        needMoney.map(({ row }) => row.agent?.user_id).filter((id): id is string => !!id),
        params.currency
      );
      for (const { row, facts } of needMoney) {
        const hold = await this.agentHoldService.resolveOrderHoldWithCeiling(
          params.subtotal,
          row.agent_id,
          params.rail
        );
        const holdAmount = Number(hold.holdAmount) || 0;
        const userId = row.agent?.user_id ?? null;
        const balance = userId ? balances.get(userId) ?? 0 : 0;
        const reason = dedicatedBalanceIneligibleReason(balance, holdAmount);
        if (reason) {
          result.rejected.push({ agentId: row.agent_id, assignmentId: row.id, reason });
        } else {
          result.eligible.push(this.toEligible(row, facts, holdAmount, balance));
        }
      }
    }
    return result;
  }

  private toEligible(
    row: AssignmentRow,
    facts: DedicatedAgentFacts,
    holdAmount: number,
    availableBalance: number | null
  ): DedicatedEligibleAgent {
    return {
      agentId: row.agent_id,
      userId: row.agent?.user_id ?? null,
      assignmentId: row.id,
      isInternal: facts.isInternal,
      activeOrders: facts.activeOrders,
      outstandingDedicatedOffers: facts.outstandingDedicatedOffers,
      holdAmount,
      availableBalance,
    };
  }

  /** Location country/state, disabled slots, config and country timezone; null when the flag is off. */
  private async loadLocationContext(locationId: string): Promise<LocationContext | null> {
    const res = await this.hasuraSystemService.executeQuery<{
      business_locations_by_pk: LocationContextRow | null;
    }>(DEDICATED_LOCATION_CONTEXT_QUERY, { locationId });
    const row = res?.business_locations_by_pk;
    const country = row?.address?.country?.trim().toUpperCase();
    if (!row || !country) return null;
    const config = await this.configService.getConfig(country);
    if (!config.enabled) return null;
    const configured = await this.deliveryConfigService.getTimezone(country).catch(() => null);
    return {
      country,
      state: row.address?.state?.trim() ?? '',
      disabledSlots: new Set(
        (row.pickup_slots ?? []).filter((s) => s.is_enabled === false).map((s) => s.slot_key)
      ),
      config,
      timeZone: resolveTimeZone(configured, country),
    };
  }

  /** Standard slots for the state, else the country `__DEFAULT__` rows (same rule as DeliverySlotsService). */
  private async loadSlotBounds(country: string, state: string) {
    const states = state ? [state, DEFAULT_DELIVERY_SLOT_STATE] : [DEFAULT_DELIVERY_SLOT_STATE];
    const res = await this.hasuraSystemService.executeQuery<{
      delivery_time_slots: DeliveryTimeSlotRow[];
    }>(DEDICATED_DELIVERY_SLOTS_QUERY, { country, states });
    const rows = res?.delivery_time_slots ?? [];
    const stateRows = rows.filter((r) => r.state === state);
    return toDedicatedSlotBounds(
      stateRows.length > 0 ? stateRows : rows.filter((r) => r.state === DEFAULT_DELIVERY_SLOT_STATE)
    );
  }

  private async loadAssignments(locationId: string, slotKey: string): Promise<AssignmentRow[]> {
    const res = await this.hasuraSystemService.executeQuery<{
      dedicated_agent_assignments: AssignmentRow[];
    }>(DEDICATED_SLOT_ASSIGNMENTS_QUERY, { locationId, slotKey });
    return res?.dedicated_agent_assignments ?? [];
  }

  private async loadAgentLoad(
    agentIds: string[],
    now: Date,
    excludeOrderId: string | null
  ): Promise<{ active: Map<string, number>; offers: Map<string, number> }> {
    const res = await this.hasuraSystemService.executeQuery<{
      orders: Array<{ id: string; assigned_agent_id: string }>;
      order_offers: Array<{ order_id: string; agent_id: string }>;
    }>(DEDICATED_AGENT_LOAD_QUERY, {
      agentIds,
      activeStatuses: [...DEDICATED_ACTIVE_ORDER_STATUSES],
      now: now.toISOString(),
    });
    const active = new Map<string, number>();
    for (const o of res?.orders ?? []) {
      active.set(o.assigned_agent_id, (active.get(o.assigned_agent_id) ?? 0) + 1);
    }
    const offers = new Map<string, number>();
    for (const o of res?.order_offers ?? []) {
      if (excludeOrderId && o.order_id === excludeOrderId) continue;
      offers.set(o.agent_id, (offers.get(o.agent_id) ?? 0) + 1);
    }
    return { active, offers };
  }

  /** Read-only balance lookup (no account creation): oldest active personal account per user. */
  private async loadBalances(userIds: string[], currency: string): Promise<Map<string, number>> {
    const balances = new Map<string, number>();
    if (userIds.length === 0 || !currency) return balances;
    try {
      const res = await this.hasuraSystemService.executeQuery<{
        accounts: Array<{ user_id: string; available_balance: number | string | null }>;
      }>(DEDICATED_AGENT_BALANCES_QUERY, { userIds, currency });
      for (const a of res?.accounts ?? []) {
        if (!balances.has(a.user_id)) balances.set(a.user_id, Number(a.available_balance ?? 0));
      }
    } catch (error) {
      this.logger.warn(
        `Dedicated balance lookup failed; independents on this rail get no coverage: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return balances;
  }
}
