export interface DispatchRadiusInput {
  /** Dispatch round: 1 = closest agents, 2 = escalated (wide) radius. */
  round: number;
  /** Country `delivery_availability_radius_km` (the checkout radius). */
  countryRadiusKm: number;
  /** `orderOffers.round1RadiusKm`; null/invalid falls back to the country radius. */
  round1RadiusKm?: number | null;
  /** `orderOffers.round2RadiusKm`; null/invalid falls back to round 1. */
  round2RadiusKm?: number | null;
}

function positiveOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/**
 * Search radius for a dispatch round. Round 1 uses `round1RadiusKm` (default:
 * the country checkout radius). Round 2 uses `round2RadiusKm` (default: the
 * round 1 radius, i.e. no widening) and is never narrower than round 1.
 */
export function resolveDispatchRadiusKm(input: DispatchRadiusInput): number {
  const round1 =
    positiveOrNull(input.round1RadiusKm) ?? input.countryRadiusKm;
  if (input.round < 2) return round1;
  const round2 = positiveOrNull(input.round2RadiusKm) ?? round1;
  return Math.max(round1, round2);
}
