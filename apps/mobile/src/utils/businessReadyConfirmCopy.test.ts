import { describe, expect, it } from 'vitest';
import { businessReadyConfirmMessage } from './businessReadyConfirmCopy';

const t = (_key: string, fallback?: string) => fallback ?? '';

describe('businessReadyConfirmMessage', () => {
  it('omits the pickup PIN for pay-at-confirm store pickup', () => {
    const message = businessReadyConfirmMessage(
      { fulfillment_method: 'pickup', pay_after_merchant_confirm: true },
      t,
      'delivery'
    );
    expect(message).toContain('Complete order');
    expect(message).toContain('no pickup PIN');
    expect(message).not.toContain('ask for their pickup PIN');
  });

  it('keeps the pickup PIN for prepaid store pickup', () => {
    const message = businessReadyConfirmMessage(
      { fulfillment_method: 'pickup', pay_after_merchant_confirm: false },
      t,
      'delivery'
    );
    expect(message).toContain('pickup PIN');
  });

  it('uses the delivery body when an agent will collect the order', () => {
    const message = businessReadyConfirmMessage(
      { fulfillment_method: 'delivery', pay_after_merchant_confirm: true },
      t,
      'The order will be ready for agent pickup.'
    );
    expect(message).toBe('The order will be ready for agent pickup.');
  });
});
