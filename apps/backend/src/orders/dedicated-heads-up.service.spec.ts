import { buildDedicatedHeadsUpMessage } from '../notifications/dedicated-order-push.messages';
import { DedicatedHeadsUpService, HEADS_UP_REPING_LEAD_MINUTES } from './dedicated-heads-up.service';

const NOW = new Date('2026-10-30T09:00:00Z');
const GATE = new Date('2026-10-30T11:00:00Z');
const SLOT = { slotKey: 'afternoon', date: '2026-10-30', startTime: '12:00', endTime: '17:00', timeZone: 'Africa/Libreville' };

type Row = { agent_id: string; user_id: string | null; status: 'sent' | 'unavailable'; reping_sent_at: string | null };

function setup(
  overrides: {
    order?: Record<string, unknown>;
    rows?: Row[];
    eligible?: string[];
    flag?: boolean;
    /** Coverage returns these agents with no user id, so they must not be notified. */
    userless?: string[];
    noSlot?: boolean;
    /** Insert claim returns nobody (lost the race). */
    claimEmpty?: boolean;
    /** Re-ping claim returns nobody. */
    repingClaimEmpty?: boolean;
    /** Throw when the GraphQL operation name includes this string. */
    failQuery?: string;
    noticeReject?: boolean;
    scheduleReject?: boolean;
    /** Override the agent-scoped heads-up row. null = no row. */
    agentHeadsUp?: {
      agent_id: string;
      status: 'sent' | 'unavailable';
      order: {
        current_status: string;
        assigned_agent_id: string | null;
        dispatch_ready_at: string | null;
      } | null;
    } | null;
  } = {}
) {
  const rows: Row[] = overrides.rows ?? [];
  const order = {
    id: 'o1',
    order_number: 'ORD-1',
    business_id: 'b1',
    business_location_id: 'loc',
    current_status: 'ready_for_pickup',
    assigned_agent_id: null,
    fulfillment_method: 'delivery',
    fulfillment_timing: 'scheduled',
    subtotal: 1000,
    currency: 'XAF',
    verified_agent_delivery: false,
    coverage_slot_key: 'afternoon',
    dispatch_ready_at: GATE.toISOString(),
    business: { name: 'Biz' },
    business_location: { name: 'Chez Mama', address: { country: 'GA' } },
    delivery_time_windows: [{ slot_id: 's1', preferred_date: '2026-10-30', is_confirmed: true }],
    ...overrides.order,
  };
  const agentRow = { agent_id: 'a1', status: 'sent' as 'sent' | 'unavailable', order: { current_status: 'ready_for_pickup', assigned_agent_id: null, dispatch_ready_at: GATE.toISOString() } };
  const hasura = {
    executeQuery: jest.fn(async (q: string) => {
      if (overrides.failQuery && q.includes(overrides.failQuery)) throw new Error('hasura down');
      if (q.includes('DedicatedHeadsUpOrder')) return { orders_by_pk: order, dedicated_order_heads_ups: rows };
      if (q.includes('AgentDedicatedHeadsUp')) {
        if (overrides.agentHeadsUp === null) return { dedicated_order_heads_ups: [] };
        if (overrides.agentHeadsUp) return { dedicated_order_heads_ups: [overrides.agentHeadsUp] };
        return { dedicated_order_heads_ups: rows.length ? [agentRow] : [] };
      }
      if (q.includes('DedicatedHeadsUpLocales')) return { users: [{ id: 'u2', preferred_language: 'fr' }] };
      return {};
    }),
    executeMutation: jest.fn(async (q: string, vars: any) => {
      if (q.includes('ClaimDedicatedHeadsUps')) {
        if (overrides.claimEmpty) return { insert_dedicated_order_heads_ups: { returning: [] } };
        const fresh = vars.objects.filter((o: any) => !rows.some((r) => r.agent_id === o.agent_id));
        for (const o of fresh) rows.push({ agent_id: o.agent_id, user_id: o.user_id, status: 'sent', reping_sent_at: null });
        return { insert_dedicated_order_heads_ups: { returning: fresh.map((o: any) => ({ agent_id: o.agent_id })) } };
      }
      if (q.includes('ClaimDedicatedHeadsUpReping')) {
        if (overrides.repingClaimEmpty) return { update_dedicated_order_heads_ups: { returning: [] } };
        const hit = rows.filter((r) => vars.agentIds.includes(r.agent_id) && r.status === 'sent' && !r.reping_sent_at);
        hit.forEach((r) => (r.reping_sent_at = vars.now));
        return { update_dedicated_order_heads_ups: { returning: hit.map((r) => ({ agent_id: r.agent_id })) } };
      }
      return { update_dedicated_order_heads_ups: { returning: [] } };
    }),
  };
  const eligible = (overrides.eligible ?? ['a1', 'a2']).map((id) => ({
    agentId: id,
    userId: overrides.userless?.includes(id) ? null : id.replace('a', 'u'),
    assignmentId: `as-${id}`,
    isInternal: false,
    activeOrders: 0,
  }));
  const coverage = {
    resolveSlot: jest.fn(async () => (overrides.noSlot ? null : SLOT)),
    evaluate: jest.fn(async () => ({ eligible, rejected: [] })),
  };
  const config = { isEnabled: jest.fn(async () => overrides.flag ?? true) };
  const payment = { resolveRailForBusiness: jest.fn(async () => 'mobile_money') };
  const notifications = {
    sendDedicatedOrderNotice: jest.fn(async () => {
      if (overrides.noticeReject) throw new Error('push down');
    }),
  };
  const wait = {
    scheduleDedicatedHeadsUpReping: jest.fn(async () => {
      if (overrides.scheduleReject) throw new Error('sfn down');
    }),
  };
  const service = new DedicatedHeadsUpService(
    hasura as any, config as any, coverage as any, payment as any, notifications as any, wait as any
  );
  return { service, hasura, coverage, notifications, wait, rows };
}

