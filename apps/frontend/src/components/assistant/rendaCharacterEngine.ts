/**
 * Renda character engine (spec #451 §1, viewBox 0 0 82 100).
 *
 * A port of the approved prototype (`prototypes/renda-character/index.html`):
 * one clock per character drives every motion so periods change without jumps.
 * Only `transform` and `opacity` (plus a few colour attributes on one-shots) are
 * written per frame, straight to the SVG nodes, so React never re-renders per frame.
 * Web has no dark mode, so only the light-surface treatment is ported.
 */
import {
  CX,
  CY,
  EYE_Y,
  RENDA_COLORS,
  mixHex,
} from './rendaCharacterTokens';
import type { RendaEyes } from './rendaCharacterTokens';

export {
  CX,
  CY,
  EYE_X,
  EYE_Y,
  RENDA_COLORS,
  RENDA_WIDTH_RATIO,
  eyesForSize,
  mixHex,
} from './rendaCharacterTokens';
export type { RendaEyes } from './rendaCharacterTokens';

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

type HaloMode = 'breath' | 'max' | 'mid';
interface StateConfig {
  eyes: 'arc' | 'open' | 'dot';
  off: [number, number];
  amp: number;
  period: number;
  grad: number;
  halo: HaloMode;
  blink?: boolean;
  orbit?: boolean;
}

export const RENDA_STATES: Record<RendaState, StateConfig> = {
  idle: {
    eyes: 'arc',
    off: [0, 0],
    amp: 0.03,
    period: 3200,
    grad: 36,
    halo: 'breath',
  },
  attentive: {
    eyes: 'open',
    off: [0, 0],
    amp: 0,
    period: 3200,
    grad: 0,
    halo: 'max',
    blink: true,
  },
  listening: {
    eyes: 'open',
    off: [0, 2],
    amp: 0,
    period: 3200,
    grad: 0,
    halo: 'max',
    blink: true,
  },
  thinking: {
    eyes: 'open',
    off: [2, -2],
    amp: 0.04,
    period: 1200,
    grad: 36,
    halo: 'breath',
    orbit: true,
  },
  responding: {
    eyes: 'arc',
    off: [0, 0],
    amp: 0.03,
    period: 1600,
    grad: 36,
    halo: 'breath',
  },
  success: {
    eyes: 'arc',
    off: [0, 0],
    amp: 0,
    period: 3200,
    grad: 36,
    halo: 'max',
  },
  attention: {
    eyes: 'open',
    off: [0, 0],
    amp: 0,
    period: 3200,
    grad: 36,
    halo: 'max',
  },
};

