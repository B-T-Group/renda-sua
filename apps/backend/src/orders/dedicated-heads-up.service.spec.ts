import { HttpException } from '@nestjs/common';
import { buildDedicatedHeadsUpMessage } from '../notifications/dedicated-order-push.messages';
import { DedicatedHeadsUpService, HEADS_UP_REPING_LEAD_MINUTES } from './dedicated-heads-up.service';

const NOW = new Date('2026-10-30T09:00:00Z');
const GATE = new Date('2026-10-30T11:00:00Z');
const SLOT = { slotKey: 'afternoon', date: '2026-10-30', startTime: '12:00', endTime: '17:00', timeZone: 'Africa/Libreville' };

type Row = { agent_id: string; user_id: string | null; status: 'sent' | 'unavailable'; reping_sent_at: string | null };

function setup(overrides: { order?: Record<string, unknown>; rows?: Row[]; eligible?: string[]; flag?: boolean } = {}) {
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
      if (q.includes('DedicatedHeadsUpOrder')) return { orders_by_pk: order, dedicated_order_heads_ups: rows };
      if (q.includes('AgentDedicatedHeadsUp')) return { dedicated_order_heads_ups: rows.length ? [agentRow] : [] };
      if (q.includes('DedicatedHeadsUpLocales')) return { users: [{ id: 'u2', preferred_language: 'fr' }] };
      return {};
    }),
    executeMutation: jest.fn(async (q: string, vars: any) => {
      if (q.includes('ClaimDedicatedHeadsUps')) {
        const fresh = vars.objects.filter((o: any) => !rows.some((r) => r.agent_id === o.agent_id));
        for (const o of fresh) rows.push({ agent_id: o.agent_id, user_id: o.user_id, status: 'sent', reping_sent_at: null });
        return { insert_dedicated_order_heads_ups: { returning: fresh.map((o: any) => ({ agent_id: o.agent_id })) } };
      }
      if (q.includes('ClaimDedicatedHeadsUpReping')) {
        const hit = rows.filter((r) => vars.agentIds.includes(r.agent_id) && r.status === 'sent' && !r.reping_sent_at);
        hit.forEach((r) => (r.reping_sent_at = vars.now));
        return { update_dedicated_order_heads_ups: { returning: hit.map((r) => ({ agent_id: r.agent_id })) } };
      }
      return { update_dedicated_order_heads_ups: { returning: [] } };
    }),
  };
  const eligible = (overrides.eligible ?? ['a1', 'a2']).map((id) => ({
    agentId: id, userId: id.replace('a', 'u'), assignmentId: `as-${id}`, isInternal: false, activeOrders: 0,
  }));
  const coverage = {
    resolveSlot: jest.fn(async () => SLOT),
    evaluate: jest.fn(async () => ({ eligible, rejected: [] })),
  };
  const config = { isEnabled: jest.fn(async () => overrides.flag ?? true) };
  const payment = { resolveRailForBusiness: jest.fn(async () => 'mobile_money') };
  const notifications = { sendDedicatedOrderNotice: jest.fn(async () => undefined) };
  const wait = { scheduleDedicatedHeadsUpReping: jest.fn(async () => undefined) };
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
    await expect(t.service.markUnavailable('u1', 'o1', NOW)).rejects.toBeInstanceOf(HttpException);
  });
});

describe('buildDedicatedHeadsUpMessage', () => {
  it('has EN and FR copy, never phrased as an offer', () => {
    const en = buildDedicatedHeadsUpMessage({ orderNumber: 'ORD-1', storeName: 'S', slotKey: 'morning', preferredLanguage: 'en' });
    const fr = buildDedicatedHeadsUpMessage({ orderNumber: 'ORD-1', storeName: 'S', slotKey: 'morning', preferredLanguage: 'fr' });
    expect(en.title).toBe('You may get this delivery later');
    expect(en.body).toContain("can't take it");
    expect(fr.body).toContain('ne pouvez pas la prendre');
    expect(buildDedicatedHeadsUpMessage({ orderNumber: 'X', storeName: 'S', slotKey: 'morning', reping: true, preferredLanguage: 'en' }).title).toBe('Dedicated delivery soon');
  });
});
