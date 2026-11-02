import { ItemRejectionsService } from '../item-appeals/item-rejections.service';
import { ItemAiReviewService } from './item-ai-review.service';

/** AI reject writes item flip + rejection record + audit in one guarded mutation. */
describe('ItemAiReviewService AI reject is atomic with its rejection record', () => {
  function build(opts: { rejectError?: Error; statusAfterError?: string } = {}) {
    const executeQuery = jest.fn(async (q: string) => {
      if (q.includes('ItemSnapshotForRejection')) return { items_by_pk: { id: 'item-1', name: 'Lamp' } };
      if (q.includes('GetItemModerationStatus')) {
        return { items_by_pk: { id: 'item-1', moderation_status: opts.statusAfterError ?? 'ai_reviewing', ai_review_version: 1 } };
      }
      return {};
    });
    const executeMutation = jest.fn(async (q: string) => {
      if (q.includes('RejectItemIfAiReviewingWithRecord')) {
        if (opts.rejectError) throw opts.rejectError;
        return { update_items: { affected_rows: 1 }, rejection: { id: 'x' }, rejection_audit: { id: 'y' } };
      }
      return {};
    });
    const hasura = { executeQuery, executeMutation };
    const trackEvent = jest.fn().mockResolvedValue(undefined);
    const rejections = new ItemRejectionsService(hasura as any, { trackEvent } as any);
    const notifications = { sendSaleItemRejectedEmail: jest.fn() };
    const service = new ItemAiReviewService(
      hasura as never,
      {} as never,
      {} as never,
      notifications as never,
      { get: jest.fn(() => ({ enabled: true })) } as never,
      {} as never,
      { recompute: jest.fn() } as never,
      { autoAssignCollectionsIfFit: jest.fn() } as never,
      rejections
    );
    const item = { id: 'item-1', name: 'Lamp', business: { id: 'b1', user_id: 'u1' } };
    const result = { reason: 'Photo is blurry', issues: [{ field: 'images', code: 'photo_quality', message: 'blurry' }] };
    const run = () => (service as any).applyRejectDecision(item, 'rev-1', result, {});
    return { run, executeMutation, trackEvent, notifications };
  }

  it('sends one guarded mutation carrying the pointer, the record and the audit row', async () => {
    const { run, executeMutation, trackEvent, notifications } = build();
    await run();
    const calls = executeMutation.mock.calls as any[];
    const rejects = calls.filter((c) => /insert_item_rejections_one/.test(String(c[0])));
    expect(rejects).toHaveLength(1);
    const [q, v] = rejects[0];
    expect(q).toContain('moderation_status: { _eq: ai_reviewing }');
    expect(q).toMatch(/current_rejection_id: \$rejectionId/);
    expect(q).toContain('insert_item_moderation_audit_one');
    expect(q.indexOf('update_items(')).toBeLessThan(q.indexOf('insert_item_rejections_one'));
    expect(v.rejection).toMatchObject({ id: v.rejectionId, item_id: 'item-1', source: 'ai', reviewer_id: null, reason: 'Photo is blurry' });
    expect(v.rejectionCategory).toBe(v.rejection.category);
    expect(calls.some((c) => /ApplyItemModerationIfAiReviewing\b/.test(String(c[0])))).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'item_moderation.rejected' }), expect.anything());
    expect(notifications.sendSaleItemRejectedEmail).toHaveBeenCalledTimes(1);
  });

  it('lost race (item already decided): rolled back, no notice, no metric, no error', async () => {
    const { run, trackEvent, notifications, executeMutation } = build({
      rejectError: new Error('item_rejection_not_current'),
      statusAfterError: 'approved',
    });
    await expect(run()).resolves.toBeUndefined();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(notifications.sendSaleItemRejectedEmail).not.toHaveBeenCalled();
    expect((executeMutation.mock.calls as any[]).some((c) => /OwnerMessage/.test(String(c[0])))).toBe(false);
  });

  it('a real failure while still ai_reviewing is rethrown so the queue retries', async () => {
    const { run, notifications } = build({ rejectError: new Error('connection reset'), statusAfterError: 'ai_reviewing' });
    await expect(run()).rejects.toThrow('connection reset');
    expect(notifications.sendSaleItemRejectedEmail).not.toHaveBeenCalled();
  });
});
