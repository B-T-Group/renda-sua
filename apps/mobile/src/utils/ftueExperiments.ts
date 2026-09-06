/**
 * Deterministic local A/B bucketing from the install anonymous id.
 * No remote config — variants are stamped on analytics events.
 */

import { EXPERIMENT_SKIP_TIMING } from '../constants/onboarding';
import { getOrCreateRsAnonymousId } from './rsAnonymousId';

type ExperimentKey = typeof EXPERIMENT_SKIP_TIMING | string;

const cache = new Map<string, string>();

function hashToBucket(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h % 100;
}

/** Synchronous read of a previously resolved variant (or null). */
export function getExperimentVariant(experiment: ExperimentKey): string | null {
  return cache.get(experiment) ?? null;
}

/**
 * Resolves and caches a 50/50 A/B variant for the given experiment.
 * Call once during FTUE hydrate / first onboarding show.
 */
export async function resolveExperimentVariant(
  experiment: ExperimentKey,
  variants: [string, string] = ['control', 'treatment']
): Promise<string> {
  const cached = cache.get(experiment);
  if (cached) return cached;
  const anonId = await getOrCreateRsAnonymousId();
  const bucket = hashToBucket(`${experiment}:${anonId}`);
  const variant = bucket < 50 ? variants[0] : variants[1];
  cache.set(experiment, variant);
  return variant;
}

/** Skip button: control = immediate; treatment = after first slide. */
export async function resolveSkipTimingVariant(): Promise<'immediate' | 'after_slide_1'> {
  const v = await resolveExperimentVariant(EXPERIMENT_SKIP_TIMING, [
    'immediate',
    'after_slide_1',
  ]);
  return v === 'after_slide_1' ? 'after_slide_1' : 'immediate';
}
