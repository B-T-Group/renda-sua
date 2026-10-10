/**
 * Renda character engine (viewBox 0 0 82 100): a solid-colour jelly blob with pill eyes.
 *
 * One clock per character drives every motion. Continuous parameters (tempo, wobble,
 * sway, tint…) ease toward per-state targets, one-shots (pulse) are damped springs,
 * and the procedural motion comes from incommensurate sines on accumulated clocks,
 * so speed changes never jump and the loop never visibly repeats. Only attributes
 * whose value changed are written, straight to the SVG nodes: React never re-renders
 * per frame and a settled character costs no DOM writes. Fills are solid colours
 * (no gradients, filters or clip paths), which keeps rasterisation cheap.
 */
import {
  BLOB_BASE_Y,
  CX,
  EYE_Y,
  RENDA_COLORS,
  RENDA_REST_PATH,
  SHAPE_N,
  THINK_DOTS,
  TICK_PIVOT,
  mixHex,
  rendaShapePath,
  shapeAngle,
  shapeY,
} from './rendaCharacterTokens';
import type { RendaEyes } from './rendaCharacterTokens';
import {
  advanceDotBlink,
  advanceIdleEyeLife,
  idleEyeMode,
  poseForPhase,
  startDotBlink,
  startIdleEyeLife,
  type DotBlinkState,
  type GlanceDir,
  type IdleEyeLifeState,
  type IdleEyePhase,
  type IdleEyePose,
} from './rendaIdleEyeLife';

export {
  BLOB,
  CX,
  CY,
  EYE_DOT,
  EYE_PILL,
  EYE_X,
  EYE_Y,
  ARC_STROKE,
  RENDA_COLORS,
  RENDA_REST_PATH,
  RENDA_WIDTH_RATIO,
  THINK_DOTS,
  TICKS,
  eyeArcPath,
  eyesForSize,
} from './rendaCharacterTokens';
export type { RendaEyes } from './rendaCharacterTokens';
export {
  GLANCE_OFFSETS,
  IDLE_EYE_TIMING,
  idleEyeMode,
  poseForPhase,
  startIdleEyeLife,
  advanceIdleEyeLife,
} from './rendaIdleEyeLife';
export type { IdleEyePhase, GlanceDir, IdleEyePose } from './rendaIdleEyeLife';

export type RendaState =
  | 'idle'
  | 'attentive'
  | 'listening'
  | 'thinking'
  | 'responding'
  | 'success'
  | 'attention';

/** Where the character is used (spec "Where" column). */
export type RendaSurface = 'hero' | 'header' | 'launcher' | 'avatar';

/** Eye shape actually drawn for a state (exposed for tests and a11y-neutral styling hooks). */
export type RendaEyeShape = 'arc' | 'open' | 'dot' | 'none';

type ParamKey =
  | 'amp'
  | 'flow'
  | 'deform'
  | 'wave'
  | 'float'
  | 'sway'
  | 'tint'
  | 'dots'
  | 'ticks'
  | 'scan'
  | 'look'
  | 'wander'
  | 'hold';

export interface StateConfig extends Record<ParamKey, number> {
  eyes: 'arc' | 'open' | 'dot';
  /** Eye offset (viewBox units). */
  off: [number, number];
  /** Squash/stretch period (ms); `amp` is its amplitude. */
  period: number;
  /** Eye scale [x, y]; y below x reads as focused. */
  eyeScale: [number, number];
  blink?: boolean;
}

/**
 * Per-state profiles. `flow` = tempo of the bob / wobble clocks, `deform` / `wave` =
 * jelly outline, `float` = bob (units), `sway` = tilt (deg), `tint` = blue → violet,
 * `dots` / `ticks` = accents, `scan` = thinking eye sweep, `look` = pointer tracking,
 * `wander` = micro-saccades, `hold` = eyes stay pills (idle life cycle sets openness).
 */
