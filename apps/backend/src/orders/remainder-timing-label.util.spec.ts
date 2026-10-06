import { remainderTimingLabel } from './remainder-timing-label.util';

describe('remainderTimingLabel', () => {
  it('labels pay-at-pickup orders as pickup', () => {
    expect(
      remainderTimingLabel({ payment_timing: 'pay_at_pickup', fulfillment_method: 'pickup' })
    ).toBe('pay at pickup');
    expect(
      remainderTimingLabel({ payment_timing: 'pay_at_pickup' }, 'hyphen')
    ).toBe('pay-at-pickup');
  });

  it('labels a pickup fulfillment as pickup even without payment_timing', () => {
    expect(remainderTimingLabel({ fulfillment_method: 'pickup' })).toBe('pay at pickup');
  });

  it('labels delivery orders as delivery', () => {
    expect(
      remainderTimingLabel({ payment_timing: 'pay_at_delivery', fulfillment_method: 'delivery' })
    ).toBe('pay at delivery');
    expect(remainderTimingLabel({}, 'hyphen')).toBe('pay-at-delivery');
  });
});