describe('DedicatedHeadsUpService.sendForOrder', () => {
  it('pushes one soft heads-up per eligible agent and schedules the re-ping', async () => {
    const t = setup();
    const out = await t.service.sendForOrder('o1', NOW);
    expect(out).toEqual({ kind: 'sent', agentIds: ['a1', 'a2'] });
    expect(t.notifications.sendDedicatedOrderNotice).toHaveBeenCalledTimes(2);
    const fr = t.notifications.sendDedicatedOrderNotice.mock.calls.map((c: any) => c[0]).find((p: any) => p.userId === 'u2');
    expect(fr.messageType).toBe('DEDICATED_ORDER_HEADS_UP');
    expect(fr.event).toBe('dedicated.heads_up');
    expect(fr.title).toBe('Livraison possible plus tard');
    const wait = (GATE.getTime() - HEADS_UP_REPING_LEAD_MINUTES * 60_000 - NOW.getTime()) / 1000;
    expect(t.wait.scheduleDedicatedHeadsUpReping).toHaveBeenCalledWith('o1', wait);
  });

  it('never pushes twice for the same order and agent', async () => {
    const t = setup();
    await t.service.sendForOrder('o1', NOW);
    const again = await t.service.sendForOrder('o1', NOW);
    expect(again).toEqual({ kind: 'skipped', reason: 'already_sent' });
    expect(t.notifications.sendDedicatedOrderNotice).toHaveBeenCalledTimes(2);
  });

  it('skips paused / off / at-capacity agents (left out by the coverage check)', async () => {
    const t = setup({ eligible: [] });
    expect(await t.service.sendForOrder('o1', NOW)).toEqual({ kind: 'skipped', reason: 'no_agents' });
    expect(t.notifications.sendDedicatedOrderNotice).not.toHaveBeenCalled();
  });

  it.each([
    ['gate_open', { dispatch_ready_at: NOW.toISOString() }],
    ['gate_open', { dispatch_ready_at: null }],
    ['not_covered', { coverage_slot_key: null }],
    ['not_covered', { delivery_time_windows: [{ slot_id: 's1', preferred_date: '2026-10-30', is_confirmed: false }] }],
    ['not_dispatchable', { assigned_agent_id: 'a9' }],
    ['not_dispatchable', { current_status: 'preparing' }],
  ])('skips with %s', async (reason, order) => {
    const t = setup({ order });
    expect(await t.service.sendForOrder('o1', NOW)).toEqual({ kind: 'skipped', reason });
    expect(t.notifications.sendDedicatedOrderNotice).not.toHaveBeenCalled();
  });

  it('skips when the flag is off', async () => {
    const t = setup({ flag: false });
    expect(await t.service.sendForOrder('o1', NOW)).toEqual({ kind: 'skipped', reason: 'flag_off' });
  });

  it('does not schedule a re-ping when the gate is too close', async () => {
    const t = setup({ order: { dispatch_ready_at: new Date(NOW.getTime() + 15 * 60_000).toISOString() } });
    await t.service.sendForOrder('o1', NOW);
    expect(t.wait.scheduleDedicatedHeadsUpReping).not.toHaveBeenCalled();
  });

  it('schedules the re-ping at a 5 minute gap and skips one second under', async () => {
    const leadSeconds = HEADS_UP_REPING_LEAD_MINUTES * 60;
    const gapSeconds = 5 * 60;
    const exact = setup({
      order: { dispatch_ready_at: new Date(NOW.getTime() + (leadSeconds + gapSeconds) * 1000).toISOString() },
    });
    await exact.service.sendForOrder('o1', NOW);
    expect(exact.wait.scheduleDedicatedHeadsUpReping).toHaveBeenCalledWith('o1', gapSeconds);

    const under = setup({
      order: { dispatch_ready_at: new Date(NOW.getTime() + (leadSeconds + gapSeconds - 1) * 1000).toISOString() },
    });
    await under.service.sendForOrder('o1', NOW);
    expect(under.wait.scheduleDedicatedHeadsUpReping).not.toHaveBeenCalled();
  });

  it.each([
    ['not_dispatchable', { fulfillment_method: 'pickup' }],
    ['not_covered', { fulfillment_timing: 'asap' }],
    ['not_covered', { delivery_time_windows: [] }],
  ])('skips with %s and does not ask coverage', async (reason, order) => {
    const t = setup({ order });
    expect(await t.service.sendForOrder('o1', NOW)).toEqual({ kind: 'skipped', reason });
    expect(t.notifications.sendDedicatedOrderNotice).not.toHaveBeenCalled();
    expect(t.coverage.evaluate).not.toHaveBeenCalled();
  });

  it('skips when the slot cannot be resolved', async () => {
    const t = setup({ noSlot: true });
    expect(await t.service.sendForOrder('o1', NOW)).toEqual({ kind: 'skipped', reason: 'no_slot' });
    expect(t.coverage.evaluate).not.toHaveBeenCalled();
  });

  it('does not notify an agent who has no user id', async () => {
    const t = setup({ eligible: ['a1', 'a2'], userless: ['a1'] });
    expect(await t.service.sendForOrder('o1', NOW)).toEqual({ kind: 'sent', agentIds: ['a2'] });
    expect(t.notifications.sendDedicatedOrderNotice).toHaveBeenCalledTimes(1);
    expect(t.notifications.sendDedicatedOrderNotice.mock.calls[0][0].userId).toBe('u2');
  });

  it('pushes only agents who were not already sent a heads-up', async () => {
    const t = setup({
      rows: [{ agent_id: 'a1', user_id: 'u1', status: 'sent', reping_sent_at: null }],
    });
    expect(await t.service.sendForOrder('o1', NOW)).toEqual({ kind: 'sent', agentIds: ['a2'] });
    expect(t.notifications.sendDedicatedOrderNotice).toHaveBeenCalledTimes(1);
  });

  it('does not push when the claim loses the race', async () => {
    const t = setup({ claimEmpty: true });
    expect(await t.service.sendForOrder('o1', NOW)).toEqual({ kind: 'skipped', reason: 'already_sent' });
    expect(t.notifications.sendDedicatedOrderNotice).not.toHaveBeenCalled();
    expect(t.wait.scheduleDedicatedHeadsUpReping).not.toHaveBeenCalled();
  });

  it('still schedules the re-ping when one push fails', async () => {
    const t = setup({ noticeReject: true });
    expect(await t.service.sendForOrder('o1', NOW)).toEqual({ kind: 'sent', agentIds: ['a1', 'a2'] });
    expect(t.wait.scheduleDedicatedHeadsUpReping).toHaveBeenCalled();
  });

  it('still returns sent when the re-ping schedule fails', async () => {
    const t = setup({ scheduleReject: true });
    expect(await t.service.sendForOrder('o1', NOW)).toEqual({ kind: 'sent', agentIds: ['a1', 'a2'] });
    expect(t.notifications.sendDedicatedOrderNotice).toHaveBeenCalledTimes(2);
  });

  it('swallows a read failure instead of failing ready-for-pickup', async () => {
    const t = setup({ failQuery: 'DedicatedHeadsUpOrder' });
    await expect(t.service.sendForOrder('o1', NOW)).resolves.toEqual({ kind: 'skipped', reason: 'not_found' });
    expect(t.notifications.sendDedicatedOrderNotice).not.toHaveBeenCalled();
  });

  it('passes a numeric subtotal and only an explicit verified-agent flag', async () => {
    const numeric = setup({ order: { subtotal: '2500', verified_agent_delivery: true } });
    await numeric.service.sendForOrder('o1', NOW);
    expect(numeric.coverage.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 2500, verifiedAgentDelivery: true })
    );

    const blank = setup({ order: { subtotal: 'nope', verified_agent_delivery: 'true' } });
    await blank.service.sendForOrder('o1', NOW);
    expect(blank.coverage.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 0, verifiedAgentDelivery: false })
    );
  });
});

