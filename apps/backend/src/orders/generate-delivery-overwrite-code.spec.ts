import { HttpException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AWAITING_CLIENT_CONFIRMATION } from '../client-confirm-delivery/client-confirm-delivery.constants';

jest.mock('../addresses/addresses.service', () => ({
  AddressesService: class AddressesService {},
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../notifications/orchestration/channels/email.channel', () => ({
  EmailChannel: class EmailChannel {},
}));

describe('OrdersService.generateDeliveryOverwriteCode', () => {
  const build = (orderExtra: Record<string, unknown> = {}) => {
    const svc: any = Object.create(OrdersService.prototype);
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'biz-user',
        active_persona: 'business',
        business: { id: 'biz-1' },
      }),
    };
    svc.getOrderDetails = jest.fn().mockResolvedValue({
      id: 'order-1',
      business_id: 'biz-1',
      current_status: AWAITING_CLIENT_CONFIRMATION,
      fulfillment_method: 'delivery',
      delivery_pin_hash: null,
      ...orderExtra,
    });
    svc.canAccessOrder = jest.fn().mockResolvedValue(false);
    svc.createStatusHistoryEntry = jest.fn();
    svc.hasuraSystemService = { executeMutation: jest.fn() };
    svc.deliveryPinService = {
      hashOverwriteCode: jest.fn().mockReturnValue('hash'),
    };
    return svc;
  };

  it('allows business overwrite while awaiting_client_confirmation', async () => {
    const svc = build();

    const result = await svc.generateDeliveryOverwriteCode('order-1', 'client no phone');

    expect(result.overwriteCode).toMatch(/^[0-9A-F]{8}$/);
    expect(svc.createStatusHistoryEntry).toHaveBeenCalledWith(
      'order-1',
      AWAITING_CLIENT_CONFIRMATION,
      expect.stringContaining('client no phone'),
      'business',
      'biz-user'
    );
    expect(svc.hasuraSystemService.executeMutation).toHaveBeenCalled();
  });

  it('allows support overwrite while awaiting_client_confirmation', async () => {
    const svc = build();
    svc.hasuraUserService.getUser.mockResolvedValue({
      id: 'support-user',
      active_persona: 'client',
    });
    svc.canAccessOrder.mockResolvedValue(true);

    const result = await svc.generateDeliveryOverwriteCode(
      'order-1',
      'support doorstep assist'
    );

    expect(result.overwriteCode).toBeDefined();
    expect(svc.createStatusHistoryEntry).toHaveBeenCalledWith(
      'order-1',
      AWAITING_CLIENT_CONFIRMATION,
      expect.stringContaining('Support generated'),
      'support',
      'support-user'
    );
  });

  it('still requires a reason on client-confirm orders', async () => {
    const svc = build();
    await expect(svc.generateDeliveryOverwriteCode('order-1', '  ')).rejects.toBeInstanceOf(
      HttpException
    );
    expect(svc.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('refuses overwrite outside the allowed delivery statuses', async () => {
    const svc = build({ current_status: 'picked_up' });
    await expect(
      svc.generateDeliveryOverwriteCode('order-1', 'too early')
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('awaiting client confirmation'),
    });
  });
});
