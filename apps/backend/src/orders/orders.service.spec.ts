import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from '../accounts/accounts.service';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { OrderStatusService } from './order-status.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let hasuraUserService: jest.Mocked<HasuraUserService>;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let configService: jest.Mocked<ConfigService<Configuration>>;
  let accountsService: jest.Mocked<any>;
  let orderStatusService: jest.Mocked<any>;

  const mockUser = {
    id: 'user-123',
    identifier: 'john.doe@example.com',
    email: 'john.doe@example.com',
    first_name: 'John',
    last_name: 'Doe',
    user_type_id: 'business',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    business: { id: 'business-123', user_id: 'user-123' },
    agent: null,
  } as any;

  const mockAgentUser = {
    id: 'agent-123',
    identifier: 'jane.smith@example.com',
    email: 'jane.smith@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    user_type_id: 'agent',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    business: null,
    agent: { id: 'agent-123', user_id: 'agent-123' },
  } as any;

  const mockClientUser = {
    id: 'client-456',
    identifier: 'client@example.com',
    email: 'client@example.com',
    first_name: 'Client',
    last_name: 'User',
    user_type_id: 'client',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    business: null,
    client: { id: 'client-123', user_id: 'client-456' },
    agent: null,
  } as any;

  const mockOrder = {
    id: 'order-123',
    order_number: 'ORD-20241201-000001',
    current_status: 'pending',
    total_amount: 100.0,
    currency: 'USD',
    business: { user_id: 'user-123' },
    client_id: 'client-123',
    assigned_agent_id: null,
    assigned_agent: null,
  };

  const mockReadyOrder = {
    ...mockOrder,
    current_status: 'ready_for_pickup',
  };

  const mockAgentAccount = {
    id: 'account-123',
    available_balance: 1000.0,
    withheld_balance: 0.0,
    total_balance: 1000.0,
  };

  beforeEach(async () => {
    const mockHasuraUserService = {
      getUser: jest.fn(),
      updateOrderStatus: jest.fn(),
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };

    const mockHasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
      getAccount: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockAccountsService = {
      registerTransaction: jest.fn(),
    };

    const mockOrderStatusService = {
      updateOrderStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: HasuraUserService,
          useValue: mockHasuraUserService,
        },
        {
          provide: HasuraSystemService,
          useValue: mockHasuraSystemService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AccountsService,
          useValue: mockAccountsService,
        },
        {
          provide: OrderStatusService,
          useValue: mockOrderStatusService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    hasuraUserService = module.get(HasuraUserService);
    hasuraSystemService = module.get(HasuraSystemService);
    configService = module.get(ConfigService);
    accountsService = module.get(AccountsService);
    orderStatusService = module.get(OrderStatusService);
  });

  describe('confirmOrder', () => {
    it('should confirm an order successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockOrder,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'confirmed',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.confirmOrder({
        orderId: 'order-123',
        notes: 'Confirmed by business',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('confirmed');
      expect(orderStatusService.updateOrderStatus).toHaveBeenCalledWith(
        'order-123',
        'confirmed'
      );
    });

    it('should throw error if user is not a business', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);

      await expect(
        service.confirmOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Only business users can confirm orders',
          HttpStatus.FORBIDDEN
        )
      );
    });

    it('should throw error if order not found', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({ orders_by_pk: null });

      await expect(
        service.confirmOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException('Order not found', HttpStatus.NOT_FOUND)
      );
    });

    it('should throw error if order is not in pending status', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'confirmed' },
      });

      await expect(
        service.confirmOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Cannot confirm order in confirmed status',
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });

  describe('startPreparing', () => {
    it('should start preparing an order successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'confirmed' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'preparing',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.startPreparing({
        orderId: 'order-123',
        notes: 'Started preparation',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('preparing');
    });

    it('should throw error if order is not in confirmed status', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'pending' },
      });

      await expect(
        service.startPreparing({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Cannot start preparing order in pending status',
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });

  describe('startPreparingBatch', () => {
    it('should start preparing multiple orders successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'confirmed' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'preparing',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.startPreparingBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch start preparing',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it('should return partial success when some orders fail', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery
        .mockResolvedValueOnce({
          orders_by_pk: { ...mockOrder, current_status: 'confirmed' },
        })
        .mockResolvedValueOnce({
          orders_by_pk: { ...mockOrder, current_status: 'pending' },
        });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'preparing',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.startPreparingBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch start preparing',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.filter((r) => r.success)).toHaveLength(1);
      expect(result.results.filter((r) => !r.success)).toHaveLength(1);
    });
  });

  describe('completePreparation', () => {
    it('should complete preparation successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'preparing' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'ready_for_pickup',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.completePreparation({
        orderId: 'order-123',
        notes: 'Preparation completed',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('ready_for_pickup');
    });
  });

  describe('completePreparationBatch', () => {
    it('should complete preparation for multiple orders successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'preparing' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'ready_for_pickup',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.completePreparationBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch complete preparation',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it('should return partial success when some orders fail', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery
        .mockResolvedValueOnce({
          orders_by_pk: { ...mockOrder, current_status: 'preparing' },
        })
        .mockResolvedValueOnce({
          orders_by_pk: { ...mockOrder, current_status: 'confirmed' },
        });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'ready_for_pickup',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.completePreparationBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch complete preparation',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.filter((r) => r.success)).toHaveLength(1);
      expect(result.results.filter((r) => !r.success)).toHaveLength(1);
    });
  });

  describe('getOrder', () => {
    beforeEach(() => {
      configService.get.mockReturnValue({ agentHoldPercentage: 80 }); // 80% hold percentage
    });

    it('should assign order to agent successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockReadyOrder,
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        accounts: [mockAgentAccount],
      });
      hasuraSystemService.executeMutation.mockResolvedValue({
        affected_rows: 1,
      });
      hasuraUserService.executeMutation.mockResolvedValue({
        update_orders_by_pk: {
          ...mockReadyOrder,
          current_status: 'assigned_to_agent',
          assigned_agent_id: 'agent-123',
        },
      });

      const result = await service.getOrder({ orderId: 'order-123' });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('assigned_to_agent');
      expect(result.holdAmount).toBe(80.0); // 80% of 100
    });

    it('should throw error if user is not an agent', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);

      await expect(service.getOrder({ orderId: 'order-123' })).rejects.toThrow(
        new HttpException(
          'Only agent users can get orders',
          HttpStatus.FORBIDDEN
        )
      );
    });

    it('should throw error if order is not ready for pickup', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'pending' },
      });

      await expect(service.getOrder({ orderId: 'order-123' })).rejects.toThrow(
        new HttpException(
          'Cannot get order in pending status',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should throw error if agent has insufficient balance', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockReadyOrder,
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        accounts: [{ ...mockAgentAccount, available_balance: 50.0 }],
      });

      await expect(service.getOrder({ orderId: 'order-123' })).rejects.toThrow(
        new HttpException(
          'Insufficient balance. Required: 80 USD, Available: 50 USD',
          HttpStatus.FORBIDDEN
        )
      );
    });

    it('should throw error if agent has no account for currency', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockReadyOrder,
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        accounts: [],
      });

      await expect(service.getOrder({ orderId: 'order-123' })).rejects.toThrow(
        new HttpException(
          'No account found for currency USD',
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });

  describe('pickUpOrder', () => {
    it('should pick up order successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'assigned_to_agent',
          assigned_agent_id: 'agent-123',
        },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'picked_up',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.pickUpOrder({
        orderId: 'order-123',
        notes: 'Picked up from business location',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('picked_up');
    });

    it('should throw error if user is not an agent', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);

      await expect(
        service.pickUpOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Only agent users can pick up orders',
          HttpStatus.FORBIDDEN
        )
      );
    });

    it('should throw error if order is not assigned to agent', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'assigned_to_agent',
          assigned_agent_id: 'different-agent',
        },
      });

      await expect(
        service.pickUpOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Only the assigned agent can pick up this order',
          HttpStatus.FORBIDDEN
        )
      );
    });
  });

  describe('pickUpOrderBatch', () => {
    it('should pick up multiple orders successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'assigned_to_agent',
          assigned_agent_id: 'agent-123',
        },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'picked_up',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.pickUpOrderBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch pick up',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it('should return partial success when some orders fail', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery
        .mockResolvedValueOnce({
          orders_by_pk: {
            ...mockOrder,
            current_status: 'assigned_to_agent',
            assigned_agent_id: 'agent-123',
          },
        })
        .mockResolvedValueOnce({
          orders_by_pk: {
            ...mockOrder,
            current_status: 'assigned_to_agent',
            assigned_agent_id: 'different-agent',
          },
        });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'picked_up',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.pickUpOrderBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch pick up',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.filter((r) => r.success)).toHaveLength(1);
      expect(result.results.filter((r) => !r.success)).toHaveLength(1);
    });
  });

  describe('startTransit', () => {
    it('should start transit successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'picked_up',
          assigned_agent_id: 'agent-123',
        },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'in_transit',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.startTransit({
        orderId: 'order-123',
        notes: 'Started transit to customer',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('in_transit');
    });
  });

  describe('startTransitBatch', () => {
    it('should start transit for multiple orders successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'picked_up',
          assigned_agent_id: 'agent-123',
        },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'in_transit',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.startTransitBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch start transit',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });
  });

  describe('outForDelivery', () => {
    it('should mark as out for delivery successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'in_transit',
          assigned_agent_id: 'agent-123',
        },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'out_for_delivery',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.outForDelivery({
        orderId: 'order-123',
        notes: 'Arrived at customer location',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('out_for_delivery');
    });
  });

  describe('outForDeliveryBatch', () => {
    it('should mark multiple orders as out for delivery successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'in_transit',
          assigned_agent_id: 'agent-123',
        },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'out_for_delivery',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.outForDeliveryBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch out for delivery',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });
  });

  describe('deliverOrder', () => {
    it('should deliver order successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'out_for_delivery',
          assigned_agent_id: 'agent-123',
        },
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        accounts: [mockAgentAccount],
      });
      hasuraSystemService.executeMutation.mockResolvedValue({
        affected_rows: 1,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'delivered',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.deliverOrder({
        orderId: 'order-123',
        notes: 'Delivered to customer',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('delivered');
    });
  });

  describe('deliverOrderBatch', () => {
    it('should deliver multiple orders successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'out_for_delivery',
          assigned_agent_id: 'agent-123',
        },
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        accounts: [mockAgentAccount],
      });
      hasuraSystemService.executeMutation.mockResolvedValue({
        affected_rows: 1,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'delivered',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.deliverOrderBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch deliver',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });
  });

  describe('failDelivery', () => {
    it('should mark delivery as failed successfully', async () => {
      const mockFailedOrder = {
        ...mockOrder,
        current_status: 'out_for_delivery',
        assigned_agent_id: 'agent-123',
        assigned_agent: { user_id: 'agent-123' },
        client: { user_id: 'client-456' },
      };

      const mockOrderHold = {
        id: 'hold-123',
        client_hold_amount: 100.0,
        agent_hold_amount: 80.0,
      };

      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockFailedOrder,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockFailedOrder,
        current_status: 'failed',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      // Mock the getOrCreateOrderHold method
      jest
        .spyOn(service as any, 'getOrCreateOrderHold')
        .mockResolvedValue(mockOrderHold);

      // Mock hasuraSystemService.getAccount for both agent and client
      hasuraSystemService.getAccount
        .mockResolvedValueOnce({
          id: 'agent-account-123',
          available_balance: 1000.0,
        })
        .mockResolvedValueOnce({
          id: 'client-account-123',
          available_balance: 1000.0,
        });

      const result = await service.failDelivery({
        orderId: 'order-123',
        notes: 'Customer not available',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('failed');

      // Verify that both agent and client hold release transactions were registered
      expect(accountsService.registerTransaction).toHaveBeenCalledWith({
        accountId: 'agent-account-123',
        amount: 80.0,
        transactionType: 'release',
        memo: 'Hold released for order ORD-20241201-000001',
        referenceId: 'order-123',
      });

      expect(accountsService.registerTransaction).toHaveBeenCalledWith({
        accountId: 'client-account-123',
        amount: 100.0,
        transactionType: 'release',
        memo: 'Hold released for order ORD-20241201-000001',
        referenceId: 'order-123',
      });
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'pending' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'cancelled',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.cancelOrder({
        orderId: 'order-123',
        notes: 'Cancelled by business',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('cancelled');
    });

    it('should throw error if order cannot be cancelled', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'delivered' },
      });

      await expect(
        service.cancelOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Cannot cancel order in delivered status',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should allow client to cancel their own order in pending status', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'pending' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'cancelled',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.cancelOrder({
        orderId: 'order-123',
        notes: 'Cancelled by client',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('cancelled');
    });

    it('should release client hold when order is cancelled', async () => {
      const mockOrderWithHold = {
        ...mockOrder,
        current_status: 'pending',
        client: { user_id: 'client-456' },
        assigned_agent: null,
      };

      const mockOrderHold = {
        id: 'hold-123',
        client_hold_amount: 100.0,
        agent_hold_amount: 0,
      };

      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockOrderWithHold,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrderWithHold,
        current_status: 'cancelled',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      // Mock the getOrCreateOrderHold method
      jest
        .spyOn(service as any, 'getOrCreateOrderHold')
        .mockResolvedValue(mockOrderHold);

      // Mock hasuraSystemService.getAccount for client
      hasuraSystemService.getAccount.mockResolvedValue({
        id: 'client-account-123',
        available_balance: 1000.0,
      });

      const result = await service.cancelOrder({
        orderId: 'order-123',
        notes: 'Cancelled by client',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('cancelled');

      // Verify that client hold release transaction was registered
      expect(accountsService.registerTransaction).toHaveBeenCalledWith({
        accountId: 'client-account-123',
        amount: 100.0,
        transactionType: 'release',
        memo: 'Hold released for order ORD-20241201-000001',
        referenceId: 'order-123',
      });
    });

    it('should release both agent and client holds when assigned order is cancelled', async () => {
      const mockOrderWithAgentAndHold = {
        ...mockOrder,
        current_status: 'assigned_to_agent',
        client: { user_id: 'client-456' },
        assigned_agent: { user_id: 'agent-123' },
        assigned_agent_id: 'agent-123',
      };

      const mockOrderHold = {
        id: 'hold-123',
        client_hold_amount: 100.0,
        agent_hold_amount: 80.0,
      };

      hasuraUserService.getUser.mockResolvedValue(mockUser); // Business user cancelling
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockOrderWithAgentAndHold,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrderWithAgentAndHold,
        current_status: 'cancelled',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      // Mock the getOrCreateOrderHold method
      jest
        .spyOn(service as any, 'getOrCreateOrderHold')
        .mockResolvedValue(mockOrderHold);

      // Mock hasuraSystemService.getAccount for both agent and client
      hasuraSystemService.getAccount
        .mockResolvedValueOnce({
          id: 'agent-account-123',
          available_balance: 1000.0,
        })
        .mockResolvedValueOnce({
          id: 'client-account-123',
          available_balance: 1000.0,
        });

      const result = await service.cancelOrder({
        orderId: 'order-123',
        notes: 'Cancelled by business',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('cancelled');

      // Verify that agent hold release transaction was registered
      expect(accountsService.registerTransaction).toHaveBeenCalledWith({
        accountId: 'agent-account-123',
        amount: 80.0,
        transactionType: 'release',
        memo: 'Hold released for order ORD-20241201-000001',
        referenceId: 'order-123',
      });

      // Verify that client hold release transaction was registered
      expect(accountsService.registerTransaction).toHaveBeenCalledWith({
        accountId: 'client-account-123',
        amount: 100.0,
        transactionType: 'release',
        memo: 'Hold released for order ORD-20241201-000001',
        referenceId: 'order-123',
      });
    });

    it('should allow client to cancel their own order in confirmed status', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'confirmed' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'cancelled',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.cancelOrder({
        orderId: 'order-123',
        notes: 'Changed my mind',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('cancelled');
    });

    it('should not allow client to cancel order in preparing status', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'preparing' },
      });

      await expect(
        service.cancelOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Cannot cancel order in preparing status',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should not allow client to cancel order that does not belong to them', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          client_id: 'different-client',
          current_status: 'pending',
        },
      });

      await expect(
        service.cancelOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Unauthorized to cancel this order',
          HttpStatus.FORBIDDEN
        )
      );
    });

    it('should not allow non-business and non-client users to cancel orders', async () => {
      const mockInvalidUser = {
        ...mockUser,
        business: null,
        client: null,
      };
      hasuraUserService.getUser.mockResolvedValue(mockInvalidUser);

      await expect(
        service.cancelOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Only business users and clients can cancel orders',
          HttpStatus.FORBIDDEN
        )
      );
    });
  });

  describe('refundOrder', () => {
    it('should refund order successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'delivered' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'refunded',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.refundOrder({
        orderId: 'order-123',
        notes: 'Refunded due to customer complaint',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('refunded');
    });

    it('should throw error if order cannot be refunded', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'pending' },
      });

      await expect(
        service.refundOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Cannot refund order in pending status',
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });

  describe('helper methods', () => {
    it('should get order details correctly', async () => {
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockOrder,
      });

      const result = await (service as any).getOrderDetails('order-123');

      expect(result).toEqual(mockOrder);
      expect(hasuraUserService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('query GetOrder'),
        { orderId: 'order-123' }
      );
    });

    it('should place hold on account correctly', async () => {
      hasuraSystemService.executeMutation.mockResolvedValue({
        affected_rows: 1,
      });

      await (service as any).placeHoldOnAccount(
        'account-123',
        80.0,
        'Hold for order ORD-123',
        'order-123'
      );

      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('mutation PlaceHold'),
        {
          accountId: 'account-123',
          amount: 80.0,
          memo: 'Hold for order ORD-123',
          referenceId: 'order-123',
        }
      );
    });
  });
});
