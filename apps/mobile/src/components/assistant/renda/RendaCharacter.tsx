/**
 * Renda, the shopping-assistant character (#451 spec §1): an upright oval ring
 * around a navy face with two white eyes. One component for every size; eyes
 * are derived from the size (expressive ≥ 36, dots 20–35, none below 20).
 *
 * Motion uses RN core Animated with `useNativeDriver: true` and animates
 * transform / opacity only (eng plan §6.1: no Reanimated / worklets here).
 * Reduce Motion (hooks/useReducedMotion) gives a static ring; the eye shape
 * still switches per state. Decorative: hidden from screen readers.
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
import { useTheme } from '../../../contexts/ThemeContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import {
  ATTENTION_SPRING,
  CX,
  CY,
  ECHO_TURNS,
  EYE_CENTERS,
  ORBIT_TURNS,
  RENDA_TIMING,
  RING_SQUASH_X,
  SPARKLE_ANGLES,
  SUCCESS_SPRING,
  VIEWBOX_H,
  VIEWBOX_W,
  bloomAlphaRange,
  bloomSegmentsForSize,
  characterWidth,
  easeInOutCubic,
  easeOutCubic,
  eyeShapeFor,
  eyesForSize,
  haloAlphaRange,
  nextBlinkDelay,
  resolveRendaConfig,
  sampleCurve,
  sparkleColor,
  sparklePath,
  springVelocityForPeak,
  wedgeCountForSize,
  type RendaCharacterState,
  type RendaEyes,
} from './rendaCharacterModel';
import {
  ArcEyes,
  BLOOM_SQUARE,
  DotEyes,
  ECHO_DEFS,
  EchoEllipse,
  EyeGlow,
  FaceLayer,
  HaloLayer,
  ORBIT_R,
  OpenEye,
  OrbitCircle,
  RING_SQUARE,
  RingBaseLayer,
  RingBloomCircle,
  RingGradientCircle,
  RingSweepCircle,
  RippleOval,
  Sparkle,
  frameStyle,
  layerStyles,
  openEyeBox,
} from './rendaCharacterLayers';
import { RendaCharacterStatic } from './RendaCharacterStatic';

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
  /** Header avatar: idle is static; attentive/listening read as idle. */
  staticIdle?: boolean;
  /** Pause loops (screen blurred, 20 s settle). Eyes and halo keep their state. */
  paused?: boolean;
  /** Force dark-mode glow; defaults to the app theme. */
  dark?: boolean;
  /** Bump to replay the current state's one-shot (e.g. the attention ripple). */
  replayKey?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const ND = true; // useNativeDriver everywhere in this file
let instanceSeq = 0;

