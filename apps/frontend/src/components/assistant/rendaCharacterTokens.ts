/**
 * Renda character geometry and colours (viewBox 0 0 82 100), shared by the animated
 * engine and the static avatar. Kept free of the engine so the header (main bundle)
 * and message avatars never pull in the rAF engine. Mirrors the mobile model
 * (`apps/mobile/src/components/assistant/renda/rendaCharacterModel.ts`).
 */
export type RendaEyes = 'expressive' | 'dot' | 'none';

/** Expressive eyes need >= 36 px of character height, dots 20-35 px, none below 20. */
export function eyesForSize(size: number): RendaEyes {
  if (size >= 36) return 'expressive';
  if (size >= 20) return 'dot';
  return 'none';
}

export const RENDA_WIDTH_RATIO = 0.82;
export const CX = 41;
export const CY = 50;

/** The jelly blob: wider than tall, sitting low so accents fit above it. */
export const BLOB = { cx: 41, cy: 58, rx: 38, ry: 29 } as const;
/** Squash / stretch pivot: the blob's base, so it settles like jelly. */
export const BLOB_BASE_Y = BLOB.cy + BLOB.ry;

export const EYE_X = [32.5, 49.5] as const;
export const EYE_Y = 54;
/** Pill eyes [width, height]; the dot level is chunkier so it reads at 20–35 px. */
export const EYE_PILL = [6, 12.6] as const;
export const EYE_DOT = [7, 10.4] as const;
export const ARC_STROKE = 3.6;

/** Solid colours only (no gradients). */
export const RENDA_COLORS = {
  blue: '#2F6BFF',
  violet: '#8B5CF6',
  mote: '#8FB4FF',
  eye: '#FFFFFF',
  highlight: '#FFFFFF',
} as const;

/** Thinking dots (cx, cy, r), rising toward the top-right. */
export const THINK_DOTS = [
  [60, 22, 1.9],
  [67, 16, 2.4],
  [75, 9.5, 3],
] as const;
/** Listening / responding signal ticks (x1, y1, x2, y2). */
export const TICKS = [
  [63, 25, 66, 19.5],
  [68.5, 28.5, 74.5, 25],
] as const;
export const TICK_PIVOT = [62, 30] as const;

/** Silhouette sample points (closed Catmull-Rom). */
export const SHAPE_N = 16;
const SX = new Float64Array(SHAPE_N);
const SY = new Float64Array(SHAPE_N);
for (let i = 0; i < SHAPE_N; i++) {
  const a = (i / SHAPE_N) * Math.PI * 2;
  const s = Math.sin(a);
  const c = -Math.cos(a);
  // Squircle-ish jelly: rounder dome, flatter base, a little lopsided.
  const ey = c > 0 ? 0.7 : 0.92;
  const lop = 1 + 0.035 * Math.sin(a + 2.3);
  SX[i] = Math.sign(s) * Math.pow(Math.abs(s), 0.86) * lop;
  SY[i] = Math.sign(c) * Math.pow(Math.abs(c), ey) * lop;
}
/** Angle of point i, measured clockwise from the top. */
export const shapeAngle = (i: number) => (i / SHAPE_N) * Math.PI * 2;
/** Vertical position of point i in [-1 top, 1 bottom]. */
export const shapeY = (i: number) => SY[i];

const PX = new Float64Array(SHAPE_N);
const PY = new Float64Array(SHAPE_N);
const f2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Closed smooth path for the blob. `dyn[i]` is an extra radial factor per point
 * (organic wobble); omit it for the resting silhouette.
 */
export function rendaShapePath(dyn?: ArrayLike<number>): string {
  for (let i = 0; i < SHAPE_N; i++) {
    const r = 1 + (dyn ? dyn[i] : 0);
    PX[i] = BLOB.cx + BLOB.rx * SX[i] * r;
    PY[i] = BLOB.cy + BLOB.ry * SY[i] * r;
  }
  let d = `M${f2(PX[0])} ${f2(PY[0])}`;
  for (let i = 0; i < SHAPE_N; i++) {
    const p = (i + SHAPE_N - 1) % SHAPE_N;
    const n = (i + 1) % SHAPE_N;
    const nn = (i + 2) % SHAPE_N;
    d += `C${f2(PX[i] + (PX[n] - PX[p]) / 6)} ${f2(PY[i] + (PY[n] - PY[p]) / 6)} ${f2(
      PX[n] - (PX[nn] - PX[i]) / 6
    )} ${f2(PY[n] - (PY[nn] - PY[i]) / 6)} ${f2(PX[n])} ${f2(PY[n])}`;
  }
  return `${d}Z`;
}

export const RENDA_REST_PATH = rendaShapePath();

/** Happy-arc eye path centred on `x`. */
export const eyeArcPath = (x: number) =>
  `M${x - 4.6} ${EYE_Y + 2.2}Q${x} ${EYE_Y - 5.2} ${x + 4.6} ${EYE_Y + 2.2}`;

/** Mix two `#rrggbb` colours (t in [0, 1]). */
export function mixHex(a: string, b: string, t: number): string {
  let out = '#';
  for (let i = 1; i < 7; i += 2) {
    const x = parseInt(a.slice(i, i + 2), 16);
    const y = parseInt(b.slice(i, i + 2), 16);
    out += Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  }
  return out;
}
