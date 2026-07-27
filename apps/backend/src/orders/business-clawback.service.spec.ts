import { BusinessClawbackService } from './business-clawback.service';
import type { RefundOrderContext } from './refund.types';

describe('BusinessClawbackService', () => {
  const paymentId = '00000000-0000-0000-0000-000000000002';
  const order: RefundOrderContext = {
    id: '00000000-0000-0000-0000-000000000020',
    order_number: 'ORD-2',
    current_status: 'refund_processing',
    subtotal: 100,
    base_delivery_fee: 0,
    per_km_delivery_fee: 0,
    currency: 'XAF',
    completed_at: new Date().toISOString(),
    client_id: 'client-2',
    business_id: 'business-2',
    business_location_id: 'location-2',
    payment_source: 'credit_card',
    payment_status: 'paid',
    client: { user_id: 'client-user-2' },
    business: { user_id: 'business-user-2' },
  };

  it('uses the refund payment id as the clawback transaction reference', async () => {
    const hasuraSystem = {
      getAccount: jest.fn().mockResolvedValue({ id: 'business-account-1' }),
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    const accountsService = {
      registerTransaction: jest.fn().mockResolvedValue({ success: true }),
    };
    const service = new BusinessClawbackService(
      hasuraSystem as never,
      accountsService as never
    );

    await service.clawbackItemSubtotal(order, 25, paymentId);

    expect(accountsService.registerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ referenceId: paymentId })
    );
  });
});