function useAppActive(): boolean {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

function useValue(initial: number): Animated.Value {
  return useRef(new Animated.Value(initial)).current;
}

/** Loop `value` 0→1 over `period`, resuming from its current value. */
function startCycle(value: Animated.Value, period: number): () => void {
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

const OUT_CUBIC = sampleCurve(easeOutCubic, 9);
const SWEEP_ANGLE = sampleCurve((p) => easeInOutCubic(p) * 360 + 20, 13);
const SWEEP_OPACITY = sampleCurve((p) => Math.sin(Math.PI * p) * 0.9, 9);
const SPARKLE_OPACITY = { inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] };

const SUCCESS_VELOCITY = springVelocityForPeak(0.08, SUCCESS_SPRING);
const ATTENTION_VELOCITY = springVelocityForPeak(0.1, ATTENTION_SPRING);

/**
 * Latch: false until `on` is first true, then true for the instance's life.
 * One-shot layers (sparkles, ripples, orbits, sweep) mount on first use only,
 * so an idle launcher / hero does not carry ~14 invisible native SVG views.
 */
function useLatch(on: boolean): boolean {
  const [latched, setLatched] = useState(on);
  if (on && !latched) setLatched(true);
  return latched || on;
}

type AnimatedProps = Omit<RendaCharacterProps, 'animated' | 'dark'> & { dark: boolean };

function RendaCharacterAnimated({
  size,
  state = 'idle',
  eyes,
  staticIdle = false,
  paused = false,
  dark,
  replayKey = 0,
  style,
  testID,
}: AnimatedProps) {
  const reducedMotion = useReducedMotion();
  const appActive = useAppActive();
  const id = useMemo(() => `renda${++instanceSeq}`, []);

  const k = size / VIEWBOX_H;
  const width = characterWidth(size);
  const eyeLevel = eyes ?? eyesForSize(size);
  const effectivePaused = paused || !appActive;
  const cfg = resolveRendaConfig(state, {
    animated: true,
    reducedMotion,
    staticIdle,
    paused: effectivePaused,
  });
  const eyeShape = eyeShapeFor(eyeLevel, cfg);
  const motionCapable = !reducedMotion;

  // ---- animated values -------------------------------------------------
  const breath = useValue(0);
  const pop = useValue(0);
  const spin = useValue(0);
  const orbitClock = useValue(0);
  const orbitOpacity = useValue(0);
  const sweep = useValue(-1);
  const haloFollow = useValue(cfg.halo === 'breath' ? 0 : 1);
  const haloFixed = useValue(cfg.halo === 'max' ? 1 : 0.5);
  const eyeMix = useValue(eyeShape === 'open' ? 1 : 0);
  const blink = useValue(1);
  const eyeX = useValue(cfg.offset[0] * k);
  const eyeY = useValue(cfg.offset[1] * k);
  const sparkles = useRef(SPARKLE_ANGLES.map(() => new Animated.Value(0))).current;
  /** -1 = at rest (hidden); 0→1 = one ripple. */
  const ripples = useRef([new Animated.Value(-1), new Animated.Value(-1)]).current;

  // ---- breath (scale) --------------------------------------------------
  useEffect(() => {
    if (!cfg.loops || cfg.amp <= 0) {
      const settle = Animated.timing(breath, {
        toValue: 0,
        duration: motionCapable ? RENDA_TIMING.settleEase : 0,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: ND,
      });
      settle.start();
      return () => settle.stop();
    }
    const half = cfg.period / 2;
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: half, easing: ease, useNativeDriver: ND }),
        Animated.timing(breath, { toValue: 0, duration: half, easing: ease, useNativeDriver: ND }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath, cfg.loops, cfg.amp, cfg.period, motionCapable]);

  // ---- ring gradient spin (360° / 10 s), never the face or eyes ----------
  useEffect(() => {
    if (!cfg.loops || !cfg.spin) {
      spin.stopAnimation();
      return undefined;
    }
    return startCycle(spin, RENDA_TIMING.spinPeriod);
  }, [spin, cfg.loops, cfg.spin]);

  // ---- thinking orbits + drift echoes ----------------------------------
  const orbitsOn = cfg.loops && cfg.orbits;
  useEffect(() => {
    const fade = Animated.timing(orbitOpacity, {
      toValue: orbitsOn ? 1 : 0,
      duration: motionCapable ? 270 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: ND,
    });
    fade.start();
    if (!orbitsOn) return () => fade.stop();
    const stop = startCycle(orbitClock, RENDA_TIMING.orbitClock);
    return () => {
      fade.stop();
      stop();
    };
  }, [orbitClock, orbitOpacity, orbitsOn, motionCapable]);

  // ---- halo level: follows the breath, or held at max / mid ------------
  useEffect(() => {
    const follow = cfg.halo === 'breath' && cfg.loops ? 0 : 1;
    const fixed = cfg.halo === 'max' ? 1 : 0.5;
    const duration = motionCapable ? RENDA_TIMING.haloMax : 0;
    const anim = Animated.parallel([
      Animated.timing(haloFollow, { toValue: follow, duration, useNativeDriver: ND }),
      Animated.timing(haloFixed, { toValue: fixed, duration, useNativeDriver: ND }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [haloFollow, haloFixed, cfg.halo, cfg.loops, motionCapable]);

  // ---- eyes: shape morph + offset (instant under reduce motion) --------
  const attentionEyes = state === 'attention' && cfg.oneShots;
  useEffect(() => {
    const target = eyeShape === 'open' ? 1 : 0;
    const morph = (to: number) =>
      Animated.timing(eyeMix, {
        toValue: to,
        duration: motionCapable ? RENDA_TIMING.eyeMorph : 0,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: ND,
      });
    const anim = morph(target);
    anim.start();
    // Attention: eyes open during the ripple, then back to arcs.
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (attentionEyes) {
      timer = setTimeout(() => morph(0).start(), RENDA_TIMING.attentionEyesOpen);
    }
    return () => {
      anim.stop();
      if (timer) clearTimeout(timer);
    };
  }, [eyeMix, eyeShape, motionCapable, attentionEyes, replayKey]);

  useEffect(() => {
    const duration = motionCapable ? RENDA_TIMING.eyeOffset : 0;
    const easing = Easing.out(Easing.cubic);
    const anim = Animated.parallel([
      Animated.timing(eyeX, { toValue: cfg.offset[0] * k, duration, easing, useNativeDriver: ND }),
      Animated.timing(eyeY, { toValue: cfg.offset[1] * k, duration, easing, useNativeDriver: ND }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [eyeX, eyeY, cfg.offset, k, motionCapable]);

  // ---- blink every 4–7 s (attentive / listening) -----------------------
  useEffect(() => {
    if (!cfg.blink || eyeShape !== 'open') return undefined;
    let timer: ReturnType<typeof setTimeout>;
    const half = RENDA_TIMING.blink / 2;
    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(blink, { toValue: 0.1, duration: half, easing: Easing.out(Easing.sin), useNativeDriver: ND }),
          Animated.timing(blink, { toValue: 1, duration: half, easing: Easing.in(Easing.sin), useNativeDriver: ND }),
        ]).start();
        schedule(nextBlinkDelay(Math.random()));
      }, delay);
    };
    // First blink comes a little sooner so a short Attentive still reads.
    schedule(1200 + Math.random() * 800);
    return () => {
      clearTimeout(timer);
      blink.setValue(1);
    };
  }, [blink, cfg.blink, eyeShape]);

  // ---- one-shots on state entry ----------------------------------------
  useEffect(() => {
    if (!cfg.oneShots) return undefined;
    const running: Animated.CompositeAnimation[] = [];
    const run = (a: Animated.CompositeAnimation) => {
      running.push(a);
      a.start();
    };
    if (state === 'responding') {
      pop.setValue(0);
      run(
        Animated.sequence([
          Animated.timing(pop, { toValue: 0.06, duration: 135, easing: Easing.out(Easing.back(1.70158)), useNativeDriver: ND }),
          Animated.timing(pop, { toValue: 0, duration: 165, easing: Easing.inOut(Easing.cubic), useNativeDriver: ND }),
        ])
      );
      sweep.setValue(0);
      run(Animated.timing(sweep, { toValue: 1, duration: RENDA_TIMING.respondingSweep, easing: Easing.linear, useNativeDriver: ND }));
    }
    if (state === 'success') {
      pop.setValue(0);
      run(Animated.spring(pop, { toValue: 0, velocity: SUCCESS_VELOCITY, ...SUCCESS_SPRING, useNativeDriver: ND }));
      sparkles.forEach((v) => v.setValue(0));
      run(
        Animated.stagger(
          RENDA_TIMING.sparkleStagger,
          sparkles.map((v) =>
            Animated.timing(v, { toValue: 1, duration: RENDA_TIMING.sparkle, easing: Easing.linear, useNativeDriver: ND })
          )
        )
      );
    }
    if (state === 'attention') {
      pop.setValue(0);
      run(Animated.spring(pop, { toValue: 0, velocity: ATTENTION_VELOCITY, ...ATTENTION_SPRING, useNativeDriver: ND }));
      ripples.forEach((v) => v.setValue(-1));
      run(
        Animated.parallel(
          ripples.map((v, i) =>
            Animated.sequence([
              Animated.delay(i * RENDA_TIMING.rippleGap),
              Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: ND }),
              Animated.timing(v, { toValue: 1, duration: RENDA_TIMING.ripple, easing: Easing.linear, useNativeDriver: ND }),
            ])
          )
        )
      );
    }
    return () => running.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, replayKey, cfg.oneShots]);

  // ---- derived nodes (memoised: new nodes each render would make the native
  // driver detach / re-attach its graph) ------------------------------------
  const amp = cfg.amp;
  const nodes = useMemo(() => {
    const [hMin, hMax] = haloAlphaRange(dark);
    const [bMin, bMax] = bloomAlphaRange(dark);
    const haloLevel = Animated.add(
      Animated.multiply(breath, Animated.subtract(1, haloFollow)),
      Animated.multiply(haloFollow, haloFixed)
    );
    return {
      haloOpacity: haloLevel.interpolate({ inputRange: [0, 1], outputRange: [hMin, hMax] }),
      bloomOpacity: haloLevel.interpolate({ inputRange: [0, 1], outputRange: [bMin, bMax] }),
      spinRotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
      sweepRotate: sweep.interpolate({
        inputRange: SWEEP_ANGLE.inputRange,
        outputRange: SWEEP_ANGLE.outputRange.map((a) => `${a}deg`),
        extrapolate: 'clamp',
      }),
      sweepOpacity: sweep.interpolate({ ...SWEEP_OPACITY, extrapolate: 'clamp' }),
      openOpacity: eyeMix.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 1, 1] }),
      arcOpacity: eyeMix.interpolate({ inputRange: [0, 0.2, 1], outputRange: [1, 1, 0] }),
      arcLift: eyeMix.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5 * k] }),
      openScaleY: Animated.multiply(eyeMix.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }), blink),
      echoOpacity: Animated.multiply(orbitOpacity, dark ? 0.75 : 0.5),
      echoRotate: ECHO_TURNS.map((turns) =>
        orbitClock.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${turns * 360}deg`] })
      ),
      orbitRotate: [
        orbitClock.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${ORBIT_TURNS * 360}deg`] }),
        orbitClock.interpolate({ inputRange: [0, 1], outputRange: ['140deg', `${140 - ORBIT_TURNS * 360}deg`] }),
      ],
    };
  }, [dark, k, breath, haloFollow, haloFixed, spin, sweep, eyeMix, blink, orbitOpacity, orbitClock]);
  const bodyScale = useMemo(
    () =>
      Animated.multiply(
        breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + Math.max(amp, 0.0001)] }),
        pop.interpolate({ inputRange: [0, 1], outputRange: [1, 2] })
      ),
    [breath, pop, amp]
  );
  const rippleNodes = useMemo(
    () =>
      ripples.map((v) => ({
        opacity: v.interpolate({ inputRange: [-1, -0.001, 0, 1], outputRange: [0, 0, 0.35, 0], extrapolate: 'clamp' }),
        scale: v.interpolate({
          inputRange: OUT_CUBIC.inputRange,
          outputRange: OUT_CUBIC.outputRange.map((o) => 1 + 0.5 * o),
          extrapolate: 'clamp',
        }),
      })),
    [ripples]
  );
  const sparkleNodes = useMemo(
    () =>
      SPARKLE_ANGLES.map((angle, i) => {
        const v = sparkles[i];
        const { from, to } = sparklePath(angle);
        const unitsTall = Math.max((4 / size) * 100, 6);
        const px = unitsTall * k * 2.1;
        const along = (delta: number) =>
          v.interpolate({ inputRange: OUT_CUBIC.inputRange, outputRange: OUT_CUBIC.outputRange.map((o) => o * delta * k) });
        return {
          angle,
          px,
          left: from[0] * k - px / 2,
          top: from[1] * k - px / 2,
          opacity: v.interpolate(SPARKLE_OPACITY),
          tx: along(to[0] - from[0]),
          ty: along(to[1] - from[1]),
          scale: v.interpolate({ inputRange: OUT_CUBIC.inputRange, outputRange: OUT_CUBIC.outputRange.map((o) => 0.6 + 0.4 * o) }),
        };
      }),
    [sparkles, size, k]
  );

  // One-shot layers mount on first use (and stay, so fades / tails finish).
  const needRipples = useLatch(motionCapable && state === 'attention');
  const needSparkles = useLatch(motionCapable && state === 'success');
  const needSweep = useLatch(motionCapable && state === 'responding');
  const needOrbits = useLatch(motionCapable && cfg.orbits);

  const segments = wedgeCountForSize(size);
  const q = RING_SQUARE;
  const bq = BLOOM_SQUARE;
  const orbitHalf = ORBIT_R + 3;
  const {
    haloOpacity,
    bloomOpacity,
    spinRotate,
    sweepRotate,
    sweepOpacity,
    openOpacity,
    arcOpacity,
    arcLift,
    openScaleY,
    echoOpacity,
    echoRotate,
    orbitRotate,
  } = nodes;

  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={[{ width, height: size }, styles.root, style]}
    >
      {/* Attention ripples: outside the body, oval, 1.0→1.5, .35→0 */}
      {needRipples
        ? rippleNodes.map((n, i) => (
            <Animated.View
              key={`r${i}`}
              style={[layerStyles.fill, { opacity: n.opacity, transform: [{ scale: n.scale }] }]}
            >
              <RippleOval k={k} dark={dark} />
            </Animated.View>
          ))
        : null}

      <Animated.View style={[layerStyles.fill, { transform: [{ scale: bodyScale }] }]}>
        <Animated.View style={[layerStyles.fill, { opacity: haloOpacity }]}>
          <HaloLayer k={k} dark={dark} id={id} />
        </Animated.View>

        {/* Ring bloom: the gradient's own colours, rotating with it (prototype r.bloom). */}
        <Animated.View style={[frameStyle(k, bq.x, bq.y, bq.size, bq.size), { opacity: bloomOpacity }]}>
          <View style={[styles.square, { transform: [{ scaleX: RING_SQUASH_X }] }]}>
            <Animated.View style={[styles.square, { transform: [{ rotate: spinRotate }] }]}>
              <RingBloomCircle k={k} id={id} segments={bloomSegmentsForSize(size)} />
            </Animated.View>
          </View>
        </Animated.View>

        {needOrbits ? (
          <Animated.View style={[layerStyles.fill, { opacity: echoOpacity }]}>
            {ECHO_DEFS.map((_, i) => (
              <Animated.View key={`e${i}`} style={[layerStyles.fill, { transform: [{ rotate: echoRotate[i] }] }]}>
                <EchoEllipse k={k} index={i} />
              </Animated.View>
            ))}
          </Animated.View>
        ) : null}

        <RingBaseLayer k={k} id={id} />

        {/* Rotating sweep gradient: a circle squashed to the ring's oval. */}
        <View style={[frameStyle(k, q.x, q.y, q.size, q.size), { transform: [{ scaleX: RING_SQUASH_X }] }]}>
          <Animated.View style={[styles.square, { transform: [{ rotate: spinRotate }] }]}>
            <RingGradientCircle k={k} segments={segments} />
          </Animated.View>
          {needSweep ? (
            <Animated.View
              style={[styles.squareAbs, { opacity: sweepOpacity, transform: [{ rotate: sweepRotate }] }]}
            >
              <RingSweepCircle k={k} />
            </Animated.View>
          ) : null}
        </View>

        {needOrbits
          ? [-20, 20].map((tilt, i) => (
              <Animated.View
                key={`o${i}`}
                style={[
                  frameStyle(k, CX - orbitHalf, CY - orbitHalf, orbitHalf * 2, orbitHalf * 2),
                  { opacity: orbitOpacity, transform: [{ rotate: `${tilt}deg` }, { scaleY: 0.44 }] },
                ]}
              >
                <Animated.View style={{ transform: [{ rotate: orbitRotate[i] }] }}>
                  <OrbitCircle k={k} dark={dark} id={`${id}${i}`} />
                </Animated.View>
              </Animated.View>
            ))
          : null}

        <FaceLayer k={k} id={id} />

        {eyeShape !== 'none' ? (
          <Animated.View
            style={[layerStyles.fill, { transform: [{ translateX: eyeX }, { translateY: eyeY }] }]}
          >
            {eyeShape === 'dot' ? (
              <>
                {dark ? <EyeGlow k={k} id={id} /> : null}
                <DotEyes k={k} />
              </>
            ) : (
              <>
                {/* Dark: the disc glow belongs to the open eyes only, so it fades with them. */}
                {dark ? (
                  <Animated.View style={[layerStyles.fill, { opacity: openOpacity }]}>
                    <EyeGlow k={k} id={id} />
                  </Animated.View>
                ) : null}
                <Animated.View
                  style={[layerStyles.fill, { opacity: arcOpacity, transform: [{ translateY: arcLift }] }]}
                >
                  <ArcEyes k={k} glow={dark} />
                </Animated.View>
                {EYE_CENTERS.map(([x, y]) => {
                  const b = openEyeBox(x, y);
                  return (
                    <Animated.View
                      key={x}
                      style={[
                        frameStyle(k, b.x, b.y, b.w, b.h),
                        { opacity: openOpacity, transform: [{ scaleY: openScaleY }] },
                      ]}
                    >
                      <OpenEye k={k} x={x} y={y} />
                    </Animated.View>
                  );
                })}
              </>
            )}
          </Animated.View>
        ) : null}
      </Animated.View>

      {/* Success sparkles: six 4 px diamonds, outward 0→14% of height */}
      {needSparkles
        ? sparkleNodes.map((n, i) => (
            <Animated.View
              key={`s${n.angle}`}
              style={[
                styles.sparkle,
                {
                  left: n.left,
                  top: n.top,
                  width: n.px,
                  height: n.px,
                  opacity: n.opacity,
                  transform: [{ translateX: n.tx }, { translateY: n.ty }, { scale: n.scale }],
                },
              ]}
            >
              <Sparkle px={n.px} color={sparkleColor(i, dark)} />
            </Animated.View>
          ))
        : null}
    </View>
  );
}

/**
 * `animated={false}` (message avatars, header button, badges) renders the
 * single-<Svg> static drawing; everything else gets the animated character.
 */
function RendaCharacterImpl(props: RendaCharacterProps) {
  const theme = useTheme();
  const dark = props.dark ?? theme.isDark;
  if (props.animated === false) {
    return (
      <RendaCharacterStatic
        size={props.size}
        state={props.state}
        eyes={props.eyes}
        dark={dark}
        style={props.style}
        testID={props.testID}
      />
    );
  }
  return <RendaCharacterAnimated {...props} dark={dark} />;
}

export const RendaCharacter = memo(RendaCharacterImpl);
export default RendaCharacter;

const styles = StyleSheet.create({
  root: { overflow: 'visible' },
  square: { width: '100%', height: '100%' },
  squareAbs: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  sparkle: { position: 'absolute' },
});

/** Exposed for tests / docs: the drawing box in viewBox units. */
export const RENDA_VIEWBOX = { width: VIEWBOX_W, height: VIEWBOX_H, cx: CX, cy: CY } as const;