export const RENDA_STATES: Record<RendaState, StateConfig> = {
  idle: {
    eyes: 'open', off: [0, 0], eyeScale: [1, 1], period: 2600,
    amp: 0.035, flow: 1, deform: 0.9, wave: 0, float: 2, sway: 2.5,
    tint: 0, dots: 0, ticks: 0, scan: 0, look: 1, wander: 0.45, hold: 1,
  },
  attentive: {
    eyes: 'open', off: [0, 0], eyeScale: [1.06, 1.06], period: 2200,
    amp: 0.03, flow: 1.15, deform: 0.9, wave: 0.2, float: 1.6, sway: 1.6,
    tint: 0, dots: 0, ticks: 0.6, scan: 0, look: 0.8, wander: 0, hold: 0, blink: true,
  },
  listening: {
    eyes: 'open', off: [0, 2], eyeScale: [1.1, 1.1], period: 1800,
    amp: 0.04, flow: 1.25, deform: 1, wave: 0.8, float: 1.4, sway: 1.4,
    tint: 0, dots: 0, ticks: 1, scan: 0, look: 0.5, wander: 0, hold: 0, blink: true,
  },
  thinking: {
    eyes: 'open', off: [2, -2], eyeScale: [1, 0.86], period: 1500,
    amp: 0.045, flow: 1.6, deform: 1.4, wave: 0.3, float: 1.6, sway: 4.5,
    tint: 1, dots: 1, ticks: 0, scan: 1, look: 0.15, wander: 0.5, hold: 0,
  },
  responding: {
    eyes: 'arc', off: [0, 0], eyeScale: [1.06, 1.06], period: 1000,
    amp: 0.05, flow: 1.8, deform: 1.1, wave: 0.5, float: 1.4, sway: 2,
    tint: 0, dots: 0, ticks: 1, scan: 0, look: 0.6, wander: 0, hold: 0,
  },
  success: {
    eyes: 'arc', off: [0, 0], eyeScale: [1.12, 1.12], period: 2400,
    amp: 0.03, flow: 1.3, deform: 0.9, wave: 0.2, float: 2, sway: 2,
    tint: 0, dots: 0, ticks: 0, scan: 0, look: 0.5, wander: 0, hold: 0,
  },
  attention: {
    eyes: 'open', off: [0, 0], eyeScale: [1.08, 1.08], period: 2200,
    amp: 0.03, flow: 1.2, deform: 1, wave: 0.3, float: 1.8, sway: 2,
    tint: 0, dots: 0, ticks: 0.6, scan: 0, look: 0.8, wander: 0, hold: 0,
  },
};

const PARAM_KEYS: readonly ParamKey[] = [
  'amp', 'flow', 'deform', 'wave', 'float', 'sway', 'tint',
  'dots', 'ticks', 'scan', 'look', 'wander', 'hold',
];
/** Easing time constants (ms): colour and accents react first, the body follows. */
const PARAM_TAU: Record<ParamKey, number> = {
  amp: 320, flow: 520, deform: 520, wave: 420, float: 600, sway: 600, tint: 260,
  dots: 220, ticks: 200, scan: 400, look: 300, wander: 300, hold: 160,
};
/** The header keeps a gentle idle so it never competes with the page. */
const HEADER_IDLE = { amp: 0.02, deform: 0.5, float: 0.8, sway: 1, wander: 0 };
const STILL = { amp: 0, flow: 0, deform: 0, wave: 0, float: 0, sway: 0, scan: 0, wander: 0 };

/** Role filters from the spec "Where" column (header idle is gentle; avatars never move). */
export function stateConfigFor(
  surface: RendaSurface,
  eyes: RendaEyes,
  state: RendaState
): StateConfig {
  if (surface === 'avatar') {
    return { ...RENDA_STATES.idle, ...STILL, look: 0, eyes: eyes === 'dot' ? 'dot' : 'open' };
  }
  let s = state;
  if (surface === 'header' && (s === 'attentive' || s === 'listening')) s = 'idle';
  const c: StateConfig = { ...RENDA_STATES[s] };
  if (surface === 'header' && s === 'idle') Object.assign(c, HEADER_IDLE);
  if (eyes === 'dot') c.eyes = 'dot';
  return c;
}

export function eyeShapeFor(
  surface: RendaSurface,
  eyes: RendaEyes,
  state: RendaState
): RendaEyeShape {
  if (eyes === 'none') return 'none';
  if (eyes === 'dot') return 'dot';
  return stateConfigFor(surface, eyes, state).eyes;
}

