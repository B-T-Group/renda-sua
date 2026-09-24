import { HttpException, HttpStatus } from '@nestjs/common';
import { FOOD_CATEGORY_NAME } from '../food/food.constants';
import { isLocationPaymentsEnabled } from '../inventory-items/inventory-catalog-eligibility.util';
import { OrderReorderService } from './order-reorder.service';

jest.mock('../inventory-items/inventory-catalog-eligibility.util', () => ({
  fetchStripeEnabledCountries: jest.fn().mockResolvedValue(['CA', 'US']),
  isLocationPaymentsEnabled: jest.fn().mockReturnValue(true),
}));

describe('OrderReorderService', () => {
  const hasuraSystem = { executeQuery: jest.fn() };
  const hasuraUser = {
    getUser: jest.fn(),
    sessionPersonaContext: jest.fn().mockReturnValue({
      activePersona: 'client',
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client'],
    }),
  };
  const orderAcceptance = { isBusinessAcceptingOrders: jest.fn() };
  const deliveryAvailability = { evaluate: jest.fn() };

  let service: OrderReorderService;

  const clientUser = {
    id: 'user-1',
    client: { id: 'client-1' },
    active_persona: 'client',
  };

  const baseOrder = {
    id: 'order-1',
    current_status: 'complete',
    business_id: 'biz-1',
    business_location_id: 'loc-1',
    delivery_address_id: 'addr-1',
    fulfillment_method: 'delivery',
    client: { id: 'client-1', user_id: 'user-1' },
    business_location: {
      id: 'loc-1',
      is_active: true,
      address: {
        country: 'CM',
        state: 'Centre',
        latitude: 3.8,
        longitude: 11.5,
      },
      business: { id: 'biz-1', name: 'Store' },
    },
    delivery_address: {
      id: 'addr-1',
      country: 'CM',
      state: 'Centre',
      latitude: 3.9,
      longitude: 11.6,
    },
    order_items: [
      {
        id: 'oi-1',
        business_inventory_id: 'inv-1',
        item_id: 'item-1',
        item_variant_id: null,
        item_name: 'Rice',
        variant_name: null,
        quantity: 2,
      },
    ],
  };

  const baseInventory = {
    id: 'inv-1',
    selling_price: 1000,
    computed_available_quantity: 10,
    is_active: true,
    item_variant_id: null,
    variant_price_overrides: [],
    business_location: {
      id: 'loc-1',
      business_id: 'biz-1',
      is_active: true,
      mobile_payment_phone: { is_verified: true },
      business: {
        id: 'biz-1',
        name: 'Store',
        can_accept_orders: true,
        user: { id: 'owner-1', country: 'CM' },
      },
      address: {
        country: 'CM',
        state: 'Centre',
        latitude: 3.8,
        longitude: 11.5,
      },
    },
    food_settings: null,
    item: {
      id: 'item-1',
      name: 'Rice',
      currency: 'XAF',
      max_order_quantity: null,
      min_order_quantity: null,
      pay_on_delivery_enabled: true,
      export_available: false,
      item_images: [{ image_url: 'https://img/rice.jpg' }],
      item_variants: [],
    },
    item_variant: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (isLocationPaymentsEnabled as jest.Mock).mockReturnValue(true);
    hasuraUser.sessionPersonaContext.mockReturnValue({
      activePersona: 'client',
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client'],
    });
    service = new OrderReorderService(
      hasuraSystem as any,
      hasuraUser as any,
      orderAcceptance as any,
      deliveryAvailability as any
    );
    hasuraUser.getUser.mockResolvedValue(clientUser);
    orderAcceptance.isBusinessAcceptingOrders.mockResolvedValue(true);
    deliveryAvailability.evaluate.mockResolvedValue({ available: true });
  });

  function mockOrderAndInventory(order: any, inventories: any[]) {
    hasuraSystem.executeQuery.mockImplementation((query: string) => {
      if (query.includes('GetOrderForReorder')) {
        return Promise.resolve({ orders_by_pk: order });
      }
      if (query.includes('GetInventoryForReorder')) {
        return Promise.resolve({ business_inventory: inventories });
      }
      return Promise.resolve({});
    });
  }

  it('returns checkout hint when all lines available, accepting, address valid', async () => {
    mockOrderAndInventory(baseOrder, [baseInventory]);
    const result = await service.reorder('order-1');
    expect(result.navigation_hint).toBe('checkout');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].quantity).toBe(2);
    expect(result.lines[0].item_data.price).toBe(1000);
    expect(result.skipped).toHaveLength(0);
    expect(result.fulfillment.address_valid).toBe(true);
    expect(result.fulfillment.business_accepting_orders).toBe(true);
  });

  it('partially skips unavailable lines and hints cart', async () => {
    const order = {
      ...baseOrder,
      order_items: [
        ...baseOrder.order_items,
        {
          id: 'oi-2',
          business_inventory_id: 'inv-missing',
          item_id: 'item-2',
          item_variant_id: null,
          item_name: 'Beans',
          variant_name: null,
          quantity: 1,
        },
      ],
    };
    mockOrderAndInventory(order, [baseInventory]);
    const result = await service.reorder('order-1');
    expect(result.lines).toHaveLength(1);
    expect(result.skipped).toEqual([
      { name: 'Beans', reason: 'unavailable' },
    ]);
    expect(result.navigation_hint).toBe('cart');
  });

  it('returns none when all lines unavailable', async () => {
    mockOrderAndInventory(baseOrder, []);
    const result = await service.reorder('order-1');
    expect(result.lines).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.navigation_hint).toBe('none');
  });

  it('keeps lines and hints cart when business is closed', async () => {
    orderAcceptance.isBusinessAcceptingOrders.mockResolvedValue(false);
    mockOrderAndInventory(baseOrder, [baseInventory]);
    const result = await service.reorder('order-1');
    expect(result.lines).toHaveLength(1);
    expect(result.fulfillment.business_accepting_orders).toBe(false);
    expect(result.navigation_hint).toBe('cart');
  });

  it('hints cart when delivery address is invalid', async () => {
    deliveryAvailability.evaluate.mockResolvedValue({ available: false });
    mockOrderAndInventory(baseOrder, [baseInventory]);
    const result = await service.reorder('order-1');
    expect(result.lines).toHaveLength(1);
    expect(result.fulfillment.address_valid).toBe(false);
    expect(result.navigation_hint).toBe('cart');
  });

  it('caps quantity to available stock', async () => {
    mockOrderAndInventory(baseOrder, [
      { ...baseInventory, computed_available_quantity: 1 },
    ]);
    const result = await service.reorder('order-1');
    expect(result.lines[0].quantity).toBe(1);
    expect(result.lines[0].ordered_quantity).toBe(2);
    expect(result.navigation_hint).toBe('checkout');
  });

  it('throws 403 for wrong owner', async () => {
    mockOrderAndInventory(
      { ...baseOrder, client: { id: 'other', user_id: 'other-user' } },
      [baseInventory]
    );
    await expect(service.reorder('order-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('throws 400 for non-completed order', async () => {
    mockOrderAndInventory(
      { ...baseOrder, current_status: 'preparing' },
      [baseInventory]
    );
    await expect(service.reorder('order-1')).rejects.toBeInstanceOf(
      HttpException
    );
    await expect(service.reorder('order-1')).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('throws 404 when order is missing', async () => {
    hasuraSystem.executeQuery.mockResolvedValue({ orders_by_pk: null });
    await expect(service.reorder('missing')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('skips out_of_stock lines', async () => {
    mockOrderAndInventory(baseOrder, [
      { ...baseInventory, computed_available_quantity: 0 },
    ]);
    const result = await service.reorder('order-1');
    expect(result.lines).toHaveLength(0);
    expect(result.skipped[0].reason).toBe('out_of_stock');
    expect(result.navigation_hint).toBe('none');
  });

  it('allows delivered orders', async () => {
    mockOrderAndInventory(
      { ...baseOrder, current_status: 'delivered' },
      [baseInventory]
    );
    const result = await service.reorder('order-1');
    expect(result.navigation_hint).toBe('checkout');
    expect(result.lines).toHaveLength(1);
  });

  it('rejects an agent session even when a client profile exists', async () => {
    hasuraUser.sessionPersonaContext.mockReturnValue({
      activePersona: 'agent',
      jwtDefaultRole: 'agent',
      jwtAllowedRoles: ['agent', 'client'],
    });
    hasuraUser.getUser.mockResolvedValue({
      id: 'user-1',
      client: { id: 'client-1' },
      agent: { id: 'agent-1' },
    });
    mockOrderAndInventory(baseOrder, [baseInventory]);
    await expect(service.reorder('order-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      message: 'Only clients can reorder an order',
    });
    expect(hasuraSystem.executeQuery).not.toHaveBeenCalled();
  });

  it('rejects a client persona with no client id', async () => {
    hasuraUser.getUser.mockResolvedValue({
      id: 'user-1',
      client: {},
    });
    mockOrderAndInventory(baseOrder, [baseInventory]);
    await expect(service.reorder('order-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      message: 'Client profile is missing',
    });
  });

  it('checks out pickup when the store location is active', async () => {
    mockOrderAndInventory(
      { ...baseOrder, fulfillment_method: 'pickup' },
      [baseInventory]
    );
    const result = await service.reorder('order-1');
    expect(result.fulfillment.type).toBe('pickup');
    expect(result.fulfillment.address_valid).toBe(true);
    expect(result.navigation_hint).toBe('checkout');
    expect(deliveryAvailability.evaluate).not.toHaveBeenCalled();
  });

  it('sends pickup to cart when the order location is inactive', async () => {
    mockOrderAndInventory(
      {
        ...baseOrder,
        fulfillment_method: 'pickup',
        business_location: {
          ...baseOrder.business_location,
          is_active: false,
        },
      },
      [baseInventory]
    );
    const result = await service.reorder('order-1');
    expect(result.lines).toHaveLength(1);
    expect(result.fulfillment.address_valid).toBe(false);
    expect(result.navigation_hint).toBe('cart');
  });

  it('always opens the cart for shipping and skips delivery checks', async () => {
    mockOrderAndInventory(
      { ...baseOrder, fulfillment_method: 'shipping' },
      [baseInventory]
    );
    const result = await service.reorder('order-1');
    expect(result.fulfillment.type).toBe('shipping');
    expect(result.fulfillment.address_valid).toBe(true);
    expect(result.navigation_hint).toBe('cart');
    expect(deliveryAvailability.evaluate).not.toHaveBeenCalled();
  });

  it('treats an unknown fulfillment method as delivery', async () => {
    mockOrderAndInventory(
      { ...baseOrder, fulfillment_method: 'courier' },
      [baseInventory]
    );
    const result = await service.reorder('order-1');
    expect(result.fulfillment.type).toBe('delivery');
    expect(deliveryAvailability.evaluate).toHaveBeenCalled();
    expect(result.navigation_hint).toBe('checkout');
  });

  it('keeps the line and hints cart when delivery check throws', async () => {
    deliveryAvailability.evaluate.mockRejectedValue(new Error('timeout'));
    mockOrderAndInventory(baseOrder, [baseInventory]);
    const result = await service.reorder('order-1');
    expect(result.lines).toHaveLength(1);
    expect(result.fulfillment.address_valid).toBe(false);
    expect(result.navigation_hint).toBe('cart');
  });

  it('treats a missing delivery address as invalid', async () => {
    mockOrderAndInventory(
      {
        ...baseOrder,
        delivery_address_id: null,
        delivery_address: null,
      },
      [baseInventory]
    );
    const result = await service.reorder('order-1');
    expect(result.fulfillment.address_id).toBeNull();
    expect(result.fulfillment.address_valid).toBe(false);
    expect(result.navigation_hint).toBe('cart');
    expect(deliveryAvailability.evaluate).not.toHaveBeenCalled();
  });

  it('returns none for an order with no items and skips inventory lookup', async () => {
    mockOrderAndInventory({ ...baseOrder, order_items: [] }, [baseInventory]);
    const result = await service.reorder('order-1');
    expect(result.lines).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.navigation_hint).toBe('none');
    const queries = hasuraSystem.executeQuery.mock.calls.map((call) =>
      String(call[0])
    );
    expect(queries.some((q) => q.includes('GetInventoryForReorder'))).toBe(
      false
    );
  });

  it('skips inactive stock and inactive locations as unavailable', async () => {
    const order = {
      ...baseOrder,
      order_items: [
        { ...baseOrder.order_items[0], item_name: 'Hidden' },
        {
          ...baseOrder.order_items[0],
          id: 'oi-2',
          business_inventory_id: 'inv-2',
          item_name: 'Closed shop',
        },
      ],
    };
    mockOrderAndInventory(order, [
      { ...baseInventory, is_active: false },
      {
        ...baseInventory,
        id: 'inv-2',
        business_location: {
          ...baseInventory.business_location,
          is_active: false,
        },
      },
    ]);
    const result = await service.reorder('order-1');
    expect(result.lines).toHaveLength(0);
    expect(result.skipped).toEqual([
      { name: 'Hidden', reason: 'unavailable' },
      { name: 'Closed shop', reason: 'unavailable' },
    ]);
    expect(result.navigation_hint).toBe('none');
  });

  it('skips export-only items as not orderable', async () => {
    mockOrderAndInventory(baseOrder, [
      {
        ...baseInventory,
        item: { ...baseInventory.item, export_available: true },
      },
    ]);
    const result = await service.reorder('order-1');
    expect(result.skipped).toEqual([{ name: 'Rice', reason: 'not_orderable' }]);
    expect(result.navigation_hint).toBe('none');
  });

  it('skips locations whose payments are disabled', async () => {
    (isLocationPaymentsEnabled as jest.Mock).mockReturnValue(false);
    mockOrderAndInventory(baseOrder, [baseInventory]);
    const result = await service.reorder('order-1');
    expect(result.skipped[0].reason).toBe('unavailable');
    expect(result.lines).toHaveLength(0);
  });

  it('skips sold-out cooked food as not orderable', async () => {
    mockOrderAndInventory(baseOrder, [
      {
        ...baseInventory,
        food_settings: [
          {
            marked_unavailable_at: new Date().toISOString(),
            availability_slots: [],
          },
        ],
        item: {
          ...baseInventory.item,
          item_sub_category: {
            item_category: { name: 'Restaurant & Cooked Food' },
          },
        },
      },
    ]);
    const result = await service.reorder('order-1');
    expect(result.skipped).toEqual([
      { name: 'Rice', reason: 'not_orderable' },
    ]);
    expect(result.lines).toHaveLength(0);
  });

  it('skips a variant that is no longer for sale', async () => {
    mockOrderAndInventory(
      {
        ...baseOrder,
        order_items: [
          {
            ...baseOrder.order_items[0],
            item_variant_id: 'var-gone',
            variant_name: 'Large',
          },
        ],
      },
      [
        {
          ...baseInventory,
          item: {
            ...baseInventory.item,
            item_variants: [
              { id: 'var-1', name: 'Small', price: 1200, is_default: true },
            ],
          },
        },
      ]
    );
    const result = await service.reorder('order-1');
    expect(result.skipped).toEqual([
      { name: 'Rice', reason: 'variant_unavailable' },
    ]);
    expect(result.navigation_hint).toBe('none');
  });

  it('uses the location variant price and caps quantity at max order', async () => {
    mockOrderAndInventory(
      {
        ...baseOrder,
        order_items: [
          {
            ...baseOrder.order_items[0],
            quantity: 8,
            item_variant_id: 'var-1',
          },
        ],
      },
      [
        {
          ...baseInventory,
          selling_price: 1000,
          computed_available_quantity: 10,
          variant_price_overrides: [
            { id: 'ov-1', item_variant_id: 'var-1', selling_price: 750 },
          ],
          item: {
            ...baseInventory.item,
            max_order_quantity: 3,
            currency: null,
            item_variants: [
              { id: 'var-1', name: 'Small', price: 1200, is_default: false },
            ],
          },
          business_location: {
            ...baseInventory.business_location,
            address: {
              ...baseInventory.business_location.address,
              country: ' cm ',
            },
          },
        },
      ]
    );
    const result = await service.reorder('order-1');
    expect(result.lines[0].quantity).toBe(3);
    expect(result.lines[0].ordered_quantity).toBe(8);
    expect(result.lines[0].item_variant_id).toBe('var-1');
    expect(result.lines[0].variant_name).toBe('Small');
    expect(result.lines[0].item_data.price).toBe(750);
    expect(result.lines[0].item_data.currency).toBe('XAF');
    expect(result.lines[0].item_data.seller_country).toBe('CM');
    expect(result.navigation_hint).toBe('checkout');
  });

  it('floors a zero ordered quantity to one when stock allows', async () => {
    mockOrderAndInventory(
      {
        ...baseOrder,
        order_items: [{ ...baseOrder.order_items[0], quantity: 0 }],
      },
      [baseInventory]
    );
    const result = await service.reorder('order-1');
    expect(result.lines[0].quantity).toBe(1);
    expect(result.lines[0].ordered_quantity).toBe(1);
  });

  it('reorders cooked food above the quantity-1 sentinel', async () => {
    mockOrderAndInventory(
      {
        ...baseOrder,
        order_items: [{ ...baseOrder.order_items[0], quantity: 8 }],
      },
      [
        {
          ...baseInventory,
          computed_available_quantity: 0,
          item: {
            ...baseInventory.item,
            item_sub_category: {
              item_category: { name: FOOD_CATEGORY_NAME },
            },
          },
        },
      ]
    );
    const result = await service.reorder('order-1');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].quantity).toBe(8);
    expect(result.lines[0].ordered_quantity).toBe(8);
    expect(result.skipped).toHaveLength(0);
    expect(result.navigation_hint).toBe('checkout');
  });

  it('still caps cooked-food reorder quantity at the merchant maximum', async () => {
    mockOrderAndInventory(
      {
        ...baseOrder,
        order_items: [{ ...baseOrder.order_items[0], quantity: 8 }],
      },
      [
        {
          ...baseInventory,
          computed_available_quantity: 1,
          item: {
            ...baseInventory.item,
            max_order_quantity: 3,
            item_sub_category: {
              item_category: { name: ` ${FOOD_CATEGORY_NAME} ` },
            },
          },
        },
      ]
    );
    const result = await service.reorder('order-1');
    expect(result.lines[0].quantity).toBe(3);
    expect(result.lines[0].ordered_quantity).toBe(8);
    expect(result.skipped).toHaveLength(0);
    expect(result.navigation_hint).toBe('checkout');
  });

  it('loads each inventory id once when lines repeat it', async () => {
    mockOrderAndInventory(
      {
        ...baseOrder,
        order_items: [
          baseOrder.order_items[0],
          { ...baseOrder.order_items[0], id: 'oi-2' },
        ],
      },
      [baseInventory]
    );
    const result = await service.reorder('order-1');
    expect(result.lines).toHaveLength(2);
    const inventoryCall = hasuraSystem.executeQuery.mock.calls.find((call) =>
      String(call[0]).includes('GetInventoryForReorder')
    );
    expect(inventoryCall?.[1]).toEqual({ ids: ['inv-1'] });
  });
});
