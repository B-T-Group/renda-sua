/**
 * Renda eye animation: shape morph (pill ↔ happy arc), offset, natural blinks
 * and the Idle eye life cycle (Rest→Wake→Glance→Blink→Drowse at size ≥36;
 * blink-only at 20–35). In Idle the eyes stay pills and `eyeMix` is their
 * openness (Rest ≈ 80% tall, Wake fully open). Native driver throughout.
 */
import { useEffect, useMemo } from 'react';
import { Animated, Easing } from 'react-native';
import {
  RENDA_TIMING,
  nextBlinkDelay,
  type RendaCharacterState,
  type RendaEyeShape,
  type ResolvedRendaConfig,
} from './rendaCharacterModel';
import {
  GLANCE_OFFSETS,
  IDLE_EYE_TIMING,
  advanceDotBlink,
  advanceIdleEyeLife,
  poseForPhase,
  startDotBlink,
  startIdleEyeLife,
  type GlanceDir,
  type IdleEyeMode,
  type IdleEyePhase,
  type IdleEyePose,
} from './rendaIdleEyeLife';
import { useValue } from './useRendaMotion';

const ND = true;

export type IdleEyeForce = { phase: IdleEyePhase; glance?: GlanceDir; blinkProgress?: number };

type EyeParams = {
  state: RendaCharacterState;
  cfg: ResolvedRendaConfig;
  eyeShape: RendaEyeShape;
  lifeMode: IdleEyeMode;
  k: number;
  motionCapable: boolean;
  replayKey: number;
  idleEyeForce?: IdleEyeForce;
};

