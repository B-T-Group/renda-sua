jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: jest.fn(),
}));
import { DashboardService } from './dashboard.service';

describe('DashboardService tips reminders fallback', () => {
  let service: DashboardService;
  let hasuraUserService: { getUser: jest.Mock };
  let hasuraSystemService: { executeQuery: jest.Mock };

  beforeEach(() => {
    hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'u1',
        user_type_id: 'business',
        active_persona: 'business',
        business: { id: 'biz-1' },
      }),
    };
    hasuraSystemService = {
      executeQuery: jest.fn().mockImplementation(async (query: string) => {
        if (query.includes('BusinessTipsReminders')) {
          throw new Error('column tips_reminders_enabled does not exist');
        }
        if (query.includes('DashboardCatalogReadiness')) {
          return {
            approved: { aggregate: { count: 5 } },
            pending: { aggregate: { count: 1 } },
            rejected: { aggregate: { count: 0 } },
            approved_rentals: { aggregate: { count: 0 } },
            pending_rentals: { aggregate: { count: 0 } },
            rejected_rentals: { aggregate: { count: 0 } },
            latest_item: [{ created_at: '2026-08-01T00:00:00.000Z' }],
            latest_rental: [],
          };
        }
        if (query.includes('DashboardLocationProfile')) {
          return {
            business_locations: [
              { logo_url: 'https://img/logo.png', operating_hours: { mon: [] } },
            ],
          };
        }
        if (query.includes('DashboardItemsNeedingAiCleanup')) {
          return { items_aggregate: { aggregate: { count: 2 } } };
        }
        if (query.includes('DashboardProductViewStats')) {
          return {
            total: { aggregate: { count: 9 } },
            last7d: { aggregate: { count: 3 } },
          };
        }
        if (query.includes('DashboardTopViewedProducts')) {
          return { business_inventory: [] };
        }
        if (query.includes('DashboardTopViewedStock')) {
          return { business_inventory: [] };
        }
        if (query.includes('DashboardUniqueClientCount')) {
          return { clients_aggregate: { aggregate: { count: 1 } } };
        }
        return {
          orders: [],
          orders_aggregate: { nodes: [], aggregate: { count: 0 } },
          items_aggregate: { aggregate: { count: 0 } },
          rental_items_aggregate: { aggregate: { count: 0 } },
          business_locations_aggregate: { aggregate: { count: 0 } },
          business_inventory_aggregate: { aggregate: { count: 0 } },
          failed_deliveries_aggregate: { aggregate: { count: 0 } },
          clients_aggregate: { aggregate: { count: 0 } },
        };
      }),
    };

    service = new DashboardService(
      hasuraUserService as any,
      hasuraSystemService as any,
      { isBusinessAdmin: jest.fn().mockResolvedValue(false) } as any,
      { hasAnyPermission: jest.fn().mockResolvedValue(false) } as any,
      {
        listPendingForBusiness: jest
          .fn()
          .mockResolvedValue({ incoming: [], outgoing: [] }),
      } as any,
      {
        listPending: jest.fn().mockResolvedValue({ jobs: [], pendingResultCount: 0 }),
      } as any,
      { resolveRailForUser: jest.fn().mockResolvedValue('mobile_money') } as any,
      { isPayoutReady: jest.fn().mockResolvedValue(false) } as any
    );
  });

  it('keeps readiness aggregates when tips preference lookup fails', async () => {
    const result = await service.getAggregates();

    expect(result.approvedItemCount).toBe(5);
    expect(result.pendingItemCount).toBe(1);
    expect(result.hasLogo).toBe(true);
    expect(result.itemsNeedingAiCleanupCount).toBe(2);
    expect(result.tipsRemindersEnabled).toBe(true);
    expect(result.totalProductViews).toBe(9);
  });
});
