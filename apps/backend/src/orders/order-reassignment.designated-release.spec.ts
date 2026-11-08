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
  const orderEvents = {
    recordEvent: jest.fn(async () => undefined),
    recordEventStrict: jest.fn(async () => undefined),
  };
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
  return { service, s, mutations, notifications, designatedFirst, reassign, hasura, orderEvents };
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
    const unaccepted = build({ designated_accepted_at: null });
    expect(await unaccepted.service.releaseDesignated('o1', 'a1', null)).toMatchObject({ success: false, refusal: 'not_designated' });
    expect(unaccepted.mutations).toHaveLength(0);
    expect(unaccepted.reassign).not.toHaveBeenCalled();
  });

  it('treats the cutoff instant and a missing cutoff as a late strike', async () => {
    const atCutoff = build();
    const out = await atCutoff.service.releaseDesignated('o1', 'a1', null, new Date(CUTOFF));
    expect(out).toMatchObject({ success: true, mode: 'late' });
    expect(atCutoff.reassign).toHaveBeenCalledWith('o1', 'designated_late_release');
    expect(atCutoff.designatedFirst.offerAtReady).not.toHaveBeenCalled();

    const noCutoff = build({ designated_release_cutoff_at: null });
    const late = await noCutoff.service.releaseDesignated('o1', 'a1', null, new Date('2026-11-09T12:00:00Z'));
    expect(late).toMatchObject({ success: true, mode: 'late' });
    expect(noCutoff.designatedFirst.offerAtReady).not.toHaveBeenCalled();
  });

  it('a lost free-release compare-and-swap drops the exclusion and does not re-offer', async () => {
    const t = build();
    t.hasura.executeMutation.mockImplementation(async (q: string, v: any) => {
      t.mutations.push({ q, v });
      if (q.includes('ReleaseDesignatedFree')) return { update_orders: { affected_rows: 0 } };
      return { update_orders: { affected_rows: 1 } };
    });
    const out = await t.service.releaseDesignated('o1', 'a1', null, new Date('2026-11-09T12:00:00Z'));
    expect(out).toMatchObject({ success: false, refusal: 'window_closed' });
    expect(t.s.dropExclusion).toHaveBeenCalledWith('o1', 'a1', '2026-11-09T12:00:00.000Z');
    expect(t.designatedFirst.offerAtReady).not.toHaveBeenCalled();
    expect(t.designatedFirst.recordReliability).not.toHaveBeenCalled();
    expect(t.reassign).not.toHaveBeenCalled();
  });

  it('restores the assignment when the hold cannot be released', async () => {
    const restored = build();
    restored.hasura.executeMutation.mockImplementation(async (q: string, v: any) => {
      restored.mutations.push({ q, v });
      if (q.includes('RevertDedicatedRelease')) return { update_orders: { affected_rows: 1 }, restore: { affected_rows: 1 } };
      return { update_orders: { affected_rows: 1 } };
    });
    restored.s.releaseHoldDetailed.mockResolvedValue({ released: false, hold: { id: 'h1', agent_hold_amount: 200 } });
    const out = await restored.service.releaseDesignated('o1', 'a1', null, new Date('2026-11-09T12:00:00Z'));
    expect(out).toMatchObject({ success: false, refusal: 'release_failed' });
    expect(restored.s.dropExclusion).toHaveBeenCalled();
    expect(restored.mutations.some((m) => m.q.includes('RestoreDesignatedStamps'))).toBe(true);
    expect(restored.designatedFirst.offerAtReady).not.toHaveBeenCalled();
    expect(restored.orderEvents.recordEventStrict).not.toHaveBeenCalled();

    const stranded = build();
    stranded.s.releaseHoldDetailed.mockResolvedValue({ released: false, hold: { id: 'h1', agent_hold_amount: 200 } });
    const lost = await stranded.service.releaseDesignated('o1', 'a1', null, new Date('2026-11-09T12:00:00Z'));
    expect(lost).toMatchObject({ success: false, refusal: 'release_lost' });
    expect(stranded.orderEvents.recordEventStrict).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'o1',
        eventType: 'agent_hold_stranded',
        payload: expect.objectContaining({ amount: 200, path: 'dedicated_release', holdId: 'h1' }),
      })
    );
    expect(stranded.designatedFirst.offerAtReady).not.toHaveBeenCalled();
    expect(stranded.s.dropExclusion).not.toHaveBeenCalled();

    const noMoney = build();
    noMoney.s.releaseHoldDetailed.mockResolvedValue({ released: false, hold: null });
    expect(await noMoney.service.releaseDesignated('o1', 'a1', null, new Date('2026-11-09T12:00:00Z'))).toMatchObject({
      success: false,
      refusal: 'release_lost',
    });
    expect(noMoney.orderEvents.recordEventStrict).not.toHaveBeenCalled();
  });

  it('does not release the order when the exclusion row cannot be written', async () => {
    const t = build();
    t.hasura.executeMutation.mockImplementation(async (q: string) => {
      if (q.includes('RecordDedicatedRelease')) throw new Error('conflict');
      return { update_orders: { affected_rows: 1 } };
    });
    const out = await t.service.releaseDesignated('o1', 'a1', null, new Date('2026-11-09T12:00:00Z'));
    expect(out).toMatchObject({ success: false, refusal: 'release_failed' });
    expect(t.mutations.some((m) => m.q.includes('ReleaseDesignatedFree'))).toBe(false);
    expect(t.designatedFirst.offerAtReady).not.toHaveBeenCalled();
    expect(t.reassign).not.toHaveBeenCalled();
  });

  it('a failed late reassignment drops the exclusion and does not strike or notify', async () => {
    const t = build();
    t.reassign.mockResolvedValue({ success: false, message: 'busy' } as any);
    const out = await t.service.releaseDesignated('o1', 'a1', null, new Date('2026-11-10T06:30:00Z'));
    expect(out).toMatchObject({ success: false, refusal: 'release_failed' });
    expect(t.s.dropExclusion).toHaveBeenCalledWith('o1', 'a1', '2026-11-10T06:30:00.000Z');
    expect(t.designatedFirst.recordReliability).not.toHaveBeenCalled();
    expect(t.notifications.sendDedicatedOrderNotice).not.toHaveBeenCalled();
    expect(t.mutations.some((m) => m.q.includes('ClearDesignatedStamps'))).toBe(false);
  });

  it('refuses when the agent user or the release row is missing, before any write', async () => {
    const missingUser = build();
    missingUser.s.fetchDedicatedReleaseOrder.mockResolvedValue({
      id: 'o1',
      order_number: 'ORD-1',
      current_status: 'assigned_to_agent',
      assigned_agent_id: 'a1',
      currency: 'XAF',
      assignment_source: 'dedicated_offer',
      assigned_agent: { user_id: null },
    });
    expect(await missingUser.service.releaseDesignated('o1', 'a1', null)).toMatchObject({ success: false, refusal: 'release_failed' });
    expect(missingUser.mutations).toHaveLength(0);

    const gone = build();
    gone.hasura.executeQuery.mockResolvedValue({ orders_by_pk: null });
    expect(await gone.service.releaseDesignated('o1', 'a1', null)).toMatchObject({ success: false, refusal: 'unavailable' });
    expect(gone.mutations).toHaveLength(0);
    expect(gone.reassign).not.toHaveBeenCalled();
  });
});

