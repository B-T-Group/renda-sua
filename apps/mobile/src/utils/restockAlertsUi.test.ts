import { describe, expect, it } from 'vitest';
import type { RestockLikedItem } from '../services/restockAlertsApi';
import { isBellOn, showsRestockBell, withAlertEnabled } from './restockAlertsUi';

const base = (over: Partial<RestockLikedItem>) =>
  ({
    in_stock: false,
    back_in_stock: false,
    restocked_at: null,
    restock_alert: { state: 'on', enabled: true, expires_at: null },
    ...over,
  }) as RestockLikedItem;

describe('bell states', () => {
  it('shows the bell only for sold-out likes', () => {
    expect(showsRestockBell(base({}))).toBe(true);
    expect(showsRestockBell(base({ in_stock: true, restock_alert: { state: null, enabled: true, expires_at: null } }))).toBe(false);
  });

  it('on = filled, off and expired = outline', () => {
    expect(isBellOn('on')).toBe(true);
    expect(isBellOn('off')).toBe(false);
    expect(isBellOn('expired')).toBe(false);
  });

  it('flips local state after a toggle (undo restores)', () => {
    const off = withAlertEnabled(base({}), false);
    expect(off.restock_alert.state).toBe('off');
    expect(withAlertEnabled(off, true).restock_alert.state).toBe('on');
  });
});
