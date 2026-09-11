import type { NavigationProp, ParamListBase } from '@react-navigation/native';

export type ClientOrderDetailBackTo = 'orders' | 'home';

type TabLikeState = {
  index?: number;
  routes?: Array<{ name: string }>;
};

/**
 * Prefer Orders when we came from that tab (or backTo=orders).
 * Otherwise send the user to the browse home/dashboard.
 */
export function resolveClientOrderDetailBackTo(
  navigation: NavigationProp<ParamListBase>,
  backTo?: ClientOrderDetailBackTo
): ClientOrderDetailBackTo {
  if (backTo === 'orders' || backTo === 'home') return backTo;

  const state = navigation.getState();
  const prev = state?.routes?.[Math.max(0, (state?.index ?? 0) - 1)];
  if (prev?.name === 'ClientMainTabs') {
    const tabState = prev.state as TabLikeState | undefined;
    const tabName = tabState?.routes?.[tabState.index ?? 0]?.name;
    if (tabName === 'ClientOrders') return 'orders';
  }
  return 'home';
}

/** Leave Order Detail for Orders list or client home (never a no-op goBack). */
export function leaveClientOrderDetail(
  navigation: { navigate: (...args: any[]) => void; getState: () => any },
  backTo?: ClientOrderDetailBackTo
): void {
  const target = resolveClientOrderDetailBackTo(
    navigation as NavigationProp<ParamListBase>,
    backTo
  );
  navigation.navigate('ClientMainTabs', {
    screen: target === 'orders' ? 'ClientOrders' : 'ClientBrowse',
  });
}
