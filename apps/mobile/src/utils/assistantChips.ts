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
const ITEM_DETAIL_CHIPS: ChipConfig[] = [
  {
    id: 'item_availability',
    translationKey: 'assistant.suggestion.itemAvailability',
    fallback: 'Is this item available?',
  },
  {
    id: 'item_price',
    translationKey: 'assistant.suggestion.itemPrice',
    fallback: 'What is the price?',
  },
  {
    id: 'item_delivery',
    translationKey: 'assistant.suggestion.itemDelivery',
    fallback: 'How is this delivered?',
  },
  {
    id: 'similar_items',
    translationKey: 'assistant.suggestion.similarItems',
    fallback: 'Show similar items',
  },
];

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
const DELIVERY_TRACKING_CHIPS: ChipConfig[] = [
  {
    id: 'track_order',
    translationKey: 'assistant.suggestion.trackOrder',
    fallback: 'Where is my order?',
  },
  {
    id: 'delivery_time',
    translationKey: 'assistant.suggestion.deliveryTime',
    fallback: 'When will it arrive?',
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
      return ITEM_DETAIL_CHIPS;
    
    case 'order_detail':
      // Show delivery tracking chips if order is in progress
      if (context.orderStatus && [
        'pending',
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'assigned_to_agent',
        'picked_up',
        'in_transit',
        'out_for_delivery',
      ].includes(context.orderStatus)) {
        return DELIVERY_TRACKING_CHIPS;
      }
      // Show reorder chips if order is completed
      return ORDER_REORDER_CHIPS;
    
    case 'orders_list':
      return ORDER_REORDER_CHIPS;
    
    case 'delivery_tracking':
      return DELIVERY_TRACKING_CHIPS;
    
    default:
      return GENERIC_CHIPS;
  }
}

/**
 * Build the initial message text for a chip tap, optionally injecting context.
 * Uses the translated label as-is to preserve i18n interpolation.
 * 
 * @param chip - The chip configuration (reserved for future context-specific customization)
 * @param translatedLabel - The translated label from i18n
 * @param context - The assistant context (reserved for future context-specific customization)
 * @returns The message text to send when the chip is tapped
 */
export function buildChipMessage(
  chip: ChipConfig, // eslint-disable-line @typescript-eslint/no-unused-vars
  translatedLabel: string,
  context?: AssistantContext | null // eslint-disable-line @typescript-eslint/no-unused-vars
): string {
  // Use the translated label as-is - i18n should handle interpolation
  // For context-specific customization, the translation key itself should use placeholders
  return translatedLabel;
}
