import { OrderReassignmentService } from './order-reassignment.service';

const CUTOFF = '2026-11-10T06:00:00.000Z';
const GATE = '2026-11-10T07:30:00.000Z';

function build(extra: Record<string, unknown> = {}) {
  const mutations: Array<{ q: string; v: any }> = [];
  const hasura = {
    executeQuery: jest.fn(async () => ({
      orders_by_pk: {
        dispatch_mode: 'designated_first',
        dispatch_ready_at: GATE,
        designated_release_cutoff_at: CUTOFF,
        designated_accepted_at: '2026-11-08T09:00:00Z',
        business: { user_id: 'bu1', user: { preferred_language: 'fr' } },
        ...extra,
      },
    })),
    executeMutation: jest.fn(async (q: string, v: any) => {
      mutations.push({ q, v });
      return { update_orders: { affected_rows: 1 } };
    }),
  };
  const orderEvents = { recordEvent: jest.fn(async () => undefined) };
  const notifications = { sendDedicatedOrderNotice: jest.fn(async () => undefined) };
  const designatedFirst = { offerAtReady: jest.fn(async () => ({ kind: 'offered' })), recordReliability: jest.fn(async () => undefined) };
  const service = new OrderReassignmentService(
    hasura as any,
    orderEvents as any,
    notifications as any,
    {} as any,
    {} as any,
    undefined,
    undefined,
    designatedFirst as any
  );
  const s = service as any;
  s.fetchDedicatedReleaseOrder = jest.fn(async () => ({
    id: 'o1',
    order_number: 'ORD-1',
    current_status: 'assigned_to_agent',
    assigned_agent_id: 'a1',
    currency: 'XAF',
    assignment_source: 'dedicated_offer',
    assigned_agent: { user_id: 'u1' },
  }));
  s.releaseHoldDetailed = jest.fn(async () => ({ released: true, hold: null }));
  s.insertAgentHistory = jest.fn(async () => undefined);
  s.dropExclusion = jest.fn(async () => undefined);
  s.redispatch = jest.fn(async () => undefined);
  const reassign = jest.spyOn(service, 'reassignOrder').mockResolvedValue({ success: true, message: 'ok' } as any);
  return { service, s, mutations, notifications, designatedFirst, reassign };
}

describe('OrderReassignmentService.releaseDesignated', () => {
  it('before the 2 h cutoff: free, no strike, gate kept, re-offered to the other designated agents', async () => {
    const t = build();
    const out = await t.service.releaseDesignated('o1', 'a1', null, new Date('2026-11-09T12:00:00Z'));
    expect(out).toMatchObject({ success: true, mode: 'free' });
    const cas = t.mutations.find((m) => m.q.includes('ReleaseDesignatedFree'));
    expect(cas?.q).not.toContain('dispatch_ready_at');
    expect(t.reassign).not.toHaveBeenCalled();
    expect(t.designatedFirst.recordReliability).not.toHaveBeenCalled();
    expect(t.designatedFirst.offerAtReady).toHaveBeenCalledWith('o1', expect.any(Date));
    expect(t.s.redispatch).not.toHaveBeenCalled();
  });

  it('free release after the gate passed goes straight to round 1', async () => {
    const t = build({ designated_release_cutoff_at: '2026-11-10T09:00:00Z', dispatch_ready_at: '2026-11-10T07:00:00Z' });
    await t.service.releaseDesignated('o1', 'a1', null, new Date('2026-11-10T07:10:00Z'));
    expect(t.s.redispatch).toHaveBeenCalledWith('o1');
  });

  it('after the cutoff: late release = strike (standard reassignment) + reliability event + business notice, no money', async () => {
    const t = build();
    const out = await t.service.releaseDesignated('o1', 'a1', 'emergency' as any, new Date('2026-11-10T06:30:00Z'));
    expect(out).toMatchObject({ success: true, mode: 'late' });
    expect(t.reassign).toHaveBeenCalledWith('o1', 'designated_late_release');
    expect(t.designatedFirst.recordReliability).toHaveBeenCalledWith('a1', 'o1', 'late_release', expect.any(Object));
    expect(t.notifications.sendDedicatedOrderNotice).toHaveBeenCalledWith(expect.objectContaining({ userId: 'bu1', persona: 'business' }));
    expect(t.mutations.some((m) => m.q.includes('ClearDesignatedStamps'))).toBe(true);
  });

  it('refuses another agent or a non-designated order', async () => {
    const t = build();
    expect(await t.service.releaseDesignated('o1', 'other', null)).toMatchObject({ success: false, refusal: 'not_assigned' });
    const n = build({ dispatch_mode: null });
    expect(await n.service.releaseDesignated('o1', 'a1', null)).toMatchObject({ success: false, refusal: 'not_designated' });
  });
});
