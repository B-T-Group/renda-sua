import {
  ADMIN_ITEM_APPEALS_PATH,
  createItemAppealsAdminApi,
} from './itemAppealsAdminApi';

function mockClient() {
  return { get: jest.fn(), post: jest.fn() };
}

describe('itemAppealsAdminApi', () => {
  it('lists the queue with SLA-first filters', async () => {
    const client = mockClient();
    client.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          total: 1,
          appeals: [
            {
              id: 'ap-1',
              rejectionId: 'rej-1',
              itemId: 'item-1',
              reason: 'Please reconsider this listing as it is accurate.',
              evidence: [],
              status: 'pending',
              slaState: 'breached',
              item: { id: 'item-1', name: 'Lamp', moderationStatus: 'rejected', imageUrl: null },
              business: { id: 'biz-1', name: 'Shop' },
              rejection: {
                id: 'rej-1',
                category: 'photo_quality',
                reason: 'Blurry',
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            },
          ],
        },
      },
    });
    const api = createItemAppealsAdminApi(client as never);
    const result = await api.list({ status: 'pending', category: 'photo_quality' });
    expect(client.get).toHaveBeenCalledWith(ADMIN_ITEM_APPEALS_PATH, {
      params: { status: 'pending', category: 'photo_quality' },
    });
    expect(result.appeals[0].slaState).toBe('breached');
  });

  it('loads counts and decides an appeal', async () => {
    const client = mockClient();
    client.get.mockResolvedValue({
      data: { data: { pending: 3, breached: 1 } },
    });
    client.post.mockResolvedValue({
      data: {
        data: {
          appealId: 'ap-1',
          status: 'upheld',
          itemModerationStatus: 'rejected',
          warnings: [],
        },
      },
    });
    const api = createItemAppealsAdminApi(client as never);
    const counts = await api.counts();
    expect(client.get).toHaveBeenCalledWith(`${ADMIN_ITEM_APPEALS_PATH}/count`);
    expect(counts.pending).toBe(3);
    const decided = await api.decide('ap-1', {
      decision: 'uphold',
      note: 'The photos still do not show the item clearly.',
    });
    expect(client.post).toHaveBeenCalledWith(`${ADMIN_ITEM_APPEALS_PATH}/ap-1/decide`, {
      decision: 'uphold',
      note: 'The photos still do not show the item clearly.',
    });
    expect(decided.status).toBe('upheld');
  });
});
