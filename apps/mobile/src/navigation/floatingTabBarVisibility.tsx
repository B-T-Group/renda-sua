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
  Animated,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
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

type FloatingTabBarVisibilityValue = {
  hiddenProgress: Animated.Value;
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
  const hiddenProgress = useRef(new Animated.Value(0)).current;
  const lastYRef = useRef(0);
  const hiddenRef = useRef(false);
  const ignoreScrollUntilRef = useRef(0);

  const animateTo = useCallback(
    (hidden: boolean) => {
      if (hiddenRef.current === hidden) return;
      hiddenRef.current = hidden;
      Animated.timing(hiddenProgress, {
        toValue: hidden ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
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
  const focusedKey = props.state.routes[props.state.index]?.key;
  const chrome = floatingTabBarChrome(theme, true);

  const hideDistance =
    FLOATING_PILL_HEIGHT + geometry.tabBarBottomOffset + 24;

  useEffect(() => {
    ctx?.showTabBar();
  }, [focusedKey, ctx]);

  useEffect(() => {
    if (!ctx) return;
    const id = ctx.hiddenProgress.addListener(({ value }) => {
      setPointerEvents(value > 0.85 ? 'none' : 'auto');
    });
    return () => ctx.hiddenProgress.removeListener(id);
  }, [ctx]);

  if (!geometry.floatingNavEnabled) {
    return <BottomTabBar {...props} />;
  }

  const translateY = ctx?.hiddenProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, hideDistance],
  });
  const fade = ctx?.hiddenProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.35],
  });

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
    <Animated.View
      pointerEvents={pointerEvents}
      style={{
        ...hostStyle,
        transform: [{ translateY }],
        opacity: fade,
      }}
    >
      {bar}
    </Animated.View>
  );
}

/** React Navigation calls `tabBar(props)` — must return an element, not invoke a hook component. */
export function renderFloatingAnimatedTabBar(props: BottomTabBarProps) {
  return React.createElement(FloatingAnimatedTabBar, props);
}
