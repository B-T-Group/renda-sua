import { HttpException } from '@nestjs/common';
import { OrderStatusService } from './order-status.service';

describe('OrderStatusService status updates with completed_at', () => {
  const hasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const hasuraUserService = {
    getUser: jest.fn(),
  };
  const orderQueueService = {
    sendOrderStatusUpdatedMessage: jest.fn(),
  };
  const agentReferralsService = {
    creditAfterFirstDelivery: jest.fn(),
  };
  const paymentRoutingService = {
    getUserCountryCode: jest.fn(),
  };
  const representativeCompensationService = {
    evaluateForOrderSafe: jest.fn(),
  };

  let service: OrderStatusService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrderStatusService(
      hasuraSystemService as never,
      hasuraUserService as never,
      orderQueueService as never,
      agentReferralsService as never,
      paymentRoutingService as never,
      representativeCompensationService as never
    );
    hasuraUserService.getUser.mockResolvedValue({
      id: 'user-1',
      agent: { id: 'agent-1' },
      active_persona: 'agent',
    });
    paymentRoutingService.getUserCountryCode.mockResolvedValue('CM');
    orderQueueService.sendOrderStatusUpdatedMessage.mockResolvedValue(undefined);
  });

  it('sets completed_at when transitioning to complete with null completed_at', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      orders_by_pk: {
        id: 'order-1',
        order_number: 'ORD-001',
        current_status: 'out_for_delivery',
        business_id: 'biz-1',
        business: { user_id: 'user-1' },
        assigned_agent_id: 'agent-1',
        assigned_agent: { user_id: 'user-1' },
      },
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: {
        affected_rows: 1,
        returning: [
          {
            id: 'order-1',
            order_number: 'ORD-001',
            current_status: 'complete',
            completed_at: '2026-10-13T12:00:00.000Z',
            updated_at: '2026-10-13T12:00:00.000Z',
          },
        ],
      },
    });

    const result = await service.updateOrderStatus('order-1', 'complete', {
      viaSystem: true,
    });

    expect(result.current_status).toBe('complete');
    expect(result.completed_at).toBeDefined();
    const mutation = hasuraSystemService.executeMutation.mock.calls[0][0];
    expect(mutation).toContain('completed_at: "now()"');
    expect(mutation).toContain('completed_at: { _is_null: true }');
  });

  it('does not overwrite completed_at when transitioning delivered to complete', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('GetOrder')) {
        return {
          orders_by_pk: {
            id: 'order-1',
            order_number: 'ORD-001',
            current_status: 'delivered',
            business_id: 'biz-1',
            business: { user_id: 'user-1' },
            client_id: 'client-1',
            client: { user_id: 'client-user-1' },
          },
        };
      }
      if (query.includes('CheckOrderStatus')) {
        return {
          orders_by_pk: {
            id: 'order-1',
            current_status: 'complete',
            completed_at: '2026-10-13T10:00:00.000Z',
          },
        };
      }
      return {};
    });
    hasuraUserService.getUser.mockResolvedValue({
      id: 'client-user-1',
      active_persona: 'client',
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: {
        affected_rows: 0,
        returning: [],
      },
    });

    const result = await service.updateOrderStatus('order-1', 'complete', {
      viaSystem: true,
    });

    expect(result.current_status).toBe('complete');
    expect(result.completed_at).toBe('2026-10-13T10:00:00.000Z');
  });

  it('throws conflict when mutation fails for non-completion status', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      orders_by_pk: {
        id: 'order-1',
        order_number: 'ORD-001',
        current_status: 'confirmed',
        business_id: 'biz-1',
        business: { user_id: 'user-1' },
      },
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: {
        affected_rows: 0,
        returning: [],
      },
    });

    await expect(
      service.updateOrderStatus('order-1', 'preparing', { viaSystem: true })
    ).rejects.toThrow(HttpException);
  });
});