describe('OrderReassignmentService.releaseDedicatedAutoAssignment designated-first', () => {
  function autoAssigned(over: Record<string, unknown> = {}) {
    const t = build();
    t.s.fetchDedicatedReleaseOrder.mockResolvedValue({
      id: 'o1',
      order_number: 'ORD-1',
      current_status: 'assigned_to_agent',
      assigned_agent_id: 'a1',
      currency: 'XAF',
      assignment_source: 'dedicated_auto',
      dedicated_release_until: CUTOFF,
      dispatch_mode: 'designated_first',
      assigned_agent: { user_id: 'u1' },
      ...over,
    });
    return t;
  }

  it('hands a designated-first auto-assign to designated release so the gate stays and stamps are not inherited', async () => {
    const t = autoAssigned();
    const designated = jest.spyOn(t.service, 'releaseDesignated');
    const out = await t.service.releaseDedicatedAutoAssignment(
      'o1',
      'a1',
      null,
      new Date('2026-11-09T12:00:00Z')
    );
    expect(out).toMatchObject({ success: true, mode: 'free' });
    expect(designated).toHaveBeenCalledWith('o1', 'a1', null, expect.any(Date));
    expect(t.s.redispatch).not.toHaveBeenCalled();
    expect(t.mutations.find((m) => m.q.includes('ReleaseDedicatedAutoAssignment'))).toBeUndefined();
    expect(t.mutations.find((m) => m.q.includes('ReleaseDesignatedFree'))).toBeDefined();
  });

  it('after the designated cutoff: late designated release, not the 120 s window_closed refusal', async () => {
    const t = autoAssigned();
    const out = await t.service.releaseDedicatedAutoAssignment(
      'o1',
      'a1',
      'busy' as any,
      new Date('2026-11-10T06:30:00Z')
    );
    expect(out).toMatchObject({ success: true, mode: 'late' });
    expect(t.reassign).toHaveBeenCalledWith('o1', 'designated_late_release');
    expect(t.mutations.find((m) => m.q.includes('ReleaseDedicatedAutoAssignment'))).toBeUndefined();
  });

  it('non-designated auto-assign still uses the 120 s dedicated-auto path', async () => {
    const t = autoAssigned({ dispatch_mode: null });
    t.s.clearLeftoverDesignatedStamps = jest.fn(async () => undefined);
    const designated = jest.spyOn(t.service, 'releaseDesignated');
    const out = await t.service.releaseDedicatedAutoAssignment(
      'o1',
      'a1',
      'busy' as any,
      new Date('2026-11-09T12:00:00Z')
    );
    expect(out).toMatchObject({ success: true });
    expect(designated).not.toHaveBeenCalled();
    expect(t.mutations.find((m) => m.q.includes('ReleaseDedicatedAutoAssignment'))).toBeDefined();
    expect(t.s.redispatch).toHaveBeenCalledWith('o1');
    expect(t.s.clearLeftoverDesignatedStamps).toHaveBeenCalledWith('o1');
  });
});

