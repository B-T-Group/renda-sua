import { HttpException, HttpStatus } from '@nestjs/common';
import { AdminOrdersController } from './admin-orders.controller';

describe('AdminOrdersController.updateStatus', () => {
  const order = {
    id: 'order-1',
    current_status: 'confirmed',
  };

  function buildController(opts?: {
    cancelResult?: { success: boolean; message: string };
    cancelError?: Error;
  }) {
    const ordersService = {
      getOrderById: jest.fn().mockResolvedValue(order),
      cancelOrderAsAdmin: jest.fn().mockImplementation(async () => {
        if (opts?.cancelError) throw opts.cancelError;
        return (
          opts?.cancelResult ?? {
            success: true,
            message: 'Order cancelled successfully',
          }
        );
      }),
    };
    const hasuraSystemService = {
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    const orderEventsService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new AdminOrdersController(
      ordersService as any,
      {} as any, // adminOrdersService
      {} as any, // orderReassignmentService
      orderEventsService as any,
      {} as any, // riskIncidentsService
      {} as any, // riskMonitorService
      hasuraSystemService as any,
      {} as any, // hasuraUserService
      {} as any, // notificationsService
      {} as any, // adminOrderContactService
      {} as any  // creditsService
    );
    return { controller, ordersService, hasuraSystemService, orderEventsService };
  }

  it('routes cancelled through cancelOrderAsAdmin instead of a raw status write', async () => {
    const { controller, ordersService, hasuraSystemService } = buildController();

    const result = await controller.updateStatus('order-1', {
      status: 'cancelled',
      notes: 'Customer asked support to cancel',
    });

    expect(ordersService.cancelOrderAsAdmin).toHaveBeenCalledWith(
      'order-1',
      'Customer asked support to cancel'
    );
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'Order cancelled successfully',
    });
  });

  it('rejects delivered so capture and settlement cannot be skipped', async () => {
    const { controller, hasuraSystemService } = buildController();

    await expect(
      controller.updateStatus('order-1', { status: 'delivered' })
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects picked_up so Stripe capture cannot be skipped', async () => {
    const { controller, hasuraSystemService } = buildController();

    await expect(
      controller.updateStatus('order-1', { status: 'picked_up' })
    ).rejects.toBeInstanceOf(HttpException);
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('writes operational mid-flow status with schema-valid history fields', async () => {
    const { controller, hasuraSystemService, orderEventsService } =
      buildController();

    const result = await controller.updateStatus('order-1', {
      status: 'preparing',
      notes: 'Merchant confirmed prep',
    });

    expect(result.success).toBe(true);
    const [mutation, variables] = hasuraSystemService.executeMutation.mock.calls[0];
    expect(mutation).toContain('status: $status');
    expect(mutation).toContain('previous_status: $previousStatus');
    expect(mutation).toContain('changed_by_type: "system"');
    expect(mutation).not.toContain('from_status');
    expect(mutation).not.toContain('to_status');
    expect(variables).toEqual({
      orderId: 'order-1',
      status: 'preparing',
      previousStatus: 'confirmed',
      notes: 'Merchant confirmed prep',
    });
    expect(orderEventsService.recordEvent).toHaveBeenCalled();
  });
});
