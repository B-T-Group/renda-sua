import { WalletRefundExecutor } from './wallet-refund.executor';
import type { RefundOrderContext } from './refund.types';

describe('WalletRefundExecutor', () => {
  const paymentId = '00000000-0000-0000-0000-000000000001';
  const order: RefundOrderContext = {
    id: '00000000-0000-0000-0000-000000000010',
    order_number: 'ORD-1',
    current_status: 'refund_processing',
    subtotal: 100,
    base_delivery_fee: 0,
    per_km_delivery_fee: 0,
    currency: 'XAF',
    completed_at: new Date().toISOString(),
    client_id: 'client-1',
    business_id: 'business-1',
    business_location_id: null,
    payment_source: 'wallet',
    payment_status: 'paid',
    client: { user_id: 'client-user-1' },
    business: { user_id: 'business-user-1' },
  };

  it('uses the refund payment id as the wallet transaction reference', async () => {
    const hasuraSystem = {
      getAccount: jest.fn().mockResolvedValue({ id: 'account-1' }),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    const accountsService = {
      registerTransaction: jest.fn().mockResolvedValue({ success: true }),
    };
    const executor = new WalletRefundExecutor(
      hasuraSystem as never,
      accountsService as never
    );

    await executor.execute({ order, amount: 25, paymentId });

    expect(accountsService.registerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ referenceId: paymentId })
    );
  });
});