describe('OrderReassignmentService.afterDroppedDesignatedAssignment', () => {
  function leftover(over: Record<string, unknown> = {}) {
    const t = build();
    t.hasura.executeQuery.mockResolvedValue({
      orders_by_pk: {
        dispatch_mode: 'designated_first',
        assignment_source: 'dedicated_offer',
        designated_accepted_at: '2026-11-08T09:00:00Z',
        ...over,
      },
    });
    return t;
  }

  it('declines the leftover dedicated row and clears stamps so Take cannot reclaim', async () => {
    const t = leftover();
    await t.service.afterDroppedDesignatedAssignment('o1', 'a1', 'u1');
    const exclusion = t.mutations.find((m) => m.q.includes('RecordDedicatedRelease'));
    expect(exclusion?.v.object).toMatchObject({
      order_id: 'o1',
      agent_id: 'a1',
      user_id: 'u1',
      status: 'declined',
      offer_kind: 'dedicated',
    });
    expect(t.mutations.some((m) => m.q.includes('ClearDesignatedStamps'))).toBe(true);
  });

  it('skips a marketplace drop that was never designated or dedicated', async () => {
    const t = leftover({
      dispatch_mode: null,
      assignment_source: 'open_claim',
      designated_accepted_at: null,
    });
    await t.service.afterDroppedDesignatedAssignment('o1', 'a1', 'u1');
    expect(t.mutations.some((m) => m.q.includes('RecordDedicatedRelease'))).toBe(false);
    expect(t.mutations.some((m) => m.q.includes('ClearDesignatedStamps'))).toBe(false);
  });

  it('does not query or write when the dropped agent id is missing', async () => {
    const t = leftover();
    t.hasura.executeQuery.mockClear();
    await t.service.afterDroppedDesignatedAssignment('o1', null, 'u1');
    await t.service.afterDroppedDesignatedAssignment('o1', '', 'u1');
    expect(t.hasura.executeQuery).not.toHaveBeenCalled();
    expect(t.mutations).toHaveLength(0);
  });

  it('still clears stamps when the agent user id is missing, without a declined row', async () => {
    const t = leftover();
    await t.service.afterDroppedDesignatedAssignment('o1', 'a1', null);
    await t.service.afterDroppedDesignatedAssignment('o1', 'a1', '');
    expect(t.mutations.some((m) => m.q.includes('RecordDedicatedRelease'))).toBe(false);
    expect(t.mutations.filter((m) => m.q.includes('ClearDesignatedStamps'))).toHaveLength(2);
  });

  it('still clears stamps when the declined-offer write fails', async () => {
    const t = leftover();
    t.hasura.executeMutation.mockImplementation(async (q: string, v: any) => {
      t.mutations.push({ q, v });
      if (q.includes('RecordDedicatedRelease')) throw new Error('unique violation');
      return { update_orders: { affected_rows: 1 } };
    });
    const warn = jest.spyOn((t.service as any).logger, 'warn').mockImplementation(() => undefined);

    await t.service.afterDroppedDesignatedAssignment('o1', 'a1', 'u1');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Dropped-agent dedicated exclusion not recorded for o1: unique violation')
    );
    expect(t.mutations.some((m) => m.q.includes('ClearDesignatedStamps'))).toBe(true);
    warn.mockRestore();
  });

  it('writes nothing when the leftover lookup fails or the order is gone', async () => {
    const thrown = leftover();
    thrown.hasura.executeQuery.mockRejectedValue(new Error('hasura down'));
    await thrown.service.afterDroppedDesignatedAssignment('o1', 'a1', 'u1');
    expect(thrown.mutations).toHaveLength(0);

    const gone = leftover();
    gone.hasura.executeQuery.mockResolvedValue({ orders_by_pk: null });
    await gone.service.afterDroppedDesignatedAssignment('o1', 'a1', 'u1');
    expect(gone.mutations).toHaveLength(0);
  });

  it.each([
    ['dedicated_auto', { dispatch_mode: null, assignment_source: 'dedicated_auto', designated_accepted_at: null }],
    ['accepted stamp only', { dispatch_mode: null, assignment_source: 'open_claim', designated_accepted_at: '2026-11-08T09:00:00Z' }],
  ])('still excludes a %s drop so Take cannot refresh the accepted row', async (_label, over) => {
    const t = leftover(over);
    await t.service.afterDroppedDesignatedAssignment('o1', 'a1', 'u1');
    expect(t.mutations.find((m) => m.q.includes('RecordDedicatedRelease'))?.v.object).toMatchObject({
      status: 'declined',
      offer_kind: 'dedicated',
      decline_reason: 'other',
      agent_id: 'a1',
      user_id: 'u1',
    });
    expect(t.mutations.some((m) => m.q.includes('ClearDesignatedStamps'))).toBe(true);
  });
});