const isStill = (c: StateConfig) =>
  c.amp === 0 && c.flow === 0 && c.deform === 0 && c.wave === 0 &&
  c.float === 0 && c.sway === 0 && c.scan === 0 && c.wander === 0;

/* ------------------------------ helpers ------------------------------ */
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const f2 = (n: number) => Math.round(n * 100) / 100;
const f3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (cur: number, target: number, dt: number, tau: number) =>
  cur + (target - cur) * (1 - Math.exp(-dt / tau));
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
/** Sine reshaped to dwell at the extremes (look left… hold… look right). */
const dwell = (s: number) => Math.sign(s) * Math.pow(Math.abs(s), 0.35);

interface Spring {
  x: number;
  v: number;
}
/** Semi-implicit Euler with fixed sub-steps so long frames stay stable. */
function stepSpring(s: Spring, target: number, dtMs: number, k: number, c: number) {
  let left = dtMs / 1000;
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 120);
    s.v += (-k * (s.x - target) - c * s.v) * h;
    s.x += s.v * h;
    left -= h;
  }
}
const springBusy = (s: Spring, target = 0) =>
  Math.abs(s.x - target) > 0.0008 || Math.abs(s.v) > 0.002;

/** Scale an element about (x, y) after drawing it at height `y + dy`. */
const scaleAt = (x: number, y: number, dy: number, ax: number, ay: number) =>
  `translate(${x} ${f2(y + dy)}) scale(${f3(ax)} ${f3(ay)}) translate(${-x} ${-y})`;

const written = new WeakMap<object, Record<string, string>>();
/** setAttribute that skips unchanged values (no style invalidation when settled). */
function put(el: Element | null | undefined, k: string, v: string | number): void {
  if (!el) return;
  const s = String(v);
  let c = written.get(el);
  if (!c) {
    c = {};
    written.set(el, c);
  }
  if (c[k] === s) return;
  c[k] = s;
  el.setAttribute(k, s);
}

const ANG = Array.from({ length: SHAPE_N }, (_, i) => shapeAngle(i));
const YS = Array.from({ length: SHAPE_N }, (_, i) => shapeY(i));

export const SPARK_ANGLES = [30, 90, 150, 210, 270, 330] as const;
const SPARK_MS = 950;
const SPARK_STAGGER = 45;
const RIPPLE_MS = 750;
const RIPPLE_STAGGER = 300;
const LOOK_RANGE: readonly [number, number] = [2.6, 1.8];

/* ------------------------------ engine ------------------------------ */
export interface RendaEyeNodes {
  g: SVGGElement;
  /** Eye centre x (viewBox units). */
  x: number;
  open?: SVGElement | null;
  arc?: SVGPathElement | null;
}
export interface RendaNodes {
  shape: SVGPathElement;
  body: SVGGElement;
  shadow: SVGElement | null;
  highlight: SVGGElement;
  dots: SVGGElement;
  dot: SVGElement[];
  ticks: SVGGElement;
  eyes: RendaEyeNodes[];
  sparks: SVGElement[];
  ripples: SVGElement[];
}

export interface RendaEngineOptions {
  size: number;
  eyes: RendaEyes;
  surface: RendaSurface;
}

type IdleEyeForce = { phase: IdleEyePhase; glance?: GlanceDir; blinkProgress?: number };

/** Milliseconds without touch, scroll or pointer before the hero/launcher settles. */
export const SETTLE_AFTER_MS = 20000;

