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
    it('allows the client to cancel when no agent is assigned', async () => {
      hasuraUserService.getUser.mockResolvedValue(clientUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: baseOrder,
      });
      mockSuccessfulUpdate('cancelled');

      const result = await service.updateOrderStatus('order-123', 'cancelled');

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

    it('rejects client transitions other than cancelled', async () => {
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

  describe('carrier shipping transitions', () => {
    const shippingOrder = {
      ...baseOrder,
      current_status: 'confirmed',
    };

    it('lets the business move confirmed to awaiting_shipment or shipped', async () => {
      hasuraUserService.getUser.mockResolvedValue(businessUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: shippingOrder,
      });
      mockSuccessfulUpdate('awaiting_shipment');

      await expect(
        service.updateOrderStatus('order-123', 'awaiting_shipment')
      ).resolves.toEqual(
        expect.objectContaining({ current_status: 'awaiting_shipment' })
      );

      mockSuccessfulUpdate('shipped');
      await expect(
        service.updateOrderStatus('order-123', 'shipped')
      ).resolves.toEqual(expect.objectContaining({ current_status: 'shipped' }));
    });

    it('lets the client complete a shipped order but not the business', async () => {
      hasuraUserService.getUser.mockResolvedValue(clientUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...shippingOrder, current_status: 'shipped' },
      });
      mockSuccessfulUpdate('complete');

      await expect(
        service.updateOrderStatus('order-123', 'complete')
      ).resolves.toEqual(expect.objectContaining({ current_status: 'complete' }));

      hasuraUserService.getUser.mockResolvedValue(businessUser as any);
      await expect(
        service.updateOrderStatus('order-123', 'complete')
      ).rejects.toThrow('Invalid status transition from shipped to complete');
    });

    it('rejects agent transitions on shipping statuses', async () => {
      hasuraUserService.getUser.mockResolvedValue(agentUser as any);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...shippingOrder, current_status: 'awaiting_shipment' },
      });

      await expect(
        service.updateOrderStatus('order-123', 'shipped')
      ).rejects.toThrow('Unauthorized to update this order');
    });
  });

  describe('updateOrderStatus after agent assignment', () => {
    it('rejects a client cancel once the order is assigned to an agent', async () => {
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
      ).rejects.toThrow(
        'Invalid status transition from assigned_to_agent to cancelled'
      );
    });
  });
});
