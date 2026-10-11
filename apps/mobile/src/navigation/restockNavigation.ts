import { CommonActions } from '@react-navigation/native';
import { findLikedRestockItem } from '../services/restockAlertsApi';
import type { RestockLinkTarget } from '../utils/restockDeepLink';
import { rootNavigationRef } from './rootNavigationRef';

function routeAvailable(name: string): boolean {
  if (!rootNavigationRef.isReady()) return false;
  return (rootNavigationRef.getRootState()?.routeNames ?? []).includes(name);
}

/** Client navigator mounted (persona switched, cold start finished). */
export function restockRoutesReady(): boolean {
  return routeAvailable('UserLikes') && routeAvailable('InventoryItemDetail');
}

export function navigateToRestockLikes(filter: 'all' | 'back_in_stock'): boolean {
  if (!routeAvailable('UserLikes')) return false;
  rootNavigationRef.dispatch(
    CommonActions.navigate({ name: 'UserLikes', params: { filter } })
  );
  return true;
}

export function navigateToRestockItem(inventoryItemId: string): boolean {
  if (!routeAvailable('InventoryItemDetail')) return false;
  rootNavigationRef.dispatch(
    CommonActions.navigate({
      name: 'InventoryItemDetail',
      params: { inventoryItemId, src: 'restock_alert' },
    })
  );
  return true;
}

/**
 * Opens a restock deep link. The push/link carries the catalog item id; the
 * item screen needs the listing id, which we resolve from the user's likes
 * (an alert only exists for liked items). Falls back to Likes when unresolved.
 */
export async function openRestockTarget(target: RestockLinkTarget): Promise<boolean> {
  if (target.type === 'likes') return navigateToRestockLikes(target.filter);
  try {
    const liked = await findLikedRestockItem(target.itemId);
    if (liked?.id) return navigateToRestockItem(liked.id);
  } catch {
    // fall through to Likes
  }
  return navigateToRestockLikes('all');
}