export class RendaEngine {
  t = 0;
  state: RendaState = 'idle';
  private readonly p = {} as Record<ParamKey, number>;
  private period = 2600;
  private phase = 0;
  private tau = 0;
  private floatT = 0;
  private waveT = 0;
  private accentT = 0;
  private ponderT = 0;
  private motion = 1;
  private floatY = 0;
  private gazeX = 0;
  private color: string = RENDA_COLORS.blue;
  private readonly pulse: Spring = { x: 0, v: 0 };
  private readonly eyeSX: Spring = { x: 1, v: 0 };
  private readonly eyeSY: Spring = { x: 1, v: 0 };
  private eyeMix = 0;
  private eyeX = 0;
  private eyeY = 0;
  private lookTX = 0;
  private lookTY = 0;
  private lookX = 0;
  private lookY = 0;
  private wanderTX = 0;
  private wanderTY = 0;
  private wanderX = 0;
  private wanderY = 0;
  private nextSaccadeAt = 0;
  private blinkAt = Infinity;
  private blinkStart = -1e9;
  /** Idle eye life cycle (hero/launcher/header expressive). Null when inactive. */
  private idleLife: IdleEyeLifeState | null = null;
  /** Dot-eye blink-only scheduler. */
  private dotBlink: DotBlinkState | null = null;
  /** Review harness: freeze a life-cycle pose. */
  private idleEyeForce: IdleEyeForce | null = null;
  private sparkStart = -1e9;
  private rippleStart = -1e9;
  private rippleCount = 0;
  private readonly dyn = new Float64Array(SHAPE_N);
  private readonly sparkScale: number;

  constructor(
    private readonly n: RendaNodes,
    private readonly o: RendaEngineOptions,
    initial: RendaState,
    private readonly random: () => number = Math.random
  ) {
    this.state = initial;
    this.sparkScale = Math.max(1, 104 / o.size);
    this.applyInstant();
    // A character that mounts already Attentive/Listening still blinks.
    if (this.cfg().blink) this.blinkAt = 700 + this.random() * 300;
  }

  private cfg(state = this.state): StateConfig {
    return stateConfigFor(this.o.surface, this.o.eyes, state);
  }

  setIdleEyeForce(force: IdleEyeForce | null): void {
    this.idleEyeForce = force;
  }

  /** Pointer direction relative to the character, each axis in [-1, 1] (0 = none). */
  setLook(x: number, y: number): void {
    this.lookTX = clamp(x, -1, 1);
    this.lookTY = clamp(y, -1, 1);
  }

  setState(state: RendaState, reduced: boolean): void {
    if (this.o.surface === 'avatar' || state === this.state) return;
    this.state = state;
    // Restart the Idle life cycle from Rest on every entry; cancel it on leaving.
    this.idleLife = null;
    this.dotBlink = null;
    // First blink comes quickly, then every 4-7 s (idle life cycle owns idle blinks).
    this.blinkAt =
      this.cfg().blink && state !== 'idle' ? this.t + 700 + this.random() * 300 : Infinity;
    if (reduced) this.applyInstant();
    else this.kickFor(state);
  }

  /** A little jelly hop on entering a state; bigger for success / attention. */
  private kickFor(state: RendaState): void {
    const kick: Partial<Record<RendaState, number>> = {
      attentive: 0.4, listening: 0.45, thinking: 0.35, responding: 0.9, success: 1.3, attention: 1.5,
    };
    this.pulse.v += kick[state] ?? 0.25;
    if (state === 'success') {
      this.sparkStart = this.t;
      this.rippleStart = this.t;
      this.rippleCount = 1;
    }
    if (state === 'attention') {
      this.rippleStart = this.t;
      this.rippleCount = 2;
    }
  }

  /** Jump every continuous parameter to the state's target (reduce motion / static). */
  applyInstant(): void {
    const cfg = this.cfg();
    for (const k of PARAM_KEYS) this.p[k] = cfg[k];
    this.period = cfg.period;
    this.eyeMix = cfg.eyes === 'open' || cfg.eyes === 'dot' ? 1 : 0;
    this.eyeX = cfg.off[0];
    this.eyeY = cfg.off[1];
    this.resetSprings(cfg);
    this.lookX = this.lookY = this.wanderX = this.wanderY = 0;
    this.sparkStart = this.rippleStart = -1e9;
    this.blinkAt = Infinity;
  }

  private resetSprings(cfg: StateConfig): void {
    this.eyeSX.x = cfg.eyeScale[0];
    this.eyeSY.x = cfg.eyeScale[1];
    this.pulse.x = 0;
    this.eyeSX.v = this.eyeSY.v = this.pulse.v = 0;
  }

