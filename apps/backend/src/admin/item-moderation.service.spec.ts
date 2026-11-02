import { ItemRejectionsService } from '../item-appeals/item-rejections.service';
import { ItemModerationService } from './item-moderation.service';

describe('ItemModerationService', () => {
  function buildService(opts?: {
    listItems?: any[];
    itemByPk?: any;
    reasons?: Map<string, string>;
  }) {
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('ItemsModeration')) {
        return {
          items: opts?.listItems ?? [],
          items_aggregate: {
            aggregate: { count: (opts?.listItems ?? []).length },
          },
        };
      }
      if (query.includes('ItemForModeration')) {
        return { items_by_pk: opts?.itemByPk ?? null };
      }
      if (query.includes('LatestAiReviewForItem')) {
        return {
          item_ai_reviews: [{ id: 'review-1', status: 'rejected' }],
        };
      }
      if (query.includes('GetItemRejectionMessages')) {
        return { user_messages: [] };
      }
      if (query.includes('GetItemAiRejectionReasons')) {
        return {
          item_ai_reviews: Array.from(opts?.reasons?.entries() ?? []).map(
            ([item_id, decision_reason]) => ({ item_id, decision_reason })
          ),
        };
      }
      return {};
    });
    const executeMutation = jest.fn(async () => ({
      update_items_by_pk: { id: 'item-1' },
      insert_user_messages_one: { id: 'msg-1' },
    }));
    const createThread = jest.fn(async () => ({
      thread: { id: 'thread-1' },
      message: { id: 'msg-1' },
    }));
    const service = new ItemModerationService(
      { executeQuery, executeMutation } as any,
      {
        sendSaleItemApprovedEmail: jest.fn(),
        sendSaleItemRejectedEmail: jest.fn(),
      } as any,
      { assertItemCanActivateAsSystem: jest.fn() } as any,
      { recompute: jest.fn() } as any,
      { createThread } as any,
      { prepareRejection: jest.fn(), noteRejected: jest.fn(), noteApproved: jest.fn() } as any
    );
    return { service, executeQuery, executeMutation, createThread };
  }

  it('includes ai_reviewing in pending filter', async () => {
    const { service, executeQuery } = buildService({ listItems: [] });
    await service.listModerationQueue({ status: 'pending', page: 1, limit: 20 });
    const where = executeQuery.mock.calls[0][1].where;
    expect(where._and[1].moderation_status._in).toEqual([
      'pending',
      'ai_reviewing',
    ]);
  });

  it('enriches rejected rows with rejection_reason and latest_ai_review', async () => {
    const { service } = buildService({
      listItems: [
        {
          id: 'item-1',
          name: 'Widget',
          description: 'A widget',
          moderation_status: 'rejected',
          moderation_source: 'ai',
          moderated_at: null,
          created_at: '2026-01-01T00:00:00Z',
          price: 100,
          currency: 'XAF',
          is_active: false,
          business: { id: 'b1', name: 'Biz', user_id: 'u1' },
          ai_reviews: [
            {
              id: 'review-1',
              status: 'rejected',
              decision_reason: 'Bad photos',
              rejection_fields: ['images'],
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
      ],
      reasons: new Map([['item-1', 'Bad photos']]),
    });
    const result = await service.listModerationQueue({
      status: 'rejected',
      page: 1,
      limit: 20,
    });
    expect(result.items[0].rejection_reason).toBe('Bad photos');
    expect(result.items[0].latest_ai_review?.id).toBe('review-1');
  });

  it('allows approving a rejected item (overrule)', async () => {
    const { service, executeMutation } = buildService({
      itemByPk: {
        id: 'item-1',
        name: 'Widget',
        moderation_status: 'rejected',
        moderation_source: 'ai',
        status: 'active',
        business: { id: 'b1', user_id: 'u1' },
      },
    });
    await service.approveItem('item-1', 'mod-1');
    expect(executeMutation).toHaveBeenCalled();
    const overrideCall = executeMutation.mock.calls.find((c) =>
      String(c[0]).includes('SetAiReviewOverride')
    );
    expect(overrideCall?.[1]).toEqual({
      id: 'review-1',
      action: 'force_approve',
    });
  });

  it('messages the business about an item', async () => {
    const { service, createThread } = buildService({
      itemByPk: {
        id: 'item-1',
        name: 'Widget',
        moderation_status: 'rejected',
        moderation_source: 'ai',
        status: 'active',
        business: { id: 'b1', user_id: 'u1' },
      },
    });
    const result = await service.messageBusinessAboutItem({
      itemId: 'item-1',
      senderUserId: 'mod-1',
      body: 'Please update photos',
    });
    expect(createThread).toHaveBeenCalledWith({
      senderUserId: 'mod-1',
      recipientUserId: 'u1',
      body: 'Please update photos',
      subject: 'Re: Widget',
    });
    expect(result.threadId).toBe('thread-1');
  });
});

describe('ItemModerationService rejectItem with a category (A4)', () => {
  function build(opts: { failReject?: boolean } = {}) {
    const executeQuery = jest.fn(async (q: string) =>
      q.includes('ItemForModeration')
        ? { items_by_pk: { id: 'item-1', name: 'Widget', moderation_status: 'pending', status: 'active', business: { id: 'b1', user_id: 'u1' } } }
        : q.includes('ItemSnapshotForRejection')
          ? { items_by_pk: { id: 'item-1', name: 'Widget' } }
          : { user_messages: [], item_ai_reviews: [] }
    );
    const executeMutation = jest.fn(async (q: string) => {
      if (opts.failReject && q.includes('RejectItemModeration')) throw new Error('item_rejection_not_current');
      return { update_items_by_pk: { id: 'item-1' }, insert_user_messages_one: { id: 'm' } };
    });
    const hasura = { executeQuery, executeMutation } as any;
    const trackEvent = jest.fn().mockResolvedValue(undefined);
    const itemRejections = new ItemRejectionsService(hasura, { trackEvent } as any);
    const email = jest.fn();
    const service = new ItemModerationService(
      hasura,
      { sendSaleItemApprovedEmail: jest.fn(), sendSaleItemRejectedEmail: email } as any,
      { assertItemCanActivateAsSystem: jest.fn() } as any,
      { recompute: jest.fn() } as any,
      { createThread: jest.fn(async () => ({ thread: { id: 't' }, message: { id: 'm' } })) } as any,
      itemRejections
    );
    return { service, executeMutation, trackEvent, email };
  }

  it('refuses a missing or unknown category before touching the item', async () => {
    const { service, executeMutation } = build();
    for (const bad of [undefined, 'blurry']) {
      await expect(service.rejectItem('item-1', 'mod-1', 'Bad photos', bad as any)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'ITEM_REJECTION_CATEGORY_REQUIRED' }),
      });
    }
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('writes the reject, the rejection record and the audit row in ONE mutation', async () => {
    const { service, executeMutation, trackEvent } = build();
    await service.rejectItem('item-1', 'mod-1', '  Bad photos ', 'photo_quality');
    const calls = executeMutation.mock.calls as any[];
    const rejects = calls.filter((c) => /insert_item_rejections_one/.test(String(c[0])));
    expect(rejects).toHaveLength(1);
    const [q, v] = rejects[0];
    expect(q).toContain('RejectItemModeration');
    expect(q).toMatch(/current_rejection_id: \$rejectionId/);
    expect(q).toContain('insert_item_moderation_audit_one');
    // item update precedes the inserts (the DB guard needs the pointer first)
    expect(q.indexOf('update_items_by_pk')).toBeLessThan(q.indexOf('insert_item_rejections_one'));
    expect(v).toMatchObject({ id: 'item-1', moderatorId: 'mod-1', rejectionCategory: 'photo_quality' });
    expect(v.rejection).toMatchObject({ id: v.rejectionId, item_id: 'item-1', category: 'photo_quality', reason: 'Bad photos', reviewer_id: 'mod-1', source: 'admin' });
    expect(v.rejectionAudit).toMatchObject({ rejection_id: v.rejectionId, action: 'rejected' });
    expect(calls.some((c) => /RecordItemRejection/.test(String(c[0])))).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'item_moderation.rejected' }), expect.anything());
  });

  it('a failed reject mutation leaves no follow-up writes, notices or metric', async () => {
    const { service, executeMutation, trackEvent, email } = build({ failReject: true });
    await expect(service.rejectItem('item-1', 'mod-1', 'Bad photos', 'pricing')).rejects.toThrow('item_rejection_not_current');
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(email).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
