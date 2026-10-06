/**
 * Renda character model (#451 spec §1): geometry, eye levels, per-state motion
 * config and colour helpers. Pure (no React / RN imports) so vitest covers it.
 * Geometry is in the spec's 0 0 82 100 viewBox.
 */
import { rendaCharacterTokens as T } from '../../../theme/rendaCharacterTokens';

export type RendaCharacterState =
  | 'idle'
  | 'attentive'
  | 'listening'
  | 'thinking'
  | 'responding'
  | 'success'
  | 'attention';

export type RendaEyes = 'expressive' | 'dot' | 'none';
export type RendaEyeShape = 'arc' | 'open' | 'dot' | 'none';
export type RendaHaloMode = 'breath' | 'max' | 'mid';

export const VIEWBOX_W = 82;
export const VIEWBOX_H = 100;
export const CX = 41;
export const CY = 50;
/** Width : height of the character (0.82). */
export const ASPECT = VIEWBOX_W / VIEWBOX_H;

export const RING = { rx: 37, ry: 46, stroke: 7 } as const;
export const FACE = { rx: 33.5, ry: 42.5 } as const;
export const EYE_CENTERS: readonly [number, number][] = [
  [28, 46],
  [54, 46],
];
export const OPEN_EYE = { rx: 5, ry: 6 } as const;
export const DOT_EYE_R = 5;
/** Happy eye: arc 12 wide × 4 tall (quadratic control 8 above the ends), stroke 3.5. */
export const ARC_EYE_STROKE = 3.5;
/** Halo: same oval, ~10% beyond the ring (outer edge rx 40.5 / ry 49.5). */
export const HALO = { rx: 44.5, ry: 54.5 } as const;

/** Spec: expressive eyes need ≥ 36 px height, dots from 20–35, none below 20. */
export const EXPRESSIVE_MIN_SIZE = 36;
export const DOT_MIN_SIZE = 20;

export function eyesForSize(size: number): RendaEyes {
  if (size >= EXPRESSIVE_MIN_SIZE) return 'expressive';
  if (size >= DOT_MIN_SIZE) return 'dot';
  return 'none';
}

export function characterWidth(size: number): number {
  return size * ASPECT;
}

/** Arc ("happy") eye path centred on (x, y): ends at y+2, apex 2 above centre. */
export function arcEyePath(x: number, y: number): string {
  return `M${x - 6} ${y + 2}Q${x} ${y - 6} ${x + 6} ${y + 2}`;
}

// ---------------------------------------------------------------------------
// Motion config per state (spec §1 state table; prototype STATES)
// ---------------------------------------------------------------------------

export type RendaStateConfig = {
  eyes: 'arc' | 'open';
  /** Eye offset in viewBox units. */
  offset: readonly [number, number];
  /** Breath amplitude (scale delta). 0 = ring still. */
  amp: number;
  /** Breath period, ms. */
  period: number;
  /** Ring gradient spins (360° / 10 s) when true. */
  spin: boolean;
  halo: RendaHaloMode;
  blink: boolean;
  orbits: boolean;
};

export const RENDA_STATE_CONFIG: Record<RendaCharacterState, RendaStateConfig> = {
  idle: { eyes: 'arc', offset: [0, 0], amp: 0.03, period: 3200, spin: true, halo: 'breath', blink: false, orbits: false },
  attentive: { eyes: 'open', offset: [0, 0], amp: 0, period: 3200, spin: false, halo: 'max', blink: true, orbits: false },
  listening: { eyes: 'open', offset: [0, 2], amp: 0, period: 3200, spin: false, halo: 'max', blink: true, orbits: false },
  thinking: { eyes: 'open', offset: [2, -2], amp: 0.04, period: 1200, spin: true, halo: 'breath', blink: false, orbits: true },
  responding: { eyes: 'arc', offset: [0, 0], amp: 0.03, period: 1600, spin: true, halo: 'breath', blink: false, orbits: false },
  success: { eyes: 'arc', offset: [0, 0], amp: 0, period: 3200, spin: true, halo: 'max', blink: false, orbits: false },
  attention: { eyes: 'open', offset: [0, 0], amp: 0, period: 3200, spin: true, halo: 'max', blink: false, orbits: false },
};

