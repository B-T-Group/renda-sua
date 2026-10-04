import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useClientFlags } from '../contexts/ClientFlagsContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  FLOATING_PILL_HEIGHT,
  floatingTabBarChrome,
  TAB_BAR_HORIZONTAL_MARGIN,
  useTabBarGeometry,
} from './tabBarGeometry';

const SCROLL_DIR_THRESHOLD = 10;
const SHOW_NEAR_TOP_Y = 16;

function isTabBarDisplayNone(style: StyleProp<ViewStyle> | undefined): boolean {
  const flat = StyleSheet.flatten(style);
  return flat?.display === 'none';
}

type FloatingTabBarVisibilityValue = {
  hiddenProgress: SharedValue<number>;
  reportScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  showTabBar: () => void;
};

const FloatingTabBarVisibilityContext =
  createContext<FloatingTabBarVisibilityValue | null>(null);

export function FloatingTabBarVisibilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const hiddenProgress = useSharedValue(0);
  const lastYRef = useRef(0);
  const hiddenRef = useRef(false);
  const ignoreScrollUntilRef = useRef(0);

  const animateTo = useCallback(
    (hidden: boolean) => {
      if (hiddenRef.current === hidden) return;
      hiddenRef.current = hidden;
      hiddenProgress.value = withTiming(hidden ? 1 : 0, { duration: 220 });
    },
    [hiddenProgress]
  );

  const showTabBar = useCallback(() => {
    // Ignore stale scroll events from the previous tab after a focus change.
    ignoreScrollUntilRef.current = Date.now() + 350;
    animateTo(false);
  }, [animateTo]);

  const reportScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      if (Date.now() < ignoreScrollUntilRef.current) {
        lastYRef.current = y;
        return;
      }

      const delta = y - lastYRef.current;
      lastYRef.current = y;

      if (y <= SHOW_NEAR_TOP_Y) {
        animateTo(false);
        return;
      }
      if (delta > SCROLL_DIR_THRESHOLD) {
        animateTo(true);
      } else if (delta < -SCROLL_DIR_THRESHOLD) {
        animateTo(false);
      }
    },
    [animateTo]
  );

  const value = useMemo(
    () => ({ hiddenProgress, reportScroll, showTabBar }),
    [hiddenProgress, reportScroll, showTabBar]
  );

  return (
    <FloatingTabBarVisibilityContext.Provider value={value}>
      {children}
    </FloatingTabBarVisibilityContext.Provider>
  );
}

export function useFloatingTabBarVisibility(): FloatingTabBarVisibilityValue | null {
  return useContext(FloatingTabBarVisibilityContext);
}

/** Scroll reporter for Catalog / Reels; no-op when floating nav or provider is off. */
export function useReportTabBarScroll(): {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onTabFocusShow: () => void;
} {
  const { flags } = useClientFlags();
  const ctx = useFloatingTabBarVisibility();
  const isFocused = useIsFocused();

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!flags.floating_nav_enabled || !ctx || !isFocused) return;
      ctx.reportScroll(event);
    },
    [ctx, flags.floating_nav_enabled, isFocused]
  );

  const onTabFocusShow = useCallback(() => {
    if (!flags.floating_nav_enabled || !ctx) return;
    ctx.showTabBar();
  }, [ctx, flags.floating_nav_enabled]);

  return { onScroll, onTabFocusShow };
}

export function FloatingAnimatedTabBar(props: BottomTabBarProps) {
  const theme = useTheme();
  const geometry = useTabBarGeometry();
  const ctx = useFloatingTabBarVisibility();
  const [pointerEvents, setPointerEvents] = useState<'auto' | 'none'>('auto');
  const focusedRoute = props.state.routes[props.state.index];
  const focusedKey = focusedRoute?.key;
  const focusedOptions = focusedKey ? props.descriptors[focusedKey]?.options : undefined;
  const chrome = floatingTabBarChrome(theme, true);
  const tabBarHidden = isTabBarDisplayNone(focusedOptions?.tabBarStyle);

  const hideDistance =
    FLOATING_PILL_HEIGHT + geometry.tabBarBottomOffset + 24;

  useEffect(() => {
    if (!tabBarHidden) ctx?.showTabBar();
  }, [focusedKey, ctx, tabBarHidden]);

  const fallbackProgress = useSharedValue(0);
  const progress = ctx?.hiddenProgress ?? fallbackProgress;
  const barMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * hideDistance }],
    opacity: 1 - progress.value * 0.65,
  }));
  const applyPointer = useCallback((hidden: boolean) => {
    setPointerEvents(hidden ? 'none' : 'auto');
  }, []);
  useAnimatedReaction(
    () => progress.value > 0.85,
    (hidden, prev) => {
      if (hidden !== prev) runOnJS(applyPointer)(hidden);
    },
    [applyPointer]
  );

  if (!geometry.floatingNavEnabled) {
    return <BottomTabBar {...props} />;
  }

  // Guest auth (Signup/OTP/etc.) sets display:none — hide the floating host too,
  // otherwise an empty pill covers the sticky footer buttons.
  if (tabBarHidden) {
    return null;
  }

  const bar = <BottomTabBar {...props} />;

  const hostStyle = {
    position: 'absolute' as const,
    left: TAB_BAR_HORIZONTAL_MARGIN,
    right: TAB_BAR_HORIZONTAL_MARGIN,
    bottom: geometry.tabBarBottomOffset,
    height: FLOATING_PILL_HEIGHT,
    overflow: 'hidden' as const,
    ...chrome,
  };

  if (!ctx) {
    return <View style={hostStyle}>{bar}</View>;
  }

  return (
    <Animated.View pointerEvents={pointerEvents} style={[hostStyle, barMotion]}>
      {bar}
    </Animated.View>
  );
}

/** React Navigation calls `tabBar(props)` — must return an element, not invoke a hook component. */
export function renderFloatingAnimatedTabBar(props: BottomTabBarProps) {
  return React.createElement(FloatingAnimatedTabBar, props);
}
