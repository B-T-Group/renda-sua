/**
 * Decide whether a saved sub-region is still in the market-states list.
 * "QC" and "Quebec" count as the same state via normalizeStateCode, in either direction.
 */
import { normalizeStateCode } from './stateNormalizer';

export function isSavedStateInList(
  countryCode: string,
  savedState: string,
  knownStates: string[]
): boolean {
  if (!savedState) return false;
  const savedNorm = normalizeStateCode(countryCode, savedState, knownStates);
  const savedLower = savedState.toLowerCase();
  const savedNormLower = savedNorm.toLowerCase();
  return knownStates.some((name) => {
    if (!name) return false;
    if (name === savedState || name === savedNorm) return true;
    const nameLower = name.toLowerCase();
    if (nameLower === savedLower || nameLower === savedNormLower) return true;
    const nameNorm = normalizeStateCode(countryCode, name, knownStates);
    return nameNorm.toLowerCase() === savedNormLower;
  });
}

/**
 * Only clear a saved state once a market-states list has loaded successfully
 * and does not contain it. Do not treat the state as stale while the request
 * is in flight or after it failed (including a failed request that yields
 * an empty list).
 */
export function shouldClearMissingSavedState(opts: {
  countryCode: string;
  stateCode: string | null | undefined;
  loaded: boolean;
  loading: boolean;
  loadFailed: boolean;
  knownStates: string[];
}): boolean {
  if (!opts.stateCode) return false;
  if (!opts.loaded || opts.loading || opts.loadFailed) return false;
  return !isSavedStateInList(opts.countryCode, opts.stateCode, opts.knownStates);
}
