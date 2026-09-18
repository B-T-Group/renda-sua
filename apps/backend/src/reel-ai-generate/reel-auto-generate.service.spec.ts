import { ReelAutoGenerateService } from './reel-auto-generate.service';

function inventoryRow(params: {
  itemId: string;
  businessId: string;
  views: number;
  allowlist?: boolean;
  images?: number;
  country?: string | null;
  isActive?: boolean;
  locations?: Array<{ address?: { country?: string | null } | null }>;
}): Record<string, unknown> {
  return {
    item_id: params.itemId,
    item_view_events_aggregate: { aggregate: { count: params.views } },
    item: {
      id: params.itemId,
      business_id: params.businessId,
      is_active: params.isActive ?? true,
      item_images_aggregate: {
        aggregate: { count: params.images ?? 1 },
      },
      business: {
        id: params.businessId,
        reels_enabled_allowlist: params.allowlist ?? true,
        business_locations:
          params.locations ?? [
            { address: { country: params.country ?? 'CM' } },
          ],
      },
    },
  };
}

describe('ReelAutoGenerateService', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const config = {
    get: jest.fn(),
  };
  const generateService = {
    generatePlatformSponsored: jest.fn(),
  };

  let service: ReelAutoGenerateService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) =>
      key === 'reels' ? { autoGenerateEnabled: true } : undefined
    );
    service = new ReelAutoGenerateService(
      hasura as never,
      config as never,
      generateService as never
    );
  });

  describe('selectCandidate', () => {
    it('prefers higher views and skips ineligible rows', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          business_inventory: [
            inventoryRow({
              itemId: 'low-views',
              businessId: 'b1',
              views: 3,
            }),
            inventoryRow({
              itemId: 'no-allowlist',
              businessId: 'b2',
              views: 50,
              allowlist: false,
            }),
            inventoryRow({
              itemId: 'no-photos',
              businessId: 'b3',
              views: 40,
              images: 0,
            }),
            inventoryRow({
              itemId: 'recent-ai',
              businessId: 'b4',
              views: 30,
            }),
            inventoryRow({
              itemId: 'winner',
              businessId: 'b5',
              views: 20,
              country: 'Gabon',
            }),
          ],
        })
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 1 } },
        })
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 0 } },
        });

      await expect(service.selectCandidate()).resolves.toEqual({
        itemId: 'winner',
        businessId: 'b5',
        marketCountry: 'GA',
        viewCount: 20,
      });
    });

    it('returns null when none are eligible', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        business_inventory: [
          inventoryRow({ itemId: 'a', businessId: 'b1', views: 2 }),
          inventoryRow({
            itemId: 'b',
            businessId: 'b2',
            views: 10,
            allowlist: false,
          }),
        ],
      });

      await expect(service.selectCandidate()).resolves.toBeNull();
    });

    it('merges view counts across inventory rows for the same item', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          business_inventory: [
            inventoryRow({ itemId: 'same', businessId: 'b1', views: 4 }),
            inventoryRow({ itemId: 'same', businessId: 'b1', views: 3 }),
          ],
        })
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 0 } },
        });

      await expect(service.selectCandidate()).resolves.toEqual(
        expect.objectContaining({
          itemId: 'same',
          viewCount: 7,
        })
      );
    });

    it('skips inactive items and defaults market country to CM', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          business_inventory: [
            inventoryRow({
              itemId: 'inactive',
              businessId: 'b1',
              views: 40,
              isActive: false,
            }),
            inventoryRow({
              itemId: 'no-country',
              businessId: 'b2',
              views: 12,
              locations: [],
            }),
          ],
        })
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 0 } },
        });

      await expect(service.selectCandidate()).resolves.toEqual({
        itemId: 'no-country',
        businessId: 'b2',
        marketCountry: 'CM',
        viewCount: 12,
      });
    });

    it('returns null when every eligible item is still in cooldown', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          business_inventory: [
            inventoryRow({ itemId: 'a', businessId: 'b1', views: 20 }),
            inventoryRow({ itemId: 'b', businessId: 'b2', views: 15 }),
          ],
        })
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 1 } },
        })
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 2 } },
        });

      await expect(service.selectCandidate()).resolves.toBeNull();
    });
  });

  describe('tryCreateDailySponsoredReel', () => {
    it('no-ops when the feature flag is disabled', async () => {
      config.get.mockReturnValue({ autoGenerateEnabled: false });

      await expect(service.tryCreateDailySponsoredReel()).resolves.toBeNull();
      expect(hasura.executeQuery).not.toHaveBeenCalled();
      expect(generateService.generatePlatformSponsored).not.toHaveBeenCalled();
    });

    it('no-ops when a platform-sponsored reel already exists today', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        reels_aggregate: { aggregate: { count: 1 } },
      });

      await expect(service.tryCreateDailySponsoredReel()).resolves.toBeNull();
      expect(generateService.generatePlatformSponsored).not.toHaveBeenCalled();
    });

    it('generates for the selected candidate', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 0 } },
        })
        .mockResolvedValueOnce({
          business_inventory: [
            inventoryRow({
              itemId: 'item-1',
              businessId: 'biz-1',
              views: 12,
            }),
          ],
        })
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 0 } },
        });
      generateService.generatePlatformSponsored.mockResolvedValue({
        id: 'reel-1',
      });

      await expect(service.tryCreateDailySponsoredReel()).resolves.toEqual({
        itemId: 'item-1',
        businessId: 'biz-1',
        marketCountry: 'CM',
        viewCount: 12,
      });
      expect(generateService.generatePlatformSponsored).toHaveBeenCalledWith({
        businessId: 'biz-1',
        subjectId: 'item-1',
        marketCountry: 'CM',
        presetId: 'dynamic',
        tier: 'fast',
      });
    });

    it('skips when the unique day index race loses', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 0 } },
        })
        .mockResolvedValueOnce({
          business_inventory: [
            inventoryRow({
              itemId: 'item-1',
              businessId: 'biz-1',
              views: 12,
            }),
          ],
        })
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 0 } },
        });
      generateService.generatePlatformSponsored.mockRejectedValue(
        new Error('Uniqueness violation. reels_one_platform_sponsored_per_utc_day_idx')
      );

      await expect(service.tryCreateDailySponsoredReel()).resolves.toBeNull();
    });

    it('also treats a unique-constraint message as a same-day race', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 0 } },
        })
        .mockResolvedValueOnce({
          business_inventory: [
            inventoryRow({
              itemId: 'item-1',
              businessId: 'biz-1',
              views: 12,
            }),
          ],
        })
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 0 } },
        });
      generateService.generatePlatformSponsored.mockRejectedValue(
        new Error(
          'unique constraint "reels_one_platform_sponsored_per_utc_day"'
        )
      );

      await expect(service.tryCreateDailySponsoredReel()).resolves.toBeNull();
    });

    it('rethrows non-uniqueness generation failures', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 0 } },
        })
        .mockResolvedValueOnce({
          business_inventory: [
            inventoryRow({
              itemId: 'item-1',
              businessId: 'biz-1',
              views: 12,
            }),
          ],
        })
        .mockResolvedValueOnce({
          reels_aggregate: { aggregate: { count: 0 } },
        });
      generateService.generatePlatformSponsored.mockRejectedValue(
        new Error('Hasura timeout')
      );

      await expect(service.tryCreateDailySponsoredReel()).rejects.toThrow(
        'Hasura timeout'
      );
    });

    it('counts only non-failed sponsored reels since UTC midnight', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-09-18T15:30:00.000Z'));
      try {
        hasura.executeQuery
          .mockResolvedValueOnce({
            reels_aggregate: { aggregate: { count: 0 } },
          })
          .mockResolvedValueOnce({ business_inventory: [] });

        await service.tryCreateDailySponsoredReel();

        expect(hasura.executeQuery).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining('processing_status:{_neq:failed}'),
          { since: '2026-09-18T00:00:00.000Z' }
        );
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
