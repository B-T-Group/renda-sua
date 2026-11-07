import { Logger } from '@nestjs/common';
import { DEFAULT_DEDICATED_AGENTS_CONFIG } from '../dedicated-agents/dedicated-agents.constants';
import { DEDICATED_ORDER_CLAIMER } from './dedicated-claim.port';
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
      if (q.includes('DesignatedAutoAgent')) {
        return {
          agents_by_pk: {
            id: 'a1',
            is_verified: true,
            is_internal: true,
            user: { id: 'u1', first_name: 'Ada', last_name: 'Ngono' },
          },
        };
      }
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
  const offersSvc = { runDispatchRound: jest.fn(async () => undefined) };
  const claimOrderForAgent = jest.fn(async () => undefined);
  const commissions = {
    calculateAgentEarnings: jest.fn(async () => ({ totalEarnings: 500, currency: 'XAF' })),
  };
  const moduleRef = {
    get: jest.fn((token: { name?: string } | string) => {
      if (token === DEDICATED_ORDER_CLAIMER) return { claimOrderForAgent };
      if (typeof token === 'function' && token.name === 'OrderOffersService') return offersSvc;
      return reassign;
    }),
  };
  const service = new DesignatedFirstService(
    hasura as any,
    { getConfig: jest.fn(async () => config) } as any,
    coverage as any,
    { resolveRailForBusiness: jest.fn(async () => 'mobile_money') } as any,
    notifications as any,
    commissions as any,
    waitAndExecute as any,
    moduleRef as any
  );
  return {
    service,
    hasura,
    coverage,
    notifications,
    waitAndExecute,
    mutations,
    reassign,
    offersSvc,
    claimOrderForAgent,
    commissions,
  };
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
    expect(t.mutations.some((m) => m.q.includes('StampDesignatedMode') && m.v?.mode === 'fallback')).toBe(true);
  });

  it('leaves a live early offer alone and does not stamp fallback', async () => {
    const live = setup();
    jest.spyOn(live.service, 'load').mockResolvedValue({
      order: order(),
      offers: [{ id: 'x', agent_id: 'a1', user_id: 'u1', status: 'offered', phase: 'early' } as any],
    });
    expect(await live.service.offerAtReady('o1', NOW)).toEqual({ kind: 'fallback' });
    expect(live.mutations.some((m) => m.q.includes('insert_order_offers') || m.q.includes('StampDesignatedMode'))).toBe(false);
    expect(live.notifications.sendOrderOfferPush).not.toHaveBeenCalled();

    const accepted = setup();
    jest.spyOn(accepted.service, 'load').mockResolvedValue({
      order: order(),
      offers: [{ id: 'x', agent_id: 'a1', user_id: 'u1', status: 'accepted', phase: 'early' } as any],
    });
    expect(await accepted.service.offerAtReady('o1', NOW)).toEqual({ kind: 'fallback' });
    expect(accepted.mutations.some((m) => m.q.includes('insert_order_offers'))).toBe(false);
    expect(accepted.notifications.sendOrderOfferPush).not.toHaveBeenCalled();
  });

  it('re-offers an expired row and increments the attempt', async () => {
    const t = setup();
    jest.spyOn(t.service, 'load').mockResolvedValue({
      order: order(),
      offers: [{ id: 'x', agent_id: 'a1', user_id: 'u1', status: 'expired', phase: 'early', dedicated_attempt: 2 } as any],
    });
    expect(await t.service.offerAtReady('o1', NOW)).toEqual({ kind: 'offered', agentIds: ['a1'] });
    const insert = t.mutations.find((m) => m.q.includes('insert_order_offers'));
    expect(insert?.v.objects[0]).toMatchObject({ status: 'offered', phase: 'early', dedicated_attempt: 3 });
  });

  it('skips orders that are not a confirmed scheduled delivery, and a missing slot', async () => {
    const pickup = setup();
    jest.spyOn(pickup.service, 'load').mockResolvedValue({ order: order({ fulfillment_method: 'pickup' }), offers: [] });
    expect(await pickup.service.offerAtReady('o1', NOW)).toEqual({ kind: 'skipped', reason: 'not_dispatchable' });

    const taken = setup();
    jest.spyOn(taken.service, 'load').mockResolvedValue({ order: order({ assigned_agent_id: 'a1' }), offers: [] });
    expect(await taken.service.offerAtReady('o1', NOW)).toEqual({ kind: 'skipped', reason: 'not_dispatchable' });

    const missing = setup();
    jest.spyOn(missing.service, 'load').mockResolvedValue({ order: null, offers: [] });
    expect(await missing.service.offerAtReady('o1', NOW)).toEqual({ kind: 'skipped', reason: 'not_found' });

    const unconfirmed = setup();
    jest.spyOn(unconfirmed.service, 'load').mockResolvedValue({
      order: order({
        delivery_time_windows: [{ slot_id: 's1', preferred_date: '2026-11-10', is_confirmed: false }],
      }),
      offers: [],
    });
    expect(await unconfirmed.service.offerAtReady('o1', NOW)).toEqual({ kind: 'skipped', reason: 'not_covered' });
    expect(unconfirmed.coverage.evaluate).not.toHaveBeenCalled();

    const noSlot = setup();
    noSlot.coverage.resolveSlot.mockResolvedValue(null);
    jest.spyOn(noSlot.service, 'load').mockResolvedValue({ order: order(), offers: [] });
    expect(await noSlot.service.offerAtReady('o1', NOW)).toEqual({ kind: 'skipped', reason: 'no_slot' });
    expect(noSlot.coverage.evaluate).not.toHaveBeenCalled();
  });

  it('swallows an offer failure so ready-for-pickup still completes', async () => {
    const t = setup();
    jest.spyOn(t.service, 'load').mockRejectedValue(new Error('db down'));
    expect(await t.service.offerAtReady('o1', NOW)).toEqual({ kind: 'skipped', reason: 'error' });
    expect(t.notifications.sendOrderOfferPush).not.toHaveBeenCalled();
  });

  it('still offers when the commission quote fails, with a null amount', async () => {
    const t = setup();
    t.commissions.calculateAgentEarnings.mockRejectedValue(new Error('rate'));
    jest.spyOn(t.service, 'load').mockResolvedValue({ order: order(), offers: [] });
    expect(await t.service.offerAtReady('o1', NOW)).toEqual({ kind: 'offered', agentIds: ['a1'] });
    const insert = t.mutations.find((m) => m.q.includes('insert_order_offers'));
    expect(insert?.v.objects[0]).toMatchObject({ estimated_earnings: null, payload: expect.objectContaining({ commission: null, currency: 'XAF' }) });
  });

  it('auto-assigns the only internal agent, and offers if that claim fails or the user is missing', async () => {
    const internal = [{ agentId: 'a1', userId: 'u1', isInternal: true, assignmentId: 'as1' }];
    const assigned = setup();
    assigned.coverage.evaluate.mockResolvedValue({ eligible: internal });
    jest.spyOn(assigned.service, 'load').mockResolvedValue({ order: order(), offers: [] });
    expect(await assigned.service.offerAtReady('o1', NOW)).toEqual({ kind: 'auto_assigned', agentId: 'a1' });
    expect(assigned.claimOrderForAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'o1',
        fundsCheckSource: 'claim',
        assignment: expect.objectContaining({ source: 'dedicated_auto', dedicatedAssignmentId: 'as1', countOffers: true }),
      })
    );
    expect(assigned.mutations.some((m) => m.q.includes('insert_order_offers'))).toBe(false);

    const failed = setup();
    failed.coverage.evaluate.mockResolvedValue({ eligible: internal });
    failed.claimOrderForAgent.mockRejectedValue(new Error('cap'));
    jest.spyOn(failed.service, 'load').mockResolvedValue({ order: order(), offers: [] });
    expect(await failed.service.offerAtReady('o1', NOW)).toEqual({ kind: 'offered', agentIds: ['a1'] });
    expect(failed.mutations.some((m) => m.q.includes('insert_order_offers'))).toBe(true);

    const noUser = setup();
    noUser.coverage.evaluate.mockResolvedValue({ eligible: internal });
    noUser.hasura.executeQuery.mockImplementation(async (q: string) => {
      if (q.includes('DesignatedAutoAgent')) return { agents_by_pk: { id: 'a1', user: null } };
      if (q.includes('agents(')) return { agents: [] };
      return {};
    });
    jest.spyOn(noUser.service, 'load').mockResolvedValue({ order: order(), offers: [] });
    expect(await noUser.service.offerAtReady('o1', NOW)).toEqual({ kind: 'offered', agentIds: ['a1'] });
    expect(noUser.claimOrderForAgent).not.toHaveBeenCalled();
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
    expect(t.service.decideAfterDecline({ ...o, dispatch_round: 1 }, NOW)).toBe('legacy');
    expect(t.service.decideAfterDecline({ ...o, dispatch_ready_at: null }, NOW)).toBe('round1');
  });

  it('does not grant a free-release cutoff once the gate has passed, or for a normal claim', async () => {
    const held = order({
      dispatch_mode: 'designated_first',
      current_status: 'assigned_to_agent',
      assigned_agent_id: 'a1',
      assignment_source: 'dedicated_offer',
    });
    const atGate = setup();
    jest.spyOn(atGate.service, 'load').mockResolvedValue({ order: held, offers: [] });
    await atGate.service.onAssigned('o1', new Date(GATE));
    expect(atGate.mutations.some((m) => m.q.includes('StampDesignatedAccepted'))).toBe(false);

    const claimed = setup();
    jest.spyOn(claimed.service, 'load').mockResolvedValue({
      order: { ...held, assignment_source: 'claim' },
      offers: [],
    });
    await claimed.service.onAssigned('o1', NOW);
    expect(claimed.mutations.some((m) => m.q.includes('StampDesignatedAccepted'))).toBe(false);

    const pastCutoff = setup();
    jest.spyOn(pastCutoff.service, 'load').mockResolvedValue({
      order: {
        ...held,
        assignment_source: 'dedicated_auto',
        pickup_by: '2026-11-08T11:00:00.000Z',
        dispatch_ready_at: '2026-11-08T12:00:00.000Z',
      },
      offers: [],
    });
    await pastCutoff.service.onAssigned('o1', NOW);
    const stamp = pastCutoff.mutations.find((m) => m.q.includes('StampDesignatedAccepted'));
    expect(stamp?.v).toMatchObject({ agentId: 'a1', cutoff: null });
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

  it('unconfirmed check is a no-op without designated_accepted_at (e.g. after a system drop)', async () => {
    const t = setup();
    jest.spyOn(t.service, 'load').mockResolvedValue({
      order: order({
        dispatch_mode: 'designated_first',
        current_status: 'assigned_to_agent',
        assigned_agent_id: 'a2',
        assignment_source: 'dedicated_offer',
      }),
      offers: [],
    });
    expect(await t.service.checkUnconfirmedAtGate('o1', NOW)).toBe('ok');
    expect(t.notifications.sendDedicatedOrderNotice).not.toHaveBeenCalled();
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

  it('confirm is idempotent, and a normal assignment has nothing to confirm', async () => {
    const held = order({
      dispatch_mode: 'designated_first',
      current_status: 'assigned_to_agent',
      assigned_agent_id: 'a1',
      designated_confirmed_at: '2026-11-08T09:00:00.000Z',
    });
    const again = setup();
    jest.spyOn(again.service, 'load').mockResolvedValue({ order: held, offers: [] });
    await expect(again.service.confirm('o1', 'a1', NOW)).resolves.toEqual({ confirmedAt: '2026-11-08T09:00:00.000Z' });
    expect(again.mutations).toHaveLength(0);

    const plain = setup();
    jest.spyOn(plain.service, 'load').mockResolvedValue({
      order: { ...held, dispatch_mode: null, designated_confirmed_at: null },
      offers: [],
    });
    await expect(plain.service.confirm('o1', 'a1', NOW)).rejects.toMatchObject({
      status: 409,
      response: { error: 'NOT_DESIGNATED' },
    });
    expect(plain.mutations).toHaveLength(0);
  });

  it('an already-confirmed order and a lost unconfirmed claim do not notify again', async () => {
    const confirmed = setup();
    jest.spyOn(confirmed.service, 'load').mockResolvedValue({
      order: order({
        dispatch_mode: 'designated_first',
        current_status: 'assigned_to_agent',
        assigned_agent_id: 'a1',
        designated_accepted_at: NOW.toISOString(),
        designated_confirmed_at: NOW.toISOString(),
      }),
      offers: [],
    });
    expect(await confirmed.service.checkUnconfirmedAtGate('o1', NOW)).toBe('ok');
    expect(confirmed.notifications.sendDedicatedOrderNotice).not.toHaveBeenCalled();
    expect(confirmed.mutations.some((m) => m.q.includes('InsertAgentReliabilityEvent'))).toBe(false);

    const lost = setup();
    lost.hasura.executeMutation.mockImplementation(async (q: string, v: any) => {
      lost.mutations.push({ q, v });
      if (q.includes('designated_unconfirmed_flagged_at')) return { update_orders: { affected_rows: 0 } };
      return { update_orders: { affected_rows: 1 } };
    });
    jest.spyOn(lost.service, 'load').mockResolvedValue({
      order: order({
        dispatch_mode: 'designated_first',
        current_status: 'assigned_to_agent',
        assigned_agent_id: 'a1',
        designated_accepted_at: NOW.toISOString(),
      }),
      offers: [],
    });
    expect(await lost.service.checkUnconfirmedAtGate('o1', NOW)).toBe('ok');
    expect(lost.notifications.sendDedicatedOrderNotice).not.toHaveBeenCalled();
    expect(lost.reassign.reassignOrder).not.toHaveBeenCalled();
  });

  it('auto-release at the gate hands the order back without a reassignment penalty', async () => {
    const t = setup({ designatedUnconfirmedAutoRelease: true });
    jest.spyOn(t.service, 'load').mockResolvedValue({
      order: order({
        dispatch_mode: 'designated_first',
        current_status: 'assigned_to_agent',
        assigned_agent_id: 'a1',
        designated_accepted_at: NOW.toISOString(),
      }),
      offers: [],
    });
    expect(await t.service.checkUnconfirmedAtGate('o1', NOW)).toBe('released');
    expect(t.reassign.reassignOrder).toHaveBeenCalledWith('o1', 'designated_unconfirmed_at_gate', { skipReliabilityPenalty: true });
    expect(t.mutations.some((m) => m.q.includes('InsertAgentReliabilityEvent') && m.v?.object?.kind === 'reminder_unconfirmed')).toBe(true);
  });

  it('a late accept that loses the row stays closed, and a write error does not throw', async () => {
    const lost = setup();
    lost.hasura.executeMutation.mockResolvedValue({ update_order_offers: { affected_rows: 0 } });
    expect(await lost.service.reopenLateOffer('o1', 'a1', NOW)).toBe(false);

    const broken = setup();
    broken.hasura.executeMutation.mockRejectedValue(new Error('db down'));
    expect(await broken.service.reopenLateOffer('o1', 'a1', NOW)).toBe(false);
  });

  it('a failed gate move returns no kept agents', async () => {
    const t = setup();
    t.hasura.executeMutation.mockRejectedValue(new Error('db down'));
    await expect(t.service.atGate('o1', 90, new Date(GATE))).resolves.toEqual(new Set());
  });

  it('lists free release only while the cutoff is still ahead', async () => {
    const t = setup();
    t.hasura.executeQuery.mockResolvedValue({
      order_offers: [
        {
          order_id: 'o1',
          phase: null,
          expires_at: GATE,
          payload: null,
          estimated_earnings: 500,
          currency: 'XAF',
          created_at: NOW.toISOString(),
          dashboard_dismissed_at: null,
        },
      ],
      orders: [
        {
          id: 'o2',
          order_number: 'ORD-2',
          pickup_by: WINDOW,
          dispatch_ready_at: GATE,
          designated_release_cutoff_at: '2026-11-08T11:00:00.000Z',
          designated_confirmed_at: null,
          business_location: { name: 'ACEGUARD Bastos' },
          delivery_time_windows: [{ preferred_date: '2026-11-10', time_slot_start: '09:00:00', time_slot_end: '11:00:00' }],
        },
        {
          id: 'o3',
          order_number: 'ORD-3',
          pickup_by: null,
          dispatch_ready_at: null,
          designated_release_cutoff_at: NOW.toISOString(),
          designated_confirmed_at: 'stamped',
          business_location: null,
          delivery_time_windows: [],
        },
      ],
      dedicated_agent_assignments: [],
    });
    const list = await t.service.listForAgent('a1', NOW);
    expect(list.offers[0]).toMatchObject({ orderId: 'o1', phase: 'gate', details: null, dismissedFromHome: false });
    expect(list.upcoming[0]).toMatchObject({ orderId: 'o2', freeRelease: true, storeName: 'ACEGUARD Bastos' });
    expect(list.upcoming[1]).toMatchObject({ orderId: 'o3', freeRelease: false, confirmedAt: 'stamped' });

    t.hasura.executeQuery.mockResolvedValue(null);
    await expect(t.service.listForAgent('a1', NOW)).resolves.toEqual({ offers: [], upcoming: [] });
  });

  it('merges coverage-matched pre-gate orders and keeps Home-dismissed offers', async () => {
    const t = setup();
    t.hasura.executeQuery.mockImplementation(async (q: string) => {
      if (q.includes('DesignatedAgentOffers')) {
        return {
          order_offers: [
            {
              order_id: 'o1',
              phase: 'early',
              expires_at: GATE,
              payload: { businessName: 'ACEGUARD Bastos' },
              estimated_earnings: 500,
              currency: 'XAF',
              created_at: NOW.toISOString(),
              dashboard_dismissed_at: NOW.toISOString(),
            },
          ],
          orders: [],
        };
      }
      if (q.includes('AgentDeclinedDedicated')) {
        return { order_offers: [] };
      }
      if (q.includes('AgentCoverageAssignments')) {
        return {
          dedicated_agent_assignments: [
            { business_location_id: 'loc1', slot_key: 'morning', off_today_date: null },
            { business_location_id: 'loc1', slot_key: 'evening', off_today_date: NOW.toISOString().slice(0, 10) },
          ],
        };
      }
      if (q.includes('AgentCoverageOrders')) {
        return {
          orders: [
            {
              id: 'o1',
              order_number: 'ORD-1',
              business_location_id: 'loc1',
              coverage_slot_key: 'morning',
              currency: 'XAF',
              dispatch_ready_at: GATE,
              pickup_by: WINDOW,
              fulfillment_timing: 'scheduled',
              business_location: { name: 'ACEGUARD Bastos', address: { city: 'Yaoundé', country: 'CM' } },
              delivery_address: { city: 'Yaoundé', state: 'Centre' },
              delivery_time_windows: [
                { slot_id: 's1', preferred_date: '2026-11-10', is_confirmed: true, time_slot_start: '09:00:00', time_slot_end: '11:00:00' },
              ],
            },
            {
              id: 'o4',
              order_number: 'ORD-4',
              business_location_id: 'loc1',
              coverage_slot_key: 'morning',
              currency: 'XAF',
              dispatch_ready_at: GATE,
              pickup_by: WINDOW,
              fulfillment_timing: 'scheduled',
              business_location: { name: 'ACEGUARD Bastos', address: { city: 'Yaoundé', country: 'CM' } },
              delivery_address: { city: 'Yaoundé', state: 'Centre' },
              delivery_time_windows: [
                { slot_id: 's1', preferred_date: '2026-11-10', is_confirmed: true, time_slot_start: '09:00:00', time_slot_end: '11:00:00' },
              ],
            },
            {
              id: 'o5',
              order_number: 'ORD-5',
              business_location_id: 'loc1',
              coverage_slot_key: 'evening',
              currency: 'XAF',
              dispatch_ready_at: GATE,
              pickup_by: WINDOW,
              fulfillment_timing: 'scheduled',
              business_location: { name: 'ACEGUARD Bastos', address: { city: 'Yaoundé', country: 'CM' } },
              delivery_address: { city: 'Yaoundé', state: 'Centre' },
              delivery_time_windows: [
                { slot_id: 's2', preferred_date: '2026-11-10', is_confirmed: true, time_slot_start: '17:00:00', time_slot_end: '19:00:00' },
              ],
            },
          ],
        };
      }
      return {};
    });
    const list = await t.service.listForAgent('a1', NOW);
    expect(list.offers.map((o) => o.orderId)).toEqual(['o1', 'o4']);
    expect(list.offers[0]).toMatchObject({ dismissedFromHome: true, details: { businessName: 'ACEGUARD Bastos' } });
    expect(list.offers[1]).toMatchObject({
      orderId: 'o4',
      phase: 'early',
      dismissedFromHome: false,
      details: expect.objectContaining({ businessName: 'ACEGUARD Bastos', gateAt: GATE }),
    });
  });

  it('does not synthesize coverage offers for orders the agent already declined', async () => {
    const t = setup();
    t.hasura.executeQuery.mockImplementation(async (q: string) => {
      if (q.includes('DesignatedAgentOffers')) {
        return { order_offers: [], orders: [] };
      }
      if (q.includes('AgentDeclinedDedicated')) {
        return { order_offers: [{ order_id: 'o4' }] };
      }
      if (q.includes('AgentCoverageAssignments')) {
        return {
          dedicated_agent_assignments: [
            { business_location_id: 'loc1', slot_key: 'morning', off_today_date: null },
          ],
        };
      }
      if (q.includes('AgentCoverageOrders')) {
        return {
          orders: [
            {
              id: 'o4',
              order_number: 'ORD-4',
              business_location_id: 'loc1',
              coverage_slot_key: 'morning',
              currency: 'XAF',
              dispatch_ready_at: GATE,
              pickup_by: WINDOW,
              fulfillment_timing: 'scheduled',
              business_location: { name: 'ACEGUARD Bastos', address: { city: 'Yaoundé', country: 'CM' } },
              delivery_address: { city: 'Yaoundé', state: 'Centre' },
              delivery_time_windows: [
                { slot_id: 's1', preferred_date: '2026-11-10', is_confirmed: true, time_slot_start: '09:00:00', time_slot_end: '11:00:00' },
              ],
            },
          ],
        };
      }
      return {};
    });
    const list = await t.service.listForAgent('a1', NOW);
    expect(list.offers).toEqual([]);
  });

  it('ensures a quiet early offer for an eligible coverage agent', async () => {
    const t = setup();
    jest.spyOn(t.service, 'load').mockResolvedValue({
      order: order({ dispatch_mode: null }),
      offers: [],
    });
    t.hasura.executeMutation.mockImplementation(async (q: string, v: any) => {
      t.mutations.push({ q, v });
      if (q.includes('RefreshDesignatedEarlyOffer')) {
        return { update_order_offers: { affected_rows: 0 } };
      }
      if (q.includes('insert_order_offers')) {
        return { insert_order_offers: { returning: [{ agent_id: 'a1' }] } };
      }
      return { update_orders: { affected_rows: 1 } };
    });
    await expect(t.service.ensureEarlyOfferForAgent('o1', 'a1', NOW)).resolves.toBe(true);
    expect(t.coverage.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ ignoreSlotPrefs: true, ignoreOutstandingOffers: true })
    );
    expect(t.mutations.some((m) => m.q.includes('insert_order_offers'))).toBe(true);
    expect(t.notifications.sendOrderOfferPush).not.toHaveBeenCalled();
  });

  it('ensure still creates an offer when only money blocks eligibility', async () => {
    const t = setup();
    t.coverage.evaluate.mockResolvedValue({
      eligible: [],
      rejected: [{ agentId: 'a1', assignmentId: 'as1', reason: 'insufficient_balance' }],
    });
    t.hasura.executeQuery.mockImplementation(async (q: string) => {
      if (q.includes('DesignatedAgentUser')) return { agents_by_pk: { user_id: 'u1' } };
      return {};
    });
    jest.spyOn(t.service, 'load').mockResolvedValue({ order: order({ dispatch_mode: null }), offers: [] });
    t.hasura.executeMutation.mockImplementation(async (q: string, v: any) => {
      t.mutations.push({ q, v });
      if (q.includes('RefreshDesignatedEarlyOffer')) return { update_order_offers: { affected_rows: 0 } };
      if (q.includes('insert_order_offers')) {
        return { insert_order_offers: { returning: [{ agent_id: 'a1' }] } };
      }
      return { update_orders: { affected_rows: 1 } };
    });
    await expect(t.service.ensureEarlyOfferForAgent('o1', 'a1', NOW)).resolves.toBe(true);
    expect(t.mutations.some((m) => m.q.includes('insert_order_offers'))).toBe(true);
  });

  it('ensure returns false for a non-coverage agent or declined offer', async () => {
    const t = setup();
    t.coverage.evaluate.mockResolvedValue({ eligible: [], rejected: [] });
    jest.spyOn(t.service, 'load').mockResolvedValue({ order: order(), offers: [] });
    await expect(t.service.ensureEarlyOfferForAgent('o1', 'a1', NOW)).resolves.toBe(false);

    const declined = setup();
    jest.spyOn(declined.service, 'load').mockResolvedValue({
      order: order(),
      offers: [{ id: 'x', agent_id: 'a1', user_id: 'u1', status: 'declined', phase: 'early', expires_at: GATE, reminder_sent_at: null } as any],
    });
    await expect(declined.service.ensureEarlyOfferForAgent('o1', 'a1', NOW)).resolves.toBe(false);
  });

  it('dismisses an open dedicated offer without changing status', async () => {
    const t = setup();
    jest.spyOn(t.service, 'ensureEarlyOfferForAgent').mockResolvedValue(true);
    const out = await t.service.dismissDashboardOffer('o1', 'a1', NOW);
    expect(out.dismissedAt).toBe(NOW.toISOString());
    const dismiss = t.mutations.find((m) => m.q.includes('DismissDesignatedDashboardOffer'));
    expect(dismiss?.v).toMatchObject({ orderId: 'o1', agentId: 'a1', at: NOW.toISOString() });
    expect(dismiss?.q).toContain('dashboard_dismissed_at');
    expect(dismiss?.q).not.toContain('status: "declined"');
  });

  it('refuses dismiss when no open offer matches', async () => {
    const t = setup();
    jest.spyOn(t.service, 'ensureEarlyOfferForAgent').mockResolvedValue(false);
    t.hasura.executeMutation.mockResolvedValue({ update_order_offers: { affected_rows: 0 } });
    await expect(t.service.dismissDashboardOffer('o1', 'other', NOW)).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ error: 'NOT_OFFERED' }),
    });
  });
  it('sends an open-offer reminder only to claimed rows that have a user', async () => {
    const t = setup();
    const at = new Date('2026-11-10T07:18:00.000Z');
    jest.spyOn(t.service, 'load').mockResolvedValue({
      order: order({ dispatch_mode: 'designated_first' }),
      offers: [{ id: 'x', agent_id: 'a1', user_id: 'u1', status: 'offered', phase: 'early', expires_at: GATE, reminder_sent_at: null } as any],
    });
    t.hasura.executeMutation.mockImplementation(async (q: string, v: any) => {
      t.mutations.push({ q, v });
      if (q.includes('ClaimOpenOfferReminders')) {
        return { update_order_offers: { returning: [{ agent_id: 'a1', user_id: 'u1' }, { agent_id: 'a2', user_id: null }] } };
      }
      return { update_orders: { affected_rows: 1 } };
    });
    const out = await t.service.tick('o1', at);
    expect(out.sent).toEqual(['open_offer_reminder']);
    expect(t.notifications.sendOrderOfferPush).toHaveBeenCalledTimes(1);
    expect(t.notifications.sendOrderOfferPush).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', orderId: 'o1' }));
  });

  it('a reliability write failure does not throw', async () => {
    const t = setup();
    t.hasura.executeMutation.mockRejectedValue(new Error('unique'));
    await expect(t.service.recordReliability('a1', 'o1', 'no_show', { at: NOW.toISOString() })).resolves.toBeUndefined();
  });

  it('sweep starts round 1 only when the gate passed and nobody holds the order', async () => {
    const errors: string[] = [];
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation((msg: unknown) => {
      errors.push(String(msg));
    });
    const stuckOffer = {
      id: 'x',
      agent_id: 'a1',
      user_id: 'u1',
      status: 'offered',
      phase: 'early',
      expires_at: '2026-11-10T07:20:00.000Z',
      reminder_sent_at: null,
    };
    const now = new Date('2026-11-10T07:36:00.000Z');
    const open = setup();
    open.hasura.executeQuery.mockImplementation(async (q: string) => (q.includes('DesignatedSweep') ? { orders: [{ id: 'o1' }] } : {}));
    jest.spyOn(open.service, 'load').mockResolvedValue({
      order: order({ dispatch_mode: 'designated_first' }),
      offers: [stuckOffer as any],
    });
    await open.service.sweep(now);
    expect(open.offersSvc.runDispatchRound).toHaveBeenCalledWith('o1', 1);
    expect(errors.some((line) => line.includes('dedicated.early_offer_stuck'))).toBe(true);

    const held = setup();
    held.hasura.executeQuery.mockImplementation(async (q: string) => (q.includes('DesignatedSweep') ? { orders: [{ id: 'o1' }] } : {}));
    jest.spyOn(held.service, 'load').mockResolvedValue({
      order: order({
        dispatch_mode: 'designated_first',
        current_status: 'assigned_to_agent',
        assigned_agent_id: 'a1',
        designated_accepted_at: NOW.toISOString(),
        designated_confirmed_at: NOW.toISOString(),
      }),
      offers: [],
    });
    await held.service.sweep(now);
    expect(held.offersSvc.runDispatchRound).not.toHaveBeenCalled();
  });
});
