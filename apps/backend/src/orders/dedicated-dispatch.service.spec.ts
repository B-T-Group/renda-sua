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
import { OrderOffersService } from './order-offers.service';
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
      case 'DedicatedOfferLocales':
        if (state.localeLookupFails) throw new Error('hasura down');
        return {
          users: [...state.agents.values()]
            .filter((a) => vars.userIds?.includes(a.user_id))
            .map((a) => ({ id: a.user_id, preferred_language: a.preferred_language })),
        };
      case 'PushTokens':
        return { mobile_push_tokens: ((vars.userIds as string[]) ?? []).map((u) => ({ user_id: u })) };
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
          state.offers = state.offers.filter((o) => !(o.order_id === obj.order_id && o.agent_id === obj.agent_id));
          state.offers.push({ ...obj });
        }
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
        const rows = forAgent(vars, () => true);
        rows.forEach((o) => (o.status = 'accepted'));
        return { update_order_offers: { affected_rows: rows.length, returning: rows.map((o) => ({ offer_kind: o.offer_kind })) } };
      }
      case 'CancelSiblingOffers': {
        const rows = state.offers.filter((o) => o.order_id === vars.orderId && o.agent_id !== vars.agentId && o.status === 'offered');
        rows.forEach((o) => (o.status = 'cancelled'));
        return { update_order_offers: { returning: rows.map((o) => ({ user_id: o.user_id })) } };
      }
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

  const hasura = { executeQuery, executeMutation } as unknown as HasuraSystemService;
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
      });
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
      });
    });
  });
});
