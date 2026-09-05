import { shouldReuseConfirmedDeliveryWindow } from './confirm-existing-delivery-window.util';

describe('shouldReuseConfirmedDeliveryWindow', () => {
  const orderId = 'order-1';

  it('reuses a window already confirmed for this order', () => {
    expect(
      shouldReuseConfirmedDeliveryWindow({
        windowOrderId: orderId,
        requestOrderId: orderId,
        isConfirmed: true,
      })
    ).toBe(true);
  });

  it('does not reuse an unconfirmed window', () => {
    expect(
      shouldReuseConfirmedDeliveryWindow({
        windowOrderId: orderId,
        requestOrderId: orderId,
        isConfirmed: false,
      })
    ).toBe(false);
  });

  it('does not reuse a confirmed window that belongs to another order', () => {
    expect(
      shouldReuseConfirmedDeliveryWindow({
        windowOrderId: 'order-other',
        requestOrderId: orderId,
        isConfirmed: true,
      })
    ).toBe(false);
  });
});
