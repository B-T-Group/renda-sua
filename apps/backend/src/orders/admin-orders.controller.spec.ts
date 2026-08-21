import { HttpException, HttpStatus } from '@nestjs/common';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';

describe('AdminOrdersController.updateStatus', () => {
  let controller: AdminOrdersController;
  let ordersService: {
    cancelOrderAsAdmin: jest.Mock;
    getOrderById: jest.Mock;
  };
  let hasuraSystemService: { executeMutation: jest.Mock };
  let orderEventsService: { recordEvent: jest.Mock };

  beforeEach(() => {
    ordersService = {
      cancelOrderAsAdmin: jest.fn().mockResolvedValue({
        success: true,
        message: 'Order cancelled successfully',
      }),
      getOrderById: jest.fn().mockResolvedValue({
        id: 'order-123',
        current_status: 'confirmed',
      }),
    };
    hasuraSystemService = { executeMutation: jest.fn().mockResolvedValue({}) };
    orderEventsService = { recordEvent: jest.fn().mockResolvedValue(undefined) };
    controller = new AdminOrdersController(
      ordersService as unknown as OrdersService,
      {} as any,
      {} as any,
      orderEventsService as any,
      hasuraSystemService as any,
      {} as any,
      {} as any
    );
  });

  it('routes cancelled through cancelOrderAsAdmin so payment and inventory are released', async () => {
    const result = await controller.updateStatus('order-123', {
      status: 'cancelled',
      notes: 'Stuck assignment',
    });

    expect(ordersService.cancelOrderAsAdmin).toHaveBeenCalledWith(
      'order-123',
      'Stuck assignment'
    );
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'Order cancelled successfully',
    });
  });

  it('rejects delivered so settlement is not skipped', async () => {
    await expect(
      controller.updateStatus('order-123', { status: 'delivered' })
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(ordersService.cancelOrderAsAdmin).not.toHaveBeenCalled();
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('still allows a pre-fulfillment status override', async () => {
    const result = await controller.updateStatus('order-123', {
      status: 'preparing',
      notes: 'Merchant asked to start',
    });

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('UpdateOrderStatus'),
      expect.objectContaining({
        orderId: 'order-123',
        status: 'preparing',
        previousStatus: 'confirmed',
      })
    );
    expect(result.success).toBe(true);
  });

  it('rethrows HttpException from cancel instead of wrapping as 500', async () => {
    ordersService.cancelOrderAsAdmin.mockRejectedValue(
      new HttpException('Cannot cancel order in picked_up status', HttpStatus.BAD_REQUEST)
    );

    await expect(
      controller.updateStatus('order-123', { status: 'cancelled' })
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
  });
});
