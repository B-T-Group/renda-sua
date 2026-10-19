import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import type { ConfigService } from '@nestjs/config';
import type { AgentContractGateService } from '../agent-contracts/agent-contract-gate.service';
import type { AgentHoldService } from '../agents/agent-hold.service';
import type { CommissionsService } from '../commissions/commissions.service';
import type { Configuration } from '../config/configuration';
import { DedicatedAgentsConfigService } from '../dedicated-agents/dedicated-agents-config.service';
import { DedicatedCoverageService } from '../dedicated-agents/dedicated-coverage.service';
import type { EligibleAgentsQueryService } from '../delivery-availability/eligible-agents-query.service';
import type { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { SiteEventsService } from '../site-events/site-events.service';
import type { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { DEDICATED_ORDER_CLAIMER, type DedicatedOrderClaimer } from './dedicated-claim.port';
import { DedicatedDispatchService } from './dedicated-dispatch.service';
import type { AccountsService } from '../accounts/accounts.service';
import type { OrderEventsService } from './order-events.service';
import { OrderOffersService } from './order-offers.service';
import { OrderReassignmentService } from './order-reassignment.service';
import type { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

const LOCATION = 'loc-1';
const ORDER = 'order-1';
const NOW = new Date('2026-10-18T09:00:00Z'); // 10:00 in Douala

interface OfferRow {
  order_id: string;
  agent_id: string;
  user_id: string | null;
  status: string;
  offer_kind: string;
  decline_reason: string | null;
  expires_at: string;
  created_at?: string;
  responded_at?: string;
  currency?: string | null;
  estimated_earnings?: number | null;
}

type Vars = Record<string, unknown> & {
  orderId?: string;
  id?: string;
  agentId?: string;
  objects?: OfferRow[];
  now?: string;
  locationId?: string;
  slotKey?: string;
  agentIds?: string[];
  activeStatuses?: string[];
  userIds?: string[];
  currency?: string;
  states?: string[];
  reason?: string | null;
  round?: number;
};

/**
 * In-memory Hasura for the dispatch gate (OrderOffersService), the dedicated
 * fallback and the PR 2 coverage queries. Each query/mutation applies its own
 * filters to the rows, so the services are tested against data.
 */
function world() {
  const state = {
    afterUpsert: undefined as undefined | (() => void),
    flag: true,
    order: {
      id: ORDER,
      order_number: 'ORD-1',
      business_id: 'biz-1',
      business_location_id: LOCATION,
      current_status: 'ready_for_pickup',
      assigned_agent_id: null as string | null,
      fulfillment_method: 'delivery',
      fulfillment_timing: 'scheduled' as string | null,
      subtotal: 10000,
      currency: 'XAF',
      verified_agent_delivery: false,
      coverage_slot_key: 'afternoon' as string | null,
      dispatch_round: 0,
      dispatch_ready_at: null as string | null,
      dispatch_exhausted_at: null as string | null,
      assignment_source: null as string | null,
      dedicated_assignment_id: null as string | null,
      dedicated_release_until: null as string | null,
      reassignment_count: 0,
      pickup_due_at: null as string | null,
      pickup_state: null as string | null,
      window: { slot_id: 'cm-a', preferred_date: '2026-10-18', is_confirmed: true as boolean | null } as
        | { slot_id: string; preferred_date: string; is_confirmed: boolean | null }
        | null,
    },
    deliverySlots: [
      { id: 'cm-m', state: 'Littoral', slot_name: 'Morning', slot_type: 'standard', start_time: '08:00:00', end_time: '12:00:00' },
      { id: 'cm-a', state: 'Littoral', slot_name: 'Afternoon', slot_type: 'standard', start_time: '12:00:00', end_time: '16:00:00' },
      { id: 'cm-e', state: 'Littoral', slot_name: 'Evening', slot_type: 'standard', start_time: '16:00:00', end_time: '20:00:00' },
    ],
    assignments: [] as Array<{ id: string; agent_id: string; slot_key: string; status: string; off_today_date: string | null }>,
    agents: new Map<string, { id: string; user_id: string; is_verified: boolean; is_internal: boolean; status: string; focus: string; preferred_language: string | null }>(),
    localeLookupFails: false,
    claimAgentMissing: null as 'agent' | 'user' | null,
    activeOrders: [] as Array<{ id: string; assigned_agent_id: string; current_status: string }>,
    accounts: [] as Array<{ user_id: string; currency: string; available_balance: number; business_location_id: null; is_active: boolean }>,
    offers: [] as OfferRow[],
    noAgentMessages: 0,
    mutations: [] as string[],
    /** Users with a push token (standard rounds only offer to them); null = everyone. */
    pushTokenUsers: null as Set<string> | null,
    holds: [] as Array<{ id: string; agent_hold_amount: number; status: string }>,
    releaseRowFails: false,
    releaseCasDeadlocks: 0,
    /** Another agent claims the order right after the release CAS (QA #608 N1). */
    claimAfterRelease: null as string | null,
  };

  const op = (q: string) => /(?:query|mutation) (\w+)/.exec(q)?.[1] ?? '?';
  const orderRow = () => {
    const { window, ...o } = state.order;
    return {
      ...o,
      business: { name: 'Chez Mama' },
      business_location: {
        name: 'Chez Mama Akwa',
        address: { country: 'CM', state: 'Littoral', latitude: 4.05, longitude: 9.7 },
      },
      delivery_time_windows: window ? [window] : [],
    };
  };

  const executeQuery = jest.fn(async (query: string, vars: Vars) => {
    switch (op(query)) {
      case 'OfferOrder':
        return { orders_by_pk: orderRow() };
      case 'DedicatedDispatchOrder':
        return {
          orders_by_pk: orderRow(),
          order_offers: state.offers.filter((o) => o.order_id === vars.orderId && o.offer_kind === 'dedicated'),
        };
      case 'DedicatedAgentsConfig':
        return {
          application_configurations: [
            { config_key: 'dedicated_agents_enabled', boolean_value: state.flag, country_code: null },
          ],
        };
      case 'DedicatedLocationContext':
        return {
          business_locations_by_pk: { id: LOCATION, address: { country: 'cm', state: 'Littoral' }, pickup_slots: [] },
        };
      case 'DedicatedDeliverySlots':
        return { delivery_time_slots: state.deliverySlots.filter((s) => vars.states?.includes(s.state)) };
      case 'DedicatedSlotAssignments':
        return {
          dedicated_agent_assignments: state.assignments
            .filter((a) => a.slot_key === vars.slotKey && a.status === 'active')
            .map((a) => ({ ...a, agent: state.agents.get(a.agent_id) ?? null })),
        };
      case 'DedicatedAgentLoad':
        return {
          orders: state.activeOrders.filter(
            (o) => vars.agentIds?.includes(o.assigned_agent_id) && vars.activeStatuses?.includes(o.current_status)
          ),
          order_offers: state.offers.filter(
            (o) =>
              vars.agentIds?.includes(o.agent_id) &&
              o.offer_kind === 'dedicated' &&
              o.status === 'offered' &&
              Date.parse(o.expires_at) > Date.parse(String(vars.now))
          ),
        };
      case 'DedicatedAgentBalances':
        return {
          accounts: state.accounts.filter((a) => vars.userIds?.includes(a.user_id) && a.currency === vars.currency),
        };
      case 'DedicatedClaimAgent': {
        const a = state.claimAgentMissing === 'agent' ? undefined : state.agents.get(String(vars.agentId));
        const user =
          a && state.claimAgentMissing !== 'user'
            ? { id: a.user_id, first_name: 'A', last_name: a.id, preferred_language: a.preferred_language }
            : null;
        return {
          agents_by_pk: a ? { id: a.id, is_verified: a.is_verified, is_internal: a.is_internal, user } : null,
        };
      }
      case 'DedicatedDeclinedAgents':
        return {
          order_offers: state.offers
            // The filter is read from the query text, so the real where clause is what's tested.
            .filter(
              (o) =>
                o.order_id === vars.orderId &&
                (!query.includes('offer_kind: { _eq: "dedicated" }') || o.offer_kind === 'dedicated') &&
                (!query.includes('status: { _eq: declined }') || o.status === 'declined')
            )
            .map((o) => ({ agent_id: o.agent_id })),
        };
      case 'DedicatedOfferLocales':
        if (state.localeLookupFails) throw new Error('hasura down');
        return {
          users: [...state.agents.values()]
            .filter((a) => vars.userIds?.includes(a.user_id))
            .map((a) => ({ id: a.user_id, preferred_language: a.preferred_language })),
        };
      case 'DedicatedReleaseOrder': {
        const { window: _w, ...o } = state.order;
        void _w;
        const a = o.assigned_agent_id ? state.agents.get(o.assigned_agent_id) : undefined;
        return {
          orders_by_pk: {
            ...o,
            business_location: { address: { country: 'CM' } },
            assigned_agent: a ? { id: a.id, user_id: a.user_id } : null,
          },
        };
      }
      case 'OrderHold':
        return { order_holds: state.holds.filter((h) => h.status === 'active') };
      case 'PushTokens':
        return {
          mobile_push_tokens: (vars.userIds ?? [])
            .filter((u) => !state.pushTokenUsers || state.pushTokenUsers.has(u))
            .map((u) => ({ user_id: u })),
        };
      case 'AgentPickupRel':
        return { agents: ((vars.ids as string[]) ?? []).map((id) => ({ id, pickup_reliability_score: 100 })) };
      case 'AgentUser':
        return { agents_by_pk: { user_id: state.agents.get(String(vars.id))?.user_id ?? null } };
      case 'ClientForNoAgent':
        return { orders_by_pk: { client: { user_id: 'client-user', user: { preferred_language: 'en' } } } };
      case 'OrderItemsPickupEligibility':
        return { order_items: [] };
      case 'ActiveOffer': {
        const row = state.offers.find(
          (o) =>
            o.order_id === vars.orderId &&
            o.agent_id === vars.agentId &&
            o.status === 'offered' &&
            Date.parse(o.expires_at) > Date.parse(String(vars.now))
        );
        return { order_offers: row ? [{ id: `${row.order_id}:${row.agent_id}`, expires_at: row.expires_at, offer_kind: row.offer_kind }] : [] };
      }
      default:
        throw new Error(`unexpected query ${op(query)}`);
    }
  });

  const forAgent = (vars: Vars, extra: (o: OfferRow) => boolean) =>
    state.offers.filter((o) => o.order_id === vars.orderId && o.agent_id === vars.agentId && o.status === 'offered' && extra(o));

  const executeMutation = jest.fn(async (mutation: string, vars: Vars) => {
    const name = op(mutation);
    state.mutations.push(name);
    switch (name) {
      case 'MarkDispatchRound':
        state.order.dispatch_round = Number(vars.round);
        return { update_orders_by_pk: { id: ORDER } };
      case 'MarkDispatchExhausted':
        if (state.order.dispatch_exhausted_at) return { update_orders: { affected_rows: 0 } };
        state.order.dispatch_exhausted_at = String(vars.at);
        return { update_orders: { affected_rows: 1 } };
      case 'InsertNoAgentMessage':
        state.noAgentMessages += 1;
        return { insert_user_messages_one: { id: 'm' } };
      case 'UpsertDedicatedOffers':
        for (const obj of vars.objects ?? []) {
          const existing = state.offers.find((o) => o.order_id === obj.order_id && o.agent_id === obj.agent_id);
          // on_conflict ... where: only rows matching it are updated (Postgres DO UPDATE ... WHERE).
          const onlyExpired = /on_conflict: \{[^}]*where: \{ status: \{ _eq: expired \} \}/s.test(mutation);
          if (existing && onlyExpired && existing.status !== 'expired') continue;
          state.offers = state.offers.filter((o) => o !== existing);
          state.offers.push({ ...obj });
        }
        state.afterUpsert?.();
        return { insert_order_offers: { affected_rows: vars.objects?.length ?? 0 } };
      case 'ExpireDedicatedOffers': {
        const expired = state.offers.filter(
          (o) =>
            o.order_id === vars.orderId &&
            o.offer_kind === 'dedicated' &&
            o.status === 'offered' &&
            Date.parse(o.expires_at) <= Date.parse(String(vars.now))
        );
        expired.forEach((o) => (o.status = 'expired'));
        return { update_order_offers: { returning: expired.map((o) => ({ agent_id: o.agent_id })) } };
      }
      case 'AcceptOffer': {
        const guarded = mutation.includes('{ order: { assignment_source: { _eq: "dedicated_offer" } } }');
        const stamped = state.order?.assignment_source === 'dedicated_offer';
        const rows = forAgent(vars, (o) => !guarded || o.offer_kind !== 'dedicated' || stamped);
        rows.forEach((o) => (o.status = 'accepted'));
        if (mutation.includes('unstamped: update_order_offers')) forAgent(vars, () => true).forEach((o) => (o.status = 'cancelled'));
        return { update_order_offers: { affected_rows: rows.length, returning: rows.map((o) => ({ offer_kind: o.offer_kind })) } };
      }
      case 'CancelSiblingOffers': {
        const rows = state.offers.filter((o) => o.order_id === vars.orderId && o.agent_id !== vars.agentId && o.status === 'offered');
        rows.forEach((o) => (o.status = 'cancelled'));
        return { update_order_offers: { returning: rows.map((o) => ({ user_id: o.user_id })) } };
      }
      case 'ReleaseDedicatedAutoAssignment': {
        if (state.releaseCasDeadlocks > 0) {
          state.releaseCasDeadlocks -= 1;
          throw Object.assign(new Error('deadlock detected'), { code: '40P01' });
        }
        const o = state.order;
        const ok =
          o.current_status === 'assigned_to_agent' &&
          o.assigned_agent_id === vars.agentId &&
          o.assignment_source === 'dedicated_auto' &&
          !!o.dedicated_release_until &&
          Date.parse(o.dedicated_release_until) > Date.parse(String(vars.now));
        if (!ok) return { update_orders: { affected_rows: 0 } };
        Object.assign(o, {
          assigned_agent_id: null,
          current_status: 'ready_for_pickup',
          assignment_source: null,
          dedicated_assignment_id: null,
          dedicated_release_until: null,
          dispatch_round: 0,
          dispatch_exhausted_at: null,
          pickup_due_at: null,
          pickup_state: null,
        });
        if (state.claimAfterRelease) Object.assign(o, { assigned_agent_id: state.claimAfterRelease, current_status: 'assigned_to_agent' });
        return { update_orders: { affected_rows: 1 } };
      }
      case 'DropDedicatedReleaseExclusion': {
        const before = state.offers.length;
        state.offers = state.offers.filter(
          (x) => !(x.order_id === vars.orderId && x.agent_id === vars.agentId && x.status === 'declined' && x.responded_at === vars.at)
        );
        return { delete_order_offers: { affected_rows: before - state.offers.length } };
      }
      case 'RecordDedicatedRelease': {
        if (state.releaseRowFails) throw new Error('insert failed');
        const obj = vars.object as unknown as OfferRow;
        state.offers = state.offers.filter((o) => !(o.order_id === obj.order_id && o.agent_id === obj.agent_id));
        state.offers.push({ ...obj });
        return { insert_order_offers_one: { id: 'r' } };
      }
      case 'RevertDedicatedRelease': {
        const o = state.order;
        if (o.assigned_agent_id || o.current_status !== 'ready_for_pickup') return { update_orders: { affected_rows: 0 }, restore: { affected_rows: 0 } };
        if (mutation.includes('_set: $pickup')) Object.assign(o, vars.pickup);
        if (!mutation.includes('restore: update_orders')) return { update_orders: { affected_rows: 1 } };
        Object.assign(o, {
          assigned_agent_id: vars.agentId,
          current_status: 'assigned_to_agent',
          assignment_source: 'dedicated_auto',
          dedicated_assignment_id: vars.assignmentId,
          dedicated_release_until: vars.releaseUntil,
        });
        return { update_orders: { affected_rows: 1 }, restore: { affected_rows: 1 } };
      }
      case 'CancelHold':
        state.holds.filter((h) => h.id === vars.id).forEach((h) => (h.status = 'cancelled'));
        return { update_order_holds: { affected_rows: 1 } };
      case 'DedicatedReleaseHistory':
        return { insert_order_status_history: { affected_rows: 1 } };
      case 'UpsertOffers':
        for (const obj of vars.objects ?? []) {
          state.offers = state.offers.filter((o) => !(o.order_id === obj.order_id && o.agent_id === obj.agent_id));
          state.offers.push({ offer_kind: 'standard', decline_reason: null, ...obj });
        }
        return { insert_order_offers: { affected_rows: vars.objects?.length ?? 0 } };
      case 'DeclineOffer': {
        const dedicated = forAgent(vars, (o) => o.offer_kind === 'dedicated');
        dedicated.forEach((o) => {
          o.status = 'declined';
          o.decline_reason = (vars.reason as string | null) ?? null;
        });
        const standard = forAgent(vars, (o) => o.offer_kind !== 'dedicated');
        standard.forEach((o) => (o.status = 'declined'));
        return { dedicated: { affected_rows: dedicated.length }, standard: { affected_rows: standard.length } };
      }
      default:
        throw new Error(`unexpected mutation ${name}`);
    }
  });

  const getAccount = jest.fn(async (userId: string) => ({ id: `acct-${userId}`, available_balance: 0 }));
  const hasura = { executeQuery, executeMutation, getAccount } as unknown as HasuraSystemService;
  const notifications = {
    sendOrderOfferPush: jest.fn().mockResolvedValue({ webSent: 0, expoSent: 1 }),
    sendOrderOfferCancelledPush: jest.fn().mockResolvedValue(undefined),
    sendOrderNoAgentPush: jest.fn().mockResolvedValue(undefined),
    sendDedicatedOrderNotice: jest.fn().mockResolvedValue(undefined),
  };
  const commissions = {
    calculateAgentEarnings: jest.fn().mockResolvedValue({ totalEarnings: 1500, currency: 'XAF' }),
  };
  const config = {
    get: jest.fn((key: string) => (key === 'orderOffers' ? { ttlSeconds: 30, maxAgents: 5, roundGapSeconds: 30 } : undefined)),
  };
  const nearby: Array<{ agentId: string; userId: string; distanceKm: number }> = [];
  const eligibleQuery = { findEligibleAgents: jest.fn(async () => nearby) };
  const schedule = { scheduleDispatchRound: jest.fn().mockResolvedValue(undefined) };
  const deliveryConfig = {
    getDeliveryAvailabilityRadiusKm: jest.fn().mockResolvedValue(10),
    getTimezone: jest.fn().mockResolvedValue('Africa/Douala'),
  };
  const routing = { resolveRailForBusiness: jest.fn().mockResolvedValue('mobile_money') };
  const holdsByAgent = new Map<string, number>();
  const agentHold = {
    resolveOrderHoldWithCeiling: jest.fn(async (subtotal: number, agentId: string) => ({
      holdAmount: holdsByAgent.get(agentId) ?? Math.round(subtotal * 0.8),
    })),
  };
  const gate = { signedIdsOrSkip: jest.fn(async (ids: string[]) => new Set(ids)) };
  const siteEvents = { trackEvent: jest.fn().mockResolvedValue(undefined) };

  const dedicatedConfig = new DedicatedAgentsConfigService(hasura);
  const coverage = new DedicatedCoverageService(
    hasura,
    dedicatedConfig,
    agentHold as unknown as AgentHoldService,
    gate as unknown as AgentContractGateService,
    deliveryConfig as unknown as DeliveryConfigService
  );

  const holder: { offers?: OrderOffersService } = {};
  /** Atomic first-wins claim against the in-memory order, like assignOrderToAgent. */
  const claimer: DedicatedOrderClaimer & { claimOrderForAgent: jest.Mock } = {
    claimOrderForAgent: jest.fn(async (p: Parameters<DedicatedOrderClaimer['claimOrderForAgent']>[0]) => {
      if (state.order.assigned_agent_id || state.order.current_status !== 'ready_for_pickup') {
        throw new HttpException({ error: 'ALREADY_ASSIGNED' }, HttpStatus.CONFLICT);
      }
      state.order.assigned_agent_id = p.agent.id;
      state.order.current_status = 'assigned_to_agent';
      state.order.assignment_source = p.assignment?.source ?? null;
      state.order.dedicated_assignment_id = p.assignment?.dedicatedAssignmentId ?? null;
      state.order.dedicated_release_until = p.assignment?.releaseUntil ?? null;
      await holder.offers?.handleOrderAssigned(p.orderId, p.agent.id);
      return { success: true };
    }),
  };
  const moduleRef = {
    get: jest.fn((token: unknown) => {
      if (token !== DEDICATED_ORDER_CLAIMER) throw new Error('unexpected token');
      return claimer;
    }),
  };
  const dispatch = new DedicatedDispatchService(
    hasura,
    dedicatedConfig,
    coverage,
    routing as unknown as PaymentRoutingService,
    notifications as unknown as NotificationsService,
    commissions as unknown as CommissionsService,
    moduleRef as unknown as ModuleRef,
    siteEvents as unknown as SiteEventsService
  );
  const offersService = new OrderOffersService(
    hasura,
    commissions as unknown as CommissionsService,
    notifications as unknown as NotificationsService,
    config as unknown as ConfigService<Configuration>,
    eligibleQuery as unknown as EligibleAgentsQueryService,
    schedule as unknown as WaitAndExecuteScheduleService,
    deliveryConfig as unknown as DeliveryConfigService,
    routing as unknown as PaymentRoutingService,
    agentHold as unknown as AgentHoldService,
    dispatch
  );
  holder.offers = offersService;
  const orderEvents = { recordEvent: jest.fn().mockResolvedValue(undefined) };
  const accounts = { registerReleaseIfNotExists: jest.fn().mockResolvedValue({ success: true }) };
  const reassignment = new OrderReassignmentService(
    hasura,
    orderEvents as unknown as OrderEventsService,
    notifications as unknown as NotificationsService,
    offersService,
    accounts as unknown as AccountsService,
    dedicatedConfig,
    siteEvents as unknown as SiteEventsService
  );

  const addAgent = (
    id: string,
    over: { internal?: boolean; balance?: number; slot?: string; locale?: string | null } = {}
  ) => {
    state.agents.set(id, {
      id,
      user_id: `u-${id}`,
      is_verified: true,
      is_internal: over.internal === true,
      status: 'active',
      focus: 'delivery',
      preferred_language: over.locale === undefined ? 'en' : over.locale,
    });
    state.assignments.push({ id: `as-${id}`, agent_id: id, slot_key: over.slot ?? 'afternoon', status: 'active', off_today_date: null });
    if (over.balance != null) {
      state.accounts.push({ user_id: `u-${id}`, currency: 'XAF', available_balance: over.balance, business_location_id: null, is_active: true });
    }
  };
  const events = (type: string) =>
    siteEvents.trackEvent.mock.calls
      .map((c) => c[0] as { eventType: string; metadata: Record<string, unknown> })
      .filter((e) => e.eventType === type)
      .map((e) => e.metadata);
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const dedicatedOffers = () => state.offers.filter((o) => o.offer_kind === 'dedicated');
  const queries = () => executeQuery.mock.calls.map(([q]) => op(q));

  /** An agent accepts their offer: the dispatch re-check, then the atomic claim. */
  const accept = async (agentId: string) => {
    const assignment = await offersService.dedicatedAcceptAssignment(ORDER, agentId);
    const a = state.agents.get(agentId);
    return claimer.claimOrderForAgent({
      orderId: ORDER,
      user: { id: a?.user_id ?? '' },
      agent: { id: agentId, is_verified: true, is_internal: a?.is_internal },
      fundsCheckSource: 'offer_accept',
      assignment,
    });
  };

  return {
    state,
    offersService,
    dispatch,
    claimer,
    notifications,
    schedule,
    nearby,
    holdsByAgent,
    addAgent,
    events,
    flush,
    dedicatedOffers,
    queries,
    accept,
    reassignment,
    orderEvents,
    accounts,
    executeMutation,
  };
}

describe('#594 PR 5 dedicated fallback at the scheduled dispatch gate', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('one eligible internal agent: auto-assigned (dedicated_auto, release window), no offer row', async () => {
    const w = world();
    w.addAgent('int', { internal: true });
    await w.offersService.runDispatchRound(ORDER, 1);
    expect(w.claimer.claimOrderForAgent).toHaveBeenCalledTimes(1);
    expect(w.claimer.claimOrderForAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER,
        agent: expect.objectContaining({ id: 'int', is_internal: true }),
        user: expect.objectContaining({ id: 'u-int' }),
        assignment: {
          source: 'dedicated_auto',
          dedicatedAssignmentId: 'as-int',
          releaseUntil: new Date(NOW.getTime() + 120_000).toISOString(),
          // QA #607 N1: the claim checks the cap under the agent lock, counting live offers.
          maxActiveOrders: 10,
          countOffers: true,
        },
      })
    );
    expect(w.state.order.assigned_agent_id).toBe('int');
    expect(w.dedicatedOffers()).toHaveLength(0);
    expect(w.schedule.scheduleDispatchRound).not.toHaveBeenCalled();
    expect(w.notifications.sendDedicatedOrderNotice).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-int', messageType: 'DEDICATED_ORDER_AUTO_ASSIGNED', orderId: ORDER, persona: 'agent' })
    );
    await w.flush();
    expect(w.events('dedicated.auto_assigned')).toEqual([expect.objectContaining({ agentId: 'int', slotKey: 'afternoon' })]);
  });

  it('two eligible: both get a dedicated offer (TTL 120 s); the first accept wins, the other is cancelled', async () => {
    const w = world();
    w.addAgent('zed', { internal: true });
    w.addAgent('amy', { balance: 50000 });
    await w.offersService.runDispatchRound(ORDER, 1);
    expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
    const offers = w.dedicatedOffers();
    // Written in agent-id order (lock helper).
    expect(offers.map((o) => o.agent_id)).toEqual(['amy', 'zed']);
    for (const o of offers) {
      expect(o).toMatchObject({ status: 'offered', offer_kind: 'dedicated', decline_reason: null });
      expect(o.expires_at).toBe(new Date(NOW.getTime() + 120_000).toISOString());
    }
    expect(w.notifications.sendOrderOfferPush).toHaveBeenCalledTimes(2);
    expect(w.notifications.sendOrderOfferPush).toHaveBeenCalledWith(expect.objectContaining({ ttlSeconds: 120, userId: 'u-amy' }));
    // Next step waits for the offers, not the 30 s standard round gap.
    expect(w.schedule.scheduleDispatchRound).toHaveBeenCalledWith(ORDER, 2, 120);

    await w.accept('zed');
    expect(w.state.order).toMatchObject({ assigned_agent_id: 'zed', assignment_source: 'dedicated_offer' });
    expect(w.dedicatedOffers().find((o) => o.agent_id === 'zed')?.status).toBe('accepted');
    expect(w.dedicatedOffers().find((o) => o.agent_id === 'amy')?.status).toBe('cancelled');
    expect(w.notifications.sendOrderOfferCancelledPush).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-amy' }));
    await expect(w.accept('amy')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    await w.flush();
    expect(w.events('dedicated.offer_sent')).toHaveLength(2);
    expect(w.events('dedicated.offer_accepted')).toEqual([{ orderId: ORDER, agentId: 'zed' }]);
  });

  it('offer push in each agent\'s saved locale, the default language (French) when none is saved', async () => {
    const w = world();
    w.addAgent('amy', { balance: 50000, locale: 'en' });
    w.addAgent('bob', { balance: 50000, locale: 'fr-CM' });
    w.addAgent('cat', { balance: 50000, locale: null });
    await w.offersService.runDispatchRound(ORDER, 1);
    const pushFor = (userId: string) =>
      w.notifications.sendOrderOfferPush.mock.calls.map((c) => c[0]).find((p) => p.userId === userId);
    expect(pushFor('u-amy')).toMatchObject({
      title: 'Dedicated delivery available',
      body: 'Pickup: Chez Mama Akwa (Afternoon) - Tap to respond',
    });
    expect(pushFor('u-bob')).toMatchObject({ title: 'Livraison dédiée disponible' });
    expect(pushFor('u-cat')).toMatchObject({ title: 'Livraison dédiée disponible' });
  });

  it('a failed locale lookup still sends the offers, in the default language', async () => {
    const w = world();
    w.addAgent('amy', { balance: 50000, locale: 'en' });
    w.addAgent('bob', { balance: 50000, locale: 'en' });
    w.state.localeLookupFails = true;
    await w.offersService.runDispatchRound(ORDER, 1);
    expect(w.notifications.sendOrderOfferPush).toHaveBeenCalledTimes(2);
    for (const [p] of w.notifications.sendOrderOfferPush.mock.calls) {
      expect(p).toMatchObject({ title: 'Livraison dédiée disponible' });
    }
  });

  describe('a failed auto-assign is logged, then today\'s path continues', () => {
    let warn: jest.SpyInstance;
    beforeEach(() => {
      warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => warn.mockRestore());
    const autoAssignWarnings = () =>
      warn.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('Dedicated auto-assign of order ORD-1'));

    it('the claim is refused', async () => {
      const w = world();
      w.addAgent('int', { internal: true });
      w.claimer.claimOrderForAgent.mockRejectedValueOnce(
        new HttpException({ error: 'AGENT_CONTRACT_REQUIRED' }, HttpStatus.FORBIDDEN)
      );
      await w.offersService.runDispatchRound(ORDER, 1);
      expect(autoAssignWarnings()).toEqual([
        'Dedicated auto-assign of order ORD-1 to agent int failed ({"error":"AGENT_CONTRACT_REQUIRED"}); standard dispatch continues',
      ]);
      expect(w.state.order.assigned_agent_id).toBeNull();
      expect(w.schedule.scheduleDispatchRound).toHaveBeenCalledWith(ORDER, 2, 30);
      await w.flush();
      expect(w.events('dedicated.auto_assigned')).toHaveLength(0);
    });

    it.each(['agent', 'user'] as const)('the claim can no longer load the %s', async (missing) => {
      const w = world();
      w.addAgent('int', { internal: true });
      // Eligible in the assignment view, gone by the time the claim loads the agent.
      w.state.claimAgentMissing = missing;
      await w.offersService.runDispatchRound(ORDER, 1);
      expect(autoAssignWarnings()).toEqual([
        'Dedicated auto-assign of order ORD-1 to agent int failed (agent_not_found); standard dispatch continues',
      ]);
      expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
      expect(w.schedule.scheduleDispatchRound).toHaveBeenCalledWith(ORDER, 2, 30);
    });

    it('a successful auto-assign logs nothing', async () => {
      const w = world();
      w.addAgent('int', { internal: true });
      await w.offersService.runDispatchRound(ORDER, 1);
      expect(autoAssignWarnings()).toEqual([]);
    });
  });

  it('a single independent agent gets a 120 s offer, never an auto-assignment', async () => {
    const w = world();
    w.addAgent('ind', { balance: 50000 });
    await w.offersService.runDispatchRound(ORDER, 1);
    expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
    expect(w.dedicatedOffers()).toEqual([
      expect.objectContaining({ agent_id: 'ind', status: 'offered', expires_at: new Date(NOW.getTime() + 120_000).toISOString() }),
    ]);
  });

  it('an unconfirmed window gets no dedicated call and records coverage_unconfirmed_at_dispatch', async () => {
    const w = world();
    w.addAgent('int', { internal: true });
    if (w.state.order.window) w.state.order.window.is_confirmed = false;
    await w.offersService.runDispatchRound(ORDER, 1);
    expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
    expect(w.dedicatedOffers()).toHaveLength(0);
    expect(w.schedule.scheduleDispatchRound).toHaveBeenCalledWith(ORDER, 2, 30);
    await w.flush();
    expect(w.events('dedicated.coverage_unconfirmed_at_dispatch')).toEqual([
      expect.objectContaining({ orderId: ORDER, coverageSlotKey: 'afternoon', nearbyCandidateCount: 0 }),
    ]);
  });

  it('a confirmed window records no unconfirmed event', async () => {
    const w = world();
    w.addAgent('int', { internal: true });
    await w.offersService.runDispatchRound(ORDER, 1);
    await w.flush();
    expect(w.events('dedicated.coverage_unconfirmed_at_dispatch')).toHaveLength(0);
  });

  it('ASAP order: no dedicated call', async () => {
    const w = world();
    w.addAgent('int', { internal: true });
    w.state.order.fulfillment_timing = 'asap';
    await w.offersService.runDispatchRound(ORDER, 1);
    expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
    expect(w.dedicatedOffers()).toHaveLength(0);
  });

  it('flag off: no dedicated call', async () => {
    const w = world();
    w.addAgent('int', { internal: true });
    w.state.flag = false;
    await w.offersService.runDispatchRound(ORDER, 1);
    expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
    expect(w.dedicatedOffers()).toHaveLength(0);
  });

  it('an order not placed on dedicated coverage (no coverage_slot_key, no backfill): no dedicated call', async () => {
    const w = world();
    w.addAgent('int', { internal: true });
    w.state.order.coverage_slot_key = null;
    await w.offersService.runDispatchRound(ORDER, 1);
    expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
    expect(w.state.mutations).not.toContain('UpsertDedicatedOffers');
    // The gate doesn't even load the dedicated view of the order.
    expect(w.queries()).not.toContain('DedicatedDispatchOrder');
    // Called directly, the fallback refuses it too.
    await expect(w.dispatch.fallback(ORDER)).resolves.toEqual({ kind: 'none' });
    expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
  });

  it('nearby agents found: standard offers only, the dedicated fallback waits', async () => {
    const w = world();
    w.addAgent('int', { internal: true });
    w.nearby.push({ agentId: 'near', userId: 'u-near', distanceKm: 1 });
    // The standard candidate search and offer insert are covered by order-offers.service.spec.
    jest.spyOn(w.offersService as unknown as { findClosestEligibleAgents: () => unknown }, 'findClosestEligibleAgents').mockResolvedValue(w.nearby);
    jest.spyOn(w.offersService as unknown as { insertOffers: () => unknown }, 'insertOffers').mockResolvedValue(undefined);
    await w.offersService.runDispatchRound(ORDER, 1);
    expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
    expect(w.dedicatedOffers()).toHaveLength(0);
  });

  it('an agent at 10 active orders is skipped', async () => {
    const w = world();
    w.addAgent('busy', { internal: true });
    w.addAgent('ind', { balance: 50000 });
    for (let i = 0; i < 10; i++) w.state.activeOrders.push({ id: `o-${i}`, assigned_agent_id: 'busy', current_status: 'in_transit' });
    await w.offersService.runDispatchRound(ORDER, 1);
    expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
    expect(w.dedicatedOffers().map((o) => o.agent_id)).toEqual(['ind']);
  });

  it('verified-agent delivery with only an independent: no dedicated offer, the client gets the no-agent fallback', async () => {
    const w = world();
    w.addAgent('ind', { balance: 50000 });
    w.state.order.verified_agent_delivery = true;
    await w.offersService.runDispatchRound(ORDER, 1);
    await w.offersService.runDispatchRound(ORDER, 2);
    await w.offersService.runDispatchRound(ORDER, 3);
    expect(w.dedicatedOffers()).toHaveLength(0);
    expect(w.state.order.dispatch_exhausted_at).not.toBeNull();
    expect(w.state.noAgentMessages).toBe(1);
  });

  it('a duplicate SFN callback sends no second offer', async () => {
    const w = world();
    w.addAgent('a1', { balance: 50000 });
    w.addAgent('a2', { balance: 50000 });
    await w.offersService.runDispatchRound(ORDER, 1);
    await w.offersService.runDispatchRound(ORDER, 1);
    // Exhaustion check re-fired early: offers still live, nothing new goes out.
    w.state.order.dispatch_round = 2;
    await w.offersService.runDispatchRound(ORDER, 3);
    expect(w.state.mutations.filter((m) => m === 'UpsertDedicatedOffers')).toHaveLength(1);
    expect(w.notifications.sendOrderOfferPush).toHaveBeenCalledTimes(2);
    expect(w.state.order.dispatch_exhausted_at).toBeNull();
    expect(w.schedule.scheduleDispatchRound).toHaveBeenLastCalledWith(ORDER, 3, 120);
  });

  it('flag turned off while dedicated offers are live: today\'s path (exhaustion), no waiting on them', async () => {
    const w = world();
    w.addAgent('a1', { balance: 50000 });
    w.addAgent('a2', { balance: 50000 });
    await w.offersService.runDispatchRound(ORDER, 1);
    w.state.flag = false;
    // Past the config cache (30 s) but well inside the 120 s offer TTL.
    jest.setSystemTime(new Date(NOW.getTime() + 31_000));
    w.state.order.dispatch_round = 2;
    await w.offersService.runDispatchRound(ORDER, 3);
    expect(w.state.order.dispatch_exhausted_at).not.toBeNull();
    expect(w.schedule.scheduleDispatchRound).not.toHaveBeenCalledWith(ORDER, 3, expect.anything());
  });

  it('QA #607 N3: an overlapping fallback never brings a just-declined offer back', async () => {
    const w = world();
    w.addAgent('a1', { balance: 50000 });
    w.addAgent('a2', { balance: 50000 });
    let upserts = 0;
    w.state.afterUpsert = () => {
      // The agent declines between the two overlapping runs' writes.
      if (++upserts === 1) {
        const a1 = w.dedicatedOffers().find((o) => o.agent_id === 'a1');
        if (a1) Object.assign(a1, { status: 'declined', decline_reason: 'too_far' });
      }
    };
    await Promise.all([w.dispatch.fallback(ORDER), w.dispatch.fallback(ORDER)]);
    expect(upserts).toBe(2);
    expect(w.dedicatedOffers().find((o) => o.agent_id === 'a1')).toMatchObject({ status: 'declined', decline_reason: 'too_far' });
  });

  it('QA #607 N3: an expired offer may be offered again', async () => {
    const w = world();
    w.addAgent('a1', { balance: 50000 });
    w.addAgent('a2', { balance: 50000 });
    let upserts = 0;
    w.state.afterUpsert = () => {
      if (++upserts === 1) w.dedicatedOffers().forEach((o) => (o.status = 'expired'));
    };
    await Promise.all([w.dispatch.fallback(ORDER), w.dispatch.fallback(ORDER)]);
    expect(w.dedicatedOffers().map((o) => o.status)).toEqual(['offered', 'offered']);
  });

  it('QA #607 N2: an unstamped claim by a dedicated-offer holder does not mark the offer accepted', async () => {
    const w = world();
    w.addAgent('a1', { balance: 50000 });
    w.addAgent('a2', { balance: 50000 });
    await w.offersService.runDispatchRound(ORDER, 1);
    await w.claimer.claimOrderForAgent({ orderId: ORDER, user: { id: 'u-a1' }, agent: { id: 'a1' }, fundsCheckSource: 'claim' });
    expect(w.dedicatedOffers().map((o) => [o.agent_id, o.status])).toEqual([
      ['a1', 'cancelled'],
      ['a2', 'cancelled'],
    ]);
    await w.flush();
    expect(w.events('dedicated.offer_accepted')).toEqual([]);
  });

  it('QA #607 N2: a stamped dedicated claim marks the offer accepted', async () => {
    const w = world();
    w.addAgent('a1', { balance: 50000 });
    w.addAgent('a2', { balance: 50000 });
    await w.offersService.runDispatchRound(ORDER, 1);
    const assignment = await w.offersService.dedicatedAcceptAssignment(ORDER, 'a1');
    await w.claimer.claimOrderForAgent({ orderId: ORDER, user: { id: 'u-a1' }, agent: { id: 'a1' }, fundsCheckSource: 'offer_accept', assignment });
    expect(w.dedicatedOffers().map((o) => [o.agent_id, o.status])).toEqual([
      ['a1', 'accepted'],
      ['a2', 'cancelled'],
    ]);
    await w.flush();
    expect(w.events('dedicated.offer_accepted')).toEqual([{ orderId: ORDER, agentId: 'a1' }]);
  });

  it('everyone declines: dispatch is marked exhausted exactly once, reasons recorded', async () => {
    const w = world();
    w.addAgent('a1', { balance: 50000 });
    w.addAgent('a2', { balance: 50000 });
    await w.offersService.runDispatchRound(ORDER, 1);
    await w.offersService.declineOffer(ORDER, 'a1', 'too_far');
    await w.offersService.declineOffer(ORDER, 'a2', null);
    await w.offersService.runDispatchRound(ORDER, 2);
    await w.offersService.runDispatchRound(ORDER, 3);
    await w.offersService.runDispatchRound(ORDER, 3);
    expect(w.dedicatedOffers().map((o) => [o.agent_id, o.status, o.decline_reason])).toEqual([
      ['a1', 'declined', 'too_far'],
      ['a2', 'declined', null],
    ]);
    expect(w.state.mutations.filter((m) => m === 'MarkDispatchExhausted').length).toBeGreaterThanOrEqual(1);
    expect(w.state.noAgentMessages).toBe(1);
    expect(w.notifications.sendOrderNoAgentPush).toHaveBeenCalledTimes(1);
    expect(w.state.mutations.filter((m) => m === 'UpsertDedicatedOffers')).toHaveLength(1);
    await w.flush();
    expect(w.events('dedicated.offer_declined')).toEqual([
      { orderId: ORDER, agentId: 'a1', reason: 'too_far' },
      { orderId: ORDER, agentId: 'a2', reason: null },
    ]);
  });

  it('offers left to expire: marked expired at the next check, then exhaustion', async () => {
    const w = world();
    w.addAgent('a1', { balance: 50000 });
    await w.offersService.runDispatchRound(ORDER, 1);
    jest.setSystemTime(new Date(NOW.getTime() + 121_000));
    await w.offersService.runDispatchRound(ORDER, 2);
    await w.offersService.runDispatchRound(ORDER, 3);
    expect(w.dedicatedOffers().map((o) => o.status)).toEqual(['expired']);
    expect(w.state.order.dispatch_exhausted_at).not.toBeNull();
    await w.flush();
    expect(w.events('dedicated.offer_expired')).toEqual([{ orderId: ORDER, agentId: 'a1' }]);
  });

  it('standard offers expired with nobody claiming: the exhaustion check tries dedicated agents first', async () => {
    const w = world();
    w.addAgent('a1', { balance: 50000 });
    w.state.order.dispatch_round = 2;
    await w.offersService.runDispatchRound(ORDER, 3);
    expect(w.dedicatedOffers()).toHaveLength(1);
    expect(w.state.order.dispatch_exhausted_at).toBeNull();
    expect(w.schedule.scheduleDispatchRound).toHaveBeenCalledWith(ORDER, 3, 120);
  });

  it('a standard decline keeps today\'s behaviour (no reason stored, no dedicated event)', async () => {
    const w = world();
    w.state.offers.push({
      order_id: ORDER,
      agent_id: 's1',
      user_id: 'u-s1',
      status: 'offered',
      offer_kind: 'standard',
      decline_reason: null,
      expires_at: new Date(NOW.getTime() + 30_000).toISOString(),
    });
    await w.offersService.declineOffer(ORDER, 's1', 'busy');
    expect(w.state.offers[0]).toMatchObject({ status: 'declined', decline_reason: null });
    await w.flush();
    expect(w.events('dedicated.offer_declined')).toHaveLength(0);
  });

  describe('accepting a dedicated offer re-checks eligibility', () => {
    it('refuses an agent who no longer qualifies (at capacity) with 409 DEDICATED_OFFER_INELIGIBLE', async () => {
      const w = world();
      w.addAgent('a1', { balance: 50000 });
      w.addAgent('a2', { balance: 50000 });
      await w.offersService.runDispatchRound(ORDER, 1);
      for (let i = 0; i < 10; i++) w.state.activeOrders.push({ id: `o-${i}`, assigned_agent_id: 'a1', current_status: 'in_transit' });
      await expect(w.offersService.dedicatedAcceptAssignment(ORDER, 'a1')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: expect.objectContaining({ error: 'DEDICATED_OFFER_INELIGIBLE', reason: 'at_capacity' }),
      });
    });

    it('flag turned off while offers were live: the accept is still re-checked and refused, no claim', async () => {
      const w = world();
      w.addAgent('a1', { balance: 50000 });
      w.addAgent('a2', { balance: 50000 });
      await w.offersService.runDispatchRound(ORDER, 1);
      w.state.flag = false;
      // Past the 30 s config cache, inside the 120 s offer TTL.
      jest.setSystemTime(new Date(NOW.getTime() + 31_000));
      await expect(w.accept('a1')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: expect.objectContaining({ error: 'DEDICATED_OFFER_INELIGIBLE', reason: 'dedicated_disabled' }),
      });
      expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
      expect(w.state.order.assigned_agent_id).toBeNull();
    });

    it('flag off: the 409 carries code DEDICATED_DISABLED and a message in the agent\'s saved language', async () => {
      const w = world();
      w.addAgent('a1', { balance: 50000, locale: 'en' });
      w.addAgent('a2', { balance: 50000, locale: 'fr-CM' });
      w.addAgent('a3', { balance: 50000, locale: null });
      await w.offersService.runDispatchRound(ORDER, 1);
      w.state.flag = false;
      jest.setSystemTime(new Date(NOW.getTime() + 31_000));
      const refusal = async (agent: string) => {
        const err = await w.accept(agent).catch((e: unknown) => e);
        return (err as { getStatus: () => number; getResponse: () => unknown });
      };
      const en = await refusal('a1');
      expect(en.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(en.getResponse()).toEqual({
        error: 'DEDICATED_OFFER_INELIGIBLE',
        code: 'DEDICATED_DISABLED',
        reason: 'dedicated_disabled',
        message: 'Dedicated deliveries are turned off for now. This order goes back to the usual dispatch.',
      });
      const frMsg =
        "Les livraisons dédiées sont désactivées pour le moment. Cette commande repasse par l'attribution habituelle.";
      expect((await refusal('a2')).getResponse()).toMatchObject({ code: 'DEDICATED_DISABLED', message: frMsg });
      // No saved language: the default language (French).
      expect((await refusal('a3')).getResponse()).toMatchObject({ code: 'DEDICATED_DISABLED', message: frMsg });
    });

    it('other refusals keep code DEDICATED_OFFER_INELIGIBLE, also localized', async () => {
      const w = world();
      w.addAgent('a1', { balance: 50000, locale: 'fr' });
      w.addAgent('a2', { balance: 50000 });
      await w.offersService.runDispatchRound(ORDER, 1);
      for (let i = 0; i < 10; i++) w.state.activeOrders.push({ id: `o-${i}`, assigned_agent_id: 'a1', current_status: 'in_transit' });
      await expect(w.offersService.dedicatedAcceptAssignment(ORDER, 'a1')).rejects.toMatchObject({
        response: {
          error: 'DEDICATED_OFFER_INELIGIBLE',
          code: 'DEDICATED_OFFER_INELIGIBLE',
          reason: 'at_capacity',
          message: 'Vous ne pouvez plus prendre cette livraison dédiée.',
        },
      });
    });

    it('flag off with dedicated offers live: the order goes back to today\'s dispatch (standard offers, then exhaustion, no dedicated step)', async () => {
      const w = world();
      w.addAgent('a1', { balance: 50000 });
      await w.offersService.runDispatchRound(ORDER, 1);
      expect(w.dedicatedOffers()).toHaveLength(1);
      w.state.flag = false;
      jest.setSystemTime(new Date(NOW.getTime() + 31_000));
      await expect(w.accept('a1')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'DEDICATED_DISABLED' }) });
      // Round 2 (scheduled as today): a nearby agent gets a standard offer.
      w.nearby.push({ agentId: 'near', userId: 'u-near', distanceKm: 1 });
      w.state.order.dispatch_round = 1;
      await w.offersService.runDispatchRound(ORDER, 2);
      expect(w.state.offers.filter((o) => o.offer_kind === 'standard').map((o) => o.agent_id)).toEqual(['near']);
      expect(w.notifications.sendOrderOfferPush).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-near' }));
      // Nobody claims: the exhaustion check marks it exhausted as today, without a dedicated retry.
      jest.setSystemTime(new Date(NOW.getTime() + 600_000));
      const before = w.dedicatedOffers().length;
      w.state.order.dispatch_round = 2;
      await w.offersService.runDispatchRound(ORDER, 3);
      expect(w.state.order.dispatch_exhausted_at).not.toBeNull();
      expect(w.dedicatedOffers()).toHaveLength(before);
      expect(w.state.order.assigned_agent_id).toBeNull();
      expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
    });

    it('leaves a dropped balance to the claim (its hold error), stamping the assignment', async () => {
      const w = world();
      w.addAgent('a1', { balance: 50000 });
      await w.offersService.runDispatchRound(ORDER, 1);
      w.state.accounts[0].available_balance = 10;
      await expect(w.offersService.dedicatedAcceptAssignment(ORDER, 'a1')).resolves.toEqual({
        source: 'dedicated_offer',
        dedicatedAssignmentId: 'as-a1',
        maxActiveOrders: 10,
        countOffers: false,
      });
    });

    it('QA #607 N4: the agent\'s other live dedicated offers do not block this accept', async () => {
      const w = world();
      w.addAgent('a1', { balance: 50000 });
      await w.offersService.runDispatchRound(ORDER, 1);
      for (let i = 0; i < 8; i++) w.state.activeOrders.push({ id: `o-${i}`, assigned_agent_id: 'a1', current_status: 'in_transit' });
      // 8 active + 2 live offers on other orders: 10 by the offer-time rule, still acceptable.
      for (const other of ['other-1', 'other-2']) {
        w.state.offers.push({ ...w.dedicatedOffers()[0], order_id: other });
      }
      await expect(w.offersService.dedicatedAcceptAssignment(ORDER, 'a1')).resolves.toMatchObject({ dedicatedAssignmentId: 'as-a1' });
      // At the cap on active orders alone: refused.
      w.state.activeOrders.push({ id: 'o-9', assigned_agent_id: 'a1', current_status: 'in_transit' }, { id: 'o-10', assigned_agent_id: 'a1', current_status: 'in_transit' });
      await expect(w.offersService.dedicatedAcceptAssignment(ORDER, 'a1')).rejects.toBeInstanceOf(HttpException);
    });

    it('does not count the order\'s own offer against the agent', async () => {
      const w = world();
      w.addAgent('a1', { balance: 50000 });
      await w.offersService.runDispatchRound(ORDER, 1);
      // 9 active + this order's own live offer = 10, but the offer is excluded.
      for (let i = 0; i < 9; i++) w.state.activeOrders.push({ id: `o-${i}`, assigned_agent_id: 'a1', current_status: 'in_transit' });
      await expect(w.offersService.dedicatedAcceptAssignment(ORDER, 'a1')).resolves.toEqual({
        source: 'dedicated_offer',
        dedicatedAssignmentId: 'as-a1',
        maxActiveOrders: 10,
        countOffers: false,
      });
    });
  });

  describe('#594 PR 6 (AC-A6b) releasing an automatic assignment', () => {
    const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);
    /** Auto-assign 'int' at NOW (release window 120 s), then move the clock. */
    const autoAssigned = async (extra?: (w: ReturnType<typeof world>) => void) => {
      const w = world();
      w.addAgent('int', { internal: true });
      extra?.(w);
      await w.offersService.runDispatchRound(ORDER, 1);
      expect(w.state.order).toMatchObject({ assigned_agent_id: 'int', assignment_source: 'dedicated_auto' });
      w.schedule.scheduleDispatchRound.mockClear();
      w.claimer.claimOrderForAgent.mockClear();
      return w;
    };
    const strikeLike = (w: ReturnType<typeof world>) =>
      w.state.mutations.filter((m) => /Strike|BumpReassigned|SetPickupRel|BumpIssue|SystemDrop/.test(m));

    it('at 119 s: released with no strike, stored as a declined dedicated row, dispatch restarted without the agent', async () => {
      const w = await autoAssigned((x) => x.state.holds.push({ id: 'hold-1', agent_hold_amount: 0, status: 'active' }));
      jest.setSystemTime(at(119));
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', 'busy')).resolves.toEqual({
        success: true,
        message: 'Order released; dispatch restarted without you',
      });
      expect(w.state.order).toMatchObject({
        current_status: 'ready_for_pickup',
        assigned_agent_id: null,
        assignment_source: null,
        dedicated_release_until: null,
        reassignment_count: 0,
      });
      expect(w.dedicatedOffers()).toEqual([
        expect.objectContaining({ agent_id: 'int', user_id: 'u-int', status: 'declined', decline_reason: 'busy' }),
      ]);
      expect(w.state.holds[0].status).toBe('cancelled');
      expect(strikeLike(w)).toEqual([]);
      // Redispatch ran round 1: nobody nearby, and the only dedicated agent is excluded.
      expect(w.state.order.dispatch_round).toBe(1);
      expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
      expect(w.schedule.scheduleDispatchRound).toHaveBeenCalledWith(ORDER, 2, 30);
      expect(w.orderEvents.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: ORDER,
          eventType: 'reassignment_started',
          actorType: 'agent',
          actorId: 'int',
          payload: { reason: 'dedicated_auto_release', declineReason: 'busy' },
        })
      );
      expect(w.state.mutations).toContain('DedicatedReleaseHistory');
      await w.flush();
      expect(w.events('dedicated.auto_assign_released')).toEqual([
        { orderId: ORDER, agentId: 'int', assignmentId: 'as-int', reason: 'busy', secondsLeft: 1 },
      ]);
    });

    describe('structured release log (PE: no reliability signal, measurable later)', () => {
      const lines = (spies: jest.SpyInstance[]) =>
        spies
          .flatMap((s) => s.mock.calls.map((c) => c[0]))
          .filter((m): m is string => typeof m === 'string' && m.startsWith('{'))
          .map((m) => JSON.parse(m) as Record<string, unknown>)
          .filter((l) => l.event === 'dedicated.auto_assign_release');
      let spies: jest.SpyInstance[];
      beforeEach(() => {
        spies = [
          jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
          jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
        ];
      });
      afterEach(() => spies.forEach((s) => s.mockRestore()));

      it('a release logs one JSON line with the outcome, ids, reason and seconds left', async () => {
        const w = await autoAssigned();
        jest.setSystemTime(at(100));
        await w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', 'too_far');
        expect(lines(spies)).toEqual([
          {
            event: 'dedicated.auto_assign_release',
          flagOn: true,
            outcome: 'released',
            orderId: ORDER,
            agentId: 'int',
            reason: 'too_far',
            country: 'CM',
            secondsLeft: 20,
            orderNumber: w.state.order.order_number,
            assignmentId: 'as-int',
            assignmentSource: 'dedicated_auto',
            releaseUntil: at(120).toISOString(),
            at: at(100).toISOString(),
          },
        ]);
      });

      it('refusals and failures are logged too, with the refusal and its cause', async () => {
        const w = await autoAssigned();
        jest.setSystemTime(at(120));
        await w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null);
        await w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'someone-else', null);
        jest.setSystemTime(at(10));
        w.state.releaseRowFails = true;
        await w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null);
        expect(lines(spies).map((l) => [l.outcome, l.refusal, l.cause, l.agentId])).toEqual([
          ['refused', 'window_closed', 'expired', 'int'],
          ['refused', 'not_assigned', undefined, 'someone-else'],
          ['failed', 'release_failed', 'exclusion_write_failed', 'int'],
        ]);
        // A failure is a warning, a refusal is not.
        const warned = spies[1].mock.calls.map((c) => String(c[0])).filter((m) => m.includes('"outcome":"failed"'));
        expect(warned).toHaveLength(1);
      });

      it('QA #608 N3: flag off is logged as a release with flagOn=false', async () => {
        const w = await autoAssigned();
        w.state.flag = false;
        jest.setSystemTime(at(31));
        await w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null);
        expect(lines(spies)).toEqual([expect.objectContaining({ outcome: 'released', flagOn: false })]);
      });
    });

    it.each([120, 121])('at %i s the stored window has closed: 409-style refusal, order untouched', async (sec) => {
      const w = await autoAssigned();
      jest.setSystemTime(at(sec));
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null)).resolves.toMatchObject({
        success: false,
        refusal: 'window_closed',
      });
      expect(w.state.order).toMatchObject({ assigned_agent_id: 'int', assignment_source: 'dedicated_auto' });
      expect(w.state.mutations).not.toContain('ReleaseDedicatedAutoAssignment');
      expect(w.dedicatedOffers()).toHaveLength(0);
    });

    it('the database enforces the stored window too: the unassign is a CAS on dedicated_release_until > now', async () => {
      const w = await autoAssigned();
      jest.setSystemTime(at(60));
      const reads = w.reassignment as unknown as { fetchDedicatedReleaseOrder: (id: string) => Promise<unknown> };
      // The read saw an open window, but the stored time moved before the write (e.g. a concurrent claim).
      const real = reads.fetchDedicatedReleaseOrder.bind(w.reassignment);
      jest.spyOn(reads, 'fetchDedicatedReleaseOrder').mockImplementationOnce(async (id: string) => {
        const row = await real(id);
        w.state.order.dedicated_release_until = at(30).toISOString();
        return row;
      });
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null)).resolves.toMatchObject({
        success: false,
        refusal: 'window_closed',
      });
      const cas = w.executeMutation.mock.calls.find(([q]) => String(q).includes('mutation ReleaseDedicatedAutoAssignment'));
      expect(String(cas?.[0])).toContain('{ dedicated_release_until: { _gt: $now } }');
      expect(String(cas?.[0])).toContain('{ assignment_source: { _eq: "dedicated_auto" } }');
      expect(cas?.[1]).toEqual({ id: ORDER, agentId: 'int', now: at(60).toISOString() });
      expect(w.state.order.assigned_agent_id).toBe('int');
      expect(w.dedicatedOffers()).toHaveLength(0);
    });

    it('a released agent is skipped by the next dedicated fallback: the other internal agent is auto-assigned', async () => {
      const w = await autoAssigned((x) => {
        x.addAgent('int2', { internal: true });
        // int2 is busy at the first dispatch, so 'int' is the only eligible agent.
        for (let i = 0; i < 10; i++) x.state.activeOrders.push({ id: `o-${i}`, assigned_agent_id: 'int2', current_status: 'in_transit' });
      });
      w.state.activeOrders = [];
      jest.setSystemTime(at(30));
      await w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null);
      expect(w.claimer.claimOrderForAgent).toHaveBeenCalledTimes(1);
      expect(w.state.order).toMatchObject({ assigned_agent_id: 'int2', assignment_source: 'dedicated_auto' });
      expect(w.state.order.dedicated_release_until).toBe(at(150).toISOString());
    });

    it('a released agent gets no standard offer either, while a nearby agent does', async () => {
      const w = await autoAssigned();
      w.nearby.push({ agentId: 'int', userId: 'u-int', distanceKm: 0.5 }, { agentId: 'near', userId: 'u-near', distanceKm: 1 });
      jest.setSystemTime(at(10));
      await w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null);
      expect(w.state.offers.filter((o) => o.offer_kind === 'standard').map((o) => o.agent_id)).toEqual(['near']);
      expect(w.notifications.sendOrderOfferPush).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-near' }));
      expect(w.notifications.sendOrderOfferPush).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-int' }));
    });

    it('an order not placed on dedicated coverage keeps today\'s standard rounds (no exclusion lookup)', async () => {
      const w = world();
      w.state.order.coverage_slot_key = null;
      w.nearby.push({ agentId: 'near', userId: 'u-near', distanceKm: 1 });
      await w.offersService.runDispatchRound(ORDER, 1);
      expect(w.queries()).not.toContain('DedicatedDeclinedAgents');
      expect(w.state.offers.map((o) => o.agent_id)).toEqual(['near']);
    });

    it('an agent who declined the dedicated offer is not offered the order again in a standard round', async () => {
      const w = world();
      w.addAgent('a1', { balance: 50000 });
      w.addAgent('a2', { balance: 50000 });
      await w.offersService.runDispatchRound(ORDER, 1);
      await w.offersService.declineOffer(ORDER, 'a1', 'too_far');
      w.nearby.push({ agentId: 'a1', userId: 'u-a1', distanceKm: 2 });
      w.state.order.dispatch_round = 1;
      await w.offersService.runDispatchRound(ORDER, 2);
      expect(w.state.offers.find((o) => o.agent_id === 'a1')).toMatchObject({ status: 'declined', offer_kind: 'dedicated' });
    });

    it.each([
      ['an expired dedicated offer', 'expired', 'dedicated'],
      ['a declined standard offer (today\'s rounds re-offer it)', 'declined', 'standard'],
    ])('only declined dedicated rows exclude: %s does not', async (_label, status, kind) => {
      const w = world();
      w.state.offers.push({
        order_id: ORDER,
        agent_id: 'near',
        user_id: 'u-near',
        status,
        offer_kind: kind,
        decline_reason: null,
        expires_at: NOW.toISOString(),
      });
      w.nearby.push({ agentId: 'near', userId: 'u-near', distanceKm: 1 });
      w.state.order.dispatch_round = 1;
      await w.offersService.runDispatchRound(ORDER, 2);
      expect(w.queries()).toContain('DedicatedDeclinedAgents');
      expect(w.state.offers.find((o) => o.agent_id === 'near')).toMatchObject({ status: 'offered', offer_kind: 'standard' });
      expect(w.notifications.sendOrderOfferPush).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-near' }));
    });

    it('a declined row alone does not count as an earlier fallback: the rest of the slot is still offered', async () => {
      const w = world();
      w.addAgent('a1', { balance: 50000 });
      w.addAgent('a2', { balance: 50000 });
      w.state.offers.push({
        order_id: ORDER,
        agent_id: 'a1',
        user_id: 'u-a1',
        status: 'declined',
        offer_kind: 'dedicated',
        decline_reason: null,
        expires_at: NOW.toISOString(),
      });
      await w.offersService.runDispatchRound(ORDER, 1);
      expect(w.dedicatedOffers().map((o) => [o.agent_id, o.status])).toEqual([
        ['a1', 'declined'],
        ['a2', 'offered'],
      ]);
    });

    it('refuses a dedicated_offer claim, another agent, and a picked-up order', async () => {
      const w = await autoAssigned();
      jest.setSystemTime(at(10));
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'other', null)).resolves.toMatchObject({
        refusal: 'not_assigned',
      });
      w.state.order.current_status = 'picked_up';
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null)).resolves.toMatchObject({
        refusal: 'not_assigned',
      });
      w.state.order.current_status = 'assigned_to_agent';
      w.state.order.assignment_source = 'dedicated_offer';
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null)).resolves.toMatchObject({
        refusal: 'not_auto_assigned',
      });
      expect(w.state.mutations).not.toContain('ReleaseDedicatedAutoAssignment');
    });

    it('QA #608 N3: flag off (kill switch) still honours the open release window', async () => {
      const w = await autoAssigned();
      w.state.flag = false;
      // Past the 30 s config cache, inside the release window.
      jest.setSystemTime(at(31));
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null)).resolves.toMatchObject({ success: true });
      expect(w.state.order.assigned_agent_id).toBeNull();
      expect(w.dedicatedOffers().find((o) => o.agent_id === 'int')).toMatchObject({ status: 'declined' });
      // ... but the kill switch still blocks a new dedicated assignment.
      expect(w.claimer.claimOrderForAgent).not.toHaveBeenCalled();
    });

    it('QA #608 N1: the exclusion row cannot be written: nothing is released (it is written before the unassign)', async () => {
      const w = await autoAssigned();
      w.state.releaseRowFails = true;
      jest.setSystemTime(at(10));
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null)).resolves.toMatchObject({
        refusal: 'release_failed',
      });
      expect(w.state.mutations).not.toContain('ReleaseDedicatedAutoAssignment');
      expect(w.state.mutations).not.toContain('RevertDedicatedRelease');
      expect(w.state.order).toMatchObject({
        assigned_agent_id: 'int',
        current_status: 'assigned_to_agent',
        assignment_source: 'dedicated_auto',
        dedicated_assignment_id: 'as-int',
        dedicated_release_until: at(120).toISOString(),
      });
      expect(w.schedule.scheduleDispatchRound).not.toHaveBeenCalled();
    });

    it('QA #608 N1: the exclusion row is in place before the order is unassigned', async () => {
      const w = await autoAssigned();
      jest.setSystemTime(at(10));
      await w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null);
      const m = w.state.mutations;
      expect(m.indexOf('RecordDedicatedRelease')).toBeGreaterThanOrEqual(0);
      expect(m.indexOf('RecordDedicatedRelease')).toBeLessThan(m.indexOf('ReleaseDedicatedAutoAssignment'));
    });

    it('QA #608 N1: a lost CAS (window closed) removes this attempt\'s exclusion row', async () => {
      const w = await autoAssigned();
      jest.setSystemTime(at(10));
      w.state.order.dedicated_release_until = at(5).toISOString();
      const real = w.state.order;
      void real;
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null)).resolves.toMatchObject({ refusal: 'window_closed' });
      expect(w.dedicatedOffers().filter((o) => o.agent_id === 'int')).toEqual([]);
      expect(w.state.order.assigned_agent_id).toBe('int');
    });

    it('QA #608 N1: hold release fails -> the agent is put back with pickup timers restored and no exclusion left', async () => {
      const w = await autoAssigned((x) => x.state.holds.push({ id: 'hold-1', agent_hold_amount: 500, status: 'active' }));
      Object.assign(w.state.order, { pickup_due_at: at(900).toISOString(), pickup_state: 'en_route' });
      w.accounts.registerReleaseIfNotExists.mockResolvedValueOnce({ success: false, error: 'ledger down' });
      jest.setSystemTime(at(10));
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null)).resolves.toMatchObject({ refusal: 'release_failed' });
      expect(w.state.order).toMatchObject({
        assigned_agent_id: 'int',
        assignment_source: 'dedicated_auto',
        pickup_due_at: at(900).toISOString(),
        pickup_state: 'en_route',
      });
      expect(w.dedicatedOffers().filter((o) => o.agent_id === 'int')).toEqual([]);
    });

    it('QA #608 N1: hold release fails after another agent claimed it -> release_lost, logged, not reported as kept', async () => {
      const w = await autoAssigned((x) => x.state.holds.push({ id: 'hold-1', agent_hold_amount: 500, status: 'active' }));
      w.accounts.registerReleaseIfNotExists.mockResolvedValueOnce({ success: false, error: 'ledger down' });
      w.state.claimAfterRelease = 'thief';
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      jest.setSystemTime(at(10));
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null)).resolves.toMatchObject({ refusal: 'release_lost' });
      expect(w.state.order.assigned_agent_id).toBe('thief');
      expect(errors.mock.calls.some((c) => String(c[0]).includes('"event":"dedicated.release_revert_failed"'))).toBe(true);
      // #608 follow-up: the stranded hold raises one money-anomaly alert and is queued for the reconciler.
      expect(errors.mock.calls.filter((c) => String(c[0]).startsWith('agent_hold_stranded '))).toHaveLength(1);
      expect(w.orderEvents.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'agent_hold_stranded',
          payload: expect.objectContaining({ agentId: 'int', amount: 500, path: 'dedicated_release', holdId: 'hold-1' }),
        })
      );
      errors.mockRestore();
    });

    it('#608 follow-up: a failed release that IS reverted strands nothing (no alert, no event)', async () => {
      const w = await autoAssigned((x) => x.state.holds.push({ id: 'hold-1', agent_hold_amount: 500, status: 'active' }));
      w.accounts.registerReleaseIfNotExists.mockResolvedValueOnce({ success: false, error: 'ledger down' });
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      jest.setSystemTime(at(10));
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null)).resolves.toMatchObject({ refusal: 'release_failed' });
      expect(errors.mock.calls.some((c) => String(c[0]).startsWith('agent_hold_stranded'))).toBe(false);
      expect(w.orderEvents.recordEvent).not.toHaveBeenCalledWith(expect.objectContaining({ eventType: 'agent_hold_stranded' }));
      errors.mockRestore();
    });

    it('the hold cannot be released: the release is undone and dispatch does not restart', async () => {
      const w = await autoAssigned((x) => x.state.holds.push({ id: 'hold-1', agent_hold_amount: 500, status: 'active' }));
      w.accounts.registerReleaseIfNotExists.mockResolvedValueOnce({ success: false, error: 'ledger down' });
      jest.setSystemTime(at(10));
      await expect(w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null)).resolves.toMatchObject({
        refusal: 'release_failed',
      });
      expect(w.state.order).toMatchObject({ assigned_agent_id: 'int', assignment_source: 'dedicated_auto' });
      expect(w.state.holds[0].status).toBe('active');
      expect(w.schedule.scheduleDispatchRound).not.toHaveBeenCalled();
    });

    it('a positive hold is credited back to the agent once', async () => {
      const w = await autoAssigned((x) => x.state.holds.push({ id: 'hold-1', agent_hold_amount: 500, status: 'active' }));
      jest.setSystemTime(at(10));
      await w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null);
      expect(w.accounts.registerReleaseIfNotExists).toHaveBeenCalledTimes(1);
      expect(w.accounts.registerReleaseIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'acct-u-int', amount: 500, referenceId: ORDER })
      );
    });

    it('the unassign write retries a 40P01 deadlock abort', async () => {
      const w = await autoAssigned();
      w.state.releaseCasDeadlocks = 1;
      jest.setSystemTime(at(10));
      const pending = w.reassignment.releaseDedicatedAutoAssignment(ORDER, 'int', null);
      await jest.advanceTimersByTimeAsync(200);
      await expect(pending).resolves.toMatchObject({ success: true });
      expect(w.state.mutations.filter((m) => m === 'ReleaseDedicatedAutoAssignment')).toHaveLength(2);
    });
  });
});
