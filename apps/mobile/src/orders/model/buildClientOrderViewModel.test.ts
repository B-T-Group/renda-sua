import { buildClientOrderViewModel } from './buildClientOrderViewModel';
import { buildBusinessOrderViewModel } from './buildBusinessOrderViewModel';
import { buildDeliveryOrderViewModel } from './buildDeliveryOrderViewModel';
import type { OrderLike, OrderViewModelContext } from './types';

const t: OrderViewModelContext['t'] = (key, defaultValue) =>
  defaultValue ?? key;

const ctx: OrderViewModelContext = {
  t,
  now: new Date('2026-08-02T12:00:00Z'),
  locale: 'en',
};

function baseOrder(overrides: Partial<OrderLike> = {}): OrderLike {
  return {
    id: 'o1',
    order_number: 'RS-100',
    current_status: 'preparing',
    fulfillment_method: 'delivery',
    payment_status: 'paid',
    currency: 'USD',
    total_amount: 42,
    business: {
      name: 'Demo Store',
      user: { first_name: 'Biz', last_name: 'Owner', phone_number: '111' },
    },
    client: {
      user: { first_name: 'Ann', last_name: 'Client', phone_number: '222' },
    },
    business_location: {
      name: 'Main',
      address: {
        address_line_1: '1 Pickup St',
        city: 'City',
        state: 'ST',
        postal_code: '00000',
        country: 'US',
      },
    },
    delivery_address: {
      address_line_1: '2 Drop St',
      city: 'City',
      state: 'ST',
      postal_code: '00000',
      country: 'US',
    },
    order_items: [
      {
        id: 'i1',
        item_name: 'Widget',
        quantity: 2,
        unit_price: 10,
        total_price: 20,
      },
    ],
    ...overrides,
  };
}