describe('DedicatedHeadsUpService.repingForOrder', () => {
  const AT = new Date(GATE.getTime() - HEADS_UP_REPING_LEAD_MINUTES * 60_000);

  it('re-pings once, only agents who have not answered and are still eligible', async () => {
    const t = setup({
      eligible: ['a1', 'a2'],
      rows: [
        { agent_id: 'a1', user_id: 'u1', status: 'sent', reping_sent_at: null },
        { agent_id: 'a2', user_id: 'u2', status: 'unavailable', reping_sent_at: null },
      ],
    });
    expect(await t.service.repingForOrder('o1', AT)).toEqual({ kind: 'sent', agentIds: ['a1'] });
    expect((t.notifications.sendDedicatedOrderNotice.mock.calls[0] as any)[0].event).toBe('dedicated.heads_up_reping');
    expect(await t.service.repingForOrder('o1', AT)).toEqual({ kind: 'skipped', reason: 'no_agents' });
    expect(t.notifications.sendDedicatedOrderNotice).toHaveBeenCalledTimes(1);
  });

  it('is stale when it fires early', async () => {
    const t = setup({ rows: [{ agent_id: 'a1', user_id: 'u1', status: 'sent', reping_sent_at: null }] });
    expect(await t.service.repingForOrder('o1', NOW)).toEqual({ kind: 'skipped', reason: 'stale' });
  });

  it('skips once dispatch opened or the order was taken', async () => {
    const t = setup({ order: { assigned_agent_id: 'a1' }, rows: [{ agent_id: 'a1', user_id: 'u1', status: 'sent', reping_sent_at: null }] });
    expect(await t.service.repingForOrder('o1', AT)).toEqual({ kind: 'skipped', reason: 'not_dispatchable' });
  });

  it('accepts a callback inside the 120s slack and rejects one second earlier', async () => {
    const row: Row = { agent_id: 'a1', user_id: 'u1', status: 'sent', reping_sent_at: null };
    const inside = setup({ eligible: ['a1'], rows: [{ ...row }] });
    expect(await inside.service.repingForOrder('o1', new Date(AT.getTime() - 120_000))).toEqual({
      kind: 'sent',
      agentIds: ['a1'],
    });
    const early = setup({ eligible: ['a1'], rows: [{ ...row }] });
    expect(await early.service.repingForOrder('o1', new Date(AT.getTime() - 121_000))).toEqual({
      kind: 'skipped',
      reason: 'stale',
    });
    expect(early.notifications.sendDedicatedOrderNotice).not.toHaveBeenCalled();
  });

  it('does not re-ping an agent who is no longer eligible', async () => {
    const t = setup({
      eligible: [],
      rows: [{ agent_id: 'a1', user_id: 'u1', status: 'sent', reping_sent_at: null }],
    });
    expect(await t.service.repingForOrder('o1', AT)).toEqual({ kind: 'skipped', reason: 'no_agents' });
    expect(t.notifications.sendDedicatedOrderNotice).not.toHaveBeenCalled();
  });

  it('does not push when the re-ping claim loses the race', async () => {
    const t = setup({
      repingClaimEmpty: true,
      eligible: ['a1'],
      rows: [{ agent_id: 'a1', user_id: 'u1', status: 'sent', reping_sent_at: null }],
    });
    expect(await t.service.repingForOrder('o1', AT)).toEqual({ kind: 'skipped', reason: 'already_sent' });
    expect(t.notifications.sendDedicatedOrderNotice).not.toHaveBeenCalled();
  });

  it('swallows a read failure', async () => {
    const t = setup({
      failQuery: 'DedicatedHeadsUpOrder',
      rows: [{ agent_id: 'a1', user_id: 'u1', status: 'sent', reping_sent_at: null }],
    });
    await expect(t.service.repingForOrder('o1', AT)).resolves.toEqual({ kind: 'skipped', reason: 'not_found' });
  });
});

