import { describe, expect, it } from 'vitest';
import {
  foodServiceStyle,
  showEatInUnavailableNotice,
  isCookedFoodAwaitingClientPayment,
  isCookedFoodPayAfterPaid,
  isCookedFoodReadyFailEligible,
  isCookedFoodStartCookingPriority,
  isStorePayAfterConfirmOrder,
  shouldUseCookedFoodConfirmModal,
  shouldUseGuidedConfirmModal,
} from './cookedFoodOrder';
import type { Order } from '../types/agent';

const asapPickup = {
  fulfillment_method: 'pickup' as const,
  fulfillment_timing: 'asap' as const,
};

describe('foodServiceStyle', () => {
  it('labels cooked pickup as eat in or take out', () => {
    expect(foodServiceStyle({ is_cooked_food_pickup: true, eat_in: true })).toBe('eat_in');
    expect(foodServiceStyle({ is_cooked_food_pickup: true, eat_in: false })).toBe('take_out');
    expect(foodServiceStyle({ is_cooked_food_pickup: false })).toBeNull();
  });

  it('shows the no-table notice only while unpaid', () => {
    expect(
      showEatInUnavailableNotice({
        eat_in: true,
        eat_in_unavailable: true,
        payment_status: 'pending',
      })
    ).toBe(true);
    expect(
      showEatInUnavailableNotice({
        eat_in: true,
        eat_in_unavailable: true,
        payment_status: 'paid',
      })
    ).toBe(false);
  });
});

describe('shouldUseCookedFoodConfirmModal', () => {
  it('uses the ready-in modal for ASAP pickup of cooked food', () => {
    expect(
      shouldUseCookedFoodConfirmModal({
        ...asapPickup,
        is_cooked_food_pickup: true,
        order_items: [{ is_cooked_food: false }],
      })
    ).toBe(true);
    expect(
      shouldUseCookedFoodConfirmModal({
        ...asapPickup,
        order_items: [{ is_cooked_food: true }],
      })
    ).toBe(true);
  });

  it('skips scheduled pickup, delivery, and mixed carts', () => {
    expect(
      shouldUseCookedFoodConfirmModal({
        fulfillment_method: 'pickup',
        delivery_time_windows: [{ id: 'slot' }],
        is_cooked_food_pickup: true,
      } as never)
    ).toBe(false);
    expect(
      shouldUseCookedFoodConfirmModal({
        fulfillment_method: 'delivery',
        fulfillment_timing: 'asap',
        is_cooked_food_pickup: true,
      })
    ).toBe(false);
    expect(
      shouldUseCookedFoodConfirmModal({
        ...asapPickup,
        order_items: [{ is_cooked_food: true }, { is_cooked_food: false }],
      })
    ).toBe(false);
  });
});

describe('cooked-food payment and cooking priority', () => {
  const confirmedPayAfter = {
    ...asapPickup,
    is_cooked_food_pickup: true,
    pay_after_merchant_confirm: true,
    current_status: 'confirmed',
  };

  it('waits on unpaid pay-after orders and starts after payment', () => {
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        payment_status: 'pending',
      })
    ).toBe(true);
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        payment_status: 'authorized',
      })
    ).toBe(false);
    expect(
      isCookedFoodStartCookingPriority({
        ...confirmedPayAfter,
        payment_status: 'pending',
      })
    ).toBe(false);
    expect(
      isCookedFoodStartCookingPriority({
        ...confirmedPayAfter,
        payment_status: 'paid',
      })
    ).toBe(true);
    expect(
      isCookedFoodStartCookingPriority({
        ...asapPickup,
        is_cooked_food_pickup: true,
        current_status: 'preparing',
        payment_status: 'paid',
      })
    ).toBe(true);
    expect(
      isCookedFoodStartCookingPriority({
        ...asapPickup,
        is_cooked_food_pickup: true,
        current_status: 'pending',
        payment_status: 'paid',
      })
    ).toBe(false);
  });
});

describe('isCookedFoodReadyFailEligible', () => {
  const readyPaid = {
    ...asapPickup,
    current_status: 'ready_for_pickup' as const,
    payment_status: 'paid' as const,
    is_cooked_food_pickup: true,
  };

  it('allows a paid cooked-food pickup and a delivery before agent assignment', () => {
    expect(isCookedFoodReadyFailEligible(readyPaid)).toBe(true);
    expect(
      isCookedFoodReadyFailEligible({
        ...readyPaid,
        fulfillment_method: 'delivery',
        assigned_agent_id: null,
        payment_status: 'authorized',
      })
    ).toBe(true);
  });

  it('blocks unpaid orders and delivery after an agent is assigned', () => {
    expect(
      isCookedFoodReadyFailEligible({ ...readyPaid, payment_status: 'pending' })
    ).toBe(false);
    expect(
      isCookedFoodReadyFailEligible({
        ...readyPaid,
        fulfillment_method: 'delivery',
        assigned_agent_id: 'agent-1',
      })
    ).toBe(false);
    expect(
      isCookedFoodReadyFailEligible({
        ...readyPaid,
        is_cooked_food_pickup: false,
        pay_after_merchant_confirm: false,
        order_items: [{ is_cooked_food: false }],
      })
    ).toBe(false);
  });
});

describe('flagged-location goods (non-cooked pay-after)', () => {
  const goods = {
    ...asapPickup,
    pay_after_merchant_confirm: true,
    is_cooked_food_pickup: false,
    order_items: [{ is_cooked_food: false }],
    current_status: 'pending',
  } as unknown as Order;

  it('uses the guided confirm modal but not the ready-in modal', () => {
    expect(isStorePayAfterConfirmOrder(goods)).toBe(true);
    expect(shouldUseCookedFoodConfirmModal(goods)).toBe(false);
    expect(shouldUseGuidedConfirmModal(goods)).toBe(true);
  });

  it('does not treat cooked pay-after orders as store pay-after', () => {
    const cooked = { ...goods, is_cooked_food_pickup: true };
    expect(isStorePayAfterConfirmOrder(cooked)).toBe(false);
    expect(shouldUseGuidedConfirmModal(cooked)).toBe(true);
  });

  it('is not guided when the order is not pay-after', () => {
    expect(shouldUseGuidedConfirmModal(({ ...goods, pay_after_merchant_confirm: false } as Order))).toBe(false);
  });

  it('awaits client payment until paid, then is not cooked-paid', () => {
    expect(isCookedFoodAwaitingClientPayment({ ...goods, current_status: 'confirmed', payment_status: 'pending' })).toBe(true);
    expect(isCookedFoodAwaitingClientPayment({ ...goods, current_status: 'confirmed', payment_status: 'paid' })).toBe(false);
    expect(isCookedFoodPayAfterPaid({ ...goods, current_status: 'preparing', payment_status: 'paid' })).toBe(false);
  });

  it('has no cooked-only ready-fail / start-cooking behaviour', () => {
    expect(isCookedFoodReadyFailEligible({ ...goods, current_status: 'ready_for_pickup', payment_status: 'paid' })).toBe(false);
    expect(isCookedFoodStartCookingPriority({ ...goods, current_status: 'confirmed', payment_status: 'paid' })).toBe(false);
  });
});
