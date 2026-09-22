import { HttpException, HttpStatus } from '@nestjs/common';
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
});
