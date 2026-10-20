import type { AgentContractGateService } from '../agent-contracts/agent-contract-gate.service';
import type { AgentHoldService } from '../agents/agent-hold.service';
import type { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import type { AvailableSlot, DeliverySlotsService } from '../delivery/delivery-slots.service';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import {
  DEDICATED_CHECKOUT_HORIZON_DAYS,
  DedicatedCheckoutCoverageService,
  type DedicatedCoveredSlotsParams,
} from './dedicated-checkout-coverage.service';
import { DedicatedCoverageService } from './dedicated-coverage.service';

const LOCATION = 'loc-1';
// 08:00 in Douala on Sunday 2026-10-18.
const NOW = new Date('2026-10-18T07:00:00Z');

const SLOTS = {
  morning: { id: 'cm-m', slot_name: 'Morning', start_time: '08:00:00', end_time: '12:00:00' },
  afternoon: { id: 'cm-a', slot_name: 'Afternoon', start_time: '12:00:00', end_time: '16:00:00' },
  evening: { id: 'cm-e', slot_name: 'Evening', start_time: '16:00:00', end_time: '20:00:00' },
};
type Key = keyof typeof SLOTS;

function slot(key: Key, available = true): AvailableSlot {
  return {
    ...SLOTS[key],
    country_code: 'CM',
    state: 'Littoral',
    slot_type: 'standard',
    is_active: true,
    max_orders_per_slot: 10,
    display_order: 1,
    available_capacity: available ? 5 : 0,
    is_available: available,
  };
}

/**
 * Real DedicatedCoverageService over an in-memory Hasura (assignments, load,
 * balances, config), with DeliverySlotsService stubbed per date: it owns the
 * 2-hour / capacity / business-hours / enabled-slot rules and has its own spec.
 */
function world() {
  const state = {
    flag: true,
    pickupSlots: [] as Array<{ slot_key: string; is_enabled: boolean; pickup_time: string | null }>,
    assignments: [] as Array<{ id: string; agent_id: string; slot_key: string; status: string; off_today_date: string | null }>,
    agents: new Map<string, { id: string; user_id: string; is_verified: boolean; is_internal: boolean; status: string; focus: string }>(),
    balances: new Map<string, number>(),
    slotsByDate: new Map<string, AvailableSlot[]>(),
    queries: [] as string[],
  };
  interface QueryVars {
    slotKey: string;
    userIds: string[];
    currency: string;
  }
  const executeQuery = jest.fn(async (query: string, vars: QueryVars) => {
    const op = /query (\w+)/.exec(query)?.[1] ?? '?';
    state.queries.push(op);
    switch (op) {
      case 'DedicatedLocationContext':
        return {
          business_locations_by_pk: {
            id: LOCATION,
            address: { country: 'CM', state: 'Littoral' },
            pickup_slots: state.pickupSlots,
          },
        };
      case 'DedicatedLocationPickupSlots':
        return { business_location_pickup_slots: state.pickupSlots };
      case 'DedicatedSlotAssignments':
        return {
          dedicated_agent_assignments: state.assignments
            .filter((a) => a.slot_key === vars.slotKey && a.status === 'active')
            .map((a) => ({ ...a, agent: state.agents.get(a.agent_id) ?? null })),
        };
      case 'DedicatedAgentLoad':
        return { orders: [], order_offers: [] };
      case 'DedicatedAgentBalances':
        return {
          accounts: (vars.userIds as string[])
            .filter((u) => state.balances.has(u) && vars.currency === 'XAF')
            .map((u) => ({ user_id: u, available_balance: state.balances.get(u) })),
        };
      case 'DedicatedAgentsConfig':
        return {
          application_configurations: [
            { config_key: 'dedicated_agents_enabled', boolean_value: state.flag, country_code: null },
          ],
        };
      default:
        throw new Error(`unexpected query ${op}`);
    }
  });
  const hasura = { executeQuery } as unknown as HasuraSystemService;
  const config = new DedicatedAgentsConfigService(hasura);
  const deliveryConfig = { getTimezone: jest.fn(async () => 'Africa/Douala') } as unknown as DeliveryConfigService;
  const holds = {
    resolveOrderHoldWithCeiling: jest.fn(async (subtotal: number, _id: string, rail: string) => ({
      holdAmount: rail === 'stripe' ? 0 : Math.round(subtotal * 0.8),
    })),
  };
  const gate = { signedIdsOrSkip: jest.fn(async () => null) };
  const coverage = new DedicatedCoverageService(
    hasura,
    config,
    holds as unknown as AgentHoldService,
    gate as unknown as AgentContractGateService,
    deliveryConfig
  );
  const getAvailableSlots = jest.fn(async (_c: string, _s: string, date: string) => state.slotsByDate.get(date) ?? []);
  const slots = { getAvailableSlots } as unknown as DeliverySlotsService;
  const service = new DedicatedCheckoutCoverageService(hasura, config, deliveryConfig, slots, coverage);

  const addAgent = (id: string, key: Key, over: { internal?: boolean; balance?: number; offToday?: string } = {}) => {
    state.agents.set(id, {
      id,
      user_id: `u-${id}`,
      is_verified: true,
      is_internal: over.internal ?? true,
      status: 'active',
      focus: 'delivery',
    });
    state.assignments.push({ id: `as-${id}-${key}`, agent_id: id, slot_key: key, status: 'active', off_today_date: over.offToday ?? null });
    if (over.balance != null) state.balances.set(`u-${id}`, over.balance);
  };
  return { state, service, getAvailableSlots, executeQuery, addAgent };
}

const params = (over: Partial<DedicatedCoveredSlotsParams> = {}): DedicatedCoveredSlotsParams => ({
  locationId: LOCATION,
  country: 'CM',
  state: 'Littoral',
  rail: 'mobile_money',
  subtotal: 5000,
  currency: 'XAF',
  verifiedAgentDelivery: false,
  now: NOW,
  ...over,
});
const keys = (list: Array<{ date: string; slot_key: string }>) => list.map((s) => `${s.date} ${s.slot_key}`);

describe('DedicatedCheckoutCoverageService.coveredSlots', () => {
  it('flag off -> [] without reading slots or assignments', async () => {
    const w = world();
    w.state.flag = false;
    w.addAgent('a', 'afternoon');
    w.state.slotsByDate.set('2026-10-18', [slot('afternoon')]);
    await expect(w.service.coveredSlots(params())).resolves.toEqual([]);
    expect(w.getAvailableSlots).not.toHaveBeenCalled();
    expect(w.state.queries).not.toContain('DedicatedSlotAssignments');
  });

  it('lists only bookable store slots a dedicated agent covers, over the next 3 local days', async () => {
    const w = world();
    w.addAgent('a', 'afternoon');
    for (const d of ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21']) {
      w.state.slotsByDate.set(d, [slot('morning'), slot('afternoon'), slot('evening')]);
    }
    const result = await w.service.coveredSlots(params());
    expect(keys(result)).toEqual(['2026-10-18 afternoon', '2026-10-19 afternoon', '2026-10-20 afternoon']);
    expect(DEDICATED_CHECKOUT_HORIZON_DAYS).toBe(3);
    expect(w.getAvailableSlots.mock.calls.map((c) => c[2])).toEqual(['2026-10-18', '2026-10-19', '2026-10-20']);
    // Store-offered slots for this location, standard (not fast), in the country timezone.
    expect(w.getAvailableSlots).toHaveBeenCalledWith('CM', 'Littoral', '2026-10-18', false, 'Africa/Douala', LOCATION);
  });

  it('today is the local date in the seller timezone (23:30Z on the 17th is the 18th in Douala)', async () => {
    const w = world();
    w.addAgent('a', 'afternoon');
    await w.service.coveredSlots(params({ now: new Date('2026-10-17T23:30:00Z') }));
    expect(w.getAvailableSlots.mock.calls.map((c) => c[2])).toEqual(['2026-10-18', '2026-10-19', '2026-10-20']);
  });

  it('returns the slot id, local bounds and the default pickup time (start + 30)', async () => {
    const w = world();
    w.addAgent('a', 'afternoon');
    w.state.slotsByDate.set('2026-10-19', [slot('afternoon')]);
    await expect(w.service.coveredSlots(params())).resolves.toEqual([
      { date: '2026-10-19', slot_id: 'cm-a', slot_key: 'afternoon', start: '12:00', end: '16:00', pickup_time: '12:30' },
    ]);
  });

  it("uses the business's pickup time for that slot when set", async () => {
    const w = world();
    w.addAgent('a', 'afternoon');
    w.state.pickupSlots = [{ slot_key: 'afternoon', is_enabled: true, pickup_time: '13:15:00' }];
    w.state.slotsByDate.set('2026-10-19', [slot('afternoon')]);
    const [only] = await w.service.coveredSlots(params());
    expect(only.pickup_time).toBe('13:15');
  });

  it('a slot DeliverySlotsService marks unavailable (too soon, full) is not offered', async () => {
    const w = world();
    w.addAgent('a', 'morning');
    w.state.slotsByDate.set('2026-10-18', [slot('morning', false)]);
    w.state.slotsByDate.set('2026-10-19', [slot('morning')]);
    expect(keys(await w.service.coveredSlots(params()))).toEqual(['2026-10-19 morning']);
  });

  it('independent on MoMo with balance below the hold for this cart -> slot not covered', async () => {
    const w = world();
    w.addAgent('ind', 'afternoon', { internal: false, balance: 3999 });
    w.state.slotsByDate.set('2026-10-19', [slot('afternoon')]);
    await expect(w.service.coveredSlots(params({ subtotal: 5000 }))).resolves.toEqual([]);
    expect(keys(await w.service.coveredSlots(params({ subtotal: 4998 })))).toEqual(['2026-10-19 afternoon']);
    // Same agent on Stripe holds 0.
    expect(keys(await w.service.coveredSlots(params({ rail: 'stripe' })))).toEqual(['2026-10-19 afternoon']);
  });

  it('verified_agent_delivery: an independent does not cover', async () => {
    const w = world();
    w.addAgent('ind', 'afternoon', { internal: false, balance: 100000 });
    w.state.slotsByDate.set('2026-10-19', [slot('afternoon')]);
    await expect(w.service.coveredSlots(params({ verifiedAgentDelivery: true }))).resolves.toEqual([]);
  });

  it('Off today hides only today\'s slots, and eligibility is checked once per slot for later days', async () => {
    const w = world();
    w.addAgent('a', 'afternoon', { offToday: '2026-10-18' });
    for (const d of ['2026-10-18', '2026-10-19', '2026-10-20']) w.state.slotsByDate.set(d, [slot('afternoon')]);
    expect(keys(await w.service.coveredSlots(params()))).toEqual(['2026-10-19 afternoon', '2026-10-20 afternoon']);
    expect(w.state.queries.filter((q) => q === 'DedicatedSlotAssignments')).toHaveLength(2);
  });

  it('a slot lookup error -> [] (checkout behaves as today)', async () => {
    const w = world();
    w.addAgent('a', 'afternoon');
    w.getAvailableSlots.mockRejectedValueOnce(new Error('boom'));
    await expect(w.service.coveredSlots(params())).resolves.toEqual([]);
  });

  it('no location id -> []', async () => {
    const w = world();
    await expect(w.service.coveredSlots(params({ locationId: '' }))).resolves.toEqual([]);
    expect(w.getAvailableSlots).not.toHaveBeenCalled();
  });

  it('isEnabled normalises the country and is false for an empty one', async () => {
    const w = world();
    await expect(w.service.isEnabled(' cm ')).resolves.toBe(true);
    await expect(w.service.isEnabled('')).resolves.toBe(false);
    w.state.flag = false;
    const off = world();
    off.state.flag = false;
    await expect(off.service.isEnabled('CM')).resolves.toBe(false);
  });
});
