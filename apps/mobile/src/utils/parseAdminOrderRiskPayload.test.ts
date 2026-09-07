import { describe, expect, it } from 'vitest';
import { parseAdminOrderRiskPayload } from './parseAdminOrderRiskPayload';

describe('parseAdminOrderRiskPayload', () => {
  it('returns the order id for an admin order risk push', () => {
    expect(
      parseAdminOrderRiskPayload({
        type: 'admin_order_risk',
        orderId: ' order-1 ',
        severity: 'critical',
      })
    ).toBe('order-1');
  });

  it('returns an empty string when the alert has no order id', () => {
    expect(parseAdminOrderRiskPayload({ type: 'admin_order_risk' })).toBe('');
    expect(
      parseAdminOrderRiskPayload({ type: 'admin_order_risk', orderId: '  ' })
    ).toBe('');
  });

  it('ignores payloads owned by other features', () => {
    expect(parseAdminOrderRiskPayload(undefined)).toBeNull();
    expect(parseAdminOrderRiskPayload({ type: 'order_message' })).toBeNull();
    expect(parseAdminOrderRiskPayload({ orderId: 'order-1' })).toBeNull();
  });
});
