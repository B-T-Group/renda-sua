/**
 * Contextual quick-question chips for the assistant (#451 AC5/AC6/AC8).
 * Generic fallback chips are used when no specific context is provided.
 */

export type AssistantContext =
  | { type: 'item_detail'; inventoryId: string; itemName?: string }
  | { type: 'order_detail'; orderId: string; orderStatus?: string }
  | { type: 'orders_list'; hasCompletedOrders: boolean }
  | { type: 'delivery_tracking'; orderId: string; orderNumber?: string }
  | { type: 'generic' };

export type ChipConfig = {
  id: string;
  translationKey: string;
  fallback: string;
};

/** Generic fallback chips (shown when no context or context doesn't provide specific chips) */
const GENERIC_CHIPS: ChipConfig[] = [
  {
    id: 'location',
    translationKey: 'assistant.suggestion.location',
    fallback: 'Where are you located?',
  },
  {
    id: 'pay_delivery',
    translationKey: 'assistant.suggestion.payDelivery',
    fallback: 'Do you support payment at delivery?',
  },
  {
    id: 'pickup',
    translationKey: 'assistant.suggestion.pickup',
    fallback: 'Do you support in-store pickup?',
  },
  {
    id: 'mobile_pay',
    translationKey: 'assistant.suggestion.mobilePay',
    fallback: 'Do you support mobile payments?',
  },
];

/** Item detail context chips (AC5) */
function getItemDetailChips(hasName: boolean): ChipConfig[] {
  return [
    {
      id: 'item_availability',
      translationKey: hasName
        ? 'assistant.suggestion.itemAvailabilityNamed'
        : 'assistant.suggestion.itemAvailability',
      fallback: hasName ? 'Is {{name}} available?' : 'Is this item available?',
    },
    {
      id: 'item_price',
      translationKey: hasName
        ? 'assistant.suggestion.itemPriceNamed'
        : 'assistant.suggestion.itemPrice',
      fallback: hasName ? 'What is the price of {{name}}?' : 'What is the price?',
    },
    {
      id: 'item_delivery',
      translationKey: hasName
        ? 'assistant.suggestion.itemDeliveryNamed'
        : 'assistant.suggestion.itemDelivery',
      fallback: hasName ? 'How is {{name}} delivered?' : 'How is this delivered?',
    },
    {
      id: 'similar_items',
      translationKey: hasName
        ? 'assistant.suggestion.similarItemsNamed'
        : 'assistant.suggestion.similarItems',
      fallback: hasName ? 'Show items similar to {{name}}' : 'Show similar items',
    },
  ];
}

/** Order/reorder context chips (AC6) */
const ORDER_REORDER_CHIPS: ChipConfig[] = [
  {
    id: 'reorder',
    translationKey: 'assistant.suggestion.reorder',
    fallback: 'Reorder a past order',
  },
  {
    id: 'order_status',
    translationKey: 'assistant.suggestion.orderStatus',
    fallback: 'Check my order status',
  },
  {
    id: 'recent_orders',
    translationKey: 'assistant.suggestion.recentOrders',
    fallback: 'Show my recent orders',
  },
  {
    id: 'order_help',
    translationKey: 'assistant.suggestion.orderHelp',
    fallback: 'Help with my order',
  },
];

/** Delivery/tracking context chips (AC8) */
function getDeliveryTrackingChips(hasOrderNumber: boolean): ChipConfig[] {
  return [
    {
      id: 'track_order',
      translationKey: hasOrderNumber
        ? 'assistant.suggestion.trackOrderNamed'
        : 'assistant.suggestion.trackOrder',
      fallback: hasOrderNumber ? 'Where is order {{orderNumber}}?' : 'Where is my order?',
    },
    {
      id: 'delivery_time',
      translationKey: hasOrderNumber
        ? 'assistant.suggestion.deliveryTimeNamed'
        : 'assistant.suggestion.deliveryTime',
      fallback: hasOrderNumber ? 'When will order {{orderNumber}} arrive?' : 'When will it arrive?',
    },
    {
      id: 'change_delivery',
      translationKey: 'assistant.suggestion.changeDelivery',
      fallback: 'Change delivery address',
    },
    {
      id: 'contact_support',
      translationKey: 'assistant.suggestion.contactSupport',
      fallback: 'Contact support',
    },
  ];
}

/**
 * Get contextual chips based on the current context.
 * Returns at most 4 chips to avoid overwhelming the user.
 */
export function getContextualChips(context?: AssistantContext | null): ChipConfig[] {
  if (!context || context.type === 'generic') {
    return GENERIC_CHIPS;
  }

  switch (context.type) {
    case 'item_detail':
      return getItemDetailChips(!!context.itemName);
    
    case 'order_detail': {
      // When status is unknown, default to tracking chips (safer than reorder for active orders)
      if (!context.orderStatus) {
        return getDeliveryTrackingChips(!!context.orderNumber);
      }
      // Show delivery tracking chips if order is in progress
      const inProgressStatuses = [
        'pending',
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'assigned_to_agent',
        'picked_up',
        'in_transit',
        'out_for_delivery',
        'pending_payment',
      ];
      if (inProgressStatuses.includes(context.orderStatus)) {
        return getDeliveryTrackingChips(!!context.orderNumber);
      }
      // Show reorder chips for terminal statuses (delivered, cancelled, etc.)
      return ORDER_REORDER_CHIPS;
    }
    
    case 'orders_list':
      return ORDER_REORDER_CHIPS;
    
    case 'delivery_tracking':
      return getDeliveryTrackingChips(!!context.orderNumber);
    
    default:
      return GENERIC_CHIPS;
  }
}

/**
 * Build the initial message text for a chip tap, optionally injecting context.
 * Returns the translated label, which may include interpolated context (item name, order number, etc.)
 * when the translation key supports it.
 * 
 * @param chip - The chip configuration
 * @param translatedLabel - The translated label from i18n (may include interpolated values)
 * @param context - The assistant context (used by caller for i18n interpolation)
 * @returns The message text to send when the chip is tapped
 */
export function buildChipMessage(
  chip: ChipConfig,
  translatedLabel: string,
  context?: AssistantContext | null
): string {
  // The translated label already includes any context-specific interpolation
  // done by the caller using i18n.t(key, { name, orderNumber, etc. })
  return translatedLabel;
}
