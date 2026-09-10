import { OrderPaymentCallbackHandler } from './order-payment-callback.handler';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';

describe('OrderPaymentCallbackHandler', () => {
  const ordersService = {
    finalizeDepositAfterCallback: jest.fn(),
    finalizeOrderAfterIncomingPayment: jest.fn(),
    processClaimOrderPayment: jest.fn(),
    finalizeOrderAfterAuthorization: jest.fn(),
    getOrderForProcessingByNumber: jest.fn(),
    onDepositPaymentFailed: jest.fn(),
    onOrderPaymentFailed: jest.fn(),
    finalizeCashExceptionReconciliationAfterMobilePayment: jest.fn(),
  };

  let handler: OrderPaymentCallbackHandler;

  const txn = (
    overrides: Partial<MobilePaymentTransaction>
  ): MobilePaymentTransaction =>
    ({
      id: '22222222-2222-4222-8222-222222222222',
      reference: 'ORD-DEP-1',
      amount: 500,
      currency: 'XAF',
      description: 'Deposit',
      provider: 'mypvit',
      payment_method: 'mobile_money',
      status: 'pending',
      account_id: 'acct-1',
      transaction_type: 'PAYMENT',
      payment_entity: 'order_deposit',
      entity_id: '49520979',
      created_at: '2026-09-09T00:00:00.000Z',
      updated_at: '2026-09-09T00:00:00.000Z',
      ...overrides,
    }) as MobilePaymentTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new OrderPaymentCallbackHandler(ordersService as never);
    ordersService.getOrderForProcessingByNumber.mockResolvedValue({
      id: 'order-uuid-1',
    });
  });

  it('supports order, claim, cash recon, and deposit entities', () => {
    expect(handler.supportsPaymentEntity('order')).toBe(true);
    expect(handler.supportsPaymentEntity('claim_order')).toBe(true);
    expect(handler.supportsPaymentEntity('order_cash_reconciliation')).toBe(
      true
    );
    expect(handler.supportsPaymentEntity('order_deposit')).toBe(true);
    expect(handler.supportsPaymentEntity('token')).toBe(false);
    expect(handler.supportsPaymentEntity(undefined)).toBe(false);
  });

  describe('onPaymentSuccess', () => {
    it('finalizes a deposit using the DB transaction uuid, not the provider id', async () => {
      await handler.onPaymentSuccess(txn());

      expect(ordersService.finalizeDepositAfterCallback).toHaveBeenCalledWith(
        '49520979',
        '22222222-2222-4222-8222-222222222222'
      );
      expect(ordersService.finalizeOrderAfterIncomingPayment).not.toHaveBeenCalled();
    });

    it('no-ops when a deposit callback is missing entity_id', async () => {
      await handler.onPaymentSuccess(txn({ entity_id: undefined }));

      expect(ordersService.finalizeDepositAfterCallback).not.toHaveBeenCalled();
    });

    it('still finalizes regular order payments', async () => {
      const orderTxn = txn({ payment_entity: 'order', entity_id: 'ORD-9' });
      await handler.onPaymentSuccess(orderTxn);

      expect(ordersService.finalizeOrderAfterIncomingPayment).toHaveBeenCalledWith(
        orderTxn
      );
      expect(ordersService.finalizeDepositAfterCallback).not.toHaveBeenCalled();
    });
  });

  describe('onPaymentFailure', () => {
    it('marks the deposit failed and cancels the order', async () => {
      await handler.onPaymentFailure(txn(), 'timeout');

      expect(ordersService.getOrderForProcessingByNumber).toHaveBeenCalledWith(
        '49520979'
      );
      expect(ordersService.onDepositPaymentFailed).toHaveBeenCalledWith(
        'order-uuid-1',
        'timeout'
      );
      expect(ordersService.onOrderPaymentFailed).not.toHaveBeenCalled();
    });

    it('falls back to the MoMo reference when entity_id is missing', async () => {
      await handler.onPaymentFailure(txn({ entity_id: undefined }), 'declined');

      expect(ordersService.getOrderForProcessingByNumber).toHaveBeenCalledWith(
        'ORD-DEP-1'
      );
    });

    it('does not cancel the order for cash-recon failures', async () => {
      await handler.onPaymentFailure(
        txn({ payment_entity: 'order_cash_reconciliation' }),
        'declined'
      );

      expect(ordersService.onDepositPaymentFailed).not.toHaveBeenCalled();
      expect(ordersService.onOrderPaymentFailed).not.toHaveBeenCalled();
    });
  });
});
