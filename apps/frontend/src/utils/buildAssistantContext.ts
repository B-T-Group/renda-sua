import type { AssistantContext } from './assistantChips';

/**
 * Build AssistantContext from the current web route pathname.
 * Used by both the floating launcher and header icon.
 */
export function buildAssistantContextFromPath(pathname: string): AssistantContext | undefined {
  if (pathname.startsWith('/items/')) {
    const inventoryId = pathname.split('/items/')[1]?.split('/')[0];
    if (inventoryId) {
      return {
        type: 'item_detail',
        inventoryId,
        // itemName could be pulled from page data/cache if available
      };
    }
  }
  
  if (pathname === '/orders') {
    return {
      type: 'orders_list',
      hasCompletedOrders: true,
    };
  }
  
  if (pathname.startsWith('/orders/') && !pathname.includes('/reorder')) {
    const orderId = pathname.split('/orders/')[1]?.split('/')[0];
    if (orderId) {
      return {
        type: 'order_detail',
        orderId,
        // orderStatus could be pulled from page data/cache if available
      };
    }
  }
  
  return undefined;
}
