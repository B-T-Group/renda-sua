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
      { createThread } as any
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
