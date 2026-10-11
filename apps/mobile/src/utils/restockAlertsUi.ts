import type { RestockBellState, RestockLikedItem } from '../services/restockAlertsApi';

/** Bell is shown only for sold-out likes (`restock_alert.state` is null when in stock). */
export function showsRestockBell(item: Pick<RestockLikedItem, 'restock_alert' | 'in_stock'>): boolean {
  return !item.in_stock && item.restock_alert?.state != null;
}

/** Filled bell = alert on; outline (muted) = off or expired. */
export function isBellOn(state: RestockBellState): boolean {
  return state === 'on';
}

/** Local patch after a successful PUT: keeps `expires_at`, flips the visual state. */
export function withAlertEnabled(
  item: RestockLikedItem,
  enabled: boolean
): RestockLikedItem {
  return {
    ...item,
    restock_alert: {
      ...item.restock_alert,
      enabled,
      state: item.in_stock ? null : enabled ? 'on' : 'off',
    },
  };
}

export const RESTOCK_SRC = 'restock_alert';