/** Role filters from the spec "Where" column (header idle is static; avatars never move). */
export function stateConfigFor(
  surface: RendaSurface,
  eyes: RendaEyes,
  state: RendaState
): StateConfig {
  if (surface === 'avatar') {
    return {
      ...RENDA_STATES.idle,
      amp: 0,
      grad: 0,
      halo: 'mid',
      eyes: eyes === 'dot' ? 'dot' : 'arc',
    };
  }
  let s = state;
  if (surface === 'header' && (s === 'attentive' || s === 'listening')) s = 'idle';
  const c: StateConfig = { ...RENDA_STATES[s] };
  if (surface === 'header' && s === 'idle') {
    c.amp = 0;
    c.grad = 0;
    c.halo = 'mid';
  }
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

/* ------------------------------ geometry ------------------------------ */
const fmt = (n: number) => +n.toFixed(3);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (cur: number, target: number, dt: number, tau: number) =>
  cur + (target - cur) * (1 - Math.exp(-dt / tau));
const easeInOut = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
const polar = (a: number, r: number): [number, number] => [
  CX + r * Math.sin((a * Math.PI) / 180),
  CY - r * Math.cos((a * Math.PI) / 180),
];

function wedge(a0: number, a1: number, r = 72): string {
  const [x0, y0] = polar(a0, r);
  const [x1, y1] = polar(a1, r);
  return `M${CX} ${CY}L${fmt(x0)} ${fmt(y0)}L${fmt(x1)} ${fmt(y1)}Z`;
}

// Sweep gradient as wedges (SVG has no conic gradient). Highlight arc sits top-right.
const C = RENDA_COLORS;
const RING_STOPS: Array<[number, string]> = [
  [0, C.light],
  [45, C.tint],
  [95, C.light],
  [185, C.main],
  [290, C.main],
  [360, C.light],
];
function ringColor(a: number): string {
  for (let i = 0; i < RING_STOPS.length - 1; i++) {
    const [a0, c0] = RING_STOPS[i];
    const [a1, c1] = RING_STOPS[i + 1];
    if (a >= a0 && a <= a1) return mixHex(c0, c1, (a - a0) / (a1 - a0));
  }
  return C.light;
}

export interface WedgePath {
  d: string;
  fill: string;
  opacity?: number;
}

/** 120 ring wedges (rotated as one group, never the face or eyes). */
export const RING_WEDGES: WedgePath[] = (() => {
  const N = 120;
  const step = 360 / N;
  const out: WedgePath[] = [];
  for (let i = 0; i < N; i++) {
    const a = i * step;
    out.push({
      d: wedge(a - 0.4, a + step + 0.4),
      fill: ringColor(a + step / 2),
    });
  }
  return out;
})();

/** Responding highlight: feathered leading edge (+12° → 0°), long decaying tail (0° → −150°). */
export const SWEEP_WEDGES: WedgePath[] = (() => {
  const out: WedgePath[] = [];
  for (let a = 12; a > -150; a -= 2.5) {
    const lead = a > 0 ? 1 - a / 12 : 1;
    const tail = a <= 0 ? Math.pow(1 + a / 150, 2.2) : 1;
    const k = lead * tail;
    out.push({
      d: wedge(a - 2.5 - 0.3, a + 0.3),
      fill: mixHex(C.tint, C.white, clamp(k * k * 0.75)),
      opacity: fmt(0.95 * k),
    });
  }
  return out;
})();

/** Drift echoes behind the face while thinking. */
export const ECHOES: Array<[number, number, number, number, string, number]> = [
  [42.4, 49.0, 38.6, 47.6, C.light, 1.2],
  [39.6, 51.3, 39.4, 46.8, C.tint, 0.9],
  [41.0, 48.4, 40.2, 49.0, C.light, 0.8],
];

export const SPARK_ANGLES = [30, 90, 150, 210, 270, 330] as const;

/** Spring pop (damping 12, stiffness 180, mass 1), normalised to `peak`; index = ms. */
function springCurve(peak: number): number[] {
  const k = 180;
  const c = 12;
  const out: number[] = [];
  let x = 0;
  let v = 1;
  const dt = 1 / 1000;
  let maxX = 0;
  for (let i = 0; i <= 600; i++) {
    out.push(x);
    if (x > maxX) maxX = x;
    const a = -k * x - c * v;
    v += a * dt;
    x += v * dt;
  }
  return out.map((y) => (y / maxX) * peak);
}
const SPRING_108 = springCurve(0.08);
const SPRING_110 = springCurve(0.1);

/* ------------------------------ engine ------------------------------ */
export interface RendaEyeNodes {
  g: SVGGElement;
  open?: SVGEllipseElement | null;
  arc?: SVGPathElement | null;
}
export interface RendaNodes {
  body: SVGGElement;
  halo: SVGGElement;
  bloom: SVGGElement;
  bloomRot: SVGUseElement;
  ringRot: SVGUseElement;
  echoes: SVGGElement;
  echoG: SVGGElement[];
  sweep: SVGGElement;
  sweepRot: SVGUseElement;
  orbits: SVGGElement;
  orbitRot: SVGGElement[];
  eyes: RendaEyeNodes[];
  sparks: Array<{ g: SVGGElement; p: SVGPathElement; glow: SVGPathElement }>;
  ripples: SVGEllipseElement[];
}

export interface RendaEngineOptions {
  size: number;
  eyes: RendaEyes;
  surface: RendaSurface;
}

/** Milliseconds without touch, scroll or pointer before the hero/launcher settles. */
export const SETTLE_AFTER_MS = 20000;

export class RendaEngine {
  t = 0;
  state: RendaState = 'idle';
  private phase = 0;
  private amp = 0;
  private period = 3200;
  private gradRot = 0;
  private gradSpeed = 0;
  private haloN = 0.5;
  private orbitO = 0;
  private orbitA = 0;
  private echoA = [0, 0, 0];
  private eyeMix = 0;
  private eyeX = 0;
  private eyeY = 0;
  private motion = 1;
  private blinkAt = Infinity;
  private blinkStart = -1e9;
  private pops: Array<{ start: number; kind: 'resp' | 'spring' | 'att' }> = [];
  private sweepStart = -1e9;
  private sparkStart = -1e9;
  private rippleStart = -1e9;
  private readonly sparkD: number;

  constructor(
    private readonly n: RendaNodes,
    private readonly o: RendaEngineOptions,
    initial: RendaState,
    private readonly random: () => number = Math.random
  ) {
    this.state = initial;
    // 4 px diamonds, never smaller than 6 units at hero sizes.
    this.sparkD = Math.max((4 / o.size) * 100, 6);
    this.applyInstant();
    // A character that mounts already Attentive/Listening (e.g. the hero after
    // "Start over" with the composer focused) still blinks.
    if (this.cfg().blink) this.blinkAt = 700 + this.random() * 300;
  }

  private cfg(state = this.state): StateConfig {
    return stateConfigFor(this.o.surface, this.o.eyes, state);
  }

  setState(state: RendaState, reduced: boolean): void {
    if (this.o.surface === 'avatar') return;
    if (state === this.state) return;
    this.state = state;
    const t = this.t;
    const cfg = this.cfg();
    // First blink comes quickly (as in the approved prototype), then every 4-7 s.
    this.blinkAt = cfg.blink ? t + 700 + this.random() * 300 : Infinity;
    if (!reduced) {
      if (state === 'responding') {
        this.pops.push({ start: t, kind: 'resp' });
        this.sweepStart = t;
      }
      if (state === 'success') {
        this.pops.push({ start: t, kind: 'spring' });
        this.sparkStart = t;
      }
      if (state === 'attention') {
        this.pops.push({ start: t, kind: 'att' });
        this.rippleStart = t;
      }
    } else {
      this.applyInstant();
    }
  }

  /** Jump every continuous parameter to the state's target (reduce motion / static). */
  applyInstant(): void {
    const cfg = this.cfg();
    this.eyeMix = cfg.eyes === 'open' ? 1 : 0;
    this.eyeX = cfg.off[0];
    this.eyeY = cfg.off[1];
    this.haloN = cfg.halo === 'max' ? 1 : 0.5;
    this.orbitO = 0;
    this.amp = 0;
    this.gradSpeed = 0;
    this.pops = [];
    this.sweepStart = this.sparkStart = this.rippleStart = -1e9;
    this.blinkAt = Infinity;
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
   * `animated=false`): no breath, sweep, orbits, ripple or sparkles, but the eye
   * shape still follows the state.
   */
  step(dt: number, reduced: boolean, idleMs: number): void {
    this.t += dt;
    const t = this.t;
    const n = this.n;
    const rm = reduced;
    const cfg = this.cfg();

    // Settle: idle + 20 s without interaction → static over 320 ms (hero & launcher).
    const mTarget = rm || this.settleOn(idleMs) ? 0 : 1;
    this.motion = rm
      ? 0
      : clamp(this.motion + (Math.sign(mTarget - this.motion) * dt) / 320);
    const m = this.motion * this.motion * (3 - 2 * this.motion);

    // Breath: the phase accumulates so period changes never jump.
    this.period = smooth(this.period, cfg.period, dt, 180);
    this.phase += (dt / this.period) * Math.PI * 2;
    this.amp = rm ? 0 : smooth(this.amp, cfg.amp, dt, 160);
    const breathN = 0.5 - 0.5 * Math.cos(this.phase);
    let scale = 1 + this.amp * breathN * m;

    // One-shot pops.
    this.pops = this.pops.filter((p) => t - p.start < 700);
    for (const p of this.pops) {
      const e = t - p.start;
      if (p.kind === 'resp' && e < 300) {
        const q = e / 300;
        scale *=
          q < 0.45
            ? 1 + 0.06 * easeOutBack(q / 0.45)
            : 1 + 0.06 * (1 - easeInOut((q - 0.45) / 0.55));
      }
      if (p.kind === 'spring')
        scale *= 1 + SPRING_108[Math.min(600, Math.round(e))];
      if (p.kind === 'att' && e < 400)
        scale *= 1 + SPRING_110[Math.min(600, Math.round(e * 1.5))];
    }
    n.body.setAttribute(
      'transform',
      `translate(${CX} ${CY}) scale(${fmt(scale)}) translate(${-CX} ${-CY})`
    );

    // Gradient rotation (the ring only, never the face).
    this.gradSpeed = rm ? 0 : smooth(this.gradSpeed, cfg.grad, dt, 220);
    this.gradRot = (this.gradRot + (this.gradSpeed * m * dt) / 1000) % 360;
    const rot = `rotate(${fmt(this.gradRot)} ${CX} ${CY})`;
    n.ringRot.setAttribute('transform', rot);
    n.bloomRot.setAttribute('transform', rot);

    // Halo: primary.main at 16-28% on light surfaces, synced to the breath.
    const hTarget =
      cfg.halo === 'max'
        ? 1
        : cfg.halo === 'mid'
        ? 0.5
        : m * breathN + (1 - m) * 0.5;
    this.haloN = rm ? hTarget : smooth(this.haloN, hTarget, dt, 65);
    n.halo.setAttribute('opacity', String(fmt(0.16 + 0.12 * this.haloN)));
    n.bloom.setAttribute('opacity', String(fmt(0.22 + 0.1 * this.haloN)));

    // Thinking orbits (2.4 s / rev, opposite directions) + drift echoes.
    const oT = cfg.orbit && !rm ? 1 : 0;
    this.orbitO = rm ? 0 : smooth(this.orbitO, oT, dt, 90);
    this.orbitA = (this.orbitA + (150 * dt) / 1000) % 360;
    n.orbits.setAttribute('opacity', String(fmt(this.orbitO)));
    n.orbitRot[0]?.setAttribute('transform', `rotate(${fmt(this.orbitA)})`);
    n.orbitRot[1]?.setAttribute(
      'transform',
      `rotate(${fmt(-this.orbitA + 140)})`
    );
    const eSp = [70, -52, 38];
    this.echoA = this.echoA.map((a, i) => (a + (eSp[i] * dt) / 1000) % 360);
    n.echoes.setAttribute('opacity', String(fmt(this.orbitO * 0.5)));
    n.echoG.forEach((g, i) =>
      g.setAttribute('transform', `rotate(${fmt(this.echoA[i])} ${CX} ${CY})`)
    );

    // Responding: one 360° highlight sweep over 900 ms, ease-in-out.
    const se = (t - this.sweepStart) / 900;
    if (se >= 0 && se <= 1 && !rm) {
      const a = easeInOut(se) * 360 + 20;
      n.sweep.setAttribute(
        'opacity',
        String(fmt(Math.sin(Math.PI * se) * 0.9))
      );
      n.sweepRot.setAttribute('transform', `rotate(${fmt(a)} ${CX} ${CY})`);
    } else n.sweep.setAttribute('opacity', '0');

    // Eyes: 150 ms morph, 200 ms offset, blink 160 ms.
    if (n.eyes.length) {
      let eyeTarget = cfg.eyes === 'open' ? 1 : 0;
      const ae = t - this.rippleStart;
      if (this.state === 'attention') eyeTarget = ae < 1100 ? 1 : 0;
      this.eyeMix = rm ? eyeTarget : smooth(this.eyeMix, eyeTarget, dt, 40);
      this.eyeX = rm ? cfg.off[0] : smooth(this.eyeX, cfg.off[0], dt, 55);
      this.eyeY = rm ? cfg.off[1] : smooth(this.eyeY, cfg.off[1], dt, 55);
      if (!rm && t >= this.blinkAt) {
        this.blinkStart = t;
        this.blinkAt = t + 4000 + this.random() * 3000;
      }
      const be = (t - this.blinkStart) / 160;
      const blink =
        be >= 0 && be < 1 && !rm ? 1 - 0.9 * Math.sin(Math.PI * be) : 1;
      const em = this.eyeMix;
      for (const e of n.eyes) {
        e.g.setAttribute(
          'transform',
          `translate(${fmt(this.eyeX)} ${fmt(this.eyeY)})`
        );
        if (e.open && e.arc) {
          const sy = (0.3 + 0.7 * em) * blink;
          e.open.setAttribute(
            'transform',
            `translate(0 ${EYE_Y}) scale(1 ${fmt(sy)}) translate(0 ${-EYE_Y})`
          );
          e.open.setAttribute('opacity', String(fmt(clamp(em * 1.25))));
          e.arc.setAttribute('opacity', String(fmt(clamp((1 - em) * 1.25))));
          e.arc.setAttribute('transform', `translate(0 ${fmt(em * -1.5)})`);
        }
      }
    }

    // Success: 6 × 4 px diamonds travel 0 → 14% of height, 900 ms ease-out, 40 ms stagger.
    const sb = t - this.sparkStart;
    n.sparks.forEach((sp, i) => {
      const p = (sb - i * 40) / 900;
      if (rm || p < 0 || p > 1) {
        sp.g.setAttribute('opacity', '0');
        return;
      }
      const e = easeOutCubic(p);
      const rad = (SPARK_ANGLES[i] * Math.PI) / 180;
      const ux = Math.sin(rad);
      const uy = -Math.cos(rad);
      const x = CX + ux * (40.5 + 3 + 14 * e);
      const y = CY + uy * (49.5 + 3 + 14 * e);
      const sc = ((0.6 + 0.4 * e) * this.sparkD) / 2;
      const op = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75;
      const fill = i % 2 ? C.sparkLight : C.sparkCore;
      sp.p.setAttribute('fill', fill);
      sp.glow.setAttribute('fill', fill);
      sp.g.setAttribute('opacity', String(fmt(op)));
      sp.g.setAttribute(
        'transform',
        `translate(${fmt(x)} ${fmt(y)}) scale(${fmt(sc)})`
      );
    });

    // Attention: two oval ripples, scale 1.0 → 1.5, opacity .35 → 0, 700 ms each.
    n.ripples.forEach((rp, i) => {
      const p = (t - this.rippleStart - i * 300) / 700;
      if (rm || p < 0 || p > 1) {
        rp.setAttribute('opacity', '0');
        return;
      }
      const s = 1 + 0.5 * easeOutCubic(p);
      rp.setAttribute('opacity', String(fmt(0.35 * (1 - p))));
      rp.setAttribute(
        'transform',
        `translate(${CX} ${CY}) scale(${fmt(s)}) translate(${-CX} ${-CY})`
      );
    });
  }

  /**
   * True when nothing would change on the next frame (battery: the loop stops and
   * restarts on the next state change or interaction).
   */
  isQuiescent(reduced: boolean, idleMs: number): boolean {
    if (reduced) return true;
    const t = this.t;
    const cfg = this.cfg();
    if (this.pops.length) return false;
    if (t - this.sweepStart <= 900) return false;
    if (t - this.sparkStart <= 900 + 5 * 40) return false;
    if (t - this.rippleStart <= 1600) return false;
    if (this.blinkAt !== Infinity) return false;
    const eyeTarget = cfg.eyes === 'open' ? 1 : 0;
    if (Math.abs(this.eyeMix - eyeTarget) > 0.002) return false;
    if (
      Math.abs(this.eyeX - cfg.off[0]) > 0.01 ||
      Math.abs(this.eyeY - cfg.off[1]) > 0.01
    )
      return false;
    if (this.orbitO > 0.002) return false;
    const hTarget = cfg.halo === 'max' ? 1 : 0.5;
    if (cfg.halo !== 'breath' && Math.abs(this.haloN - hTarget) > 0.002)
      return false;
    const frozen = this.motion < 0.001 && this.settleOn(idleMs);
    if (frozen) return true;
    return (
      this.amp < 0.0005 &&
      this.gradSpeed < 0.05 &&
      cfg.amp === 0 &&
      cfg.grad === 0 &&
      cfg.halo !== 'breath'
    );
  }
}