  private settleOn(idleMs: number): boolean {
    return (
      (this.o.surface === 'hero' || this.o.surface === 'launcher') &&
      this.state === 'idle' &&
      idleMs > SETTLE_AFTER_MS
    );
  }

  /**
   * Advance by `dt` ms and paint. `reduced` = static character (reduce motion or
   * `animated=false`): a still pose whose colour, accents and eye shape follow the state.
   */
  step(dt: number, reduced: boolean, idleMs: number): void {
    this.t += dt;
    const cfg = this.cfg();
    const m = this.advanceMotion(dt, reduced, idleMs);
    this.advanceParams(dt, cfg, reduced);
    this.advanceClocks(dt, m);
    this.paintEyes(dt, cfg, reduced, idleMs, m);
    this.paintBody(m);
    this.paintShape(m);
    this.paintAccents(m);
    this.paintSparks(reduced);
    this.paintRipples(reduced);
  }

  /** Settle: idle + 20 s without interaction → still over 320 ms (hero & launcher). */
  private advanceMotion(dt: number, reduced: boolean, idleMs: number): number {
    const target = reduced || this.settleOn(idleMs) ? 0 : 1;
    this.motion = reduced
      ? 0
      : clamp(this.motion + (Math.sign(target - this.motion) * dt) / 320);
    return this.motion * this.motion * (3 - 2 * this.motion);
  }

  private advanceParams(dt: number, cfg: StateConfig, reduced: boolean): void {
    for (const k of PARAM_KEYS) {
      this.p[k] = reduced ? cfg[k] : smooth(this.p[k], cfg[k], dt, PARAM_TAU[k]);
    }
    this.period = smooth(this.period, cfg.period, dt, 260);
    if (reduced) {
      this.resetSprings(cfg);
      return;
    }
    stepSpring(this.eyeSX, cfg.eyeScale[0], dt, 260, 22);
    stepSpring(this.eyeSY, cfg.eyeScale[1], dt, 260, 22);
    stepSpring(this.pulse, 0, dt, 170, 11);
  }

  /** Clocks accumulate so a tempo change never jumps; all freeze when settled. */
  private advanceClocks(dt: number, m: number): void {
    const s = (dt / 1000) * m;
    this.tau += s * this.p.flow;
    this.floatT += s * this.p.flow;
    this.waveT += s * (0.7 + 0.3 * this.p.flow);
    this.accentT += s;
    this.ponderT += s;
    this.phase += (dt / this.period) * TAU * m;
  }

  /**
   * Jelly body: bob, squash/stretch pivoting on the base (wider as it sinks), sway,
   * and a lean toward wherever the eyes are looking.
   */
  private paintBody(m: number): void {
    const ft = this.floatT;
    const fl = this.p.float * m;
    this.floatY = -fl * (0.72 * Math.sin(ft * 1.85) + 0.28 * Math.sin(ft * 3.1 + 1.3));
    const q = this.p.amp * m * Math.sin(this.phase) + 0.006 * this.floatY * m;
    const k = this.pulse.x;
    const sx = 1 + q + k * 1.1;
    const sy = 1 - q * 0.9 + k * 0.8;
    const tilt =
      this.p.sway * m * (0.7 * Math.sin(ft * 0.83 + 0.5) + 0.3 * Math.sin(ft * 1.71 + 2.2)) +
      this.gazeX * 0.9;
    put(this.n.body, 'transform', `translate(${CX} ${f2(BLOB_BASE_Y + this.floatY)}) rotate(${f2(tilt)}) scale(${f3(sx)} ${f3(sy)}) translate(${-CX} ${-BLOB_BASE_Y})`);
    this.color = mixHex(RENDA_COLORS.blue, RENDA_COLORS.violet, clamp(this.p.tint));
    put(this.n.shape, 'fill', this.color);
    put(this.n.highlight, 'transform', `translate(${f2(-this.gazeX * 0.35)} 0)`);
    const lift = -this.floatY;
    put(this.n.shadow, 'fill', this.color);
    put(this.n.shadow, 'transform', `translate(${CX} 95) scale(${f3(1 - lift * 0.035 + k)} 1) translate(${-CX} -95)`);
    put(this.n.shadow, 'opacity', f2(clamp(0.22 - lift * 0.02, 0.08, 0.3)));
  }

