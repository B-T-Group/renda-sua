import { HttpException, HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('order PIN attempt claim', () => {
  const svc: any = Object.create(OrdersService.prototype);

  beforeEach(() => {
    svc.deliveryPinService = {
      getMaxPinAttempts: () => 3,
      verifyPin: jest.fn().mockReturnValue(true),
      isLegacyHash: () => true,
    };
    svc.hasuraSystemService = { executeMutation: jest.fn() };
    svc.upgradeLegacyDeliveryPinHash = jest.fn();
    svc.recordPinFailedStrikeAndMaybeSuspend = jest.fn();
  });

  it('does not check the PIN when the attempt claim loses', async () => {
    svc.hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: { affected_rows: 0, returning: [] },
    });
    await expect(
      svc.verifyOrderDeliveryPinForBusiness(
        { id: 'order-1', delivery_pin_hash: 'hash', delivery_pin_attempts: 0 },
        '1234'
      )
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(svc.deliveryPinService.verifyPin).not.toHaveBeenCalled();
  });

  it('accepts a correct delivery PIN after claiming the attempt', async () => {
    svc.hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: {
        affected_rows: 1,
        returning: [{ delivery_pin_attempts: 1 }],
      },
    });
    await svc.verifyOrderDeliveryPinForBusiness(
      { id: 'order-1', delivery_pin_hash: 'hash', delivery_pin_attempts: 0 },
      '1234'
    );
    expect(svc.deliveryPinService.verifyPin).toHaveBeenCalledWith(
      'order-1',
      '1234',
      'hash'
    );
    const mutation = svc.hasuraSystemService.executeMutation.mock.calls[0][0] as string;
    expect(mutation).toContain('delivery_pin_attempts: { _lt: $max }');
    expect(mutation).toContain('_inc:');
  });

  it('records a strike only when the claimed attempt is the last and the PIN is wrong', async () => {
    svc.deliveryPinService.verifyPin.mockReturnValue(false);
    svc.hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: {
        affected_rows: 1,
        returning: [{ delivery_pin_attempts: 3 }],
      },
    });
    const order = {
      id: 'order-1',
      assigned_agent_id: 'agent-1',
      current_status: 'out_for_delivery',
      assigned_agent: { status: 'active' },
      delivery_pin_hash: 'hash',
      delivery_pin_attempts: 2,
      order_items: [],
      client: { user_id: 'c' },
    };
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'agent-user',
        active_persona: 'agent',
        agent: { id: 'agent-1' },
      }),
    };
    svc.requireActivePersona = jest.fn();
    svc.requireAgentRecord = jest.fn().mockReturnValue({ id: 'agent-1' });
    svc.getOrderDetails = jest.fn().mockResolvedValue(order);
    await expect(
      svc.completeDelivery({ orderId: 'order-1', pin: '0000' })
    ).rejects.toBeInstanceOf(HttpException);
    expect(svc.recordPinFailedStrikeAndMaybeSuspend).toHaveBeenCalledWith(
      'agent-1',
      'order-1'
    );
  });
});
