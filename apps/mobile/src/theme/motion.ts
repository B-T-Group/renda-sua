/**
 * Shared motion. Durations match the web theme (`themeUtils.transitions`).
 * Prefer these over ad-hoc timings. Respect reduce-motion at the call site.
 */
export const motion = {
  duration: {
    fast: 120,
    normal: 200,
    slow: 320,
  },
  /** cubic-bezier(0.2, 0, 0, 1) — a quiet ease-out, no bounce. */
  easing: [0.2, 0, 0, 1] as const,
} as const;

export type MotionSpeed = keyof typeof motion.duration;

export function motionDuration(speed: MotionSpeed, reduceMotion: boolean): number {
  return reduceMotion ? 0 : motion.duration[speed];
}
