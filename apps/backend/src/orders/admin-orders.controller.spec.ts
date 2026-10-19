import { HttpException, HttpStatus } from '@nestjs/common';
import { AdminOrdersController } from './admin-orders.controller';

describe('AdminOrdersController.updateStatus', () => {
  const order = {
    id: 'order-1',
    current_status: 'confirmed',
  };

  function buildController(opts?: {
    deny?: boolean;
    status?: string;
    cancelResult?: { success: boolean; message: string };
    cancelError?: Error;
  }) {
    const ordersService = {
      getOrderById: jest.fn().mockResolvedValue({ ...order, current_status: opts?.status ?? order.current_status }),
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
      executeMutation: jest.fn().mockResolvedValue({ update_orders: { affected_rows: 1 } }),
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
      {} as any, // creditsService
      {
        require: jest.fn().mockResolvedValue({ all: true }),
        assertOrder: jest.fn().mockImplementation(async () => {
          if (opts?.deny) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
        }),
        assertIncident: jest.fn().mockResolvedValue(undefined),
      } as any
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
    ,
      'confirmed'
    );
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'Order cancelled successfully',
    });
  });

  it('uses the reason the admin UI sends (reason wins over notes, trimmed)', async () => {
    const { controller, ordersService } = buildController();
    await controller.updateStatus('order-1', { status: 'cancelled', reason: '  dup order ', notes: 'n' } as any);
    expect(ordersService.cancelOrderAsAdmin).toHaveBeenCalledWith('order-1', 'dup order', 'confirmed');
  });

  it.each([undefined, '', '   '])('requires a reason to cancel (reason=%p): 400, nothing cancelled', async (reason) => {
    const { controller, ordersService, hasuraSystemService } = buildController();
    await expect(controller.updateStatus('order-1', { status: 'cancelled', reason } as any)).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
    expect(ordersService.cancelOrderAsAdmin).not.toHaveBeenCalled();
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it.each(['picked_up', 'in_transit', 'out_for_delivery'])('refuses to cancel a %s order (after pickup)', async (status) => {
    const { controller, ordersService } = buildController({ status });
    await expect(controller.updateStatus('order-1', { status: 'cancelled', reason: 'r' } as any)).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
    expect(ordersService.cancelOrderAsAdmin).not.toHaveBeenCalled();
  });

  it.each(['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'assigned_to_agent'])(
    'still cancels a pre-pickup %s order',
    async (status) => {
      const { controller, ordersService } = buildController({ status });
      await controller.updateStatus('order-1', { status: 'cancelled', reason: 'r' } as any);
      expect(ordersService.cancelOrderAsAdmin).toHaveBeenCalledWith('order-1', 'r', status);
    }
  );

  it('F-CA1: a country admin outside the order scope cannot cancel (nothing is released or restored)', async () => {
    const { controller, ordersService, hasuraSystemService } = buildController({ deny: true });
    await expect(
      controller.updateStatus('cm-order', { status: 'cancelled', notes: 'x' })
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(ordersService.cancelOrderAsAdmin).not.toHaveBeenCalled();
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('F-CA1: scope is checked before any status branch', async () => {
    for (const status of ['cancelled', 'delivered', 'preparing']) {
      const { controller, ordersService, hasuraSystemService } = buildController({ deny: true });
      await expect(
        controller.updateStatus('cm-order', { status } as any)
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
      expect(ordersService.cancelOrderAsAdmin).not.toHaveBeenCalled();
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    }
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
    const [cas, casVars] = hasuraSystemService.executeMutation.mock.calls[0];
    expect(cas).toContain('current_status: { _eq: $previousStatus }');
    expect(casVars).toEqual({ orderId: 'order-1', status: 'preparing', previousStatus: 'confirmed' });
    const [mutation, variables] = hasuraSystemService.executeMutation.mock.calls[1];
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

  it('#627 C2: a concurrent status change (CAS lost) is a 409 with no history or event', async () => {
    const { controller, hasuraSystemService, orderEventsService } = buildController();
    hasuraSystemService.executeMutation.mockResolvedValueOnce({ update_orders: { affected_rows: 0 } });
    await expect(controller.updateStatus('order-1', { status: 'preparing', notes: 'x' })).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledTimes(1);
    expect(orderEventsService.recordEvent).not.toHaveBeenCalled();
  });

  it('#627 C1: no backward move out of a post-pickup status', async () => {
    for (const status of ['in_transit', 'out_for_delivery', 'shipped', 'picked_up']) {
      const { controller, hasuraSystemService } = buildController({ status });
      await expect(controller.updateStatus('order-1', { status: 'pending', notes: 'x' })).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    }
  });
});
