import React, { type ReactNode } from 'react';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Platform, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClientFlags } from '../contexts/ClientFlagsContext';
import { useTheme } from '../contexts/ThemeContext';

const TAB_BAR_HORIZONTAL_MARGIN = 16;
const TAB_BAR_RADIUS = 24;

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
  const verticalPadding = Platform.OS === 'ios' ? 20 : 10;
  const heightBase = Platform.OS === 'ios' ? 56 : 52;
  const tabBarHeight = heightBase + bottomInset + verticalPadding / 2;
  const raisedOffset = bottomInset > 0 ? bottomInset - 4 : 8;
  return {
    bottomInset,
    tabBarHeight,
    tabBarBottomOffset: floatingNavEnabled ? raisedOffset : 0,
    // Preserve the existing conservative content clearance when the flag is off.
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

function tabBarShadowStyle(showShadow: boolean, floating: boolean) {
  return {
    elevation: showShadow ? (floating ? 12 : 8) : 0,
    shadowColor: showShadow ? '#000' : undefined,
    shadowOffset: showShadow ? { width: 0, height: -2 } : undefined,
    shadowOpacity: showShadow ? 0.08 : 0,
    shadowRadius: showShadow ? 8 : 0,
  };
}

function createTabBarStyle(
  theme: AppTheme,
  geometry: TabBarGeometry,
  showShadow: boolean
) {
  const verticalPadding = Platform.OS === 'ios' ? 20 : 10;
  const margin = geometry.floatingNavEnabled ? TAB_BAR_HORIZONTAL_MARGIN : 0;
  return {
    position: 'absolute' as const,
    left: margin,
    right: margin,
    bottom: geometry.tabBarBottomOffset,
    height: geometry.tabBarHeight,
    backgroundColor: theme.colors.pageBackground,
    borderTopWidth: geometry.floatingNavEnabled ? 0 : 1,
    borderTopColor: theme.colors.divider,
    borderRadius: geometry.floatingNavEnabled ? TAB_BAR_RADIUS : 0,
    paddingBottom: geometry.bottomInset + verticalPadding,
    paddingTop: 8,
    ...tabBarShadowStyle(showShadow, geometry.floatingNavEnabled),
  };
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
    tabBarItemStyle: options.simpleLegacyLabels ? undefined : { paddingTop: 4 },
  };
}

function createFocusedLabel(label: string, theme: AppTheme) {
  return React.createElement(Text, {
    numberOfLines: 1,
    style: {
      ...theme.typography.caption,
      color: theme.colors.primary.main,
      fontSize: 10,
      fontWeight: '700',
      marginTop: 1,
    },
    children: label,
  });
}

export function TabBarIconContent({
  focused,
  label,
  children,
}: {
  focused: boolean;
  label: string;
  children: ReactNode;
}) {
  const { flags } = useClientFlags();
  const theme = useTheme();
  return React.createElement(
    View,
    { style: { alignItems: 'center', justifyContent: 'center', minWidth: 72 } },
    children,
    flags.floating_nav_enabled && focused ? createFocusedLabel(label, theme) : null
  );
}
