import { DashboardService } from './dashboard.service';

describe('DashboardService moderation soft-delete filters', () => {
  let service: DashboardService;
  let hasuraUserService: { getUser: jest.Mock };
  let hasuraSystemService: { executeQuery: jest.Mock };

  const emptyAggregates = {
    items_aggregate: { aggregate: { count: 0 } },
    rental_location_listings_aggregate: { aggregate: { count: 0 } },
    orders_aggregate: { aggregate: { count: 0 } },
    failed_deliveries_aggregate: { aggregate: { count: 0 } },
  };

  beforeEach(() => {
    hasuraUserService = { getUser: jest.fn() };
    hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue(emptyAggregates),
    };
    service = new DashboardService(
      hasuraUserService as any,
      hasuraSystemService as any,
      {} as any,
      { hasPermission: jest.fn().mockResolvedValue(false) } as any
    );
  });

  it('excludes soft-deleted catalog items from moderation action counts', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      id: 'u1',
      user_type_id: 'business',
      business: { id: 'biz-1' },
    });
    hasuraSystemService.executeQuery.mockImplementation(
      async (query: string, vars: { status?: string }) => {
        if (
          query.includes('ItemsByModeration') &&
          vars.status === 'rejected'
        ) {
          return { items_aggregate: { aggregate: { count: 2 } } };
        }
        return emptyAggregates;
      }
    );

    const result = await service.getActionsNeeded();

    const itemCalls = hasuraSystemService.executeQuery.mock.calls.filter(
      ([query]) => String(query).includes('ItemsByModeration')
    );
    expect(itemCalls.length).toBeGreaterThan(0);
    for (const [query] of itemCalls) {
      expect(String(query)).toContain('status: { _eq: active }');
      expect(String(query)).toContain('moderation_status: { _eq: $status }');
    }
    expect(result.actions).toEqual([
      expect.objectContaining({
        id: 'item_rejected',
        count: 2,
        priority: 'critical',
      }),
    ]);
  });

  it('excludes soft-deleted rental items and listings from moderation counts', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      id: 'u1',
      user_type_id: 'business',
      business: { id: 'biz-1' },
    });
    hasuraSystemService.executeQuery.mockImplementation(
      async (query: string, vars: { status?: string }) => {
        if (
          query.includes('RentalsByModeration') &&
          vars.status === 'proposal_pending'
        ) {
          return {
            rental_location_listings_aggregate: {
              aggregate: { count: 3 },
            },
          };
        }
        return emptyAggregates;
      }
    );

    const result = await service.getActionsNeeded();

    const rentalCalls = hasuraSystemService.executeQuery.mock.calls.filter(
      ([query]) => String(query).includes('RentalsByModeration')
    );
    expect(rentalCalls.length).toBeGreaterThan(0);
    for (const [query] of rentalCalls) {
      const q = String(query);
      expect(q).toContain(
        'rental_item: { business_id: { _eq: $businessId }, deleted_at: { _is_null: true } }'
      );
      expect(q).toContain('deleted_at: { _is_null: true }');
      expect(q).toContain('moderation_status: { _eq: $status }');
    }
    expect(result.actions).toEqual([
      expect.objectContaining({
        id: 'rental_proposal_pending',
        count: 3,
        priority: 'high',
      }),
    ]);
  });
});
