import { ReelsFeedService, type FeedReel } from './reels-feed.service';

describe('ReelsFeedService', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const catalogCache = {
    get: jest.fn(),
    set: jest.fn(),
  };

  let service: ReelsFeedService;

  beforeEach(() => {
    jest.clearAllMocks();
    catalogCache.get.mockResolvedValue(null);
    catalogCache.set.mockResolvedValue(undefined);
    service = new ReelsFeedService(hasura as never, catalogCache as never);
  });

  function itemReel(overrides: Partial<FeedReel> = {}): FeedReel {
    return {
      id: 'reel-1',
      business_id: 'biz-1',
      subject_type: 'item',
      subject_id: 'item-1',
      caption: 'Soap',
      video_url: 'https://cdn/v.mp4',
      thumbnail_url: 'https://cdn/t.jpg',
      market_country: 'CM',
      like_count: 0,
      view_count: 0,
      duration_ms: 8000,
      published_at: '2026-09-15T00:00:00.000Z',
      business: { id: 'biz-1', name: 'Acme' },
      ...overrides,
    };
  }

  function inventoryRow(id: string, itemId = 'item-1', businessId = 'biz-1') {
    return { id, item_id: itemId, business_location: { business_id: businessId } };
  }

  function mockAnonymousCountryFeed(reels: FeedReel[], inventory: unknown[]) {
    hasura.executeQuery
      .mockResolvedValueOnce({ reels: reels.map((r) => ({ id: r.id })) })
      .mockResolvedValueOnce({ reels })
      .mockResolvedValueOnce({ business_inventory: inventory });
  }

  describe('getFeed inventory ids', () => {
    it('maps item subjects to inventory ids and marks matching-country rows purchasable', async () => {
      mockAnonymousCountryFeed([itemReel()], [inventoryRow('inv-1')]);

      const page = await service.getFeed({ country: 'cm' });

      expect(page.items[0].inventoryItemId).toBe('inv-1');
      expect(page.items[0].purchasable).toBe(true);
      expect(hasura.executeQuery).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('business_inventory'),
        { itemIds: ['item-1'] }
      );
    });

    it('keeps Buy off when the market matches but no inventory exists', async () => {
      mockAnonymousCountryFeed([itemReel()], []);

      const page = await service.getFeed({ country: 'CM' });

      expect(page.items[0].inventoryItemId).toBeNull();
      expect(page.items[0].purchasable).toBe(false);
    });

    it('still returns inventory id when country mismatches, but not purchasable', async () => {
      mockAnonymousCountryFeed([itemReel()], [inventoryRow('inv-1')]);

      const page = await service.getFeed({ country: 'CA' });

      expect(page.items[0].inventoryItemId).toBe('inv-1');
      expect(page.items[0].purchasable).toBe(false);
    });

    it('uses the first inventory row for a business+item key', async () => {
      mockAnonymousCountryFeed(
        [itemReel()],
        [inventoryRow('inv-high'), inventoryRow('inv-low')]
      );

      const page = await service.getFeed({ country: 'CM' });

      expect(page.items[0].inventoryItemId).toBe('inv-high');
    });

    it('ignores inventory that belongs to another business', async () => {
      mockAnonymousCountryFeed(
        [itemReel()],
        [inventoryRow('inv-other', 'item-1', 'other-biz')]
      );

      const page = await service.getFeed({ country: 'CM' });

      expect(page.items[0].inventoryItemId).toBeNull();
      expect(page.items[0].purchasable).toBe(false);
    });

    it('does not query inventory for rental or business subjects', async () => {
      const rental = itemReel({
        id: 'reel-r',
        subject_type: 'rental',
        subject_id: 'rental-1',
      });
      hasura.executeQuery
        .mockResolvedValueOnce({ reels: [{ id: rental.id }] })
        .mockResolvedValueOnce({ reels: [rental] });

      const page = await service.getFeed({ country: 'CM' });

      expect(page.items[0].inventoryItemId).toBeNull();
      expect(page.items[0].purchasable).toBe(false);
      expect(hasura.executeQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('getFeed paging and session', () => {
    it('clamps limit and treats garbage cursors as offset 0', async () => {
      hasura.executeQuery.mockResolvedValueOnce({ reels: [] });

      await service.getFeed({ limit: 99, cursor: 'nope' });

      expect(hasura.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('RankedReelIds'),
        expect.objectContaining({ limit: 25, offset: 0 })
      );
    });

    it('excludes blocked businesses for authenticated shoppers', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({ business_blocks: [{ business_id: 'blocked' }] })
        .mockResolvedValueOnce({ reels: [] });

      await service.getFeed({
        ctx: { userId: 'user-1' } as never,
        country: 'CM',
      });

      expect(hasura.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('RankedReelIds'),
        expect.objectContaining({
          where: expect.objectContaining({
            business_id: { _nin: ['blocked'] },
          }),
        })
      );
    });

    it('does not load blocks or likes for anonymous shoppers', async () => {
      hasura.executeQuery.mockResolvedValueOnce({ reels: [] });

      await service.getFeed({
        ctx: { userId: 'anonymous' } as never,
      });

      expect(hasura.executeQuery).toHaveBeenCalledTimes(1);
      expect(hasura.executeQuery.mock.calls[0][0]).toContain('RankedReelIds');
    });

    it('attaches liked flags for authenticated shoppers', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({ business_blocks: [] })
        .mockResolvedValueOnce({ reels: [{ id: 'reel-1' }] })
        .mockResolvedValueOnce({ reels: [itemReel()] })
        .mockResolvedValueOnce({ business_inventory: [inventoryRow('inv-1')] })
        .mockResolvedValueOnce({ reel_likes: [{ reel_id: 'reel-1' }] });

      const page = await service.getFeed({
        ctx: { userId: 'user-1' } as never,
        country: 'CM',
      });

      expect(page.items[0].liked).toBe(true);
    });

    it('reuses a frozen session feed without re-ranking', async () => {
      catalogCache.get.mockResolvedValue(JSON.stringify(['reel-1', 'reel-2']));
      hasura.executeQuery
        .mockResolvedValueOnce({
          reels: [itemReel(), itemReel({ id: 'reel-2', subject_id: 'item-2' })],
        })
        .mockResolvedValueOnce({
          business_inventory: [
            inventoryRow('inv-1'),
            inventoryRow('inv-2', 'item-2'),
          ],
        });

      const page = await service.getFeed({
        sessionId: 'sess-1',
        country: 'CM',
        limit: 1,
      });

      expect(page.items).toHaveLength(1);
      expect(page.nextCursor).toBe('1');
      expect(catalogCache.set).not.toHaveBeenCalled();
      expect(hasura.executeQuery.mock.calls[0][0]).not.toContain('RankedReelIds');
    });

    it('treats corrupt session JSON as a miss and freezes a new ranking', async () => {
      catalogCache.get.mockResolvedValue('{not-json');
      hasura.executeQuery.mockResolvedValueOnce({ reels: [{ id: 'reel-1' }] });
      hasura.executeQuery.mockResolvedValueOnce({ reels: [itemReel()] });
      hasura.executeQuery.mockResolvedValueOnce({
        business_inventory: [inventoryRow('inv-1')],
      });

      await service.getFeed({ sessionId: 'sess-1', country: 'CM' });

      expect(catalogCache.set).toHaveBeenCalledWith(
        'reels-feed:sess-1:CM',
        JSON.stringify(['reel-1']),
        { ttlSeconds: 3600 }
      );
    });
  });

  describe('recordView', () => {
    it('ignores watches below the 3s threshold', async () => {
      await service.recordView({ reelId: 'reel-1', watchTimeMs: 2999 });
      expect(hasura.executeMutation).not.toHaveBeenCalled();
    });

    it('records a view and marks completion at 15s', async () => {
      hasura.executeMutation.mockResolvedValue({});

      await service.recordView({
        reelId: 'reel-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        watchTimeMs: 15000,
      });

      expect(hasura.executeMutation).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('TrackReelView'),
        expect.objectContaining({
          object: expect.objectContaining({
            reel_id: 'reel-1',
            user_id: 'user-1',
            completed: true,
          }),
        })
      );
      expect(hasura.executeMutation).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('IncReelViews'),
        { id: 'reel-1' }
      );
    });
  });

  describe('setLike', () => {
    it('increments like_count only when a new like is inserted', async () => {
      hasura.executeMutation
        .mockResolvedValueOnce({ insert_reel_likes: { affected_rows: 1 } })
        .mockResolvedValueOnce({});

      await service.setLike('user-1', 'reel-1', true);

      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('IncLike'),
        { id: 'reel-1' }
      );
    });

    it('does not increment when the like already exists', async () => {
      hasura.executeMutation.mockResolvedValueOnce({
        insert_reel_likes: { affected_rows: 0 },
      });

      await service.setLike('user-1', 'reel-1', true);

      expect(hasura.executeMutation).toHaveBeenCalledTimes(1);
    });

    it('decrements like_count only when a like row is deleted', async () => {
      hasura.executeMutation
        .mockResolvedValueOnce({ delete_reel_likes: { affected_rows: 1 } })
        .mockResolvedValueOnce({});

      await service.setLike('user-1', 'reel-1', false);

      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('DecLike'),
        { id: 'reel-1' }
      );
    });

    it('does not decrement when the user had not liked the reel', async () => {
      hasura.executeMutation.mockResolvedValueOnce({
        delete_reel_likes: { affected_rows: 0 },
      });

      await service.setLike('user-1', 'reel-1', false);

      expect(hasura.executeMutation).toHaveBeenCalledTimes(1);
    });
  });
});
