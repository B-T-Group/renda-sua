import { rootNavigationRef } from '@/navigation/rootNavigationRef';
import type { AssistantContext } from './assistantChips';

/**
 * Build AssistantContext from the current mobile route.
 * Used by both the floating launcher and header icon.
 */
export function buildAssistantContextFromRoute(): AssistantContext | undefined {
  if (!rootNavigationRef.isReady()) return undefined;

  const currentRoute = rootNavigationRef.getCurrentRoute() as { name?: string; params?: any } | undefined;
  if (!currentRoute) return undefined;

  // Item detail context
  if (currentRoute.name === 'InventoryItemDetail' && currentRoute.params) {
    const params = currentRoute.params;
    return {
      type: 'item_detail',
      inventoryId: params.inventoryItemId,
      itemName: params.itemName || undefined,
    };
  }

  // Order detail context
  if (currentRoute.name === 'OrderDetail' && currentRoute.params) {
    const params = currentRoute.params;
    return {
      type: 'order_detail',
      orderId: params.orderId,
      orderStatus: params.orderStatus || undefined,
      orderNumber: params.orderNumber || undefined,
    };
  }

  // Orders list context
  if (
    currentRoute.name === 'ClientOrders' ||
    currentRoute.name === 'Orders' ||
    currentRoute.name === 'AgentOrders'
  ) {
    return {
      type: 'orders_list',
      hasCompletedOrders: true,
    };
  }

  return undefined;
}
