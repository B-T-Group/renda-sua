/**
 * Procedural body motion for the Renda character: bob, squash / stretch, sway,
 * thinking dots, signal ticks and the thinking eye scan. Every loop is a
 * native-driver 0→1 clock read through sampled-sine interpolations, scaled by
 * amplitude values that ease toward the state's targets, so state changes
 * never jump and JS does no per-frame work.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import {
  RENDA_TIMING,
  SHADOW,
  THINK_DOTS,
  bobWave,
  dotBounce,
  sampleCurve,
  scanX,
  scanY,
  swayWave,
  type ResolvedRendaConfig,
} from './rendaCharacterModel';

const ND = true;
const TAU = Math.PI * 2;

export function useValue(initial: number): Animated.Value {
  return useRef(new Animated.Value(initial)).current;
}

/** Loop `value` 0→1 over `period`, resuming from its current value. */
export function startCycle(value: Animated.Value, period: number): () => void {
  let stopped = false;
  let loop: Animated.CompositeAnimation | null = null;
  value.stopAnimation((v) => {
    if (stopped) return;
    const from = ((v % 1) + 1) % 1;
    const first = Animated.timing(value, {
      toValue: 1,
      duration: Math.max(1, (1 - from) * period),
      easing: Easing.linear,
      useNativeDriver: ND,
    });
    loop = first;
    first.start(({ finished }) => {
      if (!finished || stopped) return;
      value.setValue(0);
      loop = Animated.loop(
        Animated.timing(value, { toValue: 1, duration: period, easing: Easing.linear, useNativeDriver: ND })
      );
      loop.start();
    });
  });
  return () => {
    stopped = true;
    loop?.stop();
  };
}

/** Run `value` as a 0→1 loop while `on` (frozen in place otherwise). */
function useCycle(value: Animated.Value, period: number, on: boolean): void {
  useEffect(() => {
    if (on) return startCycle(value, period);
    value.stopAnimation();
    return undefined;
  }, [value, period, on]);
}

/** Ease `value` to `to` (instant without motion). */
export function useEased(value: Animated.Value, to: number, duration: number, motion: boolean): void {
  useEffect(() => {
    const anim = Animated.timing(value, {
      toValue: to,
      duration: motion ? duration : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: ND,
    });
    anim.start();
    return () => anim.stop();
  }, [value, to, duration, motion]);
}

const BOB = sampleCurve(bobWave, 121);
const SWAY = sampleCurve(swayWave, 121);
const SQUASH = sampleCurve((p) => Math.sin(TAU * p), 25);
const BEAT = sampleCurve((p) => 0.5 + 0.5 * Math.sin(TAU * p), 17);
const SCAN_X = sampleCurve(scanX, 49);
const SCAN_Y = sampleCurve(scanY, 49);
const DOT_LIFT = THINK_DOTS.map((_, i) => sampleCurve((p) => -3 * dotBounce(i)(p), 25));
const DOT_SCALE = THINK_DOTS.map((_, i) => sampleCurve((p) => 0.35 * dotBounce(i)(p) - 0.15, 25));

type MotionValues = Record<
  'clock' | 'squash' | 'dotsClock' | 'beat' | 'scan' | 'bobAmp' | 'swayAmp' | 'amp' | 'scanAmp' | 'live' | 'tint' | 'dots' | 'ticks',
  Animated.Value
>;

function useMotionValues(cfg: ResolvedRendaConfig): MotionValues {
  return useRef<MotionValues>({
    clock: new Animated.Value(0),
    squash: new Animated.Value(0),
    dotsClock: new Animated.Value(0),
    beat: new Animated.Value(0),
    scan: new Animated.Value(0),
    bobAmp: new Animated.Value(0),
    swayAmp: new Animated.Value(0),
    amp: new Animated.Value(0),
    scanAmp: new Animated.Value(0),
    live: new Animated.Value(0),
    tint: new Animated.Value(cfg.tint),
    dots: new Animated.Value(cfg.dots ? 1 : 0),
    ticks: new Animated.Value(cfg.ticks ? 1 : 0),
  }).current;
}

