import { tabBarGeometry, useTabBarGeometry } from '../navigation/tabBarGeometry';

/** Height reserved for the tab bar and its raised bottom offset. */
export function tabBarOverlayHeight(bottomInset: number): number {
  return tabBarGeometry(bottomInset).tabBarOverlayHeight;
}

export function useTabBarOverlayHeight(): number {
  return useTabBarGeometry().tabBarOverlayHeight;
}

/**
 * Bottom padding for scroll content on tab-root screens so the last controls stay
 * above the floating tab bar.
 */
export function useMainTabContentBottomPadding(extra = 16): number {
  return extra + useTabBarOverlayHeight();
}
