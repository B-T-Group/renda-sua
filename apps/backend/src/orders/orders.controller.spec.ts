import { Test, TestingModule } from '@nestjs/testing';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: jest.Mocked<OrdersService>;
  let hasuraUserService: jest.Mocked<HasuraUserService>;

  beforeEach(async () => {
    const mockOrdersService = {
      confirmOrder: jest.fn(),
      startPreparing: jest.fn(),
      completePreparation: jest.fn(),
      getOrder: jest.fn(),
      pickUpOrder: jest.fn(),
      startTransit: jest.fn(),
      outForDelivery: jest.fn(),
      deliverOrder: jest.fn(),
      failDelivery: jest.fn(),
      cancelOrder: jest.fn(),
      refundOrder: jest.fn(),
    };

    const mockHasuraUserService = {
      createOrder: jest.fn(),
      updateOrderStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: HasuraUserService,
          useValue: mockHasuraUserService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    ordersService = module.get(OrdersService);
    hasuraUserService = module.get(HasuraUserService);
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      const orderData = {
        item: { business_inventory_id: 'inv-123', quantity: 2 },
      };
      const expectedResult = {
        success: true,
        order: {
          id: 'order-123',
          status: 'pending',
          user_id: 'user-123',
          total_price: 100.0,
          created_at: '2024-01-01T00:00:00Z',
          order_items: [],
        },
        message: 'Order created successfully',
      };

      hasuraUserService.createOrder.mockResolvedValue(expectedResult.order);

      const result = await controller.createOrder(orderData);

      expect(result).toEqual(expectedResult);
      expect(hasuraUserService.createOrder).toHaveBeenCalledWith(orderData);
    });

    it('should handle service errors appropriately', async () => {
      const orderData = {
        item: { business_inventory_id: 'inv-123', quantity: 2 },
      };
      const error = new Error('No valid items found');

      hasuraUserService.createOrder.mockRejectedValue(error);

      await expect(controller.createOrder(orderData)).rejects.toThrow();
    });
  });

  describe('confirmOrder', () => {
    it('should confirm an order successfully', async () => {
      const request = { orderId: 'order-123', notes: 'Confirmed by business' };
      const expectedResult = {
        success: true,
        order: { id: 'order-123', current_status: 'confirmed' },
        message: 'Order confirmed successfully',
      };

      ordersService.confirmOrder.mockResolvedValue(expectedResult);

      const result = await controller.confirmOrder(request);

      expect(result).toEqual(expectedResult);
      expect(ordersService.confirmOrder).toHaveBeenCalledWith(request);
    });
  });

  describe('startPreparing', () => {
    it('should start preparing an order successfully', async () => {
      const request = { orderId: 'order-123', notes: 'Started preparation' };
      const expectedResult = {
        success: true,
        order: { id: 'order-123', current_status: 'preparing' },
        message: 'Order preparation started successfully',
      };

      ordersService.startPreparing.mockResolvedValue(expectedResult);

      const result = await controller.startPreparing(request);

      expect(result).toEqual(expectedResult);
      expect(ordersService.startPreparing).toHaveBeenCalledWith(request);
    });
  });

  describe('completePreparation', () => {
    it('should complete preparation successfully', async () => {
      const request = { orderId: 'order-123', notes: 'Preparation completed' };
      const expectedResult = {
        success: true,
        order: { id: 'order-123', current_status: 'ready_for_pickup' },
        message: 'Order preparation completed successfully',
      };

      ordersService.completePreparation.mockResolvedValue(expectedResult);

      const result = await controller.completePreparation(request);

      expect(result).toEqual(expectedResult);
      expect(ordersService.completePreparation).toHaveBeenCalledWith(request);
    });
  });

  describe('getOrder', () => {
    it('should assign order to agent successfully', async () => {
      const request = { orderId: 'order-123' };
      const expectedResult = {
        success: true,
        order: { id: 'order-123', current_status: 'assigned_to_agent' },
        holdAmount: 80.0,
        message: 'Order assigned successfully',
      };

      ordersService.getOrder.mockResolvedValue(expectedResult);

      const result = await controller.getOrder(request);

      expect(result).toEqual(expectedResult);
      expect(ordersService.getOrder).toHaveBeenCalledWith(request);
    });
  });

  describe('pickUpOrder', () => {
    it('should pick up order successfully', async () => {
      const request = {
        orderId: 'order-123',
        notes: 'Picked up from business',
      };
      const expectedResult = {
        success: true,
        order: { id: 'order-123', current_status: 'picked_up' },
        message: 'Order picked up successfully',
      };

      ordersService.pickUpOrder.mockResolvedValue(expectedResult);

      const result = await controller.pickUpOrder(request);

      expect(result).toEqual(expectedResult);
      expect(ordersService.pickUpOrder).toHaveBeenCalledWith(request);
    });
  });

  describe('startTransit', () => {
    it('should start transit successfully', async () => {
      const request = { orderId: 'order-123', notes: 'Started transit' };
      const expectedResult = {
        success: true,
        order: { id: 'order-123', current_status: 'in_transit' },
        message: 'Order transit started successfully',
      };

      ordersService.startTransit.mockResolvedValue(expectedResult);

      const result = await controller.startTransit(request);

      expect(result).toEqual(expectedResult);
      expect(ordersService.startTransit).toHaveBeenCalledWith(request);
    });
  });

  describe('outForDelivery', () => {
    it('should mark as out for delivery successfully', async () => {
      const request = { orderId: 'order-123', notes: 'Out for delivery' };
      const expectedResult = {
        success: true,
        order: { id: 'order-123', current_status: 'out_for_delivery' },
        message: 'Order marked as out for delivery successfully',
      };

      ordersService.outForDelivery.mockResolvedValue(expectedResult);

      const result = await controller.outForDelivery(request);

      expect(result).toEqual(expectedResult);
      expect(ordersService.outForDelivery).toHaveBeenCalledWith(request);
    });
  });

  describe('deliverOrder', () => {
    it('should deliver order successfully', async () => {
      const request = { orderId: 'order-123', notes: 'Delivered to customer' };
      const expectedResult = {
        success: true,
        order: { id: 'order-123', current_status: 'delivered' },
        message: 'Order delivered successfully',
      };

      ordersService.deliverOrder.mockResolvedValue(expectedResult);

      const result = await controller.deliverOrder(request);

      expect(result).toEqual(expectedResult);
      expect(ordersService.deliverOrder).toHaveBeenCalledWith(request);
    });
  });

  describe('failDelivery', () => {
    it('should mark delivery as failed successfully', async () => {
      const request = { orderId: 'order-123', notes: 'Customer not available' };
      const expectedResult = {
        success: true,
        order: { id: 'order-123', current_status: 'failed' },
        message: 'Delivery marked as failed',
      };

      ordersService.failDelivery.mockResolvedValue(expectedResult);

      const result = await controller.failDelivery(request);

      expect(result).toEqual(expectedResult);
      expect(ordersService.failDelivery).toHaveBeenCalledWith(request);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order successfully', async () => {
      const request = { orderId: 'order-123', notes: 'Cancelled by business' };
      const expectedResult = {
        success: true,
        order: { id: 'order-123', current_status: 'cancelled' },
        message: 'Order cancelled successfully',
      };

      ordersService.cancelOrder.mockResolvedValue(expectedResult);

      const result = await controller.cancelOrder(request);

      expect(result).toEqual(expectedResult);
      expect(ordersService.cancelOrder).toHaveBeenCalledWith(request);
    });
  });

  describe('refundOrder', () => {
    it('should refund order successfully', async () => {
      const request = {
        orderId: 'order-123',
        notes: 'Refunded due to complaint',
      };
      const expectedResult = {
        success: true,
        order: { id: 'order-123', current_status: 'refunded' },
        message: 'Order refunded successfully',
      };

      ordersService.refundOrder.mockResolvedValue(expectedResult);

      const result = await controller.refundOrder(request);

      expect(result).toEqual(expectedResult);
      expect(ordersService.refundOrder).toHaveBeenCalledWith(request);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status successfully', async () => {
      const orderId = 'order-123';
      const updateData = { status: 'confirmed' };
      const expectedResult = {
        success: true,
        order: { id: 'order-123', current_status: 'confirmed' },
        message: 'Order status updated successfully',
      };

      hasuraUserService.updateOrderStatus.mockResolvedValue(
        expectedResult.order
      );

      const result = await controller.updateOrderStatus(orderId, updateData);

      expect(result).toEqual(expectedResult);
      expect(hasuraUserService.updateOrderStatus).toHaveBeenCalledWith(
        orderId,
        updateData.status
      );
    });
  });
});
