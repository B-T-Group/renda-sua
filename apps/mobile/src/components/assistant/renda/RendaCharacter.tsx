/**
 * Renda, the shopping-assistant character: a solid-colour jelly blob with two
 * white pill eyes. One component for every size; eyes are derived from the
 * size (expressive ≥ 36, dots 20–35, none below 20).
 *
 * Motion uses RN core Animated with `useNativeDriver: true` and animates
 * transform / opacity only (eng plan §6.1: no Reanimated / worklets here).
 * Idle bobs, squashes, sways and leans toward its gaze while the eye life cycle
 * runs; Thinking turns violet, bounces three dots and scans with its eyes.
 * Reduce Motion: a still pose whose colour, accents and eyes follow the state.
 * Decorative: hidden from screen readers.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { rendaCharacterTokens as T } from '../../../theme/rendaCharacterTokens';
import {
  BLOB_BASE_Y,
  CX,
  CY,
  EYE_X,
  HOP_PEAK,
  HOP_SPRING,
  RENDA_TIMING,
  SPARKLE_ANGLES,
  THINK_DOTS,
  VIEWBOX_H,
  VIEWBOX_W,
  characterWidth,
  easeOutCubic,
  eyeShapeFor,
  eyesForSize,
  resolveRendaConfig,
  sampleCurve,
  sparklePath,
  springVelocityForPeak,
  type RendaCharacterState,
  type RendaEyeShape,
  type RendaEyes,
} from './rendaCharacterModel';
import { idleEyeMode, type IdleEyeMode } from './rendaIdleEyeLife';
import {
  ArcEyes,
  BlobLayer,
  Mote,
  PillEye,
  RIPPLE_BOX,
  RippleBlob,
  SHADOW_BOX,
  ShadowLayer,
  TICK_BOX,
  ThinkDot,
  Ticks,
  dotBox,
  eyeBox,
  frameStyle,
  layerStyles,
} from './rendaCharacterLayers';
import { RendaCharacterStatic } from './RendaCharacterStatic';
import { useEased, useValue, useRendaMotion, type RendaMotionNodes } from './useRendaMotion';
import { useRendaEyes, type IdleEyeForce } from './useRendaEyes';

export type { RendaCharacterState, RendaEyes } from './rendaCharacterModel';

export type RendaCharacterProps = {
  /** Character height in px (width is 0.82 × height). */
  size: number;
  state?: RendaCharacterState;
  /**
   * false = static drawing (message avatars, header button, badges): a single
   * <Svg> with no Animated values or listeners. Default true.
   */
  animated?: boolean;
  /** Override the size-derived eye level. */
  eyes?: RendaEyes;
  /** Header avatar: a gentler idle; attentive/listening read as idle. */
  staticIdle?: boolean;
  /** Pause loops (screen blurred, 20 s settle). Eyes and colour keep their state. */
  paused?: boolean;
  /** Bump to replay the current state's one-shot (e.g. the attention ripple). */
  replayKey?: number;
  /**
   * Review / harness only: freeze the Idle eye life cycle on one phase
   * (Rest / Wake / Glance / Blink / Drowse) so screenshots are deterministic.
   */
  idleEyeForce?: IdleEyeForce;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const ND = true; // useNativeDriver everywhere in this file

function useAppActive(): boolean {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * Latch: false until `on` is first true, then true for the instance's life.
 * Optional layers (violet body, dots, ticks, sparkles, ripples) mount on first
 * use only, so an idle launcher does not carry invisible native SVG views.
 */
function useLatch(on: boolean): boolean {
  const [latched, setLatched] = useState(on);
  if (on && !latched) setLatched(true);
  return latched || on;
}

const OUT_CUBIC = sampleCurve(easeOutCubic, 9);
const RIPPLE_OPACITY = sampleCurve((p) => 0.55 * Math.pow(1 - p, 1.5), 9);
const SPARKLE_OPACITY = { inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] };
/** Body pivots on the blob's base (viewBox height = 100 units → %). */
const BODY_ORIGIN = ['50%', `${BLOB_BASE_Y}%`, 0];

