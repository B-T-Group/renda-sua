/** Home already lists Active Orders — hide the duplicate Actions Needed row. */
export function filterAgentHomeActionsNeeded<T extends { kind: string }>(
  items: T[],
  activeOrdersSectionShown: boolean
): T[] {
  if (!activeOrdersSectionShown) return items;
  return items.filter((item) => item.kind !== 'active_orders');
}

/** Drop the Now hero card when Home already shows Active Orders. */
export function shouldHideAgentNowHero(activeOrderCount: number): boolean {
  return activeOrderCount > 0;
}