  /** Organic outline: low harmonics on the tempo clock plus a wave travelling upward. */
  private paintShape(m: number): void {
    const d = this.p.deform * m;
    const w = this.p.wave * m;
    if (d < 1e-4 && w < 1e-4) {
      put(this.n.shape, 'd', RENDA_REST_PATH);
      return;
    }
    const tau = this.tau;
    const wt = this.waveT;
    for (let i = 0; i < SHAPE_N; i++) {
      const a = ANG[i];
      this.dyn[i] =
        d * (0.022 * Math.sin(2 * a + 0.9 * tau) +
          0.016 * Math.sin(3 * a - 0.7 * tau + 1.3) +
          0.009 * Math.sin(5 * a + 1.25 * tau + 0.4)) +
        w * 0.02 * Math.sin(2.6 * YS[i] + 4.2 * wt);
    }
    put(this.n.shape, 'd', rendaShapePath(this.dyn));
  }

  /** Thinking dots bounce in a wave; listening / responding ticks pulse. Still when reduced. */
  private paintAccents(m: number): void {
    put(this.n.dots, 'opacity', f2(this.p.dots));
    if (this.p.dots > 0.003) {
      for (let i = 0; i < this.n.dot.length; i++) {
        const [cx, cy] = THINK_DOTS[i];
        const b = Math.max(0, Math.sin(this.accentT * (TAU / 1.25) - i * 0.75));
        put(this.n.dot[i], 'fill', this.color);
        put(this.n.dot[i], 'transform', scaleAt(cx, cy, -3 * b * m, 1 + m * (0.35 * b - 0.15), 1 + m * (0.35 * b - 0.15)));
      }
    }
    const beat = 0.5 + 0.5 * Math.sin(this.accentT * (TAU / 0.9));
    put(this.n.ticks, 'opacity', f2(this.p.ticks * (1 - 0.45 * m * beat)));
    if (this.p.ticks > 0.003) {
      put(this.n.ticks, 'stroke', this.color);
      put(this.n.ticks, 'transform', scaleAt(TICK_PIVOT[0], TICK_PIVOT[1], 0, 1 + 0.14 * m * beat, 1 + 0.14 * m * beat));
    }
  }

  /* ------------------------------ eyes ------------------------------ */
  private paintEyes(dt: number, cfg: StateConfig, reduced: boolean, idleMs: number, m: number): void {
    if (!this.n.eyes.length) return;
    const blink = this.eyePose(dt, cfg, reduced, idleMs);
    this.advanceGaze(dt, reduced, m);
    this.writeEyes(blink, m);
  }

  /** Eye openness / offset / blink: Idle life cycle on hero/launcher/header, else state morph. */
  private eyePose(dt: number, cfg: StateConfig, reduced: boolean, idleMs: number): number {
    const mode = idleEyeMode({
      eyes: this.o.eyes,
      staticIdle: false,
      reducedMotion: reduced,
      paused: this.settleOn(idleMs),
      enabled: this.state === 'idle' && this.o.surface !== 'avatar',
    });
    if (this.idleEyeForce) return this.forcedPose(this.idleEyeForce);
    if (mode === 'full') return this.idleLifePose();
    if (mode === 'blinkOnly') return this.dotBlinkPose();
    this.idleLife = null;
    this.dotBlink = null;
    return this.statePose(dt, cfg, reduced);
  }

  private applyPose(pose: IdleEyePose): number {
    this.eyeMix = pose.eyeMix;
    this.eyeX = pose.offset[0];
    this.eyeY = pose.offset[1];
    return pose.blink;
  }

  private forcedPose(force: IdleEyeForce): number {
    this.idleLife = null;
    this.dotBlink = null;
    return this.applyPose(poseForPhase(force.phase, force));
  }

  private idleLifePose(): number {
    if (!this.idleLife) this.idleLife = startIdleEyeLife(this.t, this.random());
    const r = this.random;
    this.idleLife = advanceIdleEyeLife(this.idleLife, this.t, r(), r(), r()).state;
    this.dotBlink = null;
    this.blinkAt = Infinity;
    return this.applyPose(this.idleLife.pose);
  }