/** A soft jelly hop on every state change; sparkles / ripples for success and attention. */
function useOneShots(state: RendaCharacterState, on: boolean, replayKey: number) {
  const pop = useValue(0);
  const sparkles = useRef(SPARKLE_ANGLES.map(() => new Animated.Value(0))).current;
  /** -1 = at rest (hidden); 0→1 = one ripple. */
  const ripples = useRef([new Animated.Value(-1), new Animated.Value(-1)]).current;
  useEffect(() => {
    if (!on) return undefined;
    const running: Animated.CompositeAnimation[] = [
      Animated.spring(pop, { toValue: 0, velocity: springVelocityForPeak(HOP_PEAK[state], HOP_SPRING), ...HOP_SPRING, useNativeDriver: ND }),
    ];
    if (state === 'success') running.push(sparkleRun(sparkles));
    if (state === 'success' || state === 'attention') running.push(rippleRun(ripples, state === 'success' ? 1 : 2));
    pop.setValue(0);
    running.forEach((a) => a.start());
    return () => running.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, replayKey, on]);
  return { pop, sparkles, ripples };
}

function sparkleRun(sparkles: Animated.Value[]): Animated.CompositeAnimation {
  sparkles.forEach((v) => v.setValue(0));
  return Animated.stagger(
    RENDA_TIMING.sparkleStagger,
    sparkles.map((v) =>
      Animated.timing(v, { toValue: 1, duration: RENDA_TIMING.sparkle, easing: Easing.linear, useNativeDriver: ND })
    )
  );
}

function rippleRun(ripples: Animated.Value[], count: number): Animated.CompositeAnimation {
  ripples.forEach((v) => v.setValue(-1));
  return Animated.parallel(
    ripples.slice(0, count).map((v, i) =>
      Animated.sequence([
        Animated.delay(i * RENDA_TIMING.rippleGap),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: ND }),
        Animated.timing(v, { toValue: 1, duration: RENDA_TIMING.ripple, easing: Easing.linear, useNativeDriver: ND }),
      ])
    )
  );
}

type EyeNodes = ReturnType<typeof useRendaEyes>;

/** Pill / dot / arc eyes; idle holds pills and `eyeMix` becomes their openness. */
const EyesLayer = memo(function EyesLayer({ k, shape, eyes, hold, m }: { k: number; shape: RendaEyeShape; eyes: EyeNodes; hold: Animated.Value; m: RendaMotionNodes }) {
  const n = useMemo(() => eyeNodes(eyes.eyeMix, eyes.blink, hold, k), [eyes, hold, k]);
  const translate = useMemo(
    () => [{ translateX: Animated.add(eyes.eyeX, m.scanX) }, { translateY: Animated.add(eyes.eyeY, m.scanY) }],
    [eyes, m]
  );
  if (shape === 'none') return null;
  const dot = shape === 'dot';
  return (
    <Animated.View style={[layerStyles.fill, { transform: translate }]}>
      {dot ? null : (
        <Animated.View style={[layerStyles.fill, { opacity: n.arcOpacity, transform: [{ translateY: n.arcLift }] }]}>
          <ArcEyes k={k} />
        </Animated.View>
      )}
      {EYE_X.map((x) => {
        const b = eyeBox(x);
        const scaleY = dot ? eyes.blink : n.openScaleY;
        const style = { opacity: dot ? 1 : n.openOpacity, transform: [{ scaleY }], transformOrigin: 'center' };
        return (
          <Animated.View key={x} style={[frameStyle(k, b.x, b.y, b.w, b.h), style]}>
            <PillEye k={k} x={x} dot={dot} />
          </Animated.View>
        );
      })}
    </Animated.View>
  );
});

function eyeNodes(eyeMix: Animated.Value, blink: Animated.Value, hold: Animated.Value, k: number) {
  const { add, multiply, subtract } = Animated;
  const height = add(
    eyeMix.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    multiply(hold, eyeMix.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }))
  );
  return {
    openScaleY: multiply(height, blink),
    openOpacity: add(eyeMix.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 1, 1] }), hold).interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    arcOpacity: multiply(eyeMix.interpolate({ inputRange: [0, 0.2, 1], outputRange: [1, 1, 0] }), subtract(1, hold)),
    arcLift: eyeMix.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5 * k] }),
  };
}

