import { HttpException, HttpStatus } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let hasuraUserService: { getUser: jest.Mock };
  let hasuraSystemService: { executeQuery: jest.Mock };

  beforeEach(() => {
    hasuraUserService = { getUser: jest.fn() };
    hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({
        items_aggregate: { aggregate: { count: 0 } },
        rental_location_listings_aggregate: { aggregate: { count: 0 } },
        orders_aggregate: { aggregate: { count: 0 } },
        failed_deliveries_aggregate: { aggregate: { count: 0 } },
        agents: [],
        user_uploads: [],
      }),
    };
    service = new DashboardService(
      hasuraUserService as any,
      hasuraSystemService as any,
      {} as any,
      { hasPermission: jest.fn().mockResolvedValue(false) } as any,
      {
        listPendingForBusiness: jest
          .fn()
          .mockResolvedValue({ incoming: [], outgoing: [] }),
      } as any,
      { listPending: jest.fn().mockResolvedValue({ jobs: [], pendingResultCount: 0 }) } as any
    );
  });

  describe('getActionsNeeded', () => {
    it('returns empty actions when persona has no profile', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        id: 'u1',
        user_type_id: 'client', active_persona: 'client',
      });

      await expect(service.getActionsNeeded()).resolves.toEqual({
        actions: [],
        totalCount: 0,
      });
      expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
    });

    it('counts business pending orders with order_status variable type', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        id: 'u1',
        user_type_id: 'business', active_persona: 'business',
        business: { id: 'biz-1' },
      });
      hasuraSystemService.executeQuery.mockImplementation(
        async (query: string) => {
          if (query.includes('OrdersByStatus')) {
            return { orders_aggregate: { aggregate: { count: 2 } } };
          }
          if (query.includes('pending_cash') || query.includes('Cash')) {
            return { orders_aggregate: { aggregate: { count: 0 } } };
          }
          if (query.includes('failed_deliver')) {
            return { orders_aggregate: { aggregate: { count: 0 } } };
          }
          return {
            items_aggregate: { aggregate: { count: 0 } },
            rental_location_listings_aggregate: { aggregate: { count: 0 } },
            orders_aggregate: { aggregate: { count: 0 } },
            failed_deliveries_aggregate: { aggregate: { count: 0 } },
          };
        }
      );

      const result = await service.getActionsNeeded();

      const orderQueryCall = hasuraSystemService.executeQuery.mock.calls.find(
        ([query]) => String(query).includes('OrdersByStatus')
      );
      expect(orderQueryCall).toBeDefined();
      expect(String(orderQueryCall?.[0])).toContain('$status: order_status!');
      expect(String(orderQueryCall?.[0])).not.toContain('$status: String!');
      expect(orderQueryCall?.[1]).toEqual({
        businessId: 'biz-1',
        status: 'pending',
      });
      expect(result.actions).toEqual([
        expect.objectContaining({
          id: 'orders_pending',
          kind: 'orders_pending',
          priority: 'high',
          count: 2,
        }),
      ]);
      expect(result.totalCount).toBe(2);
    });

    it('counts client pending and active deliveries with order_status lists', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        id: 'u1',
        user_type_id: 'client', active_persona: 'client',
        client: { id: 'client-1' },
      });
      hasuraSystemService.executeQuery.mockImplementation(
        async (query: string) => {
          if (query.includes('ClientPendingOrders')) {
            return { orders_aggregate: { aggregate: { count: 3 } } };
          }
          if (query.includes('ClientActiveDeliveries')) {
            return { orders_aggregate: { aggregate: { count: 1 } } };
          }
          return { orders_aggregate: { aggregate: { count: 0 } } };
        }
      );

      const result = await service.getActionsNeeded();

      const pendingCall = hasuraSystemService.executeQuery.mock.calls.find(
        ([query]) => String(query).includes('ClientPendingOrders')
      );
      const activeCall = hasuraSystemService.executeQuery.mock.calls.find(
        ([query]) => String(query).includes('ClientActiveDeliveries')
      );

      expect(String(pendingCall?.[0])).toContain(
        '$statuses: [order_status!]!'
      );
      expect(String(pendingCall?.[0])).not.toContain('$statuses: [String!]!');
      expect(pendingCall?.[1]).toEqual({
        clientId: 'client-1',
        statuses: ['pending', 'pending_payment'],
      });

      expect(String(activeCall?.[0])).toContain('$statuses: [order_status!]!');
      expect(activeCall?.[1]).toEqual({
        clientId: 'client-1',
        statuses: ['picked_up', 'in_transit', 'out_for_delivery'],
      });

      expect(result.totalCount).toBe(4);
      expect(result.actions.map((a) => a.id)).toEqual([
        'orders_pending_payment',
        'active_delivery',
      ]);
    });

    it('omits zero-count actions and sorts critical before high', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        id: 'u1',
        user_type_id: 'business', active_persona: 'business',
        business: { id: 'biz-1' },
      });
      hasuraSystemService.executeQuery.mockImplementation(
        async (query: string, vars: { status?: string }) => {
          if (
            query.includes('ItemsByModeration') &&
            vars.status === 'rejected'
          ) {
            return { items_aggregate: { aggregate: { count: 1 } } };
          }
          if (
            query.includes('OrdersByStatus') &&
            vars.status === 'pending'
          ) {
            return { orders_aggregate: { aggregate: { count: 4 } } };
          }
          return {
            items_aggregate: { aggregate: { count: 0 } },
            rental_location_listings_aggregate: { aggregate: { count: 0 } },
            orders_aggregate: { aggregate: { count: 0 } },
            failed_deliveries_aggregate: { aggregate: { count: 0 } },
          };
        }
      );

      const result = await service.getActionsNeeded();

      expect(result.actions.map((a) => a.id)).toEqual([
        'item_rejected',
        'orders_pending',
      ]);
      expect(result.totalCount).toBe(5);
    });

    it('loads agent ID docs via document_type names and is_approved', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        id: 'u1',
        user_type_id: 'agent',
        active_persona: 'agent',
        agent: { id: 'agent-1' },
      });
      hasuraSystemService.executeQuery.mockImplementation(
        async (query: string) => {
          if (query.includes('AgentIdDoc')) {
            return {
              user_uploads: [{ id: 'up1', is_approved: false, note: 'bad scan' }],
            };
          }
          return {
            agents: [
              { agent_addresses: [{ address: { country: 'CM' } }] },
            ],
            orders_aggregate: { aggregate: { count: 0 } },
            user_uploads: [],
          };
        }
      );

      const result = await service.getActionsNeeded();

      const idCall = hasuraSystemService.executeQuery.mock.calls.find(
        ([query]) => String(query).includes('AgentIdDoc')
      );
      expect(String(idCall?.[0])).toContain('document_type: { name: { _in: $names } }');
      expect(String(idCall?.[0])).toContain('is_approved');
      expect(String(idCall?.[0])).not.toContain('upload_type');
      expect(idCall?.[1]).toEqual({
        userId: 'u1',
        names: ['id_card', 'passport', 'driver_license'],
      });
      expect(result.actions).toEqual([
        expect.objectContaining({
          id: 'id_verification',
          kind: 'id_verification',
          priority: 'critical',
          count: 1,
        }),
      ]);
    });
  });

  describe('getAggregates', () => {
    it('rejects non-business users', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        id: 'u1',
        user_type_id: 'client', active_persona: 'client',
        client: { id: 'c1' },
      });

      try {
        await service.getAggregates();
        fail('expected Forbidden');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
      }
    });

    it('returns product view stats and top viewed products', async () => {
      service = new DashboardService(
        hasuraUserService as any,
        hasuraSystemService as any,
        {
          isBusinessAdmin: jest.fn().mockResolvedValue(false),
        } as any,
        { hasAnyPermission: jest.fn().mockResolvedValue(false) } as any,
        {
          listPendingForBusiness: jest
            .fn()
            .mockResolvedValue({ incoming: [], outgoing: [] }),
        } as any,
        {
          listPending: jest
            .fn()
            .mockResolvedValue({ jobs: [], pendingResultCount: 0 }),
        } as any
      );
      hasuraUserService.getUser.mockResolvedValue({
        id: 'u1',
        user_type_id: 'business',
        active_persona: 'business',
        business: { id: 'biz-1' },
      });
      hasuraSystemService.executeQuery.mockImplementation(
        async (query: string) => {
          if (query.includes('DashboardProductViewStats')) {
            return {
              total: { aggregate: { count: 12 } },
              last7d: { aggregate: { count: 3 } },
            };
          }
          if (query.includes('DashboardTopViewedProducts')) {
            return {
              business_inventory: [
                {
                  id: 'inv-1',
                  item_id: 'item-1',
                  item: {
                    id: 'item-1',
                    name: 'Coffee',
                    item_images: [{ image_url: 'https://img/coffee.jpg' }],
                  },
                  item_view_events_aggregate: { aggregate: { count: 8 } },
                },
                {
                  id: 'inv-2',
                  item_id: 'item-2',
                  item: { id: 'item-2', name: 'Tea', item_images: [] },
                  item_view_events_aggregate: { aggregate: { count: 0 } },
                },
              ],
            };
          }
          if (query.includes('DashboardUniqueClientCount')) {
            return { clients_aggregate: { aggregate: { count: 2 } } };
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
        }
      );

      const result = await service.getAggregates();

      expect(result.totalProductViews).toBe(12);
      expect(result.productViewsLast7d).toBe(3);
      expect(result.topViewedProducts).toEqual([
        {
          inventoryItemId: 'inv-1',
          itemId: 'item-1',
          itemName: 'Coffee',
          imageUrl: 'https://img/coffee.jpg',
          viewsCount: 8,
        },
      ]);
      expect(result.uniqueClientCount).toBe(2);
    });
  });
});
