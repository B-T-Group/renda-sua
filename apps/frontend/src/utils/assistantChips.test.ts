import { getContextualChips, buildChipMessage, type AssistantContext, type ChipConfig } from './assistantChips';

describe('assistantChips', () => {
  describe('getContextualChips', () => {
    const genericChipIds = [
      'location',
      'pay_delivery',
      'pickup',
      'mobile_pay',
    ];

    it('returns generic chips when context is null', () => {
      const chips = getContextualChips(null);
      expect(chips.map(c => c.id)).toEqual(genericChipIds);
    });

    it('returns generic chips when context is undefined', () => {
      const chips = getContextualChips(undefined);
      expect(chips.map(c => c.id)).toEqual(genericChipIds);
    });

    it('returns item-specific chips for item_detail context', () => {
      const context: AssistantContext = {
        type: 'item_detail',
        inventoryId: 'item-1',
        itemName: 'Cool T-Shirt',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toEqual([
        'item_availability',
        'item_price',
        'item_delivery',
        'similar_items',
      ]);
    });

    it('returns tracking chips for order_detail context without status (safer default)', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        // No status - defaults to tracking to avoid showing reorder for active orders
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns recent orders chip for orders_list context', () => {
      const context: AssistantContext = {
        type: 'orders_list',
        hasCompletedOrders: true,
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('recent_orders');
    });

    it('returns tracking chips for order_detail with pending status', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        orderStatus: 'pending',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chips for order_detail with confirmed status', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        orderStatus: 'confirmed',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chips for order_detail with preparing status', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        orderStatus: 'preparing',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chips for order_detail with ready_for_pickup status', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        orderStatus: 'ready_for_pickup',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chips for order_detail with assigned_to_agent status', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        orderStatus: 'assigned_to_agent',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chips for order_detail with picked_up status', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        orderStatus: 'picked_up',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chips for order_detail with in_transit status', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        orderStatus: 'in_transit',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chips for order_detail with out_for_delivery status', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        orderStatus: 'out_for_delivery',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chips for order_detail with pending_payment status', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        orderStatus: 'pending_payment',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns reorder chips for order_detail with delivered status', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        orderStatus: 'delivered',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('reorder');
    });

    it('returns reorder chips for order_detail with cancelled status', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        orderStatus: 'cancelled',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('reorder');
    });

    it('returns tracking chips for delivery_tracking context regardless of status', () => {
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });
  });

  describe('buildChipMessage', () => {
    const chip: ChipConfig = {
      id: 'item_availability',
      translationKey: 'assistant.suggestion.itemAvailability',
      fallback: 'Is this item available?',
    };

    it('returns translated label as-is', () => {
      const translatedLabel = 'Est-ce disponible?';
      const result = buildChipMessage(chip, translatedLabel);
      expect(result).toBe(translatedLabel);
    });

    it('returns translated label even with item context', () => {
      const translatedLabel = 'Est-ce disponible?';
      const context: AssistantContext = {
        type: 'item_detail',
        inventoryId: 'item-1',
        itemName: 'Cool T-Shirt',
      };
      const result = buildChipMessage(chip, translatedLabel, context);
      expect(result).toBe(translatedLabel);
    });

    it('returns translated label even with delivery context', () => {
      const translatedLabel = 'Où est ma commande?';
      const deliveryChip: ChipConfig = {
        id: 'track_order',
        translationKey: 'assistant.suggestion.trackOrder',
        fallback: 'Where is my order?',
      };
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
      };
      const result = buildChipMessage(deliveryChip, translatedLabel, context);
      expect(result).toBe(translatedLabel);
    });

    it('preserves interpolation placeholders in translated label', () => {
      const translatedLabel = 'Commande {{orderNumber}} - Statut?';
      const result = buildChipMessage(chip, translatedLabel);
      expect(result).toBe(translatedLabel);
    });
  });

  describe('Named translation keys', () => {
    it('selects Named keys when item_detail context has itemName', () => {
      const context: AssistantContext = {
        type: 'item_detail',
        inventoryId: '123',
        itemName: 'Blue Widget',
      };
      const chips = getContextualChips(context);
      expect(chips[0].translationKey).toBe('assistant.suggestion.itemAvailabilityNamed');
      expect(chips[0].fallback).toContain('{{name}}');
    });

    it('selects base keys when item_detail context has no itemName', () => {
      const context: AssistantContext = {
        type: 'item_detail',
        inventoryId: '123',
      };
      const chips = getContextualChips(context);
      expect(chips[0].translationKey).toBe('assistant.suggestion.itemAvailability');
      expect(chips[0].fallback).not.toContain('{{name}}');
    });

    it('selects Named keys when delivery_tracking context has orderNumber', () => {
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'ord_123',
        orderNumber: 'RDS-42',
      };
      const chips = getContextualChips(context);
      expect(chips[0].translationKey).toBe('assistant.suggestion.trackOrderNamed');
      expect(chips[0].fallback).toContain('{{orderNumber}}');
    });

    it('defaults to tracking chips when order_detail has no status', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'ord_123',
        // No orderStatus - unknown state
      };
      const chips = getContextualChips(context);
      expect(chips[0].translationKey).toContain('track');
    });
  });
});