/** Thinking dots (bouncing in a wave) and listening / responding ticks (pulsing). */
const Accents = memo(function Accents({ k, m, dots, ticks }: { k: number; m: RendaMotionNodes; dots: boolean; ticks: boolean }) {
  const t = TICK_BOX;
  return (
    <>
      {dots
        ? THINK_DOTS.map((_, i) => {
            const b = dotBox(i);
            const d = m.dot[i];
            return (
              <Animated.View
                key={`d${i}`}
                style={[frameStyle(k, b.x, b.y, b.w, b.h), { opacity: m.dots, transform: [{ translateY: d.ty }, { scale: d.scale }] }]}
              >
                <ThinkDot k={k} i={i} color={T.violet} />
              </Animated.View>
            );
          })
        : null}
      {ticks ? (
        <Animated.View style={[frameStyle(k, t.x, t.y, t.w, t.h), { opacity: m.ticksOpacity, transform: [{ scale: m.tickScale }] }]}>
          <Ticks k={k} color={T.blue} />
        </Animated.View>
      ) : null}
    </>
  );
});

const Ripples = memo(function Ripples({ k, ripples }: { k: number; ripples: Animated.Value[] }) {
  const b = RIPPLE_BOX;
  return (
    <>
      {ripples.map((v, i) => (
        <Animated.View
          key={`r${i}`}
          style={[
            frameStyle(k, b.x, b.y, b.w, b.h),
            {
              opacity: v.interpolate({ inputRange: [-1, -0.001, ...RIPPLE_OPACITY.inputRange], outputRange: [0, 0, ...RIPPLE_OPACITY.outputRange], extrapolate: 'clamp' }),
              transform: [{ scale: v.interpolate({ inputRange: OUT_CUBIC.inputRange, outputRange: OUT_CUBIC.outputRange.map((o) => 1 + 0.35 * o), extrapolate: 'clamp' }) }],
            },
          ]}
        >
          <RippleBlob k={k} color={T.blue} />
        </Animated.View>
      ))}
    </>
  );
});

const Sparkles = memo(function Sparkles({ k, size, sparkles }: { k: number; size: number; sparkles: Animated.Value[] }) {
  const px = Math.max(4.8, 300 / size) * k;
  return (
    <>
      {SPARKLE_ANGLES.map((angle, i) => {
        const v = sparkles[i];
        const { from, to } = sparklePath(angle);
        const along = (delta: number) =>
          v.interpolate({ inputRange: OUT_CUBIC.inputRange, outputRange: OUT_CUBIC.outputRange.map((o) => o * delta * k) });
        const transform = [
          { translateX: along(to[0] - from[0]) },
          { translateY: along(to[1] - from[1]) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.5] }) },
        ];
        return (
          <Animated.View
            key={`s${angle}`}
            style={[styles.abs, { left: from[0] * k - px / 2, top: from[1] * k - px / 2, width: px, height: px, opacity: v.interpolate(SPARKLE_OPACITY), transform }]}
          >
            <Mote px={px} />
          </Animated.View>
        );
      })}
    </>
  );
});

