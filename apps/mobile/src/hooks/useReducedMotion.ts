import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Returns `true` when the user has enabled the system-level "Reduce Motion"
 * accessibility setting (iOS Accessibility → Motion → Reduce Motion,
 * Android Accessibility → Remove animations / Transition animation scale = 0).
 *
 * Use this to skip or shorten animations so they respect the user's preference.
 *
 * @example
 * const isReduced = useReducedMotion();
 * const duration = isReduced ? 0 : 300;
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReducedMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (active) setReducedMotion(enabled);
      },
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
