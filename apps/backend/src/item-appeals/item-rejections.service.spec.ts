import { HttpException } from '@nestjs/common';
import { ItemRejectionsService } from './item-rejections.service';

function svc(gateItem: unknown) {
  const hasura = {
    executeQuery: jest.fn().mockResolvedValue({ items_by_pk: gateItem }),
    executeMutation: jest.fn().mockResolvedValue({}),
  };
  const siteEvents = { trackEvent: jest.fn().mockResolvedValue(undefined) };
  return { s: new ItemRejectionsService(hasura as any, siteEvents as any), hasura };
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
});