describe('DedicatedHeadsUpService.markUnavailable', () => {
  it("marks the agent's heads-up unavailable", async () => {
    const t = setup({ rows: [{ agent_id: 'a1', user_id: 'u1', status: 'sent', reping_sent_at: null }] });
    expect(await t.service.markUnavailable('u1', 'o1', NOW)).toEqual({ status: 'unavailable' });
    expect(t.hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('MarkDedicatedHeadsUpUnavailable'),
      { orderId: 'o1', agentId: 'a1', now: NOW.toISOString() }
    );
  });

  it('404s without a heads-up', async () => {
    const t = setup();
    await expect(t.service.markUnavailable('u1', 'o1', NOW)).rejects.toMatchObject({
      status: 404,
      response: { error: 'HEADS_UP_NOT_FOUND' },
    });
    expect(t.hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('is idempotent when the agent already said they cannot take it', async () => {
    const t = setup({
      agentHeadsUp: {
        agent_id: 'a1',
        status: 'unavailable',
        order: { current_status: 'ready_for_pickup', assigned_agent_id: null, dispatch_ready_at: GATE.toISOString() },
      },
    });
    expect(await t.service.markUnavailable('u1', 'o1', NOW)).toEqual({ status: 'unavailable' });
    expect(t.hasura.executeMutation).not.toHaveBeenCalled();
  });

  it.each([
    ['assigned', { current_status: 'ready_for_pickup', assigned_agent_id: 'a9', dispatch_ready_at: GATE.toISOString() }],
    ['picked up', { current_status: 'picked_up', assigned_agent_id: null, dispatch_ready_at: GATE.toISOString() }],
  ])('409s when the order is %s', async (_label, order) => {
    const t = setup({ agentHeadsUp: { agent_id: 'a1', status: 'sent', order } });
    await expect(t.service.markUnavailable('u1', 'o1', NOW)).rejects.toMatchObject({
      status: 409,
      response: { error: 'HEADS_UP_CLOSED' },
    });
    expect(t.hasura.executeMutation).not.toHaveBeenCalled();
  });
});

describe('DedicatedHeadsUpService.getForAgent', () => {
  const openOrder = {
    current_status: 'ready_for_pickup',
    assigned_agent_id: null,
    dispatch_ready_at: GATE.toISOString(),
  };

  it('returns null when this agent never got a heads-up', async () => {
    const t = setup();
    expect(await t.service.getForAgent('u1', 'o1')).toBeNull();
  });

  it('stays active only while the order is ready and unassigned', async () => {
    const open = setup({ agentHeadsUp: { agent_id: 'a1', status: 'sent', order: openOrder } });
    expect(await open.service.getForAgent('u1', 'o1')).toEqual({
      status: 'sent',
      dispatchReadyAt: GATE.toISOString(),
      active: true,
    });

    const taken = setup({
      agentHeadsUp: {
        agent_id: 'a1',
        status: 'sent',
        order: { ...openOrder, assigned_agent_id: 'a9' },
      },
    });
    expect(await taken.service.getForAgent('u1', 'o1')).toEqual({
      status: 'sent',
      dispatchReadyAt: GATE.toISOString(),
      active: false,
    });

    const gone = setup({
      agentHeadsUp: { agent_id: 'a1', status: 'unavailable', order: null },
    });
    expect(await gone.service.getForAgent('u1', 'o1')).toEqual({
      status: 'unavailable',
      dispatchReadyAt: null,
      active: false,
    });
  });
});

describe('buildDedicatedHeadsUpMessage', () => {
  it('has EN and FR copy, never phrased as an offer', () => {
    const en = buildDedicatedHeadsUpMessage({ orderNumber: 'ORD-1', storeName: 'S', slotKey: 'morning', preferredLanguage: 'en' });
    const fr = buildDedicatedHeadsUpMessage({ orderNumber: 'ORD-1', storeName: 'S', slotKey: 'morning', preferredLanguage: 'fr' });
    expect(en.title).toBe('You may get this delivery later');
    expect(en.body).toContain("can't take it");
    expect(fr.body).toContain('ne pouvez pas la prendre');
    const enReping = buildDedicatedHeadsUpMessage({ orderNumber: 'X', storeName: 'S', slotKey: 'morning', reping: true, preferredLanguage: 'en' });
    const frReping = buildDedicatedHeadsUpMessage({ orderNumber: 'X', storeName: 'S', slotKey: 'morning', reping: true, preferredLanguage: 'fr' });
    expect(enReping.title).toBe('Dedicated delivery soon');
    expect(enReping.body).toContain("can't take it");
    expect(enReping.body).not.toMatch(/\boffer\b/i);
    expect(frReping.title).toBe('Livraison dédiée bientôt');
    expect(frReping.body).toContain('ne pouvez pas la prendre');
    expect(frReping.body).not.toMatch(/offre/i);
  });
});
