import { OrderPaymentCallbackHandler } from './order-payment-callback.handler';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';

describe('OrderPaymentCallbackHandler deposit callbacks', () => {
  const ordersService = {
    finalizeDepositAfterCallback: jest.fn(),
    getOrderForProcessingByNumber: jest.fn(),
    onDepositPaymentFailed: jest.fn(),
    finalizeOrderAfterIncomingPayment: jest.fn(),
    processClaimOrderPayment: jest.fn(),
    finalizeCashExceptionReconciliationAfterMobilePayment: jest.fn(),
    finalizeOrderAfterAuthorization: jest.fn(),
    onOrderPaymentFailed: jest.fn(),
  };
  const depositRefundService = {
    completeDepositRefund: jest.fn(),
  };

  let handler: OrderPaymentCallbackHandler;

  const pendingDepositOrder = {
    id: 'order-1',
    current_status: 'pending_payment',
    deposit_status: 'pending',
    deposit_mobile_payment_transaction_id: 'txn-a',
  };

  const depositPaymentTx = {
    id: 'txn-a',
    payment_entity: 'order_deposit',
    transaction_type: 'PAYMENT',
    entity_id: '49520979',
  } as MobilePaymentTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new OrderPaymentCallbackHandler(
      ordersService as never,
      depositRefundService as never
    );
    ordersService.getOrderForProcessingByNumber.mockResolvedValue(
      pendingDepositOrder
    );
  });

  it('finalizes a deposit PAYMENT success onto the order', async () => {
    await handler.onPaymentSuccess(depositPaymentTx);
    expect(ordersService.finalizeDepositAfterCallback).toHaveBeenCalledWith(
      '49520979',
      'txn-a'
    );
    expect(depositRefundService.completeDepositRefund).not.toHaveBeenCalled();
  });

  it('completes a deposit GIVE_CHANGE success as a refund, not a capture', async () => {
    ordersService.getOrderForProcessingByNumber.mockResolvedValue({
      id: 'order-1',
    });
    await handler.onPaymentSuccess({
      ...depositPaymentTx,
      transaction_type: 'GIVE_CHANGE',
      id: 'refund-tx-1',
    } as MobilePaymentTransaction);

    expect(ordersService.finalizeDepositAfterCallback).not.toHaveBeenCalled();
    expect(depositRefundService.completeDepositRefund).toHaveBeenCalledWith(
      'order-1',
      'refund-tx-1'
    );
  });

  it('marks a current pending deposit PAYMENT failure', async () => {
    await handler.onPaymentFailure(depositPaymentTx, 'PIN failed');
    expect(ordersService.onDepositPaymentFailed).toHaveBeenCalledWith(
      'order-1',
      'PIN failed'
    );
  });

  it('ignores a GIVE_CHANGE failure so refunds cannot fail the deposit', async () => {
    await handler.onPaymentFailure(
      {
        ...depositPaymentTx,
        transaction_type: 'GIVE_CHANGE',
      } as MobilePaymentTransaction,
      'payout failed'
    );
    expect(ordersService.onDepositPaymentFailed).not.toHaveBeenCalled();
  });

  it('ignores a stale failure after the deposit is already paid', async () => {
    ordersService.getOrderForProcessingByNumber.mockResolvedValue({
      ...pendingDepositOrder,
      current_status: 'pending',
      deposit_status: 'paid',
    });
    await handler.onPaymentFailure(depositPaymentTx, 'late fail');
    expect(ordersService.onDepositPaymentFailed).not.toHaveBeenCalled();
  });

  it('ignores a failure for a superseded deposit transaction', async () => {
    ordersService.getOrderForProcessingByNumber.mockResolvedValue({
      ...pendingDepositOrder,
      deposit_mobile_payment_transaction_id: 'txn-b',
    });
    await handler.onPaymentFailure(depositPaymentTx, 'stale A failed');
    expect(ordersService.onDepositPaymentFailed).not.toHaveBeenCalled();
  });
});
