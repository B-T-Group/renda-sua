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
  let hasuraSystemService: {
    executeMutation: jest.Mock;
    getAccount?: jest.Mock;
  };
  let stripeCaptureService: {
    resolveCaptureMethodForOrderEntity: jest.Mock;
  };

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
        {
          provide: StripeCaptureService,
          useValue: {
            resolveCaptureMethodForOrderEntity: jest.fn().mockReturnValue('manual'),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get(OrdersService);
    stripeCaptureService = module.get(StripeCaptureService);
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
      update_orders_by_pk: { ...shippingOrder, current_status: 'shipped' },
    });

    const result = await service.markOrderAsShipped('order-123', 'TRACK-1', 'DHL');

    expect(result.success).toBe(true);
    expect(result.order.current_status).toBe('shipped');
  });

  it('marks a preparing shipping order as shipped', async () => {
    hasuraUserService.getUser.mockResolvedValue(businessUser);
    jest.spyOn(service as any, 'getOrderDetails').mockResolvedValue({
      ...shippingOrder,
      current_status: 'preparing',
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders_by_pk: { ...shippingOrder, current_status: 'shipped' },
    });

    const result = await service.markOrderAsShipped('order-123');

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

  it('confirms receipt for the client owner', async () => {
    hasuraUserService.sessionPersonaContext.mockReturnValue({
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client'],
    });
    hasuraUserService.getUser.mockResolvedValue(clientUser);
    jest.spyOn(service as any, 'getOrderDetails').mockResolvedValue({
      ...shippingOrder,
      current_status: 'shipped',
    });
    const capture = jest
      .spyOn(service as any, 'captureStripeAuthorizedOrderIfNeeded')
      .mockResolvedValue(undefined);
    const itemPay = jest
      .spyOn(service, 'processOrderPayment')
      .mockResolvedValue(undefined);
    const deliveryPay = jest
      .spyOn(service, 'processOrderDeliveryPayment')
      .mockResolvedValue(undefined);
    const complete = jest
      .spyOn(service as any, 'completeOrderWithSideEffects')
      .mockResolvedValue(undefined);
    jest.spyOn(service as any, 'stampOrderReceivedAt').mockResolvedValue(undefined);

    const result = await service.confirmOrderReceipt('order-123');

    expect(result.success).toBe(true);
    expect(capture).toHaveBeenCalled();
    expect(itemPay).toHaveBeenCalledWith('order-123');
    expect(deliveryPay).toHaveBeenCalledWith('order-123');
    expect(complete).toHaveBeenCalled();
  });

  it('is idempotent when the shipping order is already complete', async () => {
    hasuraUserService.sessionPersonaContext.mockReturnValue({
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client'],
    });
    hasuraUserService.getUser.mockResolvedValue(clientUser);
    jest.spyOn(service as any, 'getOrderDetails').mockResolvedValue({
      ...shippingOrder,
      current_status: 'complete',
    });
    const capture = jest.spyOn(
      service as any,
      'captureStripeAuthorizedOrderIfNeeded'
    );

    const result = await service.confirmOrderReceipt('order-123');

    expect(result.success).toBe(true);
    expect(capture).not.toHaveBeenCalled();
  });

  it('credits the merchant shipping fee and skips delivery commissions', async () => {
    const order = {
      ...shippingOrder,
      current_status: 'shipped',
      business_location_id: 'loc-1',
    };
    jest.spyOn(service as any, 'getOrderDetails').mockResolvedValue(order);
    jest.spyOn(service as any, 'getOrCreateOrderHold').mockResolvedValue({
      id: 'hold-1',
      item_settlement_completed_at: '2026-01-01T00:00:00Z',
      delivery_settlement_completed_at: null,
      delivery_fees: 1500,
      agent_hold_amount: 0,
    });
    hasuraSystemService.getAccount = jest
      .fn()
      .mockResolvedValueOnce({ id: 'client-acct' })
      .mockResolvedValueOnce({ id: 'biz-acct' });
    const register = jest
      .fn()
      .mockResolvedValue({ success: true, transactionId: 'tx-1' });
    (service as any).accountsService.registerTransaction = register;
    const distribute = jest.fn();
    (service as any).commissionsService = {
      distributeDeliveryCommissions: distribute,
    };
    jest.spyOn(service as any, 'updateOrderHold').mockResolvedValue(undefined);

    await service.processOrderDeliveryPayment('order-123');

    expect(distribute).not.toHaveBeenCalled();
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'biz-acct',
        amount: 1500,
        transactionType: 'deposit',
      })
    );
  });

  it('retries Stripe shipping payment with shipping capture, not delivery', async () => {
    hasuraUserService.sessionPersonaContext.mockReturnValue({
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client'],
    });
    hasuraUserService.getUser.mockResolvedValue(clientUser);
    jest.spyOn(service as any, 'getOrderDetails').mockResolvedValue({
      ...shippingOrder,
      current_status: 'pending_payment',
      payment_source: 'credit_card',
      payment_status: 'pending',
      business_location: { address: { country: 'CA' } },
      client: {
        user_id: 'client-456',
        user: { email: 'c@test.com', first_name: 'Ada', last_name: 'Lovelace' },
      },
    });
    hasuraSystemService.getAccount = jest.fn().mockResolvedValue({ id: 'acct-1' });
    jest.spyOn(service as any, 'buildTaxParamsForOrderRetry').mockResolvedValue({
      taxCheckoutParams: { taxEnabled: false },
      checkoutAmount: 25,
    });
    const createCheckout = jest
      .spyOn(service as any, 'createStripeOrderCheckout')
      .mockResolvedValue({
        paymentUrl: 'https://stripe.test/pay',
        reference: 'ref-1',
        transactionId: 'tx-1',
      });
    jest.spyOn(service as any, 'resetOrderPaymentFailure').mockResolvedValue(undefined);

    const result = await service.retryOrderPayment('order-123');

    expect(result.success).toBe(true);
    expect(
      stripeCaptureService.resolveCaptureMethodForOrderEntity
    ).toHaveBeenCalledWith('CA', 'shipping');
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        captureMethod: 'manual',
        fulfillmentMethod: 'shipping',
      })
    );
  });

  it('uses the customer ship-to address for shipping Stripe tax retry params', async () => {
    const shipTo = {
      address_line_1: '1 King St',
      city: 'Toronto',
      state: 'ON',
      postal_code: 'M5V 1A1',
      country: 'CA',
    };
    const store = {
      address_line_1: '9 Store Rd',
      city: 'Vancouver',
      state: 'BC',
      postal_code: 'V6B 1A1',
      country: 'CA',
    };
    hasuraSystemService.executeQuery = jest.fn().mockResolvedValue({
      orders_by_pk: {
        currency: 'CAD',
        subtotal: 20,
        total_amount: 25,
        base_delivery_fee: 5,
        per_km_delivery_fee: 0,
        discount_amount: 0,
        fulfillment_method: 'shipping',
        delivery_address: shipTo,
        business_location: { address: store },
        order_items: [
          {
            item_name: 'Hat',
            unit_price: 20,
            quantity: 1,
            business_inventory_id: 'inv-1',
            business_inventory: { item: { stripe_tax_code_id: 'txcd' } },
          },
        ],
      },
    });
    (service as any).taxCheckoutBuilder = {
      addressFromRecord: (record: { address_line_1: string; country: string }) => ({
        line1: record.address_line_1,
        country: record.country,
      }),
      isTaxEnabledForCountry: () => true,
      buildLineItems: jest.fn().mockReturnValue([{ amount: 20 }]),
    };

    const result = await (service as any).buildTaxParamsForOrderRetry('order-123');

    expect(result.taxCheckoutParams.customerAddress).toEqual({
      line1: '1 King St',
      country: 'CA',
    });
    expect(result.taxCheckoutParams.deliveryAddress).toEqual(shipTo);
  });
});
