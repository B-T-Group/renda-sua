import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatusService } from './order-status.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { OrderQueueService } from './order-queue.service';

describe('OrderStatusService', () => {
  let service: OrderStatusService;
  let hasuraSystemService: jest.Mocked<
    Pick<HasuraSystemService, 'executeQuery' | 'executeMutation'>
  >;
  let hasuraUserService: jest.Mocked<Pick<HasuraUserService, 'getUser'>>;

  const clientUser = {
    id: 'user-client-1',
    active_persona: 'client',
    client: { id: 'client-1' },
  };

  const agentUser = {
    id: 'user-agent-1',
    active_persona: 'agent',
    agent: { id: 'agent-1' },
  };

  const businessUser = {
    id: 'user-business-1',
    active_persona: 'business',
    business: { id: 'business-1' },
  };

  const baseOrder = {
    id: 'order-123',
    order_number: 'ORD-123',
    current_status: 'ready_for_pickup',
    business_id: 'business-1',
    business: { user_id: 'user-business-1' },
    assigned_agent_id: null,
    assigned_agent: null,
    client_id: 'client-1',
    client: { user_id: 'user-client-1' },
  };

  beforeEach(async () => {
    hasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    hasuraUserService = {
      getUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderStatusService,
        { provide: HasuraSystemService, useValue: hasuraSystemService },
        { provide: HasuraUserService, useValue: hasuraUserService },
        {
          provide: OrderQueueService,
          useValue: { sendOrderStatusUpdatedMessage: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(OrderStatusService);
  });

  const mockSuccessfulUpdate = (newStatus: string) => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: {
        affected_rows: 1,
        returning: [{ ...baseOrder, current_status: newStatus }],
      },
    });
  };

  describe('updateOrderStatus from ready_for_pickup', () => {
    it('rejects client cancel via generic status path (must use POST /orders/cancel)', async () => {
      hasuraUserService.getUser.mockResolvedValue(clientUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: baseOrder,
      });

      await expect(
        service.updateOrderStatus('order-123', 'cancelled')
      ).rejects.toThrow('Cancellations must use POST /orders/cancel');
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    });

    it('allows cancel when called from the dedicated cancel endpoint', async () => {
      hasuraUserService.getUser.mockResolvedValue(clientUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: baseOrder,
      });
      mockSuccessfulUpdate('cancelled');

      const result = await service.updateOrderStatus('order-123', 'cancelled', {
        viaCancelEndpoint: true,
      });

      expect(result.current_status).toBe('cancelled');
    });

    it('allows cancel endpoint options when actor argument is omitted', async () => {
      hasuraUserService.getUser.mockResolvedValue(clientUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: baseOrder,
      });
      mockSuccessfulUpdate('cancelled');

      const result = await service.updateOrderStatus(
        'order-123',
        'cancelled',
        undefined,
        { viaCancelEndpoint: true }
      );

      expect(result.current_status).toBe('cancelled');
    });

    it('still allows an agent to assign the order to themselves', async () => {
      hasuraUserService.getUser.mockResolvedValue(agentUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: baseOrder,
      });
      mockSuccessfulUpdate('assigned_to_agent');

      const result = await service.updateOrderStatus(
        'order-123',
        'assigned_to_agent'
      );

      expect(result.current_status).toBe('assigned_to_agent');
    });

    it('rejects client transitions other than cancel-via-endpoint', async () => {
      hasuraUserService.getUser.mockResolvedValue(clientUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: baseOrder,
      });

      await expect(
        service.updateOrderStatus('order-123', 'complete')
      ).rejects.toThrow(
        'Invalid status transition from ready_for_pickup to complete'
      );
    });
  });

  describe('updateOrderStatus shipping backdoor', () => {
    it('rejects business confirmed → shipped on the generic status endpoint', async () => {
      hasuraUserService.getUser.mockResolvedValue(businessUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...baseOrder, current_status: 'confirmed' },
      });

      await expect(
        service.updateOrderStatus('order-123', 'shipped')
      ).rejects.toThrow('Invalid status transition from confirmed to shipped');
    });

    it('rejects business confirmed → ready_for_pickup for shipping orders', async () => {
      hasuraUserService.getUser.mockResolvedValue(businessUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...baseOrder,
          current_status: 'confirmed',
          fulfillment_method: 'shipping',
        },
      });

      await expect(
        service.updateOrderStatus('order-123', 'ready_for_pickup')
      ).rejects.toThrow(
        'Invalid status transition from confirmed to ready_for_pickup'
      );
    });

    it('rejects client shipped → complete on the generic status endpoint', async () => {
      hasuraUserService.getUser.mockResolvedValue(clientUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...baseOrder, current_status: 'shipped' },
      });

      await expect(
        service.updateOrderStatus('order-123', 'complete')
      ).rejects.toThrow('Invalid status transition from shipped to complete');
    });
  });

  describe('updateOrderStatus cancel from preparing', () => {
    it('rejects business cancel via generic status path', async () => {
      hasuraUserService.getUser.mockResolvedValue(businessUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...baseOrder,
          current_status: 'preparing',
        },
      });

      await expect(
        service.updateOrderStatus('order-123', 'cancelled')
      ).rejects.toThrow('Cancellations must use POST /orders/cancel');
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    });
  });

  describe('updateOrderStatus after agent assignment', () => {
    it('still rejects status-only cancel (eligibility is enforced by cancelOrder)', async () => {
      hasuraUserService.getUser.mockResolvedValue(clientUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...baseOrder,
          current_status: 'assigned_to_agent',
          assigned_agent_id: 'agent-1',
          assigned_agent: { user_id: 'user-agent-1' },
        },
      });

      await expect(
        service.updateOrderStatus('order-123', 'cancelled')
      ).rejects.toThrow('Cancellations must use POST /orders/cancel');
    });
  });
});
