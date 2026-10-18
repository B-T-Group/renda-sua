import { readFileSync } from 'fs';
import { join } from 'path';
import type { AgentContractGateService } from '../agent-contracts/agent-contract-gate.service';
import type { AgentHoldService } from '../agents/agent-hold.service';
import type { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import {
  DEDICATED_ACTIVE_ORDER_STATUSES,
  DedicatedCoverageService,
  type DedicatedEligibilityParams,
} from './dedicated-coverage.service';

const LOCATION = 'loc-1';
const NOW = new Date('2026-10-18T09:00:00Z'); // 10:00 in Douala

interface FakeAgent {
  id: string;
  user_id: string;
  is_verified?: boolean;
  is_internal?: boolean;
  status?: string;
  focus?: string;
  is_available?: boolean;
}

/**
 * In-memory Hasura for the PR 2 queries. It applies each query's own filters
 * (status, slot, offer kind / expiry, active statuses, currency) to the rows
 * so the service is tested against data, not against canned answers.
 */
function world() {
  const state = {
    flag: true,
    maxActiveOrders: 10 as number | null,
    country: 'CM',
    timezone: 'Africa/Douala',
    pickupSlots: [] as Array<{ slot_key: string; is_enabled: boolean }>,
    deliverySlots: [
      { id: 'cm-m', state: 'Littoral', slot_name: 'Morning', slot_type: 'standard', start_time: '08:00:00', end_time: '12:00:00' },
      { id: 'cm-a', state: 'Littoral', slot_name: 'Afternoon', slot_type: 'standard', start_time: '12:00:00', end_time: '16:00:00' },
      { id: 'cm-e', state: 'Littoral', slot_name: 'Evening', slot_type: 'standard', start_time: '16:00:00', end_time: '20:00:00' },
      { id: 'df-a', state: '__DEFAULT__', slot_name: 'Afternoon', slot_type: 'standard', start_time: '13:00:00', end_time: '17:00:00' },
    ],
    locationState: 'Littoral',
    assignments: [] as Array<{ id: string; agent_id: string; slot_key: string; status: string; off_today_date: string | null; location: string }>,
    agents: new Map<string, FakeAgent>(),
    orders: [] as Array<{ id: string; assigned_agent_id: string; current_status: string }>,
    offers: [] as Array<{ order_id: string; agent_id: string; offer_kind: string; status: string; expires_at: string }>,
    accounts: [] as Array<{ user_id: string; currency: string; available_balance: number; business_location_id: string | null; is_active: boolean }>,
    unsigned: new Set<string>(),
    queries: [] as string[],
  };

  interface QueryVars {
    locationId: string;
    states: string[];
    slotKey: string;
    agentIds: string[];
    activeStatuses: string[];
    now: string;
    userIds: string[];
    currency: string;
  }
  const executeQuery = jest.fn(async (query: string, vars: QueryVars) => {
    const op = /query (\w+)/.exec(query)?.[1] ?? '?';
    state.queries.push(query);
    switch (op) {
      case 'DedicatedLocationContext':
        return {
          business_locations_by_pk:
            vars.locationId === LOCATION
              ? { id: LOCATION, address: { country: state.country.toLowerCase(), state: state.locationState }, pickup_slots: state.pickupSlots }
              : null,
        };
      case 'DedicatedDeliverySlots':
        return { delivery_time_slots: state.deliverySlots.filter((s) => vars.states.includes(s.state)) };
      case 'DedicatedSlotAssignments':
        return {
          dedicated_agent_assignments: state.assignments
            .filter((a) => a.location === vars.locationId && a.slot_key === vars.slotKey && a.status === 'active')
            .map((a) => ({ ...a, agent: state.agents.get(a.agent_id) ?? null })),
        };
      case 'DedicatedAgentLoad':
        return {
          orders: state.orders.filter((o) => vars.agentIds.includes(o.assigned_agent_id) && vars.activeStatuses.includes(o.current_status)),
          order_offers: state.offers.filter(
            (o) =>
              vars.agentIds.includes(o.agent_id) &&
              o.offer_kind === 'dedicated' &&
              o.status === 'offered' &&
              Date.parse(o.expires_at) > Date.parse(vars.now)
          ),
        };
      case 'DedicatedAgentBalances':
        return {
          accounts: state.accounts.filter(
            (a) => vars.userIds.includes(a.user_id) && a.currency === vars.currency && a.business_location_id === null && a.is_active
          ),
        };
      case 'DedicatedAgentsConfig':
        return {
          application_configurations: [
            { config_key: 'dedicated_agents_enabled', boolean_value: state.flag, country_code: null },
            ...(state.maxActiveOrders != null
              ? [{ config_key: 'dedicated_max_active_orders', number_value: state.maxActiveOrders, country_code: null }]
              : []),
          ],
        };
      default:
        throw new Error(`unexpected query ${op}`);
    }
  });

  const hasura = { executeQuery } as unknown as HasuraSystemService;
  const holds = new Map<string, number>();
  const agentHoldService = {
    resolveOrderHoldWithCeiling: jest.fn(async (subtotal: number, agentId: string, rail: string) => ({
      holdAmount: rail === 'stripe' ? 0 : holds.get(agentId) ?? Math.round(subtotal * 0.8),
    })),
  };
  const gate = {
    signedIdsOrSkip: jest.fn(async (ids: string[]) => new Set(ids.filter((id) => !state.unsigned.has(id)))),
  };
  const deliveryConfig = { getTimezone: jest.fn(async () => state.timezone) };
  const service = new DedicatedCoverageService(
    hasura,
    new DedicatedAgentsConfigService(hasura),
    agentHoldService as unknown as AgentHoldService,
    gate as unknown as AgentContractGateService,
    deliveryConfig as unknown as DeliveryConfigService
  );

  const addAgent = (
    id: string,
    over: Partial<FakeAgent> & { slot?: string; balance?: number; offToday?: string | null; assignmentStatus?: string } = {}
  ) => {
    state.agents.set(id, { id, user_id: `u-${id}`, is_verified: true, is_internal: false, status: 'active', focus: 'delivery', ...over });
    state.assignments.push({
      id: `as-${id}-${over.slot ?? 'afternoon'}`,
      agent_id: id,
      slot_key: over.slot ?? 'afternoon',
      status: over.assignmentStatus ?? 'active',
      off_today_date: over.offToday ?? null,
      location: LOCATION,
    });
    if (over.balance != null) {
      state.accounts.push({ user_id: `u-${id}`, currency: 'XAF', available_balance: over.balance, business_location_id: null, is_active: true });
    }
  };
  const giveActiveOrders = (agentId: string, n: number, status = 'in_transit') => {
    for (let i = 0; i < n; i++) state.orders.push({ id: `o-${agentId}-${status}-${i}`, assigned_agent_id: agentId, current_status: status });
  };
  const giveOffer = (agentId: string, over: Partial<{ order_id: string; offer_kind: string; status: string; expires_at: string }> = {}) => {
    state.offers.push({
      order_id: `oo-${agentId}-${state.offers.length}`,
      agent_id: agentId,
      offer_kind: 'dedicated',
      status: 'offered',
      expires_at: new Date(NOW.getTime() + 60_000).toISOString(),
      ...over,
    });
  };
  return { state, service, holds, agentHoldService, gate, addAgent, giveActiveOrders, giveOffer };
}

const params = (over: Partial<DedicatedEligibilityParams> = {}): DedicatedEligibilityParams => ({
  locationId: LOCATION,
  slotKey: 'afternoon',
  fulfillmentTiming: 'scheduled',
  hasDeliveryWindow: true,
  rail: 'mobile_money',
  subtotal: 5000,
  currency: 'XAF',
  verifiedAgentDelivery: false,
  now: NOW,
  ...over,
});
const ids = (agents: Array<{ agentId: string }>) => agents.map((a) => a.agentId).sort();

describe('DedicatedCoverageService.eligibleAgents', () => {
  it('flag off -> [] without loading assignments', async () => {
    const w = world();
    w.state.flag = false;
    w.addAgent('int', { is_internal: true });
    await expect(w.service.eligibleAgents(params())).resolves.toEqual([]);
    expect(w.state.queries.some((q) => q.includes('DedicatedSlotAssignments'))).toBe(false);
  });

  it('ASAP order, or scheduled without a window -> []', async () => {
    const w = world();
    w.addAgent('int', { is_internal: true });
    await expect(w.service.eligibleAgents(params({ fulfillmentTiming: 'asap' }))).resolves.toEqual([]);
    await expect(w.service.eligibleAgents(params({ hasDeliveryWindow: false }))).resolves.toEqual([]);
    expect(ids(await w.service.eligibleAgents(params()))).toEqual(['int']);
  });

  it('only agents assigned to this slot and active', async () => {
    const w = world();
    w.addAgent('aft', { is_internal: true });
    w.addAgent('mor', { is_internal: true, slot: 'morning' });
    w.addAgent('paused', { is_internal: true, assignmentStatus: 'paused' });
    expect(ids(await w.service.eligibleAgents(params()))).toEqual(['aft']);
  });

  it('a slot the business turned off covers nothing', async () => {
    const w = world();
    w.addAgent('int', { is_internal: true });
    w.state.pickupSlots = [{ slot_key: 'afternoon', is_enabled: false }];
    await expect(w.service.eligibleAgents(params())).resolves.toEqual([]);
    w.state.pickupSlots = [{ slot_key: 'morning', is_enabled: false }];
    expect(ids(await w.service.eligibleAgents(params()))).toEqual(['int']);
  });

  it('9 active + 1 outstanding dedicated offer -> ineligible; 9 + 0 -> eligible', async () => {
    const w = world();
    w.addAgent('full', { is_internal: true });
    w.addAgent('nine', { is_internal: true });
    w.giveActiveOrders('full', 9);
    w.giveOffer('full');
    w.giveActiveOrders('nine', 9);
    const res = await w.service.evaluate(params());
    expect(ids(res.eligible)).toEqual(['nine']);
    expect(res.rejected).toEqual([{ agentId: 'full', assignmentId: 'as-full-afternoon', reason: 'at_capacity' }]);
    expect(res.eligible[0]).toMatchObject({ activeOrders: 9, outstandingDedicatedOffers: 0 });
  });

  it('active orders count every active status on every rail and source; finished ones do not', async () => {
    const w = world();
    w.addAgent('a', { is_internal: true });
    w.giveActiveOrders('a', 5, 'delivered');
    w.giveActiveOrders('a', 5, 'cancelled');
    w.giveActiveOrders('a', 5, 'ready_for_pickup');
    for (const s of ['assigned_to_agent', 'picked_up', 'in_transit', 'out_for_delivery']) w.giveActiveOrders('a', 2, s);
    w.giveActiveOrders('a', 2, 'in_transit');
    expect((await w.service.evaluate(params())).rejected[0]?.reason).toBe('at_capacity');
    w.state.orders.pop();
    expect(ids(await w.service.eligibleAgents(params()))).toEqual(['a']);
  });

  it('expired, answered or standard offers are not outstanding dedicated offers', async () => {
    const w = world();
    w.addAgent('a', { is_internal: true });
    w.giveActiveOrders('a', 9);
    w.giveOffer('a', { expires_at: new Date(NOW.getTime() - 1000).toISOString() });
    w.giveOffer('a', { status: 'declined' });
    w.giveOffer('a', { offer_kind: 'standard' });
    expect(ids(await w.service.eligibleAgents(params()))).toEqual(['a']);
  });

  it("re-check at offer/claim doesn't count this order's own outstanding offer", async () => {
    const w = world();
    w.addAgent('a', { is_internal: true });
    w.giveActiveOrders('a', 9);
    w.giveOffer('a', { order_id: 'this-order' });
    await expect(w.service.eligibleAgents(params())).resolves.toEqual([]);
    expect(ids(await w.service.eligibleAgents(params({ excludeOrderId: 'this-order' })))).toEqual(['a']);
  });

  it('uses the configured max active orders', async () => {
    const w = world();
    w.state.maxActiveOrders = 3;
    w.addAgent('a', { is_internal: true });
    w.giveActiveOrders('a', 3);
    await expect(w.service.eligibleAgents(params())).resolves.toEqual([]);
  });

  it('independent on MoMo: balance = hold - 1 ineligible, = hold eligible, negative ineligible', async () => {
    const w = world();
    w.addAgent('short', { balance: 3999 });
    w.addAgent('exact', { balance: 4000 });
    w.addAgent('neg', { balance: -10 });
    w.addAgent('noacct');
    for (const id of ['short', 'exact', 'neg', 'noacct']) w.holds.set(id, 4000);
    const res = await w.service.evaluate(params());
    expect(ids(res.eligible)).toEqual(['exact']);
    expect(res.eligible[0]).toMatchObject({ holdAmount: 4000, availableBalance: 4000 });
    expect(Object.fromEntries(res.rejected.map((r) => [r.agentId, r.reason]))).toEqual({
      short: 'insufficient_balance',
      neg: 'negative_balance',
      noacct: 'insufficient_balance',
    });
    expect(w.agentHoldService.resolveOrderHoldWithCeiling).toHaveBeenCalledWith(5000, 'exact', 'mobile_money');
  });

  it('a negative balance gives 0 coverage even when the hold is 0', async () => {
    const w = world();
    w.addAgent('neg', { balance: -1 });
    w.holds.set('neg', 0);
    await expect(w.service.eligibleAgents(params())).resolves.toEqual([]);
  });

  it('reads the balance in the order currency only', async () => {
    const w = world();
    w.addAgent('a');
    w.state.accounts.push({ user_id: 'u-a', currency: 'CAD', available_balance: 1_000_000, business_location_id: null, is_active: true });
    w.holds.set('a', 4000);
    await expect(w.service.eligibleAgents(params())).resolves.toEqual([]);
  });

  it('same independent on Stripe is eligible with 0 balance; no hold or balance lookup', async () => {
    const w = world();
    w.addAgent('ind', { balance: 0 });
    const res = await w.service.eligibleAgents(params({ rail: 'stripe' }));
    expect(res).toEqual([expect.objectContaining({ agentId: 'ind', holdAmount: 0, availableBalance: null })]);
    expect(w.agentHoldService.resolveOrderHoldWithCeiling).not.toHaveBeenCalled();
    expect(w.state.queries.some((q) => q.includes('DedicatedAgentBalances'))).toBe(false);
  });

  it('internal agent on MoMo is eligible with 0 balance and no hold', async () => {
    const w = world();
    w.addAgent('int', { is_internal: true, balance: -5000 });
    const res = await w.service.eligibleAgents(params());
    expect(res).toEqual([expect.objectContaining({ agentId: 'int', isInternal: true, holdAmount: 0, availableBalance: null })]);
    expect(w.agentHoldService.resolveOrderHoldWithCeiling).not.toHaveBeenCalled();
  });

  it('verified_agent_delivery stays internal-only', async () => {
    const w = world();
    w.addAgent('int', { is_internal: true });
    w.addAgent('ind', { balance: 1_000_000 });
    expect(ids(await w.service.eligibleAgents(params({ verifiedAgentDelivery: true })))).toEqual(['int']);
    expect(ids(await w.service.eligibleAgents(params({ verifiedAgentDelivery: true, rail: 'stripe' })))).toEqual(['int']);
    expect(ids(await w.service.eligibleAgents(params()))).toEqual(['ind', 'int']);
  });

  it('Off today is compared with today in the country timezone', async () => {
    const w = world();
    w.addAgent('a', { is_internal: true, offToday: '2026-10-18' });
    // 23:30Z on the 17th is already 00:30 on the 18th in Douala.
    await expect(w.service.eligibleAgents(params({ now: new Date('2026-10-17T23:30:00Z') }))).resolves.toEqual([]);
    expect(ids(await w.service.eligibleAgents(params({ now: new Date('2026-10-17T22:30:00Z') })))).toEqual(['a']);
    expect(ids(await w.service.eligibleAgents(params({ now: new Date('2026-10-18T23:30:00Z') })))).toEqual(['a']);
  });

  it.each([
    ['unverified', { is_verified: false }, 'not_verified'],
    ['suspended', { status: 'suspended' }, 'suspended'],
    ['commercial-only', { focus: 'commercial' }, 'commercial_focus'],
  ])('%s agent is skipped', async (_n, over, reason) => {
    const w = world();
    w.addAgent('a', { is_internal: true, ...over });
    expect((await w.service.evaluate(params())).rejected[0]?.reason).toBe(reason);
  });

  it('contract gate: unsigned agent skipped; gate off (null) skips nobody', async () => {
    const w = world();
    w.addAgent('a', { is_internal: true });
    w.state.unsigned.add('a');
    expect((await w.service.evaluate(params())).rejected[0]?.reason).toBe('contract_unsigned');
    w.gate.signedIdsOrSkip.mockResolvedValueOnce(null as never);
    expect(ids(await w.service.eligibleAgents(params()))).toEqual(['a']);
  });

  it('ignores proximity and availability: an unavailable agent far away still covers the slot', async () => {
    const w = world();
    w.addAgent('a', { is_internal: true, is_available: false });
    expect(ids(await w.service.eligibleAgents(params()))).toEqual(['a']);
    expect(w.state.queries.join('\n')).not.toMatch(/agent_locations|is_available/);
  });

  it('batches: one load and one balance query for many agents', async () => {
    const w = world();
    for (let i = 0; i < 5; i++) w.addAgent(`ind${i}`, { balance: 10_000 });
    await w.service.eligibleAgents(params());
    const count = (op: string) => w.state.queries.filter((q) => q.includes(op)).length;
    expect(count('DedicatedAgentLoad')).toBe(1);
    expect(count('DedicatedAgentBalances')).toBe(1);
    expect(count('DedicatedSlotAssignments')).toBe(1);
  });
});

describe('DedicatedCoverageService.resolveSlot', () => {
  it('maps a window start (local time) to the slot, with the 15-min end grace', async () => {
    const w = world();
    const at = (windowStart: string) => w.service.resolveSlot({ locationId: LOCATION, preferredDate: '2026-10-20', windowStart });
    await expect(at('11:59:00')).resolves.toMatchObject({ slotKey: 'morning', slotId: 'cm-m', date: '2026-10-20' });
    await expect(at('12:00:00')).resolves.toMatchObject({ slotKey: 'afternoon', slotId: 'cm-a' });
    await expect(at('20:10:00')).resolves.toMatchObject({ slotKey: 'evening' });
    await expect(at('20:15:00')).resolves.toBeNull();
    await expect(at('06:00:00')).resolves.toBeNull();
  });

  it('maps an instant in Africa/Douala: 10:59Z -> Morning, 11:00Z -> Afternoon', async () => {
    const w = world();
    await expect(w.service.resolveSlot({ locationId: LOCATION, at: new Date('2026-10-18T10:59:00Z') })).resolves.toMatchObject({
      slotKey: 'morning',
      date: '2026-10-18',
      timeZone: 'Africa/Douala',
    });
    await expect(w.service.resolveSlot({ locationId: LOCATION, at: new Date('2026-10-18T11:00:00Z') })).resolves.toMatchObject({
      slotKey: 'afternoon',
    });
  });

  it('uses the country timezone from delivery config, falling back to the market zone when invalid', async () => {
    const w = world();
    w.state.timezone = 'Not/AZone';
    await expect(w.service.resolveSlot({ locationId: LOCATION, at: new Date('2026-10-18T11:00:00Z') })).resolves.toMatchObject({
      slotKey: 'afternoon',
      timeZone: 'Africa/Douala',
    });
  });

  it('falls back to __DEFAULT__ slots when the state has none', async () => {
    const w = world();
    w.state.locationState = 'Centre';
    await expect(w.service.resolveSlot({ locationId: LOCATION, preferredDate: '2026-10-20', windowStart: '12:30' })).resolves.toBeNull();
    await expect(w.service.resolveSlot({ locationId: LOCATION, preferredDate: '2026-10-20', windowStart: '13:00' })).resolves.toMatchObject({
      slotKey: 'afternoon',
      slotId: 'df-a',
    });
  });

  it('disabled slot, unknown location or flag off -> null', async () => {
    const w = world();
    const q = { locationId: LOCATION, preferredDate: '2026-10-20', windowStart: '12:30' };
    w.state.pickupSlots = [{ slot_key: 'afternoon', is_enabled: false }];
    await expect(w.service.resolveSlot(q)).resolves.toBeNull();
    w.state.pickupSlots = [];
    await expect(w.service.resolveSlot({ ...q, locationId: 'other' })).resolves.toBeNull();
    await expect(w.service.resolveSlot(q)).resolves.toMatchObject({ slotKey: 'afternoon' });
    const off = world();
    off.state.flag = false;
    await expect(off.service.resolveSlot(q)).resolves.toBeNull();
  });
});

describe('active order statuses', () => {
  it("match the agent's Active orders count (HasuraSystemService.countAgentActiveOrders)", () => {
    const src = readFileSync(join(__dirname, '../hasura/hasura-system.service.ts'), 'utf8');
    const fn = src.slice(src.indexOf('async countAgentActiveOrders'));
    const list = /current_status: \{ _in: \[([^\]]*)\] \}/.exec(fn)?.[1] ?? '';
    const statuses = list.split(',').map((s) => s.trim().replace(/"/g, ''));
    expect([...DEDICATED_ACTIVE_ORDER_STATUSES].sort()).toEqual(statuses.sort());
  });
});