export type RendaRenderMode = {
  /** false = fully static drawing (message avatar, badges). */
  animated: boolean;
  /** System "Reduce motion": no loops or one-shots, eye shapes still switch. */
  reducedMotion: boolean;
  /** Header avatar: idle is static, attentive/listening map to idle. */
  staticIdle?: boolean;
  /** Battery / settle pause: loops stop, eyes and halo keep their state. */
  paused?: boolean;
};

export type ResolvedRendaConfig = RendaStateConfig & {
  /** True when any continuous loop (breath, spin, orbit) may run. */
  loops: boolean;
  /** True when one-shots (pops, sweep, sparkles, ripples, blink) may play. */
  oneShots: boolean;
};

const STATIC_IDLE: RendaStateConfig = {
  ...RENDA_STATE_CONFIG.idle,
  amp: 0,
  spin: false,
  halo: 'mid',
};

/**
 * Effective config for a state under a render mode. Reduced motion and
 * `animated=false` freeze the ring but keep the eye shape and offset per state
 * (spec: "eye shape still switches per state, instantly").
 */
export function resolveRendaConfig(
  state: RendaCharacterState,
  mode: RendaRenderMode
): ResolvedRendaConfig {
  let effective = state;
  if (mode.staticIdle && (state === 'attentive' || state === 'listening')) effective = 'idle';
  let cfg = RENDA_STATE_CONFIG[effective];
  if (mode.staticIdle && effective === 'idle') cfg = STATIC_IDLE;
  const still = !mode.animated || mode.reducedMotion;
  if (still) {
    return {
      ...cfg,
      amp: 0,
      spin: false,
      orbits: false,
      blink: false,
      halo: cfg.halo === 'max' ? 'max' : 'mid',
      loops: false,
      oneShots: false,
    };
  }
  const loops = !mode.paused && (cfg.amp > 0 || cfg.spin || cfg.orbits);
  return {
    ...cfg,
    blink: cfg.blink && !mode.paused,
    loops,
    oneShots: !mode.paused,
  };
}

/** Eye shape actually drawn for a size + state. */
export function eyeShapeFor(eyes: RendaEyes, cfg: Pick<RendaStateConfig, 'eyes'>): RendaEyeShape {
  if (eyes === 'none') return 'none';
  if (eyes === 'dot') return 'dot';
  return cfg.eyes;
}

// ---------------------------------------------------------------------------
// Timings (ms)
// ---------------------------------------------------------------------------

export const RENDA_TIMING = {
  eyeMorph: 150,
  eyeOffset: 200,
  haloMax: 200,
  blink: 160,
  blinkMin: 4000,
  blinkMax: 7000,
  spinPeriod: 10_000,
  /** Shared clock for orbits (150°/s) and drift echoes; a whole number of turns each. */
  orbitClock: 36_000,
  respondingPop: 300,
  respondingSweep: 900,
  successTotal: 1200,
  sparkle: 900,
  sparkleStagger: 40,
  ripple: 700,
  rippleGap: 300,
  attentionTotal: 1600,
  attentionEyesOpen: 1100,
  settleAfter: 20_000,
  settleEase: 320,
} as const;

/** Next blink delay, uniformly random in 4–7 s. `rand` is in [0, 1). */
export function nextBlinkDelay(rand: number): number {
  const r = Math.min(Math.max(rand, 0), 1);
  return RENDA_TIMING.blinkMin + r * (RENDA_TIMING.blinkMax - RENDA_TIMING.blinkMin);
}

/** Orbit / echo turns per `orbitClock` cycle (150°/s → 15 turns in 36 s). */
export const ORBIT_TURNS = 15;
export const ECHO_TURNS: readonly number[] = [7, -5, 4];

// ---------------------------------------------------------------------------
// Springs: damped spring from rest with an initial velocity, matching the
// prototype's springCurve (damping 12, stiffness 180, mass 1).
// ---------------------------------------------------------------------------

export type SpringParams = { stiffness: number; damping: number; mass?: number };

/** Peak displacement of x'' = -k x - c x' with x(0)=0, x'(0)=v, per unit v. */
export function springPeakPerVelocity({ stiffness, damping, mass = 1 }: SpringParams): number {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta >= 1) return 0;
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  const tPeak = Math.atan2(wd, zeta * w0) / wd;
  return (Math.exp(-zeta * w0 * tPeak) * Math.sin(wd * tPeak)) / wd;
}

