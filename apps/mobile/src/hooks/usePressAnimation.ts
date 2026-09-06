import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

interface PressAnimationOptions {
  /** Scale factor on press (default: 0.97) */
  scaleDown?: number;
  /** Animation duration in ms (default: 120) */
  duration?: number;
}

/**
 * Returns an Animated.Value-based scale transform and press handlers for
 * subtle press-feedback animations on interactive cards/buttons.
 *
 * Automatically respects the "Reduce Motion" system setting — when enabled,
 * the animation is skipped (scale stays at 1).
 *
 * @example
 * const { scale, onPressIn, onPressOut } = usePressAnimation();
 * <Animated.View style={{ transform: [{ scale }] }} onTouchStart={onPressIn} onTouchEnd={onPressOut}>
 */
export function usePressAnimation({
  scaleDown = 0.97,
  duration = 120,
}: PressAnimationOptions = {}) {
  const isReduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    if (isReduced) return;
    Animated.spring(scale, {
      toValue: scaleDown,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [isReduced, scale, scaleDown]);

  const onPressOut = useCallback(() => {
    if (isReduced) return;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 2,
    }).start();
  }, [isReduced, scale]);

  return { scale, onPressIn, onPressOut, duration };
}
