/**
 * Renda character model: geometry, eye levels, per-state motion config and
 * curve helpers. Pure (no React / RN imports) so vitest covers it. Geometry is
 * in the 0 0 82 100 viewBox and mirrors the web tokens
 * (`apps/frontend/src/components/assistant/rendaCharacterTokens.ts`).
 */
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

export const VIEWBOX_W = 82;
export const VIEWBOX_H = 100;
export const CX = 41;
export const CY = 50;
/** Width : height of the character (0.82). */
export const ASPECT = VIEWBOX_W / VIEWBOX_H;

/** The jelly blob: wider than tall, sitting low so accents fit above it. */
export const BLOB = { cx: 41, cy: 58, rx: 38, ry: 29 } as const;
/** Squash / sway pivot: the blob's base, so it settles like jelly. */
export const BLOB_BASE_Y = BLOB.cy + BLOB.ry;
export const EYE_X: readonly [number, number] = [32.5, 49.5];
export const EYE_Y = 54;
/** Pill eyes [width, height]; the dot level is chunkier so it reads at 20–35 px. */
export const EYE_PILL = [6, 12.6] as const;
export const EYE_DOT = [7, 10.4] as const;
export const ARC_EYE_STROKE = 3.6;
/** Thinking dots (cx, cy, r), rising toward the top-right. */
export const THINK_DOTS: readonly (readonly [number, number, number])[] = [
  [60, 22, 1.9],
  [67, 16, 2.4],
  [75, 9.5, 3],
];
/** Listening / responding signal ticks (x1, y1, x2, y2) and their pulse pivot. */
export const TICKS: readonly (readonly [number, number, number, number])[] = [
  [63, 25, 66, 19.5],
  [68.5, 28.5, 74.5, 25],
];
export const TICK_PIVOT = [62, 30] as const;
export const SHADOW = { cx: 41, cy: 95, rx: 24, ry: 3.4, opacity: 0.22 } as const;

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

/** Happy-arc eye centred on (x, y). */
export function arcEyePath(x: number, y = EYE_Y): string {
  return `M${x - 4.6} ${y + 2.2}Q${x} ${y - 5.2} ${x + 4.6} ${y + 2.2}`;
}

const fmt = (n: number) => +n.toFixed(3);

/** Silhouette sample points: squircle-ish dome, flatter base, a little lopsided. */
const SHAPE_N = 16;
function blobPoints(): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < SHAPE_N; i++) {
    const a = (i / SHAPE_N) * Math.PI * 2;
    const s = Math.sin(a);
    const c = -Math.cos(a);
    const ey = c > 0 ? 0.7 : 0.92;
    const lop = 1 + 0.035 * Math.sin(a + 2.3);
    pts.push([
      BLOB.cx + BLOB.rx * Math.sign(s) * Math.pow(Math.abs(s), 0.86) * lop,
      BLOB.cy + BLOB.ry * Math.sign(c) * Math.pow(Math.abs(c), ey) * lop,
    ]);
  }
  return pts;
}

