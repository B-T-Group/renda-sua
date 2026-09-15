import React, { type ReactNode } from 'react';
import type {
  BottomTabBarButtonProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClientFlags } from '../contexts/ClientFlagsContext';
import { useTheme } from '../contexts/ThemeContext';

/** Horizontal inset of the floating pill from screen edges. */
const TAB_BAR_HORIZONTAL_MARGIN = 14;
/** Inner left/right padding so end icons clear the capsule curve. */
const FLOATING_INNER_HORIZONTAL_PADDING = 18;
/** Capsule corner radius (Facebook-style floating bar). */
const TAB_BAR_RADIUS = 28;
/** Content height of the floating pill (icons only). */
const FLOATING_PILL_HEIGHT = 56;
/** Gap between home-indicator / screen bottom and the pill. */
const FLOATING_BOTTOM_GAP = 8;
const FLOATING_ICON_HIT = 40;

type TabBarOptions = {
  showShadow?: boolean;
  simpleLegacyLabels?: boolean;
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

function tabBarShadowStyle(showShadow: boolean, floating: boolean) {
  if (!showShadow) {
    return { elevation: 0 };
  }
  if (floating) {
    return {
      elevation: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
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

function createTabBarStyle(
  theme: AppTheme,
  geometry: TabBarGeometry,
  showShadow: boolean
) {
  if (geometry.floatingNavEnabled) {
    return {
      position: 'absolute' as const,
      left: TAB_BAR_HORIZONTAL_MARGIN,
      right: TAB_BAR_HORIZONTAL_MARGIN,
      bottom: geometry.tabBarBottomOffset,
      height: FLOATING_PILL_HEIGHT,
      backgroundColor: theme.colors.pageBackground,
      borderTopWidth: 0,
      borderRadius: TAB_BAR_RADIUS,
      paddingBottom: 0,
      paddingTop: 0,
      paddingHorizontal: FLOATING_INNER_HORIZONTAL_PADDING,
      ...tabBarShadowStyle(showShadow, true),
    };
  }

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
    ...tabBarShadowStyle(showShadow, false),
  };
}

function FloatingTabBarButton(props: BottomTabBarButtonProps) {
  return React.createElement(PlatformPressable, {
    ...props,
    style: [
      props.style,
      {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 0,
      },
    ],
  });
}

export function useTabBarScreenOptions(
  options: TabBarOptions = {}
): BottomTabNavigationOptions {
  const theme = useTheme();
  const geometry = useTabBarGeometry();
  return {
    headerShown: false,
    tabBarActiveTintColor: theme.colors.primary.main,
    tabBarInactiveTintColor: theme.colors.text.secondary,
    tabBarShowLabel: !geometry.floatingNavEnabled,
    tabBarStyle: createTabBarStyle(theme, geometry, options.showShadow !== false),
    tabBarLabelStyle: options.simpleLegacyLabels
      ? theme.typography.caption
      : {
          ...theme.typography.caption,
          fontSize: 11,
          fontWeight: '600',
        },
    tabBarItemStyle: geometry.floatingNavEnabled
      ? {
          height: FLOATING_PILL_HEIGHT,
          paddingTop: 0,
          paddingBottom: 0,
          justifyContent: 'center',
        }
      : options.simpleLegacyLabels
        ? undefined
        : { paddingTop: 4 },
    tabBarButton: geometry.floatingNavEnabled ? FloatingTabBarButton : undefined,
  };
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
  const floating = flags.floating_nav_enabled;

  if (!floating) {
    return React.createElement(
      View,
      { style: { alignItems: 'center', justifyContent: 'center' } },
      children
    );
  }

  return React.createElement(
    View,
    {
      style: {
        alignItems: 'center',
        justifyContent: 'center',
        width: FLOATING_ICON_HIT,
        height: FLOATING_ICON_HIT,
        borderRadius: FLOATING_ICON_HIT / 2,
        backgroundColor: focused ? `${theme.colors.primary.main}1A` : 'transparent',
      },
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants' as const,
    },
    children
  );
}
