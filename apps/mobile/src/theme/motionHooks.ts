import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { setHapticsReduceMotion } from '@/services/haptics';
import { motion, motionDuration } from './motion';

const ease = Easing.bezier(...motion.easing);

export const enterFade = FadeIn.duration(motion.duration.normal).easing(ease);
export const enterRise = FadeInDown.duration(motion.duration.slow).easing(ease);

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const apply = (value: boolean) => {
      setReduced(value);
      setHapticsReduceMotion(value);
    };
    AccessibilityInfo.isReduceMotionEnabled().then(apply).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
    return () => sub.remove();
  }, []);
  return reduced;
}

export function usePressScale() {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const press = (to: number) => {
    scale.value = withTiming(to, { duration: motionDuration('fast', reduced), easing: ease });
  };
  return {
    animatedStyle,
    onPressIn: () => press(0.97),
    onPressOut: () => press(1),
  };
}
