import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { OrdersService } from './orders.service';
import { OrderStatusService } from './order-status.service';
import { AccountsService } from '../accounts/accounts.service';
import { StripeCaptureService } from '../stripe-payments/stripe-capture.service';

jest.mock('../addresses/addresses.service', () => ({
  AddressesService: class AddressesService {},
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../notifications/orchestration/channels/email.channel', () => ({
  EmailChannel: class EmailChannel {},
}));

describe('OrdersService carrier shipping', () => {
  let service: OrdersService;
  let hasuraUserService: { getUser: jest.Mock; sessionPersonaContext: jest.Mock };
  let hasuraSystemService: { executeMutation: jest.Mock };

  const businessUser = {
    id: 'user-123',
    active_persona: 'business',
    business: { id: 'business-123', user_id: 'user-123' },
  };

  const clientUser = {
    id: 'client-456',
    active_persona: 'client',
    client: { id: 'client-123', user_id: 'client-456' },
  };

  const shippingOrder = {
    id: 'order-123',
    order_number: 'ORD-SHIP-1',
    business_id: 'business-123',
    business: { user_id: 'user-123' },
    client_id: 'client-123',
    client: { user_id: 'client-456' },
    fulfillment_method: 'shipping',
    current_status: 'confirmed',
    payment_timing: 'pay_now',
    currency: 'CAD',
  };

  beforeEach(async () => {
    hasuraUserService = {
      getUser: jest.fn(),
      sessionPersonaContext: jest.fn().mockReturnValue({
        jwtDefaultRole: 'business',
        jwtAllowedRoles: ['business', 'client'],
      }),
    };
    hasuraSystemService = {
      executeMutation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: HasuraUserService, useValue: hasuraUserService },
        { provide: HasuraSystemService, useValue: hasuraSystemService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: AccountsService, useValue: { registerTransaction: jest.fn() } },
        { provide: OrderStatusService, useValue: {} },
        { provide: StripeCaptureService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get(OrdersService);
  });

  it('rejects markOrderAsShipped when the actor is not the business owner user', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      ...businessUser,
      id: 'other-user',
      business: { id: 'business-123', user_id: 'other-user' },
    });
    jest.spyOn(service as any, 'getOrderDetails').mockResolvedValue(shippingOrder);

    await expect(service.markOrderAsShipped('order-123')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('marks a confirmed shipping order as shipped for the business owner', async () => {
    hasuraUserService.getUser.mockResolvedValue(businessUser);
    jest.spyOn(service as any, 'getOrderDetails').mockResolvedValue(shippingOrder);
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: {
        affected_rows: 1,
        returning: [{ ...shippingOrder, current_status: 'shipped' }],
      },
    });

    const result = await service.markOrderAsShipped('order-123', 'TRACK-1', 'DHL');

    expect(result.success).toBe(true);
    expect(result.order.current_status).toBe('shipped');
  });

  it('rejects confirmOrderReceipt when user.id matches client_id but not client.user_id', async () => {
    hasuraUserService.sessionPersonaContext.mockReturnValue({
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client'],
    });
    hasuraUserService.getUser.mockResolvedValue({
      ...clientUser,
      id: 'client-123',
      client: { id: 'other-client', user_id: 'client-123' },
    });
    jest
      .spyOn(service as any, 'getOrderDetails')
      .mockResolvedValue({ ...shippingOrder, current_status: 'shipped' });

    await expect(service.confirmOrderReceipt('order-123')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('captures, settles, and runs completion side effects on confirmOrderReceipt', async () => {
    hasuraUserService.sessionPersonaContext.mockReturnValue({
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client'],
    });
    hasuraUserService.getUser.mockResolvedValue(clientUser);
    jest
      .spyOn(service as any, 'getOrderDetails')
      .mockResolvedValue({ ...shippingOrder, current_status: 'shipped' });
    const captureSpy = jest
      .spyOn(service as any, 'captureStripeAuthorizedOrderIfNeeded')
      .mockResolvedValue(undefined);
    const paySpy = jest.spyOn(service, 'processOrderPayment').mockResolvedValue();
    const feeSpy = jest
      .spyOn(service as any, 'settleShippingFeeToMerchant')
      .mockResolvedValue(undefined);
    const completeSpy = jest
      .spyOn(service as any, 'completeOrderWithSideEffects')
      .mockResolvedValue(undefined);
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: { affected_rows: 1 },
    });

    const result = await service.confirmOrderReceipt('order-123');

    expect(result.success).toBe(true);
    expect(captureSpy).toHaveBeenCalled();
    expect(paySpy).toHaveBeenCalledWith('order-123');
    expect(feeSpy).toHaveBeenCalledWith('order-123');
    expect(completeSpy).toHaveBeenCalled();
  });
});
