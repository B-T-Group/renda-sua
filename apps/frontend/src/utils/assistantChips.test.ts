import { getContextualChips, buildChipMessage, type AssistantContext, type ChipConfig } from './assistantChips';

describe('assistantChips', () => {
  describe('getContextualChips', () => {
    const allChipIds = [
      'business_locations',
      'pay_at_delivery',
      'pickup',
      'mobile_payments',
    ];

    it('returns generic chips when context is null', () => {
      const chips = getContextualChips(null);
      expect(chips.map(c => c.id)).toEqual(allChipIds);
    });

    it('returns generic chips when context is undefined', () => {
      const chips = getContextualChips(undefined);
      expect(chips.map(c => c.id)).toEqual(allChipIds);
    });

    it('returns item-specific chips for item_detail context', () => {
      const context: AssistantContext = {
        type: 'item_detail',
        itemId: 'item-1',
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

    it('returns reorder chip for order_detail context', () => {
      const context: AssistantContext = {
        type: 'order_detail',
        orderId: 'order-123',
        orderNumber: 'R123',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('reorder_this');
    });

    it('returns recent orders chip for orders_list context', () => {
      const context: AssistantContext = {
        type: 'orders_list',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('recent_orders');
    });

    it('returns tracking chip for delivery_tracking with pending status', () => {
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
        orderStatus: 'pending',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chip for delivery_tracking with confirmed status', () => {
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
        orderStatus: 'confirmed',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chip for delivery_tracking with preparing status', () => {
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
        orderStatus: 'preparing',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chip for delivery_tracking with ready_for_pickup status', () => {
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
        orderStatus: 'ready_for_pickup',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chip for delivery_tracking with assigned_to_agent status', () => {
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
        orderStatus: 'assigned_to_agent',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chip for delivery_tracking with picked_up status', () => {
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
        orderStatus: 'picked_up',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chip for delivery_tracking with in_transit status', () => {
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
        orderStatus: 'in_transit',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chip for delivery_tracking with out_for_delivery status', () => {
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
        orderStatus: 'out_for_delivery',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chips for delivery_tracking with delivered status', () => {
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
        orderStatus: 'delivered',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });

    it('returns tracking chips for delivery_tracking with cancelled status', () => {
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
        orderStatus: 'cancelled',
      };
      const chips = getContextualChips(context);
      expect(chips.map(c => c.id)).toContain('track_order');
    });
  });

  describe('buildChipMessage', () => {
    const chip: ChipConfig = {
      id: 'item_availability',
      labelKey: 'assistant.chips.itemAvailability',
      message: 'Is this item available?',
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
        itemId: 'item-1',
        itemName: 'Cool T-Shirt',
      };
      const result = buildChipMessage(chip, translatedLabel, context);
      expect(result).toBe(translatedLabel);
    });

    it('returns translated label even with delivery context', () => {
      const translatedLabel = 'Où est ma commande?';
      const deliveryChip: ChipConfig = {
        id: 'track_order',
        labelKey: 'assistant.chips.trackOrder',
        message: 'Where is my order?',
      };
      const context: AssistantContext = {
        type: 'delivery_tracking',
        orderId: 'order-123',
        orderNumber: 'R123',
        orderStatus: 'in_transit',
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
});