const Shadow = memo(function Shadow({ k, m, violet }: { k: number; m: RendaMotionNodes; violet: boolean }) {
  const b = SHADOW_BOX;
  return (
    <Animated.View style={[frameStyle(k, b.x, b.y, b.w, b.h), { opacity: m.shadowOpacity, transform: [{ scaleX: m.shadowScale }] }]}>
      <ShadowLayer k={k} color={T.blue} />
      {violet ? (
        <Animated.View style={[layerStyles.fill, { opacity: m.tint }]}>
          <ShadowLayer k={k} color={T.violet} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
});

/** Bob, sway + gaze lean, squash / stretch and the hop, all pivoting on the blob's base. */
function bodyTransformFor(m: RendaMotionNodes, pop: Animated.Value) {
  const { add, multiply } = Animated;
  return [
    { translateY: m.bobY },
    { rotate: m.rotate },
    { scaleX: multiply(m.squashX, add(1, multiply(pop, 1.1))) },
    { scaleY: multiply(m.squashY, add(1, multiply(pop, 0.8))) },
  ];
}

type Resolved = {
  k: number;
  eyeLevel: RendaEyes;
  cfg: ReturnType<typeof resolveRendaConfig>;
  eyeShape: RendaEyeShape;
  lifeMode: IdleEyeMode;
  motionCapable: boolean;
};

function useResolved({ size, state = 'idle', eyes, staticIdle = false, paused = false }: RendaCharacterProps): Resolved {
  const reducedMotion = useReducedMotion();
  const appActive = useAppActive();
  const eyeLevel = eyes ?? eyesForSize(size);
  const effectivePaused = paused || !appActive;
  const cfg = resolveRendaConfig(state, { animated: true, reducedMotion, staticIdle, paused: effectivePaused });
  const lifeMode = idleEyeMode({ eyes: eyeLevel, staticIdle, reducedMotion, paused: effectivePaused, enabled: state === 'idle' });
  return { k: size / VIEWBOX_H, eyeLevel, cfg, eyeShape: eyeShapeFor(eyeLevel, cfg), lifeMode, motionCapable: !reducedMotion };
}

function RendaCharacterAnimated(props: RendaCharacterProps) {
  const { size, state = 'idle', staticIdle = false, replayKey = 0, idleEyeForce, style, testID } = props;
  const { k, cfg, eyeShape, lifeMode, motionCapable } = useResolved(props);
  const eyes = useRendaEyes({ state, cfg, eyeShape, lifeMode, k, motionCapable, replayKey, idleEyeForce });
  const m = useRendaMotion(cfg, k, motionCapable, eyes.eyeX);
  const hold = useValue(state === 'idle' ? 1 : 0);
  useEased(hold, state === 'idle' && eyeShape === 'open' ? 1 : 0, 160, motionCapable);
  const shots = useOneShots(state, cfg.oneShots, replayKey);

  const needViolet = useLatch(cfg.tint > 0);
  const needDots = useLatch(cfg.dots);
  const needTicks = useLatch(cfg.ticks);
  const needRipples = useLatch(motionCapable && (state === 'attention' || state === 'success'));
  const needSparkles = useLatch(motionCapable && state === 'success');
  const bodyTransform = useMemo(() => bodyTransformFor(m, shots.pop), [m, shots.pop]);

  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={[{ width: characterWidth(size), height: size }, styles.root, style]}
    >
      {needRipples ? <Ripples k={k} ripples={shots.ripples} /> : null}
      {!staticIdle && size >= 48 ? <Shadow k={k} m={m} violet={needViolet} /> : null}
      <Animated.View style={[layerStyles.fill, { transformOrigin: BODY_ORIGIN, transform: bodyTransform }]}>
        <BlobLayer k={k} color={T.blue} />
        {needViolet ? (
          <Animated.View style={[layerStyles.fill, { opacity: m.tint }]}>
            <BlobLayer k={k} color={T.violet} />
          </Animated.View>
        ) : null}
        <EyesLayer k={k} shape={eyeShape} eyes={eyes} hold={hold} m={m} />
      </Animated.View>
      <Accents k={k} m={m} dots={needDots} ticks={needTicks} />
      {needSparkles ? <Sparkles k={k} size={size} sparkles={shots.sparkles} /> : null}
    </View>
  );
}

/**
 * `animated={false}` (message avatars, header button, badges) renders the
 * single-<Svg> static drawing; everything else gets the animated character.
 */
function RendaCharacterImpl(props: RendaCharacterProps) {
  if (props.animated === false) {
    return (
      <RendaCharacterStatic
        size={props.size}
        state={props.state}
        eyes={props.eyes}
        style={props.style}
        testID={props.testID}
      />
    );
  }
  return <RendaCharacterAnimated {...props} />;
}

export const RendaCharacter = memo(RendaCharacterImpl);
export default RendaCharacter;

const styles = StyleSheet.create({
  root: { overflow: 'visible' },
  abs: { position: 'absolute' },
});

/** Exposed for tests / docs: the drawing box in viewBox units. */
export const RENDA_VIEWBOX = { width: VIEWBOX_W, height: VIEWBOX_H, cx: CX, cy: CY } as const;
