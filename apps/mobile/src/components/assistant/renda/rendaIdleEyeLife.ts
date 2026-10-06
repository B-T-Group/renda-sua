/**
 * Idle eye life cycle (#451 UX spec §1, Samuel 2026-10-06): Rest → Wake →
 * (optional Glance) → Blink → Drowse → Rest. Pure (no React / RN) so vitest
 * covers phases, caps, offsets and mode gating. Drivers (Animated / rAF) only
 * paint what this module decides.
 *
 * Placement: launcher + empty-state hero only. Header stays static at Idle.
 * Dot eyes (20–35): blink only. Reduce-motion / paused / staticIdle: off.
 */
export type IdleEyePhase = 'rest' | 'wake' | 'glance' | 'blink' | 'drowse';

export type GlanceDir = 'left' | 'right' | 'up' | 'upLeft' | 'upRight';

/** Spec glance offsets in 82×100 viewBox units (both eyes move together). */
export const GLANCE_OFFSETS: Record<GlanceDir, readonly [number, number]> = {
  left: [-3, 0],
  right: [3, 0],
  up: [0, -2],
  upLeft: [-2, -2],
  upRight: [2, -2],
};

export const GLANCE_DIRS = Object.keys(GLANCE_OFFSETS) as GlanceDir[];

export const IDLE_EYE_TIMING = {
  restMin: 2500,
  restMax: 5000,
  wakeMorph: 150,
  wakeHoldMin: 800,
  wakeHoldMax: 1800,
  glanceEase: 200,
  glanceHoldMin: 600,
  glanceHoldMax: 1400,
  glanceReturn: 200,
  blink: 160,
  doubleBlinkGap: 120,
  drowseMorph: 180,
  /** ≤ 1 glance every 3 s. */
  glanceCap: 3000,
  /** ≤ 1 blink every 2.5 s. */
  blinkCap: 2500,
  /** While open, also blink every 4–7 s. */
  openBlinkMin: 4000,
  openBlinkMax: 7000,
  /** Don't stay open longer than ~4 s total. */
  maxOpenMs: 4000,
  wakeChance: 0.55,
  blinkChance: 0.15,
  glanceChance: 0.3,
  glanceAgainChance: 0.3,
  doubleBlinkChance: 0.15,
} as const;

export type IdleEyeMode = 'full' | 'blinkOnly' | 'off';

export type IdleEyeLifeOptions = {
  /** Size-derived eye level. */
  eyes: 'expressive' | 'dot' | 'none';
  /** Header avatar: idle is static — no life cycle. */
  staticIdle?: boolean;
  reducedMotion?: boolean;
  /** Battery / settle / blur pause. */
  paused?: boolean;
  /**
   * false on surfaces that must not run the life cycle (message avatars).
   * Hero and launcher pass true (the default when omitted is true for callers
   * that already gated placement).
   */
  enabled?: boolean;
};

/** Where the life cycle may run (spec: launcher + empty-state hero only). */
export function idleEyeMode(opts: IdleEyeLifeOptions): IdleEyeMode {
  if (opts.enabled === false) return 'off';
  if (opts.staticIdle || opts.reducedMotion || opts.paused) return 'off';
  if (opts.eyes === 'none') return 'off';
  if (opts.eyes === 'dot') return 'blinkOnly';
  return 'full';
}

export type IdleEyePose = {
  phase: IdleEyePhase;
  /** 0 = happy arcs, 1 = open. */
  eyeMix: number;
  /** ViewBox units. */
  offset: readonly [number, number];
  /** scaleY multiplier for open / dot eyes (1 = open, 0.1 = closed). */
  blink: number;
};

export type IdleEyeLifeState = {
  phase: IdleEyePhase;
  /** Sub-step for multi-leg phases. */
  leg: number;
  /** When the current leg started (absolute ms). */
  legStartedAt: number;
  /** When the current leg ends (absolute ms). */
  legEndsAt: number;
  /** When eyes first reached open this cycle (Wake start); 0 if closed. */
  openSince: number;
  lastGlanceAt: number;
  lastBlinkAt: number;
  glanceDir: GlanceDir | null;
  /** Second blink queued after a double-blink. */
  pendingDoubleBlink: boolean;
  pose: IdleEyePose;
};