/** Clocks and amplitudes follow the state; everything settles to rest when loops stop. */
function useMotionDrivers(v: MotionValues, cfg: ResolvedRendaConfig, motion: boolean): void {
  const on = cfg.loops;
  const T = RENDA_TIMING;
  useCycle(v.clock, T.motionClock / cfg.tempo, on);
  useCycle(v.squash, cfg.period, on && cfg.amp > 0);
  useCycle(v.dotsClock, T.dotsCycle, on && cfg.dots);
  useCycle(v.beat, T.tickBeat, on && cfg.ticks);
  useCycle(v.scan, T.scanCycle, on && cfg.scan);
  useEased(v.bobAmp, on ? cfg.bob : 0, T.amplitude, motion);
  useEased(v.swayAmp, on ? cfg.sway : 0, T.amplitude, motion);
  useEased(v.amp, on ? cfg.amp : 0, T.amplitude, motion);
  useEased(v.scanAmp, on && cfg.scan ? 1 : 0, 400, motion);
  useEased(v.live, on ? 1 : 0, T.settleEase, motion);
  useEased(v.tint, cfg.tint, T.tint, motion);
  useEased(v.dots, cfg.dots ? 1 : 0, T.accents, motion);
  useEased(v.ticks, cfg.ticks ? 1 : 0, T.accents, motion);
}

const { add, multiply, subtract } = Animated;

function accentNodes(v: MotionValues, k: number) {
  const beat = multiply(v.beat.interpolate(BEAT), v.live);
  return {
    dots: v.dots,
    dot: THINK_DOTS.map((_, i) => ({
      ty: multiply(multiply(v.dotsClock.interpolate(DOT_LIFT[i]), v.live), k),
      scale: add(1, multiply(v.dotsClock.interpolate(DOT_SCALE[i]), v.live)),
    })),
    ticksOpacity: multiply(v.ticks, subtract(1, multiply(beat, 0.45))),
    tickScale: add(1, multiply(beat, 0.14)),
  };
}

/**
 * Derived native nodes. `eyeX` (px) leans the body toward the gaze. Memoised:
 * new nodes each render would make the native driver re-attach its graph.
 */
function buildNodes(v: MotionValues, k: number, eyeX: Animated.Value) {
  const bob = multiply(v.clock.interpolate(BOB), v.bobAmp);
  const q = multiply(v.squash.interpolate(SQUASH), v.amp);
  const scanXPx = multiply(multiply(v.scan.interpolate(SCAN_X), v.scanAmp), k);
  const lean = multiply(add(eyeX, scanXPx), 0.9 / k);
  return {
    bobY: multiply(bob, k),
    squashX: add(1, q),
    squashY: subtract(1, multiply(q, 0.9)),
    rotate: add(multiply(v.clock.interpolate(SWAY), v.swayAmp), lean).interpolate({
      inputRange: [-90, 90],
      outputRange: ['-90deg', '90deg'],
    }),
    scanX: scanXPx,
    scanY: multiply(multiply(v.scan.interpolate(SCAN_Y), v.scanAmp), k),
    shadowScale: add(1, multiply(bob, 0.035)),
    shadowOpacity: add(SHADOW.opacity, multiply(bob, 0.02)),
    tint: v.tint,
    ...accentNodes(v, k),
  };
}

export type RendaMotionNodes = ReturnType<typeof buildNodes>;

export function useRendaMotion(
  cfg: ResolvedRendaConfig,
  k: number,
  motion: boolean,
  eyeX: Animated.Value
): RendaMotionNodes {
  const v = useMotionValues(cfg);
  useMotionDrivers(v, cfg, motion);
  return useMemo(() => buildNodes(v, k, eyeX), [v, k, eyeX]);
}
