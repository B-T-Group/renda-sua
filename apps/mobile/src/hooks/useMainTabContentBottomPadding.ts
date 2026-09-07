import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the floating tab bar overlay (keep in sync with Client/Agent tab navigators). */
export function tabBarOverlayHeight(bottomInset: number): number {
  const tabBarVerticalPadding = Platform.OS === 'ios' ? 20 : 10;
  const tabBarHeightBase = Platform.OS === 'ios' ? 56 : 52;
  const tabBarHeight = tabBarHeightBase + bottomInset + tabBarVerticalPadding / 2;
  const tabBarBottomOffset = bottomInset > 0 ? bottomInset - 4 : 8;
  return tabBarHeight + tabBarBottomOffset;
}

export function useTabBarOverlayHeight(): number {
  const insets = useSafeAreaInsets();
  return tabBarOverlayHeight(insets.bottom || 0);
}

/**
 * Bottom padding for scroll content on tab-root screens so the last controls stay
 * above the floating tab bar.
 */
export function useMainTabContentBottomPadding(extra = 16): number {
  return extra + useTabBarOverlayHeight();
}
