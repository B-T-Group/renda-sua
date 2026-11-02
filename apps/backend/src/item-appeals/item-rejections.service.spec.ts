import { HttpException } from '@nestjs/common';
import { ItemRejectionsService } from './item-rejections.service';

function svc(gateItem: unknown) {
  const hasura = {
    executeQuery: jest.fn().mockResolvedValue({ items_by_pk: gateItem }),
    executeMutation: jest.fn().mockResolvedValue({}),
  };
  const siteEvents = { trackEvent: jest.fn().mockResolvedValue(undefined) };
  return { s: new ItemRejectionsService(hasura as any, siteEvents as any), hasura, siteEvents };
}
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return ((e as HttpException).getResponse() as any).code;
  }
  return 'NO_THROW';
};
const rejected = (category: string, pending = false) => ({
  id: 'i1',
  moderation_status: 'rejected',
  rejection_category: category,
  current_rejection: { id: 'r1', category, created_at: '2026-11-01T00:00:00Z' },
  appeals: pending ? [{ id: 'a1', status: 'pending' }] : [],
});

describe('ItemRejectionsService resubmit gate', () => {
  it('resubmits a fixable rejection with no appeal', async () => {
    const { s } = svc(rejected('photo_quality'));
    await expect(s.assertResubmitAllowed('i1', {})).resolves.toMatchObject({ resubmit: true, withdrawsAppealId: null });
  });

  it('a pending appeal needs confirmation, then is reported as withdrawn', async () => {
    const { s } = svc(rejected('pricing', true));
    expect(await codeOf(s.assertResubmitAllowed('i1', {}))).toBe('ITEM_APPEAL_WITHDRAW_CONFIRM_REQUIRED');
    await expect(s.assertResubmitAllowed('i1', { confirmWithdrawAppeal: true })).resolves.toMatchObject({
      resubmit: true,
      withdrawsAppealId: 'a1',
    });
  });

  it('prohibited/counterfeit never resubmit: silent for edits, 409 when explicit', async () => {
    const { s } = svc(rejected('counterfeit'));
    await expect(s.assertResubmitAllowed('i1', { confirmWithdrawAppeal: true })).resolves.toMatchObject({ resubmit: false });
    expect(await codeOf(s.assertResubmitAllowed('i1', { strict: true }))).toBe('ITEM_ACTION_NOT_ALLOWED_FOR_CATEGORY');
  });

  it('non-rejected items are not resubmitted', async () => {
    const { s } = svc({ ...rejected('other'), moderation_status: 'approved' });
    await expect(s.assertResubmitAllowed('i1', {})).resolves.toMatchObject({ resubmit: false });
  });

  it('prepareRejection refuses a missing category and builds record + audit vars without writing', async () => {
    const { s, hasura } = svc(null);
    expect(await codeOf(s.prepareRejection({ itemId: 'i1', category: undefined as any, reason: 'x', reviewerId: 'u', source: 'admin' }))).toBe(
      'ITEM_REJECTION_CATEGORY_REQUIRED'
    );
    hasura.executeQuery.mockResolvedValue({ items_by_pk: { id: 'i1', name: 'Lamp' } });
    const { rejectionId, variables } = await s.prepareRejection({ itemId: 'i1', category: 'pricing', reason: 'too high', reviewerId: null, source: 'ai' });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(variables.rejectionId).toBe(rejectionId);
    expect(variables.rejection).toMatchObject({ id: rejectionId, item_id: 'i1', category: 'pricing', reviewer_id: null, source: 'ai', item_snapshot: { name: 'Lamp' } });
    expect(variables.rejectionAudit).toMatchObject({ item_id: 'i1', rejection_id: rejectionId, action: 'rejected' });
  });

  it('uses the rejection record category when the item column is null', async () => {
    const row = {
      moderation_status: 'rejected',
      rejection_category: null,
      current_rejection: { id: 'r1', category: 'photo_quality', created_at: '2026-11-01T00:00:00Z' },
      appeals: [],
    };
    const { s } = svc(row);
    await expect(s.assertResubmitAllowed('i1', {})).resolves.toMatchObject({ resubmit: true, category: 'photo_quality' });
    const blocked = svc({ ...row, current_rejection: { ...row.current_rejection, category: 'prohibited_item' } });
    expect(await codeOf(blocked.s.assertResubmitAllowed('i1', { strict: true }))).toBe('ITEM_ACTION_NOT_ALLOWED_FOR_CATEGORY');
  });

  it('a missing item is not resubmitted', async () => {
    const { s } = svc(null);
    await expect(s.assertResubmitAllowed('missing', { strict: true })).resolves.toEqual({
      resubmit: false,
      withdrawsAppealId: null,
      category: null,
      rejectedAt: null,
    });
  });

  it('keeps a null snapshot when the snapshot read fails', async () => {
    const { s, hasura } = svc(null);
    hasura.executeQuery.mockRejectedValue(new Error('snapshot down'));
    const prepared = await s.prepareRejection({ itemId: 'i1', category: 'other', reason: '', reviewerId: 'u', source: 'admin' });
    expect(prepared.variables.rejection.item_snapshot).toBeNull();
    expect(prepared.variables.rejection).toMatchObject({ reason: '', source: 'admin' });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('records hours since rejection and withdraws only an open appeal', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T12:00:00Z'));
    try {
      const open = svc(null);
      await open.s.noteResubmitted('i1', { withdrawsAppealId: 'a1', category: 'pricing', rejectedAt: '2026-11-01T00:00:00Z' }, 'u1');
      expect(open.siteEvents.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'item_moderation.resubmitted',
          metadata: expect.objectContaining({ hoursSinceRejection: 12, withdrewAppeal: true, category: 'pricing' }),
        }),
        expect.anything()
      );
      expect(open.siteEvents.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'item_appeal.withdrawn', metadata: { itemId: 'i1', appealId: 'a1', reason: 'resubmitted' } }),
        expect.anything()
      );
      const none = svc(null);
      await none.s.noteResubmitted('i1', { withdrawsAppealId: null, category: 'other', rejectedAt: null }, null);
      expect(none.siteEvents.trackEvent).toHaveBeenCalledTimes(1);
      expect(none.siteEvents.trackEvent.mock.calls[0][0].metadata.hoursSinceRejection).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('still emits the resubmit metric when the audit insert fails', async () => {
    const { s, hasura, siteEvents } = svc(null);
    hasura.executeMutation.mockRejectedValue(new Error('audit down'));
    await expect(
      s.noteResubmitted('i1', { withdrawsAppealId: null, category: 'other', rejectedAt: null }, 'u1')
    ).resolves.toBeUndefined();
    expect(siteEvents.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'item_moderation.resubmitted' }),
      expect.anything()
    );
  });

  it('marks recovery inside seven days and skips a missing rejection', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T12:00:00Z'));
    try {
      const inside = svc({ current_rejection: { id: 'r1', category: 'pricing', created_at: '2026-10-25T12:00:00Z' } });
      await inside.s.noteApproved('i1', 'appeal');
      expect(inside.siteEvents.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'item_moderation.recovered',
          metadata: expect.objectContaining({ hoursToRecover: 168, within7Days: true, via: 'appeal', rejectionId: 'r1' }),
        }),
        expect.anything()
      );
      const outside = svc({ current_rejection: { id: 'r2', category: 'other', created_at: '2026-10-25T11:00:00Z' } });
      await outside.s.noteApproved('i1', 'admin');
      expect(outside.siteEvents.trackEvent.mock.calls[0][0].metadata).toMatchObject({ hoursToRecover: 169, within7Days: false, via: 'admin' });
      const missing = svc(null);
      await missing.s.noteApproved('i1', 'ai');
      expect(missing.siteEvents.trackEvent).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('swallows a recovery-metric failure', async () => {
    const { s, hasura, siteEvents } = svc(null);
    hasura.executeQuery.mockRejectedValue(new Error('down'));
    await expect(s.noteApproved('i1', 'business_accept')).resolves.toBeUndefined();
    expect(siteEvents.trackEvent).not.toHaveBeenCalled();
  });

  it('counts a delete only while the item is still rejected', async () => {
    const rejected = svc({
      moderation_status: 'rejected',
      rejection_category: 'other',
      appeals: [{ id: 'a1' }, { id: 'a2' }],
    });
    await rejected.s.noteDeleted('i1');
    expect(rejected.siteEvents.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'item_moderation.deleted_after_rejection', metadata: { itemId: 'i1', category: 'other' } }),
      expect.anything()
    );
    const withdrawn = rejected.siteEvents.trackEvent.mock.calls.filter((c: any[]) => c[0].eventType === 'item_appeal.withdrawn');
    expect(withdrawn.map((c: any[]) => c[0].metadata)).toEqual([
      { itemId: 'i1', appealId: 'a1', reason: 'item_deleted' },
      { itemId: 'i1', appealId: 'a2', reason: 'item_deleted' },
    ]);
    const live = svc({ moderation_status: 'approved', rejection_category: 'other', appeals: [{ id: 'a1' }] });
    await live.s.noteDeleted('i1');
    expect(live.siteEvents.trackEvent).not.toHaveBeenCalled();
  });

  it('swallows a delete-metric failure and an audit insert failure', async () => {
    const { s, hasura } = svc(null);
    hasura.executeQuery.mockRejectedValue(new Error('down'));
    await expect(s.noteDeleted('i1')).resolves.toBeUndefined();
    hasura.executeMutation.mockRejectedValue(new Error('audit down'));
    await expect(s.audit({ item_id: 'i1', action: 'rejected' })).resolves.toBeUndefined();
  });
});
