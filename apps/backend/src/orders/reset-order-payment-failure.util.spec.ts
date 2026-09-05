import {
  PAYMENT_STATUSES_THAT_BLOCK_FAILURE_RESET,
  RESET_PAYMENT_FAILURE_MUTATION,
  paymentFailureResetVariables,
  resetOrderPaymentFailure,
} from './reset-order-payment-failure.util';

describe('resetOrderPaymentFailure', () => {
  it('blocks paid, authorized, and refund statuses from being overwritten', () => {
    expect(PAYMENT_STATUSES_THAT_BLOCK_FAILURE_RESET).toEqual([
      'paid',
      'authorized',
      'refunded',
      'partially_refunded',
    ]);
  });

  it('updates by filtered where, not unconditional by_pk', () => {
    expect(RESET_PAYMENT_FAILURE_MUTATION).toContain('update_orders(');
    expect(RESET_PAYMENT_FAILURE_MUTATION).toContain(
      'payment_status: { _nin: $blockedStatuses }'
    );
    expect(RESET_PAYMENT_FAILURE_MUTATION).not.toContain('update_orders_by_pk');
  });

  it('sends blocked statuses so a late retry cannot mark a paid order pending', async () => {
    const executeMutation = jest.fn().mockResolvedValue({
      update_orders: { affected_rows: 0 },
    });

    await resetOrderPaymentFailure(
      { executeMutation },
      'order-paid-1',
      () => '2026-09-05T11:00:00.000Z'
    );

    expect(executeMutation).toHaveBeenCalledWith(
      RESET_PAYMENT_FAILURE_MUTATION,
      paymentFailureResetVariables('order-paid-1', '2026-09-05T11:00:00.000Z')
    );
    expect(executeMutation.mock.calls[0][1].blockedStatuses).toContain('paid');
    expect(executeMutation.mock.calls[0][1].blockedStatuses).toContain(
      'authorized'
    );
  });
});
