import { ItemRejectionsService } from '../item-appeals/item-rejections.service';
import { ItemAiReviewAdminService } from './item-ai-review-admin.service';

describe('ItemAiReviewAdminService force_reject is atomic with its rejection record', () => {
  function build(opts: { failReject?: boolean } = {}) {
    const executeQuery = jest.fn(async (q: string) => {
      if (q.includes('ItemSnapshotForRejection')) return { items_by_pk: { id: 'item-1', name: 'Lamp' } };
      return {
        item_ai_reviews_by_pk: {
          id: 'rev-1',
          item_id: 'item-1',
          item: { id: 'item-1', name: 'Lamp', moderation_status: 'approved', business: { id: 'b1', user_id: 'u1' } },
        },
      };
    });
    const executeMutation = jest.fn(async (q: string) => {
      if (q.includes('RejectItemWithRecord') && opts.failReject) throw new Error('boom');
      return { update_items_by_pk: { id: 'item-1' } };
    });
    const hasura = { executeQuery, executeMutation };
    const trackEvent = jest.fn().mockResolvedValue(undefined);
    const notifications = { sendSaleItemRejectedEmail: jest.fn() };
    const service = new ItemAiReviewAdminService(
      hasura as any,
      {} as any,
      notifications as any,
      {} as any,
      { recompute: jest.fn() } as any,
      new ItemRejectionsService(hasura as any, { trackEvent } as any)
    );
    return { service, executeMutation, trackEvent, notifications };
  }

  it('flips the item and inserts the record + audit in the same mutation', async () => {
    const { service, executeMutation, trackEvent } = build();
    await service.override('rev-1', 'admin-1', { action: 'force_reject', reason: ' Fake brand ', rejectionCategory: 'counterfeit' } as any);
    const rejects = (executeMutation.mock.calls as any[]).filter((c) => /insert_item_rejections_one/.test(String(c[0])));
    expect(rejects).toHaveLength(1);
    const [q, v] = rejects[0];
    expect(q).toContain('RejectItemWithRecord');
    expect(q).toMatch(/current_rejection_id: \$rejectionId/);
    expect(q).toContain('insert_item_moderation_audit_one');
    expect(v).toMatchObject({ id: 'item-1', rejectionCategory: 'counterfeit', moderatorId: 'admin-1' });
    expect(v.rejection).toMatchObject({ id: v.rejectionId, category: 'counterfeit', reviewer_id: 'admin-1', reason: 'Fake brand', source: 'admin' });
    expect((executeMutation.mock.calls as any[]).some((c) => /ApplyItemModeration\b/.test(String(c[0])))).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'item_moderation.rejected' }), expect.anything());
  });

  it('a failed reject surfaces the error and sends no notice or metric', async () => {
    const { service, trackEvent, notifications } = build({ failReject: true });
    await expect(
      service.override('rev-1', 'admin-1', { action: 'force_reject', rejectionCategory: 'pricing' } as any)
    ).rejects.toThrow('boom');
    expect(trackEvent).not.toHaveBeenCalled();
    expect(notifications.sendSaleItemRejectedEmail).not.toHaveBeenCalled();
  });
});
