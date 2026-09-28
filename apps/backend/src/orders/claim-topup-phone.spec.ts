jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';

const LINKED_PHONE = '+237622222222';
const PROFILE_PHONE = '+237600000000';

function claimOrder() {
  return {
    id: 'order-1',
    order_number: 'ORD-1',
    current_status: 'ready_for_pickup',
    fulfillment_method: 'delivery',
    verified_agent_delivery: false,
    currency: 'XAF',
    subtotal: 10000,
    business_location: { address: { country: 'CM' } },
    client: { user_id: 'client-1' },
  };
}

function createHarness() {
  const resolveCheckoutPaymentPhone = jest.fn().mockResolvedValue({
    phoneE164: LINKED_PHONE,
  });
  const createTransaction = jest.fn().mockResolvedValue({ id: 'tx-1' });
  const updateTransaction = jest.fn().mockResolvedValue(undefined);
  const initiatePayment = jest.fn().mockResolvedValue({
    success: true,
    transactionId: 'prov-1',
  });
  const hasPendingClaimOrderForOrderNumber = jest
    .fn()
    .mockResolvedValue(false);
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, {
    hasuraUserService: {
      getUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        first_name: 'Ada',
        last_name: 'Agent',
        email: 'ada@example.com',
        phone_number: PROFILE_PHONE,
        active_persona: 'agent',
        agent: { id: 'agent-1', is_verified: true, is_internal: false },
      }),
      sessionPersonaContext: jest.fn().mockReturnValue({
        jwtDefaultRole: 'agent',
        jwtAllowedRoles: ['agent'],
      }),
    },
    hasuraSystemService: {
      executeQuery: jest.fn().mockResolvedValue({
        agents_by_pk: { status: 'active' },
      }),
      getAccount: jest.fn().mockResolvedValue({ id: 'acct-1' }),
    },
    mobilePaymentPhonesService: { resolveCheckoutPaymentPhone },
    mobilePaymentsDatabaseService: {
      hasPendingClaimOrderForOrderNumber,
      createTransaction,
      updateTransaction,
    },
    mobilePaymentsService: {
      getProviderForCountry: jest.fn().mockReturnValue('freemopay'),
      initiatePayment,
    },
    waitAndExecuteScheduleService: {
      schedulePaymentTimeout: jest.fn().mockResolvedValue(undefined),
    },
    logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
  });
  jest
    .spyOn(service as any, 'getOrderWithItems')
    .mockResolvedValue(claimOrder());
  jest.spyOn(service as any, 'resolveOrderHoldAmount').mockResolvedValue(2500);
  return {
    service,
    resolveCheckoutPaymentPhone,
    createTransaction,
    initiatePayment,
  };
}

describe('claimOrderWithTopup phone and fee owner', () => {
  it('sends an edited number and charges the merchant, not the agent', async () => {
    const harness = createHarness();

    const result = await harness.service.claimOrderWithTopup({
      orderId: 'order-1',
      phone_number: '  +241077000000  ',
    });

    expect(harness.resolveCheckoutPaymentPhone).not.toHaveBeenCalled();
    expect(harness.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_phone: '+241077000000',
        payment_entity: 'claim_order',
        amount: 2500,
      })
    );
    expect(harness.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        customerPhone: '+241077000000',
        ownerCharge: 'MERCHANT',
        amount: 2500,
        itemCountry: 'CM',
      }),
      expect.any(String),
      'user-1'
    );
    expect(result).toMatchObject({
      success: true,
      phoneNumber: '+241077000000',
      holdAmount: 2500,
    });
  });

  it('uses the linked Mobile Money number without rewriting the profile', async () => {
    const harness = createHarness();

    await harness.service.claimOrderWithTopup({ orderId: 'order-1' });

    expect(harness.resolveCheckoutPaymentPhone).toHaveBeenCalledWith({
      userId: 'user-1',
      profilePhone: PROFILE_PHONE,
      linkProfileIfNeeded: false,
    });
    expect(harness.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        customerPhone: LINKED_PHONE,
        ownerCharge: 'MERCHANT',
      }),
      expect.any(String),
      'user-1'
    );
  });

  it('falls back to the profile phone when the linked number is blank', async () => {
    const harness = createHarness();
    harness.resolveCheckoutPaymentPhone.mockResolvedValue({
      phoneE164: '   ',
    });

    await harness.service.claimOrderWithTopup({
      orderId: 'order-1',
      phone_number: '   ',
    });

    expect(harness.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ customerPhone: PROFILE_PHONE }),
      expect.any(String),
      'user-1'
    );
  });

  it('refuses to start a claim payment when no phone can be resolved', async () => {
    const harness = createHarness();
    harness.resolveCheckoutPaymentPhone.mockResolvedValue({ phoneE164: '' });
    (harness.service as any).hasuraUserService.getUser.mockResolvedValue({
      id: 'user-1',
      first_name: 'Ada',
      last_name: 'Agent',
      phone_number: '  ',
      active_persona: 'agent',
      agent: { id: 'agent-1', is_verified: true, is_internal: false },
    });

    await expect(
      harness.service.claimOrderWithTopup({ orderId: 'order-1' })
    ).rejects.toMatchObject({
      response: { error: 'PHONE_NUMBER_REQUIRED' },
      status: HttpStatus.BAD_REQUEST,
    });
    expect(harness.initiatePayment).not.toHaveBeenCalled();
    expect(harness.createTransaction).not.toHaveBeenCalled();
  });
});