const CENTRE: readonly [number, number] = [0, 0];

function clamp01(r: number): number {
  if (Number.isNaN(r)) return 0;
  return Math.min(1, Math.max(0, r));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function uniform(min: number, max: number, rand: number): number {
  return min + clamp01(rand) * (max - min);
}

function pickGlanceDir(rand: number): GlanceDir {
  const i = Math.min(GLANCE_DIRS.length - 1, Math.floor(clamp01(rand) * GLANCE_DIRS.length));
  return GLANCE_DIRS[i];
}

function restPose(): IdleEyePose {
  return { phase: 'rest', eyeMix: 0, offset: CENTRE, blink: 1 };
}

function openPose(phase: IdleEyePhase, offset: readonly [number, number] = CENTRE): IdleEyePose {
  return { phase, eyeMix: 1, offset, blink: 1 };
}

/** Start of the life cycle: Rest for a fresh Idle entry. */
export function startIdleEyeLife(now: number, rand: number = 0.5): IdleEyeLifeState {
  const hold = uniform(IDLE_EYE_TIMING.restMin, IDLE_EYE_TIMING.restMax, rand);
  return {
    phase: 'rest',
    leg: 0,
    legStartedAt: now,
    legEndsAt: now + hold,
    openSince: 0,
    lastGlanceAt: -Infinity,
    lastBlinkAt: -Infinity,
    glanceDir: null,
    pendingDoubleBlink: false,
    pose: restPose(),
  };
}

/**
 * Snapshot pose for a forced phase (review harness / screenshots). Morph and
 * blink legs are frozen at a readable mid-point.
 */
export function poseForPhase(
  phase: IdleEyePhase,
  opts: { glance?: GlanceDir; blinkProgress?: number } = {}
): IdleEyePose {
  switch (phase) {
    case 'rest':
      return restPose();
    case 'wake':
      return openPose('wake');
    case 'glance': {
      const dir = opts.glance ?? 'right';
      return openPose('glance', GLANCE_OFFSETS[dir]);
    }
    case 'blink': {
      const p = opts.blinkProgress ?? 0.5;
      const blink = 1 - 0.9 * Math.sin(Math.PI * clamp01(p));
      return { phase: 'blink', eyeMix: 1, offset: CENTRE, blink };
    }
    case 'drowse':
      return { phase: 'drowse', eyeMix: 0.35, offset: CENTRE, blink: 1 };
    default:
      return restPose();
  }
}

export type IdleEyeAdvanceResult = {
  state: IdleEyeLifeState;
  /** True when a new leg just began (drivers may restart a timing animation). */
  startedLeg: boolean;
};

function canGlance(s: IdleEyeLifeState, now: number): boolean {
  return now - s.lastGlanceAt >= IDLE_EYE_TIMING.glanceCap;
}

function canBlink(s: IdleEyeLifeState, now: number): boolean {
  return now - s.lastBlinkAt >= IDLE_EYE_TIMING.blinkCap;
}

function openTooLong(s: IdleEyeLifeState, now: number): boolean {
  return s.openSince > 0 && now - s.openSince >= IDLE_EYE_TIMING.maxOpenMs;
}

/** After Rest: Wake 55%, Blink-via-Wake 15% (open then blink), else Rest again. */
function pickAfterRest(rand: number): 'wake' | 'wakeBlink' | 'rest' {
  const r = clamp01(rand);
  if (r < IDLE_EYE_TIMING.wakeChance) return 'wake';
  if (r < IDLE_EYE_TIMING.wakeChance + IDLE_EYE_TIMING.blinkChance) return 'wakeBlink';
  return 'rest';
}

/**
 * While open (after Wake hold or Glance return): Glance 30% if capped,
 * else Blink 15% if capped, else Drowse. Forced Drowse if open too long.
 */
function pickWhileOpen(
  s: IdleEyeLifeState,
  now: number,
  rand: number,
  rand2: number
): 'glance' | 'blink' | 'drowse' {
  if (openTooLong(s, now)) return 'drowse';
  const r = clamp01(rand);
  if (r < IDLE_EYE_TIMING.glanceChance && canGlance(s, now)) return 'glance';
  if (r < IDLE_EYE_TIMING.glanceChance + IDLE_EYE_TIMING.blinkChance && canBlink(s, now)) {
    return 'blink';
  }
  // Spec also blinks every 4–7 s while open — treat as a soft nudge into Blink
  // when the open window is already past the min interval and the roll allows.
  if (canBlink(s, now) && s.openSince > 0) {
    const openFor = now - s.openSince;
    const due = IDLE_EYE_TIMING.openBlinkMin + clamp01(rand2) * (IDLE_EYE_TIMING.openBlinkMax - IDLE_EYE_TIMING.openBlinkMin);
    if (openFor >= due) return 'blink';
  }
  return 'drowse';
}

function beginRest(s: IdleEyeLifeState, now: number, rand: number): IdleEyeLifeState {
  return {
    ...s,
    phase: 'rest',
    leg: 0,
    legStartedAt: now,
    legEndsAt: now + uniform(IDLE_EYE_TIMING.restMin, IDLE_EYE_TIMING.restMax, rand),
    openSince: 0,
    glanceDir: null,
    pendingDoubleBlink: false,
    pose: restPose(),
  };
}

function beginWake(s: IdleEyeLifeState, now: number, thenBlink: boolean): IdleEyeLifeState {
  return {
    ...s,
    phase: 'wake',
    leg: 0,
    legStartedAt: now,
    legEndsAt: now + IDLE_EYE_TIMING.wakeMorph,
    openSince: now,
    pendingDoubleBlink: thenBlink,
    glanceDir: null,
    pose: { phase: 'wake', eyeMix: 0, offset: CENTRE, blink: 1 },
  };
}

function beginGlance(s: IdleEyeLifeState, now: number, rand: number): IdleEyeLifeState {
  const dir = pickGlanceDir(rand);
  return {
    ...s,
    phase: 'glance',
    leg: 0,
    legStartedAt: now,
    legEndsAt: now + IDLE_EYE_TIMING.glanceEase,
    lastGlanceAt: now,
    glanceDir: dir,
    pose: openPose('glance', CENTRE),
  };
}

function beginBlink(s: IdleEyeLifeState, now: number, rand: number): IdleEyeLifeState {
  const dbl = clamp01(rand) < IDLE_EYE_TIMING.doubleBlinkChance;
  return {
    ...s,
    phase: 'blink',
    leg: 0,
    legStartedAt: now,
    legEndsAt: now + IDLE_EYE_TIMING.blink,
    lastBlinkAt: now,
    pendingDoubleBlink: dbl,
    pose: { phase: 'blink', eyeMix: 1, offset: s.pose.offset, blink: 1 },
  };
}

function beginDrowse(s: IdleEyeLifeState, now: number): IdleEyeLifeState {
  return {
    ...s,
    phase: 'drowse',
    leg: 0,
    legStartedAt: now,
    legEndsAt: now + IDLE_EYE_TIMING.drowseMorph,
    glanceDir: null,
    pendingDoubleBlink: false,
    pose: { phase: 'drowse', eyeMix: 1, offset: CENTRE, blink: 1 },
  };
}

/**
 * Advance the life cycle. Call on a timer or each frame with the current time.
 * `rand` / `rand2` / `rand3` are independent [0,1) samples for the next decision
 * (injectable for tests). Returns a new state; morph progress within a leg is
 * linear in time so drivers can ease separately if they prefer.
 */
export function advanceIdleEyeLife(
  state: IdleEyeLifeState,
  now: number,
  rand: number = Math.random(),
  rand2: number = Math.random(),
  rand3: number = Math.random()
): IdleEyeAdvanceResult {
  let s = state;
  let startedLeg = false;

  // Interpolate pose within the current leg before checking for transitions.
  s = { ...s, pose: poseDuringLeg(s, now) };

  if (now < s.legEndsAt) return { state: s, startedLeg: false };

  // Leg finished → next leg or next phase.
  switch (s.phase) {
    case 'rest': {
      const pick = pickAfterRest(rand);
      startedLeg = true;
      if (pick === 'rest') s = beginRest(s, now, rand2);
      else s = beginWake(s, now, pick === 'wakeBlink');
      break;
    }
    case 'wake': {
      if (s.leg === 0) {
        // Morph done → hold open.
        startedLeg = true;
        const hold = uniform(IDLE_EYE_TIMING.wakeHoldMin, IDLE_EYE_TIMING.wakeHoldMax, rand);
        s = {
          ...s,
          leg: 1,
          legStartedAt: now,
          legEndsAt: now + hold,
          pose: openPose('wake'),
        };
        break;
      }
      // Hold done.
      startedLeg = true;
      if (s.pendingDoubleBlink && canBlink(s, now)) {
        s = beginBlink({ ...s, pendingDoubleBlink: false }, now, rand);
      } else {
        const next = pickWhileOpen(s, now, rand, rand2);
        if (next === 'glance') s = beginGlance(s, now, rand3);
        else if (next === 'blink') s = beginBlink(s, now, rand3);
        else s = beginDrowse(s, now);
      }
      break;
    }
    case 'glance': {
      const dir = s.glanceDir ?? 'right';
      const off = GLANCE_OFFSETS[dir];
      if (s.leg === 0) {
        // Ease-out done → hold.
        startedLeg = true;
        const hold = uniform(IDLE_EYE_TIMING.glanceHoldMin, IDLE_EYE_TIMING.glanceHoldMax, rand);
        s = {
          ...s,
          leg: 1,
          legStartedAt: now,
          legEndsAt: now + hold,
          pose: openPose('glance', off),
        };
        break;
      }
      if (s.leg === 1) {
        // Hold done → return to centre.
        startedLeg = true;
        s = {
          ...s,
          leg: 2,
          legStartedAt: now,
          legEndsAt: now + IDLE_EYE_TIMING.glanceReturn,
          pose: openPose('glance', off),
        };
        break;
      }
      // Return done.
      startedLeg = true;
      if (clamp01(rand) < IDLE_EYE_TIMING.glanceAgainChance && canGlance(s, now) && !openTooLong(s, now)) {
        s = beginGlance(s, now, rand2);
      } else {
        const next = pickWhileOpen(s, now, rand2, rand3);
        if (next === 'glance') s = beginGlance(s, now, rand3);
        else if (next === 'blink') s = beginBlink(s, now, rand3);
        else s = beginDrowse(s, now);
      }
      break;
    }
    case 'blink': {
      if (s.pendingDoubleBlink) {
        startedLeg = true;
        s = {
          ...s,
          leg: 10, // gap before the second blink
          legStartedAt: now,
          legEndsAt: now + IDLE_EYE_TIMING.doubleBlinkGap,
          pendingDoubleBlink: false,
          pose: { phase: 'blink', eyeMix: 1, offset: CENTRE, blink: 1 },
        };
        break;
      }
      if (s.leg === 10) {
        startedLeg = true;
        s = {
          ...s,
          leg: 0,
          legStartedAt: now,
          legEndsAt: now + IDLE_EYE_TIMING.blink,
          lastBlinkAt: now,
          pose: { phase: 'blink', eyeMix: 1, offset: CENTRE, blink: 1 },
        };
        break;
      }
      startedLeg = true;
      if (openTooLong(s, now)) s = beginDrowse(s, now);
      else {
        const next = pickWhileOpen(s, now, rand, rand2);
        if (next === 'glance') s = beginGlance(s, now, rand3);
        else if (next === 'blink') s = beginBlink(s, now, rand3);
        else s = beginDrowse(s, now);
      }
      break;
    }
    case 'drowse': {
      startedLeg = true;
      s = beginRest(s, now, rand);
      break;
    }
    default:
      startedLeg = true;
      s = beginRest(s, now, rand);
  }

  return { state: s, startedLeg };
}

/** Linear pose within the current leg (drivers may re-ease). */
function poseDuringLeg(s: IdleEyeLifeState, now: number): IdleEyePose {
  const start = s.legStartedAt;
  const dur = Math.max(1, s.legEndsAt - start);
  const u = clamp01((now - start) / dur);

  switch (s.phase) {
    case 'rest':
      return restPose();
    case 'wake':
      if (s.leg === 0) return { phase: 'wake', eyeMix: u, offset: CENTRE, blink: 1 };
      return openPose('wake');
    case 'glance': {
      const dir = s.glanceDir ?? 'right';
      const off = GLANCE_OFFSETS[dir];
      if (s.leg === 0) {
        return {
          phase: 'glance',
          eyeMix: 1,
          offset: [lerp(0, off[0], u), lerp(0, off[1], u)],
          blink: 1,
        };
      }
      if (s.leg === 1) return openPose('glance', off);
      return {
        phase: 'glance',
        eyeMix: 1,
        offset: [lerp(off[0], 0, u), lerp(off[1], 0, u)],
        blink: 1,
      };
    }
    case 'blink': {
      if (s.leg === 10) return { phase: 'blink', eyeMix: 1, offset: s.pose.offset, blink: 1 };
      const blink = 1 - 0.9 * Math.sin(Math.PI * u);
      return { phase: 'blink', eyeMix: 1, offset: s.pose.offset, blink };
    }
    case 'drowse':
      return { phase: 'drowse', eyeMix: 1 - u, offset: CENTRE, blink: 1 };
    default:
      return s.pose;
  }
}


/**
 * Blink-only scheduler for dot eyes: happy rest is a no-op (dots stay dots);
 * fires a blink every 4–7 s subject to the 2.5 s cap. No glance / morph.
 */
export type DotBlinkState = {
  nextBlinkAt: number;
  blinkStartedAt: number;
  blinking: boolean;
  pendingDouble: boolean;
};

export function startDotBlink(now: number, rand: number = 0.5): DotBlinkState {
  return {
    nextBlinkAt: now + uniform(IDLE_EYE_TIMING.openBlinkMin, IDLE_EYE_TIMING.openBlinkMax, rand),
    blinkStartedAt: -Infinity,
    blinking: false,
    pendingDouble: false,
  };
}

export function advanceDotBlink(
  state: DotBlinkState,
  now: number,
  rand: number = Math.random(),
  rand2: number = Math.random()
): { state: DotBlinkState; blink: number } {
  let s = state;
  if (s.blinking) {
    const elapsed = now - s.blinkStartedAt;
    if (elapsed >= IDLE_EYE_TIMING.blink) {
      if (s.pendingDouble) {
        // Gap then second blink.
        if (elapsed < IDLE_EYE_TIMING.blink + IDLE_EYE_TIMING.doubleBlinkGap) {
          return { state: s, blink: 1 };
        }
        if (elapsed < IDLE_EYE_TIMING.blink + IDLE_EYE_TIMING.doubleBlinkGap + IDLE_EYE_TIMING.blink) {
          const u = (elapsed - IDLE_EYE_TIMING.blink - IDLE_EYE_TIMING.doubleBlinkGap) / IDLE_EYE_TIMING.blink;
          return { state: s, blink: 1 - 0.9 * Math.sin(Math.PI * clamp01(u)) };
        }
        s = {
          ...s,
          blinking: false,
          pendingDouble: false,
          nextBlinkAt: now + uniform(IDLE_EYE_TIMING.openBlinkMin, IDLE_EYE_TIMING.openBlinkMax, rand),
        };
        return { state: s, blink: 1 };
      }
      s = {
        ...s,
        blinking: false,
        nextBlinkAt: now + uniform(IDLE_EYE_TIMING.openBlinkMin, IDLE_EYE_TIMING.openBlinkMax, rand),
      };
      return { state: s, blink: 1 };
    }
    const u = elapsed / IDLE_EYE_TIMING.blink;
    return { state: s, blink: 1 - 0.9 * Math.sin(Math.PI * clamp01(u)) };
  }
  if (now >= s.nextBlinkAt) {
    s = {
      blinking: true,
      blinkStartedAt: now,
      pendingDouble: clamp01(rand2) < IDLE_EYE_TIMING.doubleBlinkChance,
      nextBlinkAt: now + IDLE_EYE_TIMING.blinkCap, // floored by cap on next schedule
    };
    return { state: s, blink: 1 };
  }
  return { state: s, blink: 1 };
}

/** Easing helpers matching the spec (ease-out wake, ease-in drowse). */
export const idleEyeEaseOutCubic = (p: number) => 1 - Math.pow(1 - clamp01(p), 3);
export const idleEyeEaseInCubic = (p: number) => Math.pow(clamp01(p), 3);