/** Initial velocity that makes the spring overshoot to `peak` (e.g. 0.08 → scale 1.08). */
export function springVelocityForPeak(peak: number, params: SpringParams): number {
  const perV = springPeakPerVelocity(params);
  return perV > 0 ? peak / perV : 0;
}

/** Success pop: 1.00 → 1.08 → 1.00, spring d12 k180 (~450 ms). */
export const SUCCESS_SPRING: SpringParams = { stiffness: 180, damping: 12 };
/** Attention pop: 1.10, the same curve 1.5× faster (≤ 400 ms). */
export const ATTENTION_SPRING: SpringParams = { stiffness: 180 * 2.25, damping: 12 * 1.5 };

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const k = Math.min(Math.max(t, 0), 1);
  return (
    '#' +
    A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('')
  ).toUpperCase();
}

/** Face edge: secondary.main shaded 12% toward black. */
export const FACE_EDGE = mixHex(T.face, '#000000', 0.12);

/**
 * Sweep-gradient stops by angle (deg, 0 = top, clockwise). The highlight sits
 * top-right, ~25% of the ring, as in the approved prototype.
 */
export const RING_STOPS: readonly [number, string][] = [
  [0, T.ringLight],
  [45, T.ringHighlight],
  [95, T.ringLight],
  [185, T.ringMain],
  [290, T.ringMain],
  [360, T.ringLight],
];

export function ringColorAt(angle: number): string {
  const a = ((angle % 360) + 360) % 360;
  for (let i = 0; i < RING_STOPS.length - 1; i++) {
    const [a0, c0] = RING_STOPS[i];
    const [a1, c1] = RING_STOPS[i + 1];
    if (a >= a0 && a <= a1) return mixHex(c0, c1, (a - a0) / (a1 - a0));
  }
  return T.ringLight;
}

const fmt = (n: number) => +n.toFixed(3);

/** Point at `angle` (deg, 0 = top, clockwise) and radius `r` around (cx, cy). */
export function polar(angle: number, r: number, cx = CX, cy = CY): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

export type Wedge = { d: string; fill: string };

/**
 * The sweep gradient as `count` wedges (SVG / react-native-svg have no conic
 * gradient). Wedges overlap by 0.4° to hide seams, as in the prototype.
 */
export function buildRingWedges(count: number, cx: number, cy: number, r: number): Wedge[] {
  const step = 360 / count;
  const out: Wedge[] = [];
  for (let i = 0; i < count; i++) {
    const a = i * step;
    const [x0, y0] = polar(a - 0.4, r, cx, cy);
    const [x1, y1] = polar(a + step + 0.4, r, cx, cy);
    out.push({
      d: `M${cx} ${cy}L${fmt(x0)} ${fmt(y0)}L${fmt(x1)} ${fmt(y1)}Z`,
      fill: ringColorAt(a + step / 2),
    });
  }
  return out;
}

/** Fewer wedges on small characters: no visible banding, fewer SVG nodes. */
export function wedgeCountForSize(size: number): number {
  if (size >= 96) return 120;
  if (size >= 44) return 72;
  if (size >= 36) return 48;
  return 32;
}

export type SweepWedge = Wedge & { opacity: number };

/**
 * Responding highlight sweep: bright head at 0°, feathered lead (+12°) and a
 * long decaying tail back to −150° (prototype `sw` group).
 */
export function buildSweepWedges(cx: number, cy: number, r: number): SweepWedge[] {
  const out: SweepWedge[] = [];
  for (let a = 12; a > -150; a -= 2.5) {
    const lead = a > 0 ? 1 - a / 12 : 1;
    const tail = a <= 0 ? Math.pow(1 + a / 150, 2.2) : 1;
    const k = lead * tail;
    const [x0, y0] = polar(a - 2.5 - 0.3, r, cx, cy);
    const [x1, y1] = polar(a + 0.3, r, cx, cy);
    out.push({
      d: `M${cx} ${cy}L${fmt(x0)} ${fmt(y0)}L${fmt(x1)} ${fmt(y1)}Z`,
      fill: mixHex(T.ringHighlight, '#FFFFFF', Math.min(1, k * k * 0.75)),
      opacity: fmt(0.95 * k),
    });
  }
  return out;
}

/** Halo alpha range: 16–28% on light surfaces, 30–45% in dark mode. */
export function haloAlphaRange(dark: boolean): [number, number] {
  return dark ? [0.3, 0.45] : [0.16, 0.28];
}

export function haloColor(dark: boolean): string {
  return dark ? T.haloDark : T.haloLight;
}

