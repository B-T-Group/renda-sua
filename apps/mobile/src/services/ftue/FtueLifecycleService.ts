/**
 * Client helpers for FTUE lifecycle personalization.
 * Re-engagement pushes are server-driven; this module only exposes the payload
 * shapes and local promo-slide merge used by the hero carousel.
 */

export type LifecyclePromoSlide = {
  id: string;
  title: string;
  ctaLabel: string;
  deepLink?: string;
  countryCodes?: string[];
  startsAt?: string;
  endsAt?: string;
};

export type FtueServerSyncPayload = {
  onboarding_version: number;
  persona_intent: string | null;
  completed_at: string | null;
};

/** Filter seasonal/location promo slides for the current market. */
export function filterActivePromoSlides(
  slides: LifecyclePromoSlide[],
  countryCode: string,
  now = new Date()
): LifecyclePromoSlide[] {
  const code = countryCode.toUpperCase();
  return slides.filter((s) => {
    if (s.countryCodes?.length && !s.countryCodes.map((c) => c.toUpperCase()).includes(code)) {
      return false;
    }
    if (s.startsAt && new Date(s.startsAt) > now) return false;
    if (s.endsAt && new Date(s.endsAt) < now) return false;
    return true;
  });
}

/**
 * Optional sync of local FTUE state for CRM segmentation.
 * Uses site-events so no new schema is required; failures are swallowed.
 */
export async function syncFtueStateToServer(
  track: (input: {
    eventType: string;
    metadata?: Record<string, unknown>;
  }) => void,
  payload: FtueServerSyncPayload
): Promise<boolean> {
  try {
    track({
      eventType: 'ftue.persona_intent.changed',
      metadata: {
        source: 'server_sync',
        onboarding_version: payload.onboarding_version,
        persona_intent: payload.persona_intent,
        completed_at: payload.completed_at,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export const FtueLifecycleService = {
  filterActivePromoSlides,
  syncFtueStateToServer,
};
