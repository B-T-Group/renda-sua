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
    business: { name: 'Demo Store', user: { first_name: 'Biz', last_name: 'Owner', phone_number: '111' } },
    client: { user: { first_name: 'Ann', last_name: 'Client', phone_number: '222' } },
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
      { id: 'i1', item_name: 'Widget', quantity: 2, unit_price: 10, total_price: 20 },
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
});
