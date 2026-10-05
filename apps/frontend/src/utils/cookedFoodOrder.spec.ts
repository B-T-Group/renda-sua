import {
  foodServiceStyle,
  showEatInUnavailableNotice,
  isCookedFoodAwaitingClientPayment,
  isCookedFoodPayAfterPaid,
  isStorePayAfterConfirmOrder,
  shouldUseGuidedConfirmModal,
  isCookedFoodReadyFailEligible,
  isCookedFoodStartCookingPriority,
  shouldUseCookedFoodConfirmModal,
} from './cookedFoodOrder';

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
        eat_in: false,
        eat_in_unavailable: true,
        payment_status: 'pending',
      })
    ).toBe(false);
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
        order_items: [{ item: { is_cooked_food: true } }],
      })
    ).toBe(true);
  });

  it('skips scheduled pickup, delivery, and mixed carts', () => {
    expect(
      shouldUseCookedFoodConfirmModal({
        fulfillment_method: 'pickup',
        delivery_time_windows: [{ id: 'slot' }],
        is_cooked_food_pickup: true,
      })
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
    expect(shouldUseCookedFoodConfirmModal({ ...asapPickup, order_items: [] })).toBe(
      false
    );
  });

  it('treats a pickup with no window as ASAP', () => {
    expect(
      shouldUseCookedFoodConfirmModal({
        fulfillment_method: 'pickup',
        is_cooked_food_pickup: true,
        delivery_time_windows: [],
      })
    ).toBe(true);
  });
});

describe('cooked-food payment and cooking priority', () => {
  const confirmedPayAfter = {
    ...asapPickup,
    is_cooked_food_pickup: true,
    pay_after_merchant_confirm: true,
    current_status: 'confirmed',
  };

  it('waits on any unpaid pay-after status except paid and authorized', () => {
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        payment_status: 'pending',
      })
    ).toBe(true);
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        payment_status: 'failed',
      })
    ).toBe(true);
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        payment_status: 'paid',
      })
    ).toBe(false);
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        payment_status: 'authorized',
      })
    ).toBe(false);
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        pay_after_merchant_confirm: false,
        payment_status: 'pending',
      })
    ).toBe(false);
  });

  it('starts cooking after payment, and while already preparing', () => {
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
        current_status: 'confirmed',
        payment_status: 'authorized',
      })
    ).toBe(true);
    expect(
      isCookedFoodStartCookingPriority({
        ...asapPickup,
        is_cooked_food_pickup: true,
        current_status: 'preparing',
        pay_after_merchant_confirm: true,
        payment_status: 'pending',
      })
    ).toBe(true);
    expect(
      isCookedFoodStartCookingPriority({
        ...asapPickup,
        is_cooked_food_pickup: true,
        current_status: 'ready_for_pickup',
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

  it('allows a paid or authorized cooked-food pickup', () => {
    expect(isCookedFoodReadyFailEligible(readyPaid)).toBe(true);
    expect(
      isCookedFoodReadyFailEligible({
        ...readyPaid,
        payment_status: 'authorized',
      })
    ).toBe(true);
  });

  it('blocks unpaid, unready, retail, and delivery after an agent is assigned', () => {
    expect(
      isCookedFoodReadyFailEligible({ ...readyPaid, payment_status: 'pending' })
    ).toBe(false);
    expect(
      isCookedFoodReadyFailEligible({
        ...readyPaid,
        current_status: 'preparing',
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
    expect(
      isCookedFoodReadyFailEligible({
        ...readyPaid,
        fulfillment_method: 'delivery',
        assigned_agent_id: 'agent-1',
      })
    ).toBe(false);
  });

  it('allows a cooked-food delivery handoff before an agent is assigned', () => {
    expect(
      isCookedFoodReadyFailEligible({
        ...readyPaid,
        fulfillment_method: 'delivery',
        assigned_agent_id: null,
      })
    ).toBe(true);
  });
});

describe('flagged-location goods (non-cooked pay-after)', () => {
  const goods = {
    fulfillment_method: 'delivery' as const,
    fulfillment_timing: 'asap' as const,
    pay_after_merchant_confirm: true,
    current_status: 'confirmed',
    payment_status: 'pending',
    order_items: [{ is_cooked_food: false }],
  };

  it('uses the guided store confirm, not the cooked ready-in modal', () => {
    expect(shouldUseCookedFoodConfirmModal(goods)).toBe(false);
    expect(isStorePayAfterConfirmOrder(goods)).toBe(true);
    expect(shouldUseGuidedConfirmModal(goods)).toBe(true);
    expect(
      shouldUseGuidedConfirmModal({ ...goods, fulfillment_method: 'pickup' })
    ).toBe(true);
  });

  it('is not guided for scheduled, non-pay-after, or cooked orders', () => {
    expect(
      isStorePayAfterConfirmOrder({ ...goods, delivery_time_windows: [{ id: 's' }], fulfillment_timing: 'scheduled' })
    ).toBe(false);
    expect(isStorePayAfterConfirmOrder({ ...goods, pay_after_merchant_confirm: false })).toBe(false);
    expect(
      isStorePayAfterConfirmOrder({ ...goods, order_items: [{ is_cooked_food: true }] })
    ).toBe(false);
  });

  it('waits for payment while unpaid, and never counts as cooked "start cooking"', () => {
    expect(isCookedFoodAwaitingClientPayment(goods)).toBe(true);
    expect(isCookedFoodAwaitingClientPayment({ ...goods, payment_status: 'paid' })).toBe(false);
    expect(
      isCookedFoodStartCookingPriority({ ...goods, payment_status: 'paid' })
    ).toBe(false);
  });

  it('paid goods stay cancellable by the store (refund); paid cooked do not', () => {
    expect(isCookedFoodPayAfterPaid({ ...goods, payment_status: 'paid' })).toBe(false);
    expect(
      isCookedFoodPayAfterPaid({
        ...goods,
        payment_status: 'paid',
        order_items: [{ is_cooked_food: true }],
      })
    ).toBe(true);
  });

  it('delivery pay-after for cooked food keeps the ready-in modal', () => {
    expect(
      shouldUseCookedFoodConfirmModal({ ...goods, order_items: [{ is_cooked_food: true }] })
    ).toBe(true);
  });
});
