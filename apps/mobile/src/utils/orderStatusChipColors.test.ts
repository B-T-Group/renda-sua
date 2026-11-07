import { describe, expect, it } from 'vitest';
import { lightColors } from '../theme/colors';
import { orderStatusChipColors } from './orderStatusChipColors';

describe('orderStatusChipColors', () => {
  it('uses a different color for pending and pending payment', () => {
    const pending = orderStatusChipColors('pending', lightColors);
    const payment = orderStatusChipColors('pending_payment', lightColors);
    expect(pending.backgroundColor).not.toBe(payment.backgroundColor);
    expect(pending.dotColor).toBe(lightColors.warning.main);
    expect(payment.dotColor).toBe(lightColors.info.main);
  });

  it('marks completed statuses as success and cancelled as error', () => {
    expect(orderStatusChipColors('delivered', lightColors).dotColor).toBe(lightColors.success.main);
    expect(orderStatusChipColors('complete', lightColors).dotColor).toBe(lightColors.success.main);
    expect(orderStatusChipColors('cancelled', lightColors).dotColor).toBe(lightColors.error.main);
  });

  it('falls back to a neutral chip for an unknown status', () => {
    const unknown = orderStatusChipColors('not_a_status', lightColors);
    expect(unknown.backgroundColor).toBe(lightColors.surface);
    expect(unknown.borderColor).toBe(lightColors.divider);
  });
});
