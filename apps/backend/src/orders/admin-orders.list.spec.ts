jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { AdminOrdersController } from './admin-orders.controller';
import {
  OrderStatusFilter,
  RiskLevelFilter,
} from './dto/admin-orders.dto';
import { OrderRiskService } from './order-risk.service';

describe('AdminOrdersController.getAdminOrders', () => {
  const NOW = '2026-08-20T12:00:00.000Z';

  function createController() {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        orders: [],
        orders_aggregate: { aggregate: { count: 0 } },
      }),
    };
    const controller = new AdminOrdersController(
      {} as any,
      new OrderRiskService(),
      {} as any,
      {} as any,
      hasura as any,
      {} as any
    );
    return { controller, hasura };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('queries businesses.name and sends numeric GraphQL Ints', async () => {
    const { controller, hasura } = createController();

    await controller.getAdminOrders({
      status: OrderStatusFilter.ALL,
      risk_level: RiskLevelFilter.ALL,
      limit: '50' as unknown as number,
      offset: '0' as unknown as number,
    });

    const [query, variables] = hasura.executeQuery.mock.calls[0];
    expect(query).toMatch(/business\s*\{\s*id\s+name/);
    expect(query).not.toMatch(/business_name/);
    expect(variables).toEqual(
      expect.objectContaining({
        limit: 50,
        offset: 0,
      })
    );
    expect(typeof variables.limit).toBe('number');
    expect(typeof variables.offset).toBe('number');
  });

  it('excludes terminal statuses unless a specific status is requested', async () => {
    const { controller, hasura } = createController();

    await controller.getAdminOrders({
      status: OrderStatusFilter.ALL,
      risk_level: RiskLevelFilter.ALL,
    });
    await controller.getAdminOrders({
      status: OrderStatusFilter.PENDING,
      risk_level: RiskLevelFilter.ALL,
    });

    const allWhere = hasura.executeQuery.mock.calls[0][1].where;
    const pendingWhere = hasura.executeQuery.mock.calls[1][1].where;
    expect(allWhere.current_status._nin).toEqual(
      expect.arrayContaining([
        'delivered',
        'complete',
        'cancelled',
        'failed',
        'refunded',
      ])
    );
    expect(pendingWhere.current_status).toEqual({ _eq: 'pending' });
  });

  it('searches by order number or client name', async () => {
    const { controller, hasura } = createController();

    await controller.getAdminOrders({
      status: OrderStatusFilter.ALL,
      risk_level: RiskLevelFilter.ALL,
      search: 'ORD-9',
    });

    expect(hasura.executeQuery.mock.calls[0][1].where._or).toEqual([
      { order_number: { _ilike: '%ORD-9%' } },
      { client: { user: { first_name: { _ilike: '%ORD-9%' } } } },
      { client: { user: { last_name: { _ilike: '%ORD-9%' } } } },
    ]);
  });

  it('filters, sorts, and recounts by computed risk level', async () => {
    const { controller, hasura } = createController();
    hasura.executeQuery.mockResolvedValue({
      orders: [
        {
          id: 'low-older',
          current_status: 'confirmed',
          created_at: '2026-08-20T08:00:00.000Z',
        },
        {
          id: 'high-newer',
          current_status: 'assigned_to_agent',
          pickup_state: 'overdue',
          created_at: '2026-08-20T11:00:00.000Z',
        },
        {
          id: 'high-older',
          current_status: 'assigned_to_agent',
          pickup_state: 'overdue',
          created_at: '2026-08-20T10:00:00.000Z',
        },
      ],
      orders_aggregate: { aggregate: { count: 3 } },
    });

    const all = await controller.getAdminOrders({
      status: OrderStatusFilter.ALL,
      risk_level: RiskLevelFilter.ALL,
    });
    const highOnly = await controller.getAdminOrders({
      status: OrderStatusFilter.ALL,
      risk_level: RiskLevelFilter.HIGH,
    });

    expect(all.orders.map((order: any) => order.id)).toEqual([
      'high-newer',
      'high-older',
      'low-older',
    ]);
    expect(all.total).toBe(3);
    expect(highOnly.orders.map((order: any) => order.id)).toEqual([
      'high-newer',
      'high-older',
    ]);
    expect(highOnly.orders.every((order: any) => order.risk_level === 'high')).toBe(
      true
    );
    expect(highOnly.total).toBe(2);
  });
});