/** Sparkle fills alternate core/light (light mode) or light/tint (dark). */
export function sparkleColor(index: number, dark: boolean): string {
  if (dark) return index % 2 ? T.ringHighlight : T.sparkleLight;
  return index % 2 ? T.sparkleLight : T.sparkleCore;
}

/** Six sparkles at 30°, 90°, … 330°. */
export const SPARKLE_ANGLES: readonly number[] = [30, 90, 150, 210, 270, 330];

/**
 * Sparkle start/end centre (viewBox units): from just outside the ring,
 * travelling outward 14% of the height.
 */
export function sparklePath(angle: number): { from: [number, number]; to: [number, number] } {
  const rad = (angle * Math.PI) / 180;
  const ux = Math.sin(rad);
  const uy = -Math.cos(rad);
  const ex = RING.rx + RING.stroke / 2 + 3;
  const ey = RING.ry + RING.stroke / 2 + 3;
  return {
    from: [CX + ux * ex, CY + uy * ey],
    to: [CX + ux * (ex + 14), CY + uy * (ey + 14)],
  };
}

// ---------------------------------------------------------------------------
// Curve sampling: native-driver interpolations are piecewise linear, so eased
// curves are sampled into input/output ranges.
// ---------------------------------------------------------------------------

export function sampleCurve(
  fn: (p: number) => number,
  points: number,
  from = 0,
  to = 1
): { inputRange: number[]; outputRange: number[] } {
  const n = Math.max(2, Math.floor(points));
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1);
    inputRange.push(fmt(from + (to - from) * p));
    outputRange.push(fmt(fn(p)));
  }
  return { inputRange, outputRange };
}

export const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
export const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

/** Ring overlay drawn as a circle then squashed: x-scale that maps r46 → rx37. */
export const RING_SQUASH_X = RING.rx / RING.ry;
/**
 * Stroke of the rotating overlay in circle space. After the x-squash it is
 * 6.1 wide at the sides and 7.6 at top/bottom, within ±0.45 of the exact
 * 7-wide ring drawn underneath.
 */
export const RING_OVERLAY_STROKE = 7.6;

/** Annulus segments (no masks needed) for the rotating sweep gradient. */
export function buildRingSegments(
  count: number,
  cx: number,
  cy: number,
  rMid: number,
  stroke: number
): Wedge[] {
  const step = 360 / count;
  const rOut = rMid + stroke / 2;
  const rIn = rMid - stroke / 2;
  const out: Wedge[] = [];
  for (let i = 0; i < count; i++) {
    const a0 = i * step - 0.4;
    const a1 = (i + 1) * step + 0.4;
    const [ox0, oy0] = polar(a0, rOut, cx, cy);
    const [ox1, oy1] = polar(a1, rOut, cx, cy);
    const [ix1, iy1] = polar(a1, rIn, cx, cy);
    const [ix0, iy0] = polar(a0, rIn, cx, cy);
    out.push({
      d: `M${fmt(ox0)} ${fmt(oy0)}L${fmt(ox1)} ${fmt(oy1)}L${fmt(ix1)} ${fmt(iy1)}L${fmt(ix0)} ${fmt(iy0)}Z`,
      fill: ringColorAt(i * step + step / 2),
    });
  }
  return out;
}

/** Sweep head + tail as annulus segments (same shape as buildSweepWedges). */
export function buildSweepSegments(
  cx: number,
  cy: number,
  rMid: number,
  stroke: number
): SweepWedge[] {
  const rOut = rMid + stroke / 2;
  const rIn = rMid - stroke / 2;
  return buildSweepWedges(cx, cy, rOut).map((w, i) => {
    const a = 12 - i * 2.5;
    const a0 = a - 2.5 - 0.3;
    const a1 = a + 0.3;
    const [ox0, oy0] = polar(a0, rOut, cx, cy);
    const [ox1, oy1] = polar(a1, rOut, cx, cy);
    const [ix1, iy1] = polar(a1, rIn, cx, cy);
    const [ix0, iy0] = polar(a0, rIn, cx, cy);
    return {
      ...w,
      d: `M${fmt(ox0)} ${fmt(oy0)}L${fmt(ox1)} ${fmt(oy1)}L${fmt(ix1)} ${fmt(iy1)}L${fmt(ix0)} ${fmt(iy0)}Z`,
    };
  });
}
