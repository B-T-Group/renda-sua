import React, {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from 'react';
import type {
  BottomTabBarButtonProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClientFlags } from '../contexts/ClientFlagsContext';
import { useTheme } from '../contexts/ThemeContext';

/** Horizontal inset of the floating pill from screen edges. */
export const TAB_BAR_HORIZONTAL_MARGIN = 14;
/** Inner left/right padding so end icons clear the capsule curve. */
const FLOATING_INNER_HORIZONTAL_PADDING = 18;
/** Capsule corner radius (Facebook-style floating bar). */
export const TAB_BAR_RADIUS = 28;
/** Content height of the floating pill (icons only). */
export const FLOATING_PILL_HEIGHT = 56;
/** Gap between home-indicator / screen bottom and the pill. */
const FLOATING_BOTTOM_GAP = 4;
const FLOATING_ICON_HIT = 40;

const REELS_TAB_NAMES = new Set([
  'ClientReels',
  'GuestReels',
  'BusinessReels',
]);

export type FloatingTabBarVariant = 'light' | 'reels';

const FloatingTabBarVariantContext = createContext<FloatingTabBarVariant>('light');

export function FloatingTabBarVariantProvider({
  variant,
  children,
}: {
  variant: FloatingTabBarVariant;
  children: ReactNode;
}) {
  return React.createElement(
    FloatingTabBarVariantContext.Provider,
    { value: variant },
    children
  );
}

export function useFloatingTabBarVariant(): FloatingTabBarVariant {
  return useContext(FloatingTabBarVariantContext);
}

export function isReelsTabRoute(routeName: string): boolean {
  return REELS_TAB_NAMES.has(routeName);
}

type TabBarOptions = {
  showShadow?: boolean;
  simpleLegacyLabels?: boolean;
  /** When true, tab bar is positioned by FloatingAnimatedTabBar (no absolute self-position). */
  floatingHosted?: boolean;
};

type AppTheme = ReturnType<typeof useTheme>;

export type TabBarGeometry = {
  bottomInset: number;
  tabBarHeight: number;
  tabBarBottomOffset: number;
  tabBarOverlayHeight: number;
  floatingNavEnabled: boolean;
};

export function tabBarGeometry(
  bottomInset: number,
  floatingNavEnabled = false
): Omit<TabBarGeometry, 'floatingNavEnabled'> {
  if (floatingNavEnabled) {
    const tabBarBottomOffset = Math.max(bottomInset, 0) + FLOATING_BOTTOM_GAP;
    return {
      bottomInset,
      tabBarHeight: FLOATING_PILL_HEIGHT,
      tabBarBottomOffset,
      tabBarOverlayHeight: FLOATING_PILL_HEIGHT + tabBarBottomOffset + 8,
    };
  }

  const verticalPadding = Platform.OS === 'ios' ? 20 : 10;
  const heightBase = Platform.OS === 'ios' ? 56 : 52;
  const tabBarHeight = heightBase + bottomInset + verticalPadding / 2;
  const raisedOffset = bottomInset > 0 ? bottomInset - 4 : 8;
  return {
    bottomInset,
    tabBarHeight,
    tabBarBottomOffset: 0,
    tabBarOverlayHeight: tabBarHeight + raisedOffset,
  };
}

export function useTabBarGeometry(): TabBarGeometry {
  const insets = useSafeAreaInsets();
  const { flags } = useClientFlags();
  const floatingNavEnabled = flags.floating_nav_enabled;
  return {
    ...tabBarGeometry(insets.bottom || 0, floatingNavEnabled),
    floatingNavEnabled,
  };
}

/** Zero insets when floating — we already offset the pill above the home indicator. */
export function useFloatingTabBarSafeAreaInsets():
  | { top: number; right: number; bottom: number; left: number }
  | undefined {
  const { floatingNavEnabled } = useTabBarGeometry();
  if (!floatingNavEnabled) return undefined;
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function tabBarShadowStyle(showShadow: boolean, floating: boolean, reels: boolean) {
  if (!showShadow) {
    return { elevation: 0 };
  }
  if (floating) {
    return {
      elevation: reels ? 10 : 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: reels ? 0.35 : 0.14,
      shadowRadius: reels ? 10 : 12,
    };
  }
  return {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  };
}

export function createFloatingTabBarStyle(args: {
  theme: AppTheme;
  geometry: TabBarGeometry;
  showShadow: boolean;
  floatingHosted: boolean;
  variant: FloatingTabBarVariant;
}) {
  const { theme, geometry, showShadow, floatingHosted, variant } = args;
  const reels = variant === 'reels';
  const base = {
    height: FLOATING_PILL_HEIGHT,
    backgroundColor: reels ? 'rgba(28, 28, 30, 0.92)' : theme.colors.pageBackground,
    borderTopWidth: 0,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: reels ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.1)',
    borderRadius: TAB_BAR_RADIUS,
    paddingBottom: 0,
    paddingTop: 0,
    paddingHorizontal: FLOATING_INNER_HORIZONTAL_PADDING,
    overflow: 'hidden' as const,
    ...tabBarShadowStyle(showShadow, true, reels),
  };
  if (floatingHosted) {
    return {
      ...base,
      position: 'relative' as const,
      left: undefined,
      right: undefined,
      bottom: undefined,
    };
  }
  return {
    ...base,
    position: 'absolute' as const,
    left: TAB_BAR_HORIZONTAL_MARGIN,
    right: TAB_BAR_HORIZONTAL_MARGIN,
    bottom: geometry.tabBarBottomOffset,
  };
}

function createLegacyTabBarStyle(theme: AppTheme, geometry: TabBarGeometry, showShadow: boolean) {
  const verticalPadding = Platform.OS === 'ios' ? 20 : 10;
  return {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: geometry.tabBarHeight,
    backgroundColor: theme.colors.pageBackground,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    borderRadius: 0,
    paddingBottom: geometry.bottomInset + verticalPadding,
    paddingTop: 8,
    ...tabBarShadowStyle(showShadow, false, false),
  };
}

function FloatingTabBarButton(props: BottomTabBarButtonProps) {
  return React.createElement(PlatformPressable, {
    ...props,
    style: [
      props.style,
      {
        flex: 1,
        height: FLOATING_PILL_HEIGHT,
        maxHeight: FLOATING_PILL_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 0,
        paddingBottom: 0,
        paddingVertical: 0,
        overflow: 'hidden',
      },
    ],
  });
}

export function useTabBarScreenOptions(
  options: TabBarOptions = {}
): (props: { route: { name: string } }) => BottomTabNavigationOptions {
  const theme = useTheme();
  const geometry = useTabBarGeometry();
  const floatingHosted = Boolean(options.floatingHosted && geometry.floatingNavEnabled);
  const showShadow = options.showShadow !== false;

  return useCallback(
    ({ route }) => {
      const reelsMode =
        geometry.floatingNavEnabled && isReelsTabRoute(route.name);
      const variant: FloatingTabBarVariant = reelsMode ? 'reels' : 'light';

      if (!geometry.floatingNavEnabled) {
        return {
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary.main,
          tabBarInactiveTintColor: theme.colors.text.secondary,
          tabBarShowLabel: true,
          tabBarStyle: createLegacyTabBarStyle(theme, geometry, showShadow),
          tabBarLabelStyle: options.simpleLegacyLabels
            ? theme.typography.caption
            : {
                ...theme.typography.caption,
                fontSize: 11,
                fontWeight: '600',
              },
          tabBarItemStyle: options.simpleLegacyLabels ? undefined : { paddingTop: 4 },
        };
      }

      return {
        headerShown: false,
        tabBarActiveTintColor: reelsMode ? '#FFFFFF' : theme.colors.primary.main,
        tabBarInactiveTintColor: reelsMode
          ? 'rgba(255, 255, 255, 0.72)'
          : theme.colors.text.secondary,
        tabBarShowLabel: false,
        tabBarStyle: createFloatingTabBarStyle({
          theme,
          geometry,
          showShadow,
          floatingHosted,
          variant,
        }),
        tabBarItemStyle: {
          height: FLOATING_PILL_HEIGHT,
          paddingTop: 0,
          paddingBottom: 0,
          justifyContent: 'center',
        },
        tabBarButton: FloatingTabBarButton,
      };
    },
    [
      floatingHosted,
      geometry,
      options.simpleLegacyLabels,
      showShadow,
      theme,
    ]
  );
}

export function TabBarIconContent({
  focused,
  label: _label,
  children,
}: {
  focused: boolean;
  label: string;
  children: ReactNode;
}) {
  const { flags } = useClientFlags();
  const theme = useTheme();
  const variant = useFloatingTabBarVariant();
  const floating = flags.floating_nav_enabled;

  if (!floating) {
    return React.createElement(
      View,
      { style: { alignItems: 'center', justifyContent: 'center' } },
      children
    );
  }

  const focusBg =
    variant === 'reels'
      ? 'rgba(255, 255, 255, 0.18)'
      : `${theme.colors.primary.main}1A`;

  return React.createElement(
    View,
    {
      style: {
        alignItems: 'center',
        justifyContent: 'center',
        width: FLOATING_ICON_HIT,
        height: FLOATING_ICON_HIT,
        borderRadius: FLOATING_ICON_HIT / 2,
        backgroundColor: focused ? focusBg : 'transparent',
      },
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants' as const,
    },
    children
  );
}
