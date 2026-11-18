import { StripeCaptureService } from './stripe-capture.service';

describe('StripeCaptureService refundCapturedPayment', () => {
  it('refunds a captured PaymentIntent instead of voiding it', async () => {
    const createRefund = jest.fn(async () => ({ status: 'succeeded' }));
    const service = new StripeCaptureService(
      { createRefund } as never,
      { getTransactionByEntityId: jest.fn(async () => ({ stripe_payment_intent_id: 'pi_1' })) } as never,
      {} as never,
      {} as never,
      {} as never
    );
    const result = await service.refundCapturedPayment({
      orderNumber: 'RB-1',
      idempotencyKey: 'rental:booking:decline:card-refund',
    });
    expect(result.success).toBe(true);
    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentId: 'pi_1', idempotencyKey: 'rental:booking:decline:card-refund' })
    );
  });
});
