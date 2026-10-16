jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { OrdersService } from './orders.service';

const ACTOR = {
  userId: 'biz-user',
  businessId: 'biz-1',
  locationId: 'loc-1',
};

function tx(status: 'processing' | 'failed') {
  return {
    id: 'tx-inflight',
    reference: 'ORD-1-a',
    status,
    transaction_id: 'prov-1',
  };
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    order_number: 'ORD-1',
    assigned_agent_id: 'agent-1',
    payment_timing: 'pay_at_delivery',
    current_status: 'out_for_delivery',
    payment_status: 'pending',
    business_id: 'biz-1',
    business_location_id: 'loc-1',
    currency: 'XAF',
    total_amount: 1500,
    client: { user_id: 'client-user', user: { email: 'c@example.com' } },
    ...overrides,
  };
}

function harness() {
  const getPending = jest.fn();
  const createTransaction = jest.fn();
  const initiatePayment = jest.fn();
  const getProviderForCountry = jest.fn(() => {
    throw new Error('guard did not stop');
  });
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, {
    hasuraUserService: {
      getUser: jest.fn().mockResolvedValue({ id: 'agent-user' }),
    },
    mobilePaymentsDatabaseService: {
      getPendingOrderPaymentTransactionByOrderNumber: getPending,
      createTransaction,
    },
    mobilePaymentsService: { initiatePayment, getProviderForCountry },
    logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
  });
  jest.spyOn(service as any, 'requireActivePersona').mockImplementation(() => undefined);
  jest.spyOn(service as any, 'requireAgentRecord').mockReturnValue({ id: 'agent-1' });
  const getOrderDetails = jest.spyOn(service as any, 'getOrderDetails');
  jest.spyOn(service as any, 'resolveOrderMobileMoneyPhone').mockReturnValue('+237670000111');
  const reset = jest
    .spyOn(service as any, 'resetOrderPaymentFailure')
    .mockResolvedValue(undefined);
  return {
    service,
    getPending,
    createTransaction,
    initiatePayment,
    getProviderForCountry,
    getOrderDetails,
    reset,
  };
}

function expectNoSecondPrompt(built: ReturnType<typeof harness>) {
  expect(built.createTransaction).not.toHaveBeenCalled();
  expect(built.initiatePayment).not.toHaveBeenCalled();
  expect(built.getProviderForCountry).not.toHaveBeenCalled();
}

describe('in-flight processing payment blocks a second MoMo prompt', () => {
  it('pay at delivery returns the processing attempt', async () => {
    const built = harness();
    built.getOrderDetails.mockResolvedValue(order());
    built.getPending.mockResolvedValue(tx('processing'));

    await expect(built.service.initiatePayAtDeliveryPayment('order-1')).resolves.toMatchObject({
      success: true,
      message: 'Payment request already in progress',
      database_transaction: { id: 'tx-inflight', status: 'processing' },
    });
    expectNoSecondPrompt(built);
    expect(built.reset).not.toHaveBeenCalled();
  });

  it('pay at delivery does not treat a failed attempt as in flight', async () => {
    const built = harness();
    built.getOrderDetails.mockResolvedValue(order());
    built.getPending.mockResolvedValue(tx('failed'));

    await expect(built.service.initiatePayAtDeliveryPayment('order-1')).rejects.toThrow(
      'guard did not stop'
    );
  });

  it('pay at pickup returns the processing attempt and clears the failure flag', async () => {
    const built = harness();
    built.getOrderDetails.mockResolvedValue(
      order({ payment_timing: 'pay_at_pickup', current_status: 'ready_for_pickup' })
    );
    built.getPending.mockResolvedValue(tx('processing'));

    await expect(
      built.service.initiatePayAtPickupPayment('order-1', undefined, ACTOR)
    ).resolves.toMatchObject({
      message: 'Payment request already in progress',
      database_transaction: { status: 'processing' },
    });
    expectNoSecondPrompt(built);
    expect(built.reset).toHaveBeenCalledWith('order-1');
  });

  it('pay at pickup does not treat a failed attempt as in flight', async () => {
    const built = harness();
    built.getOrderDetails.mockResolvedValue(
      order({ payment_timing: 'pay_at_pickup', current_status: 'ready_for_pickup' })
    );
    built.getPending.mockResolvedValue(tx('failed'));

    await expect(
      built.service.initiatePayAtPickupPayment('order-1', undefined, ACTOR)
    ).rejects.toThrow('guard did not stop');
    expect(built.reset).not.toHaveBeenCalled();
  });

  it('cooked-food confirm does not send a second prompt while processing', async () => {
    const built = harness();
    built.getPending.mockResolvedValue(tx('processing'));

    await expect(
      (built.service as any).initiateCookedFoodMomoAfterConfirmOnce(order(), 'order-1')
    ).resolves.toBeUndefined();
    expectNoSecondPrompt(built);
  });

  it('cooked-food confirm does not treat a failed attempt as in flight', async () => {
    const built = harness();
    built.getPending.mockResolvedValue(tx('failed'));

    await expect(
      (built.service as any).initiateCookedFoodMomoAfterConfirmOnce(order(), 'order-1')
    ).rejects.toThrow('guard did not stop');
  });

  it('mobile-money retry returns the processing attempt', async () => {
    const built = harness();
    built.getPending.mockResolvedValue(tx('processing'));

    await expect(
      (built.service as any).retryMobileMoneyOrderPayment(order(), 'order-1')
    ).resolves.toMatchObject({
      success: true,
      message: 'Payment request already in progress',
      database_transaction: { status: 'processing' },
    });
    expectNoSecondPrompt(built);
    expect(built.reset).toHaveBeenCalledWith('order-1');
  });

  it('mobile-money retry does not treat a failed attempt as in flight', async () => {
    const built = harness();
    built.getPending.mockResolvedValue(tx('failed'));

    await expect(
      (built.service as any).retryMobileMoneyOrderPayment(order(), 'order-1')
    ).rejects.toThrow('guard did not stop');
    expect(built.reset).not.toHaveBeenCalled();
  });
});