  private dotBlinkPose(): number {
    if (!this.dotBlink) this.dotBlink = startDotBlink(this.t, this.random());
    const next = advanceDotBlink(this.dotBlink, this.t, this.random(), this.random());
    this.dotBlink = next.state;
    this.eyeMix = 1;
    this.eyeX = this.eyeY = 0;
    this.idleLife = null;
    this.blinkAt = Infinity;
    return next.blink;
  }

  /** Morph toward the state's eye shape and offset, with natural blinks (fast close, slower open). */
  private statePose(dt: number, cfg: StateConfig, reduced: boolean): number {
    let eyeTarget = cfg.eyes === 'arc' ? 0 : 1;
    if (this.state === 'attention') eyeTarget = this.t - this.rippleStart < 1100 ? 1 : 0;
    this.eyeMix = reduced ? eyeTarget : smooth(this.eyeMix, eyeTarget, dt, 40);
    this.eyeX = reduced ? cfg.off[0] : smooth(this.eyeX, cfg.off[0], dt, 70);
    this.eyeY = reduced ? cfg.off[1] : smooth(this.eyeY, cfg.off[1], dt, 70);
    if (reduced) return 1;
    if (this.t >= this.blinkAt) {
      this.blinkStart = this.t;
      this.blinkAt = this.t + 4000 + this.random() * 3000;
    }
    const be = (this.t - this.blinkStart) / 170;
    if (be < 0 || be >= 1) return 1;
    const closing = be < 0.4 ? be / 0.4 : 1 - easeOutCubic((be - 0.4) / 0.6);
    return 1 - 0.9 * closing;
  }

  /** Pointer tracking plus small saccades (quick shifts, then holds). */
  private advanceGaze(dt: number, reduced: boolean, m: number): void {
    if (reduced) {
      this.lookX = this.lookY = this.wanderX = this.wanderY = 0;
      return;
    }
    this.lookX = smooth(this.lookX, this.lookTX * m, dt, 140);
    this.lookY = smooth(this.lookY, this.lookTY * m, dt, 140);
    if (this.t >= this.nextSaccadeAt) {
      const a = this.random() * TAU;
      const r = Math.sqrt(this.random());
      this.wanderTX = Math.cos(a) * r;
      this.wanderTY = Math.sin(a) * r * 0.7;
      this.nextSaccadeAt = this.t + 650 + this.random() * 1700;
    }
    this.wanderX = smooth(this.wanderX, this.wanderTX, dt, 45);
    this.wanderY = smooth(this.wanderY, this.wanderTY, dt, 45);
  }

  /** Thinking: the eyes sweep up-left ↔ up-right, dwelling at each side as if pondering. */
  private scanOffset(m: number): [number, number] {
    const s = this.p.scan * m;
    if (s < 1e-3) return [0, 0];
    const d = dwell(Math.sin(this.ponderT * (TAU / 2.6)));
    return [-3 * (0.5 - 0.5 * d) * s, -0.8 * Math.abs(d) * s];
  }

  private writeEyes(blink: number, m: number): void {
    const { look, wander, hold } = this.p;
    const w = wander * m;
    const [scanX, scanY] = this.scanOffset(m);
    const ex = this.eyeX + this.lookX * look * LOOK_RANGE[0] + this.wanderX * w + scanX;
    const ey = this.eyeY + this.lookY * look * LOOK_RANGE[1] + this.wanderY * w + scanY;
    this.gazeX = ex;
    const sx = this.eyeSX.x;
    const sy = this.eyeSY.x;
    const em = this.eyeMix;
    const openH = (0.3 + 0.7 * em + hold * 0.5 * (1 - em)) * blink * sy;
    const tr = `translate(${f2(ex)} ${f2(ey)})`;
    for (const e of this.n.eyes) {
      put(e.g, 'transform', tr);
      if (e.open && e.arc) {
        put(e.open, 'transform', scaleAt(e.x, EYE_Y, 0, sx, openH));
        put(e.open, 'opacity', f2(clamp(em * 1.25 + hold)));
        put(e.arc, 'opacity', f2(clamp((1 - em) * 1.25) * (1 - clamp(hold))));
        put(e.arc, 'transform', scaleAt(e.x, EYE_Y, -em * 1.5, sx, sy));
      } else if (e.open) {
        put(e.open, 'transform', scaleAt(e.x, EYE_Y, 0, sx, blink * sy));
        put(e.open, 'opacity', 1);
      }
    }
  }

