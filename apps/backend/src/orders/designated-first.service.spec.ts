import { DEFAULT_DEDICATED_AGENTS_CONFIG } from '../dedicated-agents/dedicated-agents.constants';
import { DesignatedFirstService, type DesignatedOrder } from './designated-first.service';

const NOW = new Date('2026-11-08T10:00:00Z');
const GATE = '2026-11-10T07:30:00.000Z';
const WINDOW = '2026-11-10T08:00:00.000Z';

const order = (over: Partial<DesignatedOrder> = {}): DesignatedOrder => ({
  id: 'o1',
  order_number: 'ORD-1',
  business_id: 'b1',
  business_location_id: 'loc1',
  current_status: 'ready_for_pickup',
  assigned_agent_id: null,
  assignment_source: null,
  fulfillment_method: 'delivery',
  fulfillment_timing: 'scheduled',
  subtotal: 1500,
  currency: 'XAF',
  verified_agent_delivery: false,
  coverage_slot_key: 'morning',
  dispatch_ready_at: GATE,
  dispatch_round: 0,
  pickup_by: WINDOW,
  dispatch_mode: null,
  designated_accepted_at: null,
  designated_release_cutoff_at: null,
  designated_reminder_sent_at: null,
  designated_evening_reminder_sent_at: null,
  designated_confirmed_at: null,
  designated_unconfirmed_flagged_at: null,
  business: { name: 'ACEGUARD', user_id: 'bu1', user: { preferred_language: 'en' } },
  business_location: { name: 'ACEGUARD Bastos', address: { country: 'CM', city: 'Yaoundé', latitude: 3.88, longitude: 11.51 } },
  delivery_address: { city: 'Yaoundé', state: 'Centre', latitude: 3.84, longitude: 11.5 },
  delivery_time_windows: [
    { slot_id: 's1', preferred_date: '2026-11-10', is_confirmed: true, time_slot_start: '09:00:00', time_slot_end: '11:00:00' },
  ],
  ...over,
});

function setup(cfg: Partial<typeof DEFAULT_DEDICATED_AGENTS_CONFIG> = {}) {
  const config = { ...DEFAULT_DEDICATED_AGENTS_CONFIG, enabled: true, designatedFirstEnabled: true, ...cfg };
  const mutations: Array<{ q: string; v: any }> = [];
  const hasura = {
    executeQuery: jest.fn(async (q: string) => {
      if (q.includes('agents(')) {
        return {
          agents: [
            {
              id: 'a1',
              user: { preferred_language: 'en' },
              agent_locations: [{ latitude: 3.87, longitude: 11.52, updated_at: '2026-11-08T09:55:00Z' }],
              agent_addresses: [],
            },
          ],
        };
      }
      return {};
    }),
    executeMutation: jest.fn(async (q: string, v: any) => {
      mutations.push({ q, v });
      if (q.includes('insert_order_offers')) {
        return { insert_order_offers: { returning: v.objects.map((o: any) => ({ agent_id: o.agent_id })) } };
      }
      if (q.includes('update_order_offers')) return { update_order_offers: { returning: [{ agent_id: 'a1' }], affected_rows: 1 } };
      return { update_orders: { affected_rows: 1 } };
    }),
  };
  const coverage = {
    resolveSlot: jest.fn(async () => ({ slotKey: 'morning', date: '2026-11-10', startTime: '09:00', endTime: '11:00', timeZone: 'Africa/Douala' })),
    evaluate: jest.fn(async () => ({ eligible: [{ agentId: 'a1', userId: 'u1', isInternal: false, assignmentId: 'as1' }] })),
  };
  const notifications = {
    sendOrderOfferPush: jest.fn(async () => undefined),
    sendDedicatedOrderNotice: jest.fn(async () => undefined),
  };
  const waitAndExecute = { scheduleDedicatedHeadsUpReping: jest.fn(async () => undefined) };
  const reassign = { reassignOrder: jest.fn(async () => ({ success: true })) };
  const moduleRef = { get: jest.fn(() => reassign) };
  const service = new DesignatedFirstService(
    hasura as any,
    { getConfig: jest.fn(async () => config) } as any,
    coverage as any,
    { resolveRailForBusiness: jest.fn(async () => 'mobile_money') } as any,
    notifications as any,
    { calculateAgentEarnings: jest.fn(async () => ({ totalEarnings: 500, currency: 'XAF' })) } as any,
    waitAndExecute as any,
    moduleRef as any
  );
  return { service, hasura, coverage, notifications, waitAndExecute, mutations, reassign };
}

