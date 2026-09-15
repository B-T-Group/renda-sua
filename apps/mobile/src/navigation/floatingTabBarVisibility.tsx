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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useClientFlags } from '../contexts/ClientFlagsContext';
import {
  FLOATING_PILL_HEIGHT,
  FloatingTabBarVariantProvider,
  isReelsTabRoute,
  TAB_BAR_HORIZONTAL_MARGIN,
  TAB_BAR_RADIUS,
  useTabBarGeometry,
  type FloatingTabBarVariant,
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
    lastYRef.current = 0;
    animateTo(false);
  }, [animateTo]);

  const reportScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
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

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!flags.floating_nav_enabled || !ctx) return;
      ctx.reportScroll(event);
    },
    [ctx, flags.floating_nav_enabled]
  );

  const onTabFocusShow = useCallback(() => {
    if (!flags.floating_nav_enabled || !ctx) return;
    ctx.showTabBar();
  }, [ctx, flags.floating_nav_enabled]);

  return { onScroll, onTabFocusShow };
}

export function FloatingAnimatedTabBar(props: BottomTabBarProps) {
  const geometry = useTabBarGeometry();
  const ctx = useFloatingTabBarVisibility();
  const [pointerEvents, setPointerEvents] = useState<'auto' | 'none'>('auto');
  const focusedRoute = props.state.routes[props.state.index];
  const focusedKey = focusedRoute?.key;
  const variant: FloatingTabBarVariant =
    focusedRoute && isReelsTabRoute(focusedRoute.name) ? 'reels' : 'light';

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

  return (
    <FloatingTabBarVariantProvider variant={variant}>
      {ctx ? (
        <Animated.View
          pointerEvents={pointerEvents}
          style={{
            position: 'absolute',
            left: TAB_BAR_HORIZONTAL_MARGIN,
            right: TAB_BAR_HORIZONTAL_MARGIN,
            bottom: geometry.tabBarBottomOffset,
            height: FLOATING_PILL_HEIGHT,
            borderRadius: TAB_BAR_RADIUS,
            overflow: 'hidden',
            transform: [{ translateY: translateY! }],
            opacity: fade,
          }}
        >
          {bar}
        </Animated.View>
      ) : (
        bar
      )}
    </FloatingTabBarVariantProvider>
  );
}

/** React Navigation calls `tabBar(props)` — must return an element, not invoke a hook component. */
export function renderFloatingAnimatedTabBar(props: BottomTabBarProps) {
  return React.createElement(FloatingAnimatedTabBar, props);
}