/** Closed Catmull-Rom path through the blob points (same outline as web at rest). */
export function blobPath(): string {
  const p = blobPoints();
  const n = p.length;
  let d = `M${fmt(p[0][0])} ${fmt(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [a, b, c, e] = [p[(i + n - 1) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]];
    d += `C${fmt(b[0] + (c[0] - a[0]) / 6)} ${fmt(b[1] + (c[1] - a[1]) / 6)} `;
    d += `${fmt(c[0] - (e[0] - b[0]) / 6)} ${fmt(c[1] - (e[1] - b[1]) / 6)} ${fmt(c[0])} ${fmt(c[1])}`;
  }
  return `${d}Z`;
}

export const BLOB_PATH = blobPath();

// ---------------------------------------------------------------------------
// Motion config per state
// ---------------------------------------------------------------------------

export type RendaStateConfig = {
  eyes: 'arc' | 'open';
  /** Eye offset in viewBox units. */
  offset: readonly [number, number];
  /** Squash / stretch amplitude (scale delta). */
  amp: number;
  /** Squash period, ms. */
  period: number;
  /** Bob amplitude, viewBox units. */
  bob: number;
  /** Sway amplitude, degrees. */
  sway: number;
  /** Tempo of the bob / sway clock (1 = idle). */
  tempo: number;
  /** 0 = blue, 1 = violet. */
  tint: number;
  dots: boolean;
  ticks: boolean;
  /** Thinking: the eyes sweep up-left ↔ up-right. */
  scan: boolean;
  blink: boolean;
};

const BASE = { offset: [0, 0] as const, tint: 0, dots: false, ticks: false, scan: false, blink: false };

export const RENDA_STATE_CONFIG: Record<RendaCharacterState, RendaStateConfig> = {
  idle: { ...BASE, eyes: 'open', amp: 0.035, period: 2600, bob: 2, sway: 2.5, tempo: 1 },
  attentive: { ...BASE, eyes: 'open', amp: 0.03, period: 2200, bob: 1.6, sway: 1.6, tempo: 1.15, ticks: true, blink: true },
  listening: { ...BASE, eyes: 'open', offset: [0, 2], amp: 0.04, period: 1800, bob: 1.4, sway: 1.4, tempo: 1.25, ticks: true, blink: true },
  thinking: { ...BASE, eyes: 'open', offset: [2, -2], amp: 0.045, period: 1500, bob: 1.6, sway: 4.5, tempo: 1.6, tint: 1, dots: true, scan: true },
  responding: { ...BASE, eyes: 'arc', amp: 0.05, period: 1000, bob: 1.4, sway: 2, tempo: 1.8, ticks: true },
  success: { ...BASE, eyes: 'arc', amp: 0.03, period: 2400, bob: 2, sway: 2, tempo: 1.3 },
  attention: { ...BASE, eyes: 'open', amp: 0.03, period: 2200, bob: 1.8, sway: 2, tempo: 1.2, ticks: true },
};

export type RendaRenderMode = {
  /** false = fully static drawing (message avatar, badges). */
  animated: boolean;
  /** System "Reduce motion": no loops or one-shots; colour, accents and eyes still switch. */
  reducedMotion: boolean;
  /** Header avatar: a gentler idle; attentive/listening map to idle. */
  staticIdle?: boolean;
  /** Battery / settle pause: loops stop, eyes and colour keep their state. */
  paused?: boolean;
};

export type ResolvedRendaConfig = RendaStateConfig & {
  /** True when any continuous loop (squash, bob, sway, accents, scan) may run. */
  loops: boolean;
  /** True when one-shots (hop, sparkles, ripples, blink) may play. */
  oneShots: boolean;
};

const HEADER_IDLE: RendaStateConfig = { ...RENDA_STATE_CONFIG.idle, amp: 0.02, bob: 0.8, sway: 1 };
const STILL = { amp: 0, bob: 0, sway: 0, scan: false, blink: false, loops: false, oneShots: false };

/**
 * Effective config for a state under a render mode. Reduced motion and
 * `animated=false` freeze the body but keep the colour, accents, eye shape and
 * offset per state, so Thinking still reads without motion.
 */
export function resolveRendaConfig(
  state: RendaCharacterState,
  mode: RendaRenderMode
): ResolvedRendaConfig {
  let effective = state;
  if (mode.staticIdle && (state === 'attentive' || state === 'listening')) effective = 'idle';
  let cfg = RENDA_STATE_CONFIG[effective];
  if (mode.staticIdle && effective === 'idle') cfg = HEADER_IDLE;
  if (!mode.animated || mode.reducedMotion) return { ...cfg, ...STILL };
  const moving = cfg.amp > 0 || cfg.bob > 0 || cfg.sway > 0 || cfg.dots || cfg.ticks || cfg.scan;
  return {
    ...cfg,
    blink: cfg.blink && !mode.paused,
    loops: !mode.paused && moving,
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
  blink: 160,
  blinkMin: 4000,
  blinkMax: 7000,
  /** Bob / sway clock at tempo 1; the waves complete whole cycles per loop. */
  motionClock: 12_000,
  dotsCycle: 1250,
  tickBeat: 900,
  scanCycle: 2600,
  /** Colour / accent / amplitude easing. */
  tint: 260,
  accents: 220,
  amplitude: 500,
  sparkle: 950,
  sparkleStagger: 45,
  ripple: 750,
  rippleGap: 300,
  attentionEyesOpen: 1100,
  settleAfter: 20_000,
  settleEase: 320,
} as const;

/** Next blink delay, uniformly random in 4–7 s. `rand` is in [0, 1). */
export function nextBlinkDelay(rand: number): number {
  const r = Math.min(Math.max(rand, 0), 1);
  return RENDA_TIMING.blinkMin + r * (RENDA_TIMING.blinkMax - RENDA_TIMING.blinkMin);
}

const TAU = Math.PI * 2;

/**
 * Bob wave over one motion-clock loop (y, + = down, in [-1, 1]): layered sines
 * with whole cycles per loop so the native loop wraps seamlessly.
 */
export const bobWave = (p: number) => -(0.72 * Math.sin(TAU * 4 * p) + 0.28 * Math.sin(TAU * 7 * p + 1.3));
/** Sway wave (deg per unit amplitude, in [-1, 1]). */
export const swayWave = (p: number) => 0.7 * Math.sin(TAU * 2 * p + 0.5) + 0.3 * Math.sin(TAU * 5 * p + 2.2);
/** Thinking dot bounce (0..1) for dot `i` over one dots cycle. */
export const dotBounce = (i: number) => (p: number) => Math.max(0, Math.sin(TAU * p - i * 0.75));
/** Thinking eye scan over one scan cycle: x in [-3, 0] (dwelling at each side), y lift. */
const dwell = (s: number) => Math.sign(s) * Math.pow(Math.abs(s), 0.35);
export const scanX = (p: number) => -3 * (0.5 - 0.5 * dwell(Math.sin(TAU * p)));
export const scanY = (p: number) => -0.8 * Math.abs(dwell(Math.sin(TAU * p)));

// ---------------------------------------------------------------------------
// Springs: damped spring from rest with an initial velocity.
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

/** Jelly hop on state entry: soft, a little wobbly. */
export const HOP_SPRING: SpringParams = { stiffness: 170, damping: 11 };
/** Hop peak (scale delta) per state entered. */
export const HOP_PEAK: Record<RendaCharacterState, number> = {
  idle: 0.02,
  attentive: 0.03,
  listening: 0.035,
  thinking: 0.03,
  responding: 0.06,
  success: 0.09,
  attention: 0.1,
};

// ---------------------------------------------------------------------------
// One-shot geometry
// ---------------------------------------------------------------------------

/** Six success motes at 30°, 90°, … 330°. */
export const SPARKLE_ANGLES: readonly number[] = [30, 90, 150, 210, 270, 330];

/** Mote start / end centre (viewBox units): from the blob edge, outward and up. */
export function sparklePath(angle: number): { from: [number, number]; to: [number, number] } {
  const rad = (angle * Math.PI) / 180;
  const ux = Math.sin(rad);
  const uy = -Math.cos(rad);
  return {
    from: [fmt(BLOB.cx + ux * 40), fmt(BLOB.cy + uy * 31)],
    to: [fmt(BLOB.cx + ux * 52), fmt(BLOB.cy + uy * 43 - 4)],
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
