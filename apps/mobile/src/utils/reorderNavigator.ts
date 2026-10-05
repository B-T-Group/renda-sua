type ReorderNav = {
  getState: () => { routeNames?: string[] } | undefined;
  getParent: <T>() => T | undefined;
};

/** Tab screens do not own Cart. Use the parent stack when Cart is not here. */
export function reorderNavigator<T extends ReorderNav>(navigation: T): T {
  const names = navigation.getState()?.routeNames ?? [];
  if (names.includes('Cart')) return navigation;
  return navigation.getParent<T>() ?? navigation;
}