describe('DesignatedFirstService', () => {
  it('offer at ready: early claimable offer to the designated agent with full details, expiring at the gate', async () => {
    const t = setup();
    jest.spyOn(t.service, 'load').mockResolvedValue({ order: order(), offers: [] });
    const out = await t.service.offerAtReady('o1', NOW);
    expect(out).toEqual({ kind: 'offered', agentIds: ['a1'] });
    const insert = t.mutations.find((m) => m.q.includes('insert_order_offers'));
    const row = insert?.v.objects[0];
    expect(row).toMatchObject({ phase: 'early', status: 'offered', offer_kind: 'dedicated', expires_at: GATE });
    expect(row.payload).toMatchObject({
      date: '2026-11-10',
      businessName: 'ACEGUARD Bastos',
      dropoffArea: expect.stringContaining('Yaoundé'),
      distanceOrigin: 'gps',
      commission: 500,
      currency: 'XAF',
      releaseCutoffAt: '2026-11-10T06:00:00.000Z',
    });
    expect(row.payload.pickupKm).toEqual(expect.any(Number));
    // Area + distances only: no street address in the payload.
    expect(JSON.stringify(row.payload)).not.toMatch(/address_line|street/i);
    expect(t.notifications.sendOrderOfferPush).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', orderId: 'o1', expiresAt: GATE, title: expect.stringContaining('New order for you') })
    );
    expect(t.coverage.evaluate).toHaveBeenCalledWith(expect.objectContaining({ capPerSlotDay: true }));
  });

  it('never re-offers an agent who declined', async () => {
    const t = setup();
    jest.spyOn(t.service, 'load').mockResolvedValue({
      order: order(),
      offers: [{ id: 'x', agent_id: 'a1', user_id: 'u1', status: 'declined', phase: 'early' } as any],
    });
    expect(await t.service.offerAtReady('o1', NOW)).toEqual({ kind: 'fallback' });
    expect(t.notifications.sendOrderOfferPush).not.toHaveBeenCalled();
  });

  it('is dark when the flag is off, and skipped once the gate passed', async () => {
    const off = setup({ designatedFirstEnabled: false });
    jest.spyOn(off.service, 'load').mockResolvedValue({ order: order(), offers: [] });
    expect(await off.service.offerAtReady('o1', NOW)).toEqual({ kind: 'skipped', reason: 'flag_off' });
    const late = setup();
    jest.spyOn(late.service, 'load').mockResolvedValue({ order: order(), offers: [] });
    expect(await late.service.offerAtReady('o1', new Date('2026-11-10T07:31:00Z'))).toEqual({ kind: 'skipped', reason: 'gate_open' });
  });

  it('accept far-future: stamps accepted + free release cutoff (window - 2 h) and schedules reminders', async () => {
    const t = setup();
    jest.spyOn(t.service, 'load').mockResolvedValue({
      order: order({ dispatch_mode: 'designated_first', current_status: 'assigned_to_agent', assigned_agent_id: 'a1', assignment_source: 'dedicated_offer' }),
      offers: [],
    });
    await t.service.onAssigned('o1', NOW);
    const stamp = t.mutations.find((m) => m.v?.cutoff !== undefined);
    expect(stamp?.v).toMatchObject({ id: 'o1', agentId: 'a1', cutoff: '2026-11-10T06:00:00.000Z' });
  });

  it('decline before the gate waits for the gate; after it runs round 1', () => {
    const t = setup();
    const o = { dispatch_mode: 'designated_first', dispatch_round: 0, dispatch_ready_at: GATE };
    expect(t.service.decideAfterDecline(o, NOW)).toBe('wait');
    expect(t.service.decideAfterDecline(o, new Date('2026-11-10T07:31:00Z'))).toBe('round1');
    expect(t.service.decideAfterDecline({ ...o, dispatch_mode: null }, NOW)).toBe('legacy');
  });

  it('no response: at the gate the early offer moves into round 1 with the round TTL', async () => {
    const t = setup();
    const at = new Date('2026-11-10T07:30:00Z');
    const kept = await t.service.atGate('o1', 90, at);
    expect([...kept]).toEqual(['a1']);
    const move = t.mutations.find((m) => m.q.includes('update_order_offers'));
    expect(move?.v).toEqual({ orderId: 'o1', expiresAt: '2026-11-10T07:31:30.000Z' });
  });

  it('unconfirmed at the gate: flags admin + business, does not auto-release by default', async () => {
    const t = setup();
    jest.spyOn(t.service, 'load').mockResolvedValue({
      order: order({ dispatch_mode: 'designated_first', current_status: 'assigned_to_agent', assigned_agent_id: 'a1', designated_accepted_at: NOW.toISOString() }),
      offers: [],
    });
    expect(await t.service.checkUnconfirmedAtGate('o1', NOW)).toBe('flagged');
    expect(t.notifications.sendDedicatedOrderNotice).toHaveBeenCalledWith(expect.objectContaining({ userId: 'bu1', persona: 'business' }));
    expect(t.reassign.reassignOrder).not.toHaveBeenCalled();
  });

  it('confirm refuses an order the agent does not hold', async () => {
    const t = setup();
    jest.spyOn(t.service, 'load').mockResolvedValue({ order: order(), offers: [] });
    await expect(t.service.confirm('o1', 'a1', NOW)).rejects.toMatchObject({ status: 409 });
  });

  it('recordReliability inserts via agent_reliability_events_once_idx (Hasura unique constraint) and logs insert failures at error', async () => {
    const t = setup();
    await t.service.recordReliability('a1', 'o1', 'late_release', { mode: 'late' });
    const insert = t.mutations.find((m) => m.q.includes('insert_agent_reliability_events_one'));
    expect(insert?.q).toMatch(/constraint:\s*agent_reliability_events_once_idx/);
    expect(insert?.q).toMatch(/update_columns:\s*\[\]/);
    expect(insert?.v).toEqual({ object: { agent_id: 'a1', order_id: 'o1', kind: 'late_release', meta: { mode: 'late' } } });

    const failing = setup();
    const err = new Error('constraint "agent_reliability_events_once_idx" does not exist');
    (failing.hasura.executeMutation as jest.Mock).mockRejectedValueOnce(err);
    const errorSpy = jest.spyOn((failing.service as any).logger, 'error').mockImplementation(() => undefined);
    await expect(failing.service.recordReliability('a1', 'o1', 'late_release', {})).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Reliability event late_release for o1'));
    errorSpy.mockRestore();
  });
});