export function useRendaEyes({ state, cfg, eyeShape, lifeMode, k, motionCapable, replayKey, idleEyeForce }: EyeParams) {
  const eyeMix = useValue(eyeShape === 'open' ? 1 : 0);
  const blink = useValue(1);
  const eyeX = useValue(cfg.offset[0] * k);
  const eyeY = useValue(cfg.offset[1] * k);
  const lifeActive = lifeMode !== 'off';
  /** Idle without the life cycle (header, paused): eyes ease back to Rest. */
  const idleSettles = state === 'idle' && lifeMode === 'off' && motionCapable;
  // Attention: eyes open during the ripple, then back to arcs.
  const attentionEyes = state === 'attention' && cfg.oneShots;

  useEffect(() => {
    if (lifeActive || idleEyeForce || idleSettles) return undefined;
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
  }, [eyeMix, eyeShape, motionCapable, attentionEyes, replayKey, lifeActive, idleEyeForce, idleSettles]);

  useEffect(() => {
    if (lifeActive || idleEyeForce) return undefined;
    const duration = motionCapable ? RENDA_TIMING.eyeOffset : 0;
    const easing = Easing.out(Easing.cubic);
    const anim = Animated.parallel([
      Animated.timing(eyeX, { toValue: cfg.offset[0] * k, duration, easing, useNativeDriver: ND }),
      Animated.timing(eyeY, { toValue: cfg.offset[1] * k, duration, easing, useNativeDriver: ND }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [eyeX, eyeY, cfg.offset, k, motionCapable, lifeActive, idleEyeForce]);

  // ---- blink every 4–7 s (attentive / listening) -----------------------
  useEffect(() => {
    if (lifeActive || idleEyeForce) return undefined;
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
  }, [blink, cfg.blink, eyeShape, lifeActive, idleEyeForce]);

  // ---- Idle eye life cycle (hero + launcher; header staticIdle = off) ----
  useEffect(() => {
    if (idleEyeForce) {
      const pose = poseForPhase(idleEyeForce.phase, idleEyeForce);
      eyeMix.setValue(pose.eyeMix);
      eyeX.setValue(pose.offset[0] * k);
      eyeY.setValue(pose.offset[1] * k);
      blink.setValue(pose.blink);
      return undefined;
    }
    // Full expressive life cycle only (dots use the blink-only effect below).
    if (lifeMode !== 'full') {
      if (idleSettles) {
        const dur = motionCapable ? RENDA_TIMING.settleEase : 0;
        Animated.parallel([
          Animated.timing(eyeMix, { toValue: 0, duration: dur, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
          Animated.timing(eyeX, { toValue: 0, duration: dur, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
          Animated.timing(eyeY, { toValue: 0, duration: dur, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
          Animated.timing(blink, { toValue: 1, duration: dur, useNativeDriver: ND }),
        ]).start();
      }
      return undefined;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running: Animated.CompositeAnimation | null = null;
    const easeOut = Easing.out(Easing.cubic);
    const easeIn = Easing.in(Easing.cubic);

    const snap = (pose: IdleEyePose) => {
      eyeMix.setValue(pose.eyeMix);
      eyeX.setValue(pose.offset[0] * k);
      eyeY.setValue(pose.offset[1] * k);
      blink.setValue(pose.blink);
    };

    const endTarget = (life: ReturnType<typeof startIdleEyeLife>): IdleEyePose => {
      if (life.phase === 'wake') return { phase: 'wake', eyeMix: 1, offset: [0, 0], blink: 1 };
      if (life.phase === 'drowse') return { phase: 'drowse', eyeMix: 0, offset: [0, 0], blink: 1 };
      if (life.phase === 'rest') return { phase: 'rest', eyeMix: 0, offset: [0, 0], blink: 1 };
      if (life.phase === 'blink') return { phase: 'blink', eyeMix: 1, offset: [0, 0], blink: 1 };
      const off = life.glanceDir ? GLANCE_OFFSETS[life.glanceDir] : ([0, 0] as const);
      if (life.leg === 2) return { phase: 'glance', eyeMix: 1, offset: [0, 0], blink: 1 };
      return { phase: 'glance', eyeMix: 1, offset: off, blink: 1 };
    };

    const driveLeg = (life: ReturnType<typeof startIdleEyeLife>) => {
      running?.stop();
      const dur = Math.max(0, life.legEndsAt - life.legStartedAt);
      const end = endTarget(life);
      if (life.phase === 'blink' && life.leg === 0) {
        const half = IDLE_EYE_TIMING.blink / 2;
        blink.setValue(1);
        running = Animated.sequence([
          Animated.timing(blink, { toValue: 0.1, duration: half, easing: Easing.out(Easing.sin), useNativeDriver: ND }),
          Animated.timing(blink, { toValue: 1, duration: half, easing: Easing.in(Easing.sin), useNativeDriver: ND }),
        ]);
        running.start();
        return;
      }
      if (life.phase === 'wake' && life.leg === 0) {
        eyeMix.setValue(0);
        running = Animated.timing(eyeMix, { toValue: 1, duration: dur, easing: easeOut, useNativeDriver: ND });
        running.start();
        return;
      }
      if (life.phase === 'drowse') {
        eyeMix.setValue(1);
        running = Animated.timing(eyeMix, { toValue: 0, duration: dur, easing: easeIn, useNativeDriver: ND });
        running.start();
        return;
      }
      if (life.phase === 'glance' && (life.leg === 0 || life.leg === 2)) {
        running = Animated.parallel([
          Animated.timing(eyeX, { toValue: end.offset[0] * k, duration: dur, easing: easeOut, useNativeDriver: ND }),
          Animated.timing(eyeY, { toValue: end.offset[1] * k, duration: dur, easing: easeOut, useNativeDriver: ND }),
        ]);
        running.start();
        return;
      }
      snap(end);
    };

    // Restart from Rest every time Idle becomes active again.
    let life = startIdleEyeLife(Date.now());
    snap(life.pose);

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        const { state: next, startedLeg } = advanceIdleEyeLife(life, Math.max(Date.now(), life.legEndsAt));
        life = next;
        if (startedLeg) driveLeg(life);
        schedule();
      }, Math.max(0, life.legEndsAt - Date.now()));
    };
    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      running?.stop();
    };
  }, [lifeMode, idleEyeForce, idleSettles, k, eyeMix, eyeX, eyeY, blink, motionCapable]);

  // ---- Dot-eye blink-only life cycle (sizes 20–35 on hero/launcher) ------
  useEffect(() => {
    if (lifeMode !== 'blinkOnly' || idleEyeForce) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running: Animated.CompositeAnimation | null = null;
    let dot = startDotBlink(Date.now());
    blink.setValue(1);

    const schedule = () => {
      if (cancelled) return;
      const delay = Math.max(16, dot.nextBlinkAt - Date.now());
      timer = setTimeout(() => {
        if (cancelled) return;
        const now = Date.now();
        const { state: next } = advanceDotBlink(dot, now);
        dot = next;
        if (dot.blinking) {
          const half = IDLE_EYE_TIMING.blink / 2;
          running?.stop();
          running = Animated.sequence([
            Animated.timing(blink, { toValue: 0.1, duration: half, easing: Easing.out(Easing.sin), useNativeDriver: ND }),
            Animated.timing(blink, { toValue: 1, duration: half, easing: Easing.in(Easing.sin), useNativeDriver: ND }),
          ]);
          if (dot.pendingDouble) {
            // First blink; second is scheduled after gap by advanceDotBlink's timeline.
            // Drive first only; poll for the second.
            running.start(({ finished }) => {
              if (!finished || cancelled) return;
              timer = setTimeout(() => {
                if (cancelled) return;
                const half2 = IDLE_EYE_TIMING.blink / 2;
                running = Animated.sequence([
                  Animated.timing(blink, { toValue: 0.1, duration: half2, easing: Easing.out(Easing.sin), useNativeDriver: ND }),
                  Animated.timing(blink, { toValue: 1, duration: half2, easing: Easing.in(Easing.sin), useNativeDriver: ND }),
                ]);
                running.start();
              }, IDLE_EYE_TIMING.doubleBlinkGap);
            });
          } else {
            running.start();
          }
          // Advance past the blink so nextBlinkAt is set.
          const end = now + IDLE_EYE_TIMING.blink + (dot.pendingDouble ? IDLE_EYE_TIMING.doubleBlinkGap + IDLE_EYE_TIMING.blink : 0);
          const advanced = advanceDotBlink(dot, end);
          dot = advanced.state;
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      running?.stop();
      blink.setValue(1);
    };
  }, [lifeMode, idleEyeForce, blink]);

  return useMemo(() => ({ eyeMix, eyeX, eyeY, blink }), [eyeMix, eyeX, eyeY, blink]);
}
