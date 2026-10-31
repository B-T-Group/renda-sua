import { shouldHidePersistentActiveDeliveryHeader } from './shouldHidePersistentActiveDeliveryHeader';

describe('shouldHidePersistentActiveDeliveryHeader', () => {
  it('hides when there is no active delivery', () => {
    expect(
      shouldHidePersistentActiveDeliveryHeader({
        isHomeFocused: false,
        isOrderDetailFocused: false,
        hasActiveOrder: false,
      })
    ).toBe(true);
  });

  it('shows on other agent screens when an active delivery exists', () => {
    expect(
      shouldHidePersistentActiveDeliveryHeader({
        isHomeFocused: false,
        isOrderDetailFocused: false,
        hasActiveOrder: true,
      })
    ).toBe(false);
  });

  it('hides on Home and AgentOrderDetail the same way', () => {
    expect(
      shouldHidePersistentActiveDeliveryHeader({
        isHomeFocused: true,
        isOrderDetailFocused: false,
        hasActiveOrder: true,
      })
    ).toBe(true);
    expect(
      shouldHidePersistentActiveDeliveryHeader({
        isHomeFocused: false,
        isOrderDetailFocused: true,
        hasActiveOrder: true,
      })
    ).toBe(true);
  });
});
