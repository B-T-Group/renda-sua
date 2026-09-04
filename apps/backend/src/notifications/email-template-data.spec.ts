import { buildReadyNextStepHtml } from './email-template-data';

describe('buildReadyNextStepHtml', () => {
  it('explains the in-store payment request for pay-at-pickup', () => {
    const html = buildReadyNextStepHtml(
      {
        orderId: 'o1',
        orderNumber: 'ORD-1',
        clientName: 'Ann',
        businessName: 'Store',
        orderStatus: 'ready_for_pickup',
        orderItems: [],
        subtotal: 0,
        deliveryFee: 0,
        taxAmount: 0,
        totalAmount: 0,
        currency: 'XAF',
        deliveryAddress: '',
        fulfillmentMethod: 'pickup',
        paymentTiming: 'pay_at_pickup',
      },
      'en'
    );
    expect(html).toMatch(/tap Pay in the app/i);
    expect(html).toMatch(/approve/i);
  });
});