describe('persona order view models', () => {
  it('builds client VM focused on ETA and next step', () => {
    const vm = buildClientOrderViewModel(
      baseOrder({
        current_status: 'out_for_delivery',
        estimated_delivery_time: '2026-08-02T14:00:00Z',
        assigned_agent_id: 'a1',
        assigned_agent: {
          user: { first_name: 'Dan', last_name: 'Agent', phone_number: '333' },
        },
      }),
      ctx
    );

    expect(vm.heroTitle).toContain('on its way');
    expect(vm.etaText).toBeTruthy();
    expect(vm.businessName).toBe('Demo Store');
    expect(vm.availableActions.some((a) => a.id === 'track')).toBe(true);
    expect(vm.contacts.agent?.name).toContain('Dan');
  });

  it('builds business VM with required action hero', () => {
    const vm = buildBusinessOrderViewModel(
      baseOrder({
        current_status: 'pending',
        acceptance_deadline_at: '2026-08-02T12:04:00Z',
      }),
      ctx
    );

    expect(vm.requiredAction).toBe('Accept Order');
    expect(vm.slaCountdown?.deadlineAt).toBe('2026-08-02T12:04:00Z');
    expect(vm.customer?.name).toContain('Ann');
    expect(vm.availableActions.some((a) => a.id === 'confirm')).toBe(true);
  });

  it('builds delivery VM with stops and objective order', () => {
    const vm = buildDeliveryOrderViewModel(
      baseOrder({
        current_status: 'assigned_to_agent',
        assigned_agent_id: 'a1',
        delivery_commission: 5,
        estimated_delivery_time: '2026-08-02T12:20:00Z',
      }),
      ctx
    );

    expect(vm.currentObjective).toBe('Go to pickup');
    expect(vm.stops[0].kind).toBe('pickup');
    expect(vm.stops[1].kind).toBe('delivery');
    expect(vm.earnings.commission).toBe(5);
    expect(vm.packageInfo.items[0].name).toBe('Widget');
  });

  it('hides item names for unclaimed delivery orders', () => {
    const vm = buildDeliveryOrderViewModel(
      baseOrder({ current_status: 'ready_for_pickup', assigned_agent_id: null }),
      ctx
    );
    expect(vm.packageInfo.items[0].name).toBe('••••');
  });

  it('uses pickup-centered status chip copy for store pickup ready orders', () => {
    const keys: string[] = [];
    const trackingCtx: OrderViewModelContext = {
      ...ctx,
      t: (key, defaultValue) => {
        keys.push(key);
        return defaultValue ?? key;
      },
    };

    const pickupVm = buildClientOrderViewModel(
      baseOrder({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'pickup',
      }),
      trackingCtx
    );
    expect(pickupVm.statusMessage).toBe('Ready for pickup');
    expect(pickupVm.heroTitle).toBe('Ready for pickup');
    expect(keys).toContain('orders.client.status.ready_for_pickup_store');
    expect(pickupVm.contacts.business?.name).toContain('Biz');
    expect(pickupVm.contacts.business?.phone).toBe('111');

    keys.length = 0;
    const payAtPickupVm = buildClientOrderViewModel(
      baseOrder({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'delivery',
        payment_timing: 'pay_at_pickup',
      }),
      trackingCtx
    );
    expect(payAtPickupVm.heroTitle).toBe('Ready for pickup');
    expect(keys).toContain('orders.client.status.ready_for_pickup_store');

    keys.length = 0;
    const deliveryVm = buildClientOrderViewModel(
      baseOrder({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'delivery',
        payment_timing: 'pay_now',
      }),
      trackingCtx
    );
    expect(keys).toContain('orders.client.status.ready_for_pickup');
    expect(keys).not.toContain('orders.client.status.ready_for_pickup_store');
    expect(deliveryVm.heroTitle).toBe('Waiting for a delivery agent');
  });

  it('uses delivery_contact for delivery stop when present (recipient flow)', () => {
    const vm = buildDeliveryOrderViewModel(
      baseOrder({
        current_status: 'assigned_to_agent',
        assigned_agent_id: 'a1',
        client: {
          user: {
            first_name: 'Payer',
            last_name: 'Montreal',
            phone_number: null,
            email: 'payer@example.com',
          },
        },
        delivery_contact: {
          name: 'Local Recipient',
          phone: '+237655123456',
          is_recipient: true,
        },
      }),
      ctx
    );

    expect(vm.stops[1].kind).toBe('delivery');
    expect(vm.stops[1].contact?.name).toBe('Local Recipient');
    expect(vm.stops[1].contact?.phone).toBe('+237655123456');
    expect(vm.stops[1].contact?.subtitle).toBe('Recipient');
    expect(vm.stops[1].contact?.email).toBeNull();
  });

  it('uses delivery_contact for delivery stop when is_recipient is false', () => {
    const vm = buildDeliveryOrderViewModel(
      baseOrder({
        current_status: 'in_transit',
        assigned_agent_id: 'a1',
        delivery_contact: {
          name: 'Contact Person',
          phone: '+237677999888',
          is_recipient: false,
        },
      }),
      ctx
    );

    expect(vm.stops[1].contact?.name).toBe('Contact Person');
    expect(vm.stops[1].contact?.phone).toBe('+237677999888');
    expect(vm.stops[1].contact?.subtitle).toBeNull();
  });

  it('falls back to client.user when delivery_contact is null', () => {
    const vm = buildDeliveryOrderViewModel(
      baseOrder({
        current_status: 'assigned_to_agent',
        assigned_agent_id: 'a1',
        delivery_contact: null,
      }),
      ctx
    );

    expect(vm.stops[1].contact?.name).toContain('Ann');
    expect(vm.stops[1].contact?.phone).toBe('222');
  });

  it('handles delivery_contact with null phone gracefully', () => {
    const vm = buildDeliveryOrderViewModel(
      baseOrder({
        current_status: 'picked_up',
        assigned_agent_id: 'a1',
        delivery_contact: {
          name: 'Local Recipient',
          phone: null,
          is_recipient: true,
        },
      }),
      ctx
    );

    expect(vm.stops[1].contact?.name).toBe('Local Recipient');
    expect(vm.stops[1].contact?.phone).toBeNull();
    expect(vm.stops[1].contact?.subtitle).toBe('Recipient');
  });

  it('does not show redacted payer phone when delivery_contact is present', () => {
    const vm = buildDeliveryOrderViewModel(
      baseOrder({
        current_status: 'out_for_delivery',
        assigned_agent_id: 'a1',
        client: {
          user: {
            first_name: 'Diaspora',
            last_name: 'Payer',
            phone_number: null,
            email: null,
          },
        },
        delivery_contact: {
          name: 'Local Person',
          phone: '+237655111222',
          is_recipient: true,
        },
      }),
      ctx
    );

    expect(vm.stops[1].contact?.name).toBe('Local Person');
    expect(vm.stops[1].contact?.phone).toBe('+237655111222');
    expect(vm.stops[1].contact?.email).toBeNull();
  });
});
