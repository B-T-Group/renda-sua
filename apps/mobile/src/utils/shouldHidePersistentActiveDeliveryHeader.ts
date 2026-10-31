export function shouldHidePersistentActiveDeliveryHeader(input: {
  isHomeFocused: boolean;
  isOrderDetailFocused: boolean;
  hasActiveOrder: boolean;
}): boolean {
  if (!input.hasActiveOrder) return true;
  return input.isHomeFocused || input.isOrderDetailFocused;
}
