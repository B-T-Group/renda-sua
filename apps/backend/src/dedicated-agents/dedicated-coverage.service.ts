import { agentPrefersSlot, slotPrefsFromRow } from './agent-slot-prefs.util';
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
  type DedicatedSlotBounds,
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
  | { locationId: string; preferredDate: string; slotId: string }
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
  /** Accept-time check (QA #607 N4): count active orders only, not other live offers. */
  ignoreOutstandingOffers?: boolean;
  /**
   * #594 addendum AC-P12: accept-time check skips the slot preference, so an
   * outstanding offer stays valid when the agent turns the slot off.
   */
  ignoreSlotPrefs?: boolean;
  /**
   * Local date (YYYY-MM-DD) of the slot being covered. Off today only removes
   * an agent from that day's slots; defaults to today in the country timezone.
   */
  slotDate?: string;
  now?: Date;
}

/** A scheduled window (`delivery_time_windows` slot + date) to cover at checkout or order create. */
export interface DedicatedWindowCoverageParams {
  locationId: string;
  slotId: string;
  preferredDate: string;
  rail: DedicatedRail;
  subtotal: number;
  currency: string;
  verifiedAgentDelivery: boolean;
  now?: Date;
}

export interface DedicatedWindowCoverage {
  slot: ResolvedDedicatedSlot;
  eligible: DedicatedEligibleAgent[];
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
    pref_morning?: boolean | null;
    pref_afternoon?: boolean | null;
    pref_evening?: boolean | null;
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
 * the country timezone (D12). Checkout and order create use it (PR 4); the
 * scheduled dispatch gate (PR 5) will too. Everything is behind
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
    const slots = await this.loadSlotBounds(ctx.country, ctx.state);
    let slot: DedicatedSlotBounds | null;
    let date: string;
    if ('at' in params) {
      const local = localDateTimeAt(params.at, ctx.timeZone);
      slot = resolveSlotForLocalTime(slots, local.time, ctx.config.slotEndGraceMinutes);
      date = local.date;
    } else if ('slotId' in params) {
      // The client picked a `delivery_time_slots` row: only a standard keyed slot counts.
      slot = slots.find((s) => s.slotId === params.slotId) ?? null;
      date = params.preferredDate;
    } else {
      slot = resolveSlotForLocalTime(slots, params.windowStart, ctx.config.slotEndGraceMinutes);
      date = params.preferredDate;
    }
    if (!slot || ctx.disabledSlots.has(slot.slotKey)) return null;
    return {
      slotKey: slot.slotKey,
      slotId: slot.slotId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      date,
      timeZone: ctx.timeZone,
    };
  }

  /**
   * AC-E1/E2 for one chosen window: its slot and the dedicated agents who can
   * take this cart there. Null when the flag is off, the slot isn't a keyed
   * standard slot the business offers, or nobody is eligible.
   */
  async coverWindow(params: DedicatedWindowCoverageParams): Promise<DedicatedWindowCoverage | null> {
    const slot = await this.resolveSlot({
      locationId: params.locationId,
      preferredDate: params.preferredDate,
      slotId: params.slotId,
    });
    if (!slot) return null;
    const eligible = await this.eligibleAgents({
      locationId: params.locationId,
      slotKey: slot.slotKey,
      fulfillmentTiming: 'scheduled',
      hasDeliveryWindow: true,
      rail: params.rail,
      subtotal: params.subtotal,
      currency: params.currency,
      verifiedAgentDelivery: params.verifiedAgentDelivery,
      slotDate: slot.date,
      now: params.now,
    });
    return eligible.length > 0 ? { slot, eligible } : null;
  }

  /**
   * #594 PR 6 (AC-A8): agents on duty for a location-slot on a local date,
   * whatever the order: an active assignment, not Off today on that date, and
   * a profile that passes AC-E2 (verified, signed, not suspended, delivery
   * focus). Load and money are per order and left to dispatch. Flag off -> [].
   */
  async onDutyAgents(params: {
    locationId: string;
    slotKey: string;
    date: string;
  }): Promise<Array<{ agentId: string; userId: string; assignmentId: string }>> {
    const ctx = await this.loadLocationContext(params.locationId);
    if (!ctx || ctx.disabledSlots.has(params.slotKey)) return [];
    const assignments = await this.loadAssignments(params.locationId, params.slotKey);
    if (assignments.length === 0) return [];
    const signedIds = await this.agentContractGate.signedIdsOrSkip([
      ...new Set(assignments.map((a) => a.agent_id)),
    ]);
    const out: Array<{ agentId: string; userId: string; assignmentId: string }> = [];
    for (const row of assignments) {
      const agent = row.agent;
      if (!agent?.user_id) continue;
      const reason = dedicatedProfileIneligibleReason(
        {
          assignmentStatus: row.status,
          offTodayDate: row.off_today_date,
          isVerified: agent.is_verified === true,
          isInternal: agent.is_internal === true,
          agentStatus: agent.status ?? null,
          focus: agent.focus ?? null,
          contractSigned: !signedIds || signedIds.has(row.agent_id),
          activeOrders: 0,
          outstandingDedicatedOffers: 0,
        },
        {
          localToday: params.date,
          maxActiveOrders: ctx.config.maxActiveOrders,
          rail: 'mobile_money',
          verifiedAgentDelivery: false,
        }
      );
      if (!reason) out.push({ agentId: row.agent_id, userId: agent.user_id, assignmentId: row.id });
    }
    return out;
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
      localToday: params.slotDate ?? localDateTimeAt(now, ctx.timeZone).date,
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
        outstandingDedicatedOffers: params.ignoreOutstandingOffers ? 0 : load.offers.get(row.agent_id) ?? 0,
      };
      const reason = !agent
        ? 'not_verified'
        : !params.ignoreSlotPrefs && !agentPrefersSlot(slotPrefsFromRow(agent), params.slotKey)
          ? 'slot_pref_off'
          : dedicatedProfileIneligibleReason(facts, eligibilityCtx);
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
        const holdAmount = await this.holdFor(params, row.agent_id);
        const userId = row.agent?.user_id ?? null;
        const balance = userId ? balances.get(userId) ?? 0 : 0;
        // QA N2: an unknown hold fails closed for this agent only.
        const reason =
          holdAmount == null ? 'hold_unavailable' : dedicatedBalanceIneligibleReason(balance, holdAmount);
        if (reason) {
          result.rejected.push({ agentId: row.agent_id, assignmentId: row.id, reason });
        } else {
          result.eligible.push(this.toEligible(row, facts, holdAmount as number, balance));
        }
      }
    }
    return result;
  }

  /** The agent's hold for this order, or null when it can't be resolved or isn't a finite amount >= 0. */
  private async holdFor(params: DedicatedEligibilityParams, agentId: string): Promise<number | null> {
    try {
      const hold = await this.agentHoldService.resolveOrderHoldWithCeiling(params.subtotal, agentId, params.rail);
      const amount = Number(hold?.holdAmount);
      if (Number.isFinite(amount) && amount >= 0) return amount;
      this.logger.warn(`dedicated hold for agent ${agentId} is not a finite amount (${String(hold?.holdAmount)}); skipping agent`);
    } catch (error) {
      this.logger.warn(
        `dedicated hold for agent ${agentId} failed: ${error instanceof Error ? error.message : String(error)}; skipping agent`
      );
    }
    return null;
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

  /** Public read of the dedicated slot bounds for a market (used by the assignment / posting flows). */
  async slotBoundsFor(country: string, state: string): Promise<DedicatedSlotBounds[]> {
    return this.loadSlotBounds(country, state);
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