  /* ------------------------------ one-shots ------------------------------ */
  /** Success: small motes drift outward and up from the body. */
  private paintSparks(reduced: boolean): void {
    const sb = this.t - this.sparkStart;
    for (let i = 0; i < this.n.sparks.length; i++) {
      const el = this.n.sparks[i];
      const p = (sb - i * SPARK_STAGGER) / SPARK_MS;
      if (reduced || p < 0 || p > 1) {
        put(el, 'opacity', 0);
        continue;
      }
      const e = easeOutCubic(p);
      const a = SPARK_ANGLES[i % SPARK_ANGLES.length] * DEG;
      const x = CX + Math.sin(a) * (40 + 12 * e);
      const y = 58 - Math.cos(a) * (31 + 12 * e) - 4 * e;
      put(el, 'transform', `translate(${f2(x)} ${f2(y)}) scale(${f3((0.5 + 0.6 * (1 - p)) * this.sparkScale)})`);
      put(el, 'opacity', f2(p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8));
    }
  }

  /** Attention (two) and success (one): the silhouette ripples outward and fades. */
  private paintRipples(reduced: boolean): void {
    for (let i = 0; i < this.n.ripples.length; i++) {
      const el = this.n.ripples[i];
      const p = (this.t - this.rippleStart - i * RIPPLE_STAGGER) / RIPPLE_MS;
      if (reduced || i >= this.rippleCount || p < 0 || p > 1) {
        put(el, 'opacity', 0);
        continue;
      }
      const s = 1 + 0.35 * easeOutCubic(p);
      put(el, 'stroke', this.color);
      put(el, 'opacity', f2(0.55 * Math.pow(1 - p, 1.5)));
      put(el, 'transform', `translate(${CX} ${f2(58 + this.floatY)}) scale(${f3(s)}) translate(${-CX} -58)`);
    }
  }

  /* ------------------------------ quiescence ------------------------------ */
  private oneShotsRunning(): boolean {
    const t = this.t;
    return (
      t - this.sparkStart <= SPARK_MS + 5 * SPARK_STAGGER ||
      t - this.rippleStart <= RIPPLE_MS + RIPPLE_STAGGER
    );
  }

  private paramsSettled(cfg: StateConfig): boolean {
    if (PARAM_KEYS.some((k) => Math.abs(this.p[k] - cfg[k]) > 0.002)) return false;
    return !springBusy(this.eyeSX, cfg.eyeScale[0]) && !springBusy(this.eyeSY, cfg.eyeScale[1]);
  }

  private eyesSettled(cfg: StateConfig): boolean {
    const eyeTarget = cfg.eyes === 'arc' ? 0 : 1;
    return (
      Math.abs(this.eyeMix - eyeTarget) <= 0.002 &&
      Math.abs(this.eyeX - cfg.off[0]) <= 0.01 &&
      Math.abs(this.eyeY - cfg.off[1]) <= 0.01 &&
      Math.abs(this.lookX - this.lookTX * this.motion) <= 0.005 &&
      Math.abs(this.lookY - this.lookTY * this.motion) <= 0.005
    );
  }

  /**
   * True when nothing would change on the next frame (battery: the loop stops and
   * restarts on the next state change or interaction).
   */
  isQuiescent(reduced: boolean, idleMs: number): boolean {
    if (reduced) return true;
    const cfg = this.cfg();
    if (this.oneShotsRunning() || springBusy(this.pulse)) return false;
    if (this.blinkAt !== Infinity || this.idleLife || this.dotBlink || this.idleEyeForce) return false;
    if (!this.paramsSettled(cfg) || !this.eyesSettled(cfg)) return false;
    if (this.motion < 0.001 && this.settleOn(idleMs)) return true;
    return isStill(cfg);
  }
}
