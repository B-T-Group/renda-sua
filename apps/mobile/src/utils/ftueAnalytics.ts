import { ONBOARDING_VERSION, type OnboardingScreenId, type PersonaIntent } from '../constants/onboarding';
import { AppEventsService } from '../services/analytics/AppEventsService';
import { getExperimentVariant } from './ftueExperiments';

type FtueEnvelope = {
  onboarding_version: number;
  persona_intent?: PersonaIntent | null;
  country_code?: string | null;
  variant?: string | null;
  source?: string | null;
};

function envelope(extra: Record<string, unknown> = {}, base: FtueEnvelope = {
  onboarding_version: ONBOARDING_VERSION,
}): Record<string, unknown> {
  return {
    ...base,
    variant: base.variant ?? getExperimentVariant('ftue_skip_timing_v1'),
    platform: 'mobile',
    ...extra,
  };
}

export function trackOnboardingStarted(meta?: {
  persona_intent?: PersonaIntent | null;
  country_code?: string | null;
}): void {
  AppEventsService.track({
    eventType: 'ftue.onboarding.started',
    metadata: envelope({}, { onboarding_version: ONBOARDING_VERSION, ...meta }),
  });
}

export function trackOnboardingScreenViewed(
  screenId: OnboardingScreenId,
  screenIndex: number,
  meta?: { persona_intent?: PersonaIntent | null; country_code?: string | null }
): void {
  AppEventsService.track({
    eventType: 'ftue.onboarding.screen_viewed',
    metadata: envelope(
      { screen_id: screenId, screen_index: screenIndex },
      { onboarding_version: ONBOARDING_VERSION, ...meta }
    ),
  });
}

export function trackOnboardingSkipped(
  fromScreen: OnboardingScreenId,
  meta?: { persona_intent?: PersonaIntent | null; country_code?: string | null }
): void {
  AppEventsService.track({
    eventType: 'ftue.onboarding.skipped',
    metadata: envelope(
      { from_screen: fromScreen },
      { onboarding_version: ONBOARDING_VERSION, ...meta }
    ),
  });
}

export function trackOnboardingCompleted(meta?: {
  persona_intent?: PersonaIntent | null;
  country_code?: string | null;
  outcome?: 'completed' | 'skipped';
}): void {
  AppEventsService.track({
    eventType: 'ftue.onboarding.completed',
    metadata: envelope({}, { onboarding_version: ONBOARDING_VERSION, ...meta }),
  });
}

export function trackPersonaIntentSelected(
  personaIntent: PersonaIntent,
  meta?: { country_code?: string | null; source?: string }
): void {
  AppEventsService.track({
    eventType: 'ftue.persona_intent.selected',
    metadata: envelope(
      {},
      {
        onboarding_version: ONBOARDING_VERSION,
        persona_intent: personaIntent,
        country_code: meta?.country_code,
        source: meta?.source ?? 'onboarding',
      }
    ),
  });
}

export function trackPersonaIntentChanged(personaIntent: PersonaIntent): void {
  AppEventsService.track({
    eventType: 'ftue.persona_intent.changed',
    metadata: envelope({}, {
      onboarding_version: ONBOARDING_VERSION,
      persona_intent: personaIntent,
    }),
  });
}

const seenHeroSlideIds = new Set<string>();

export function trackHeroSlideViewed(
  slideId: string,
  position: number,
  meta?: { persona_intent?: PersonaIntent | null }
): void {
  if (seenHeroSlideIds.has(slideId)) return;
  seenHeroSlideIds.add(slideId);
  AppEventsService.track({
    eventType: 'ftue.hero.slide_viewed',
    metadata: envelope(
      { slide_id: slideId, position },
      { onboarding_version: ONBOARDING_VERSION, persona_intent: meta?.persona_intent }
    ),
  });
}

/** Clears in-session hero slide tracking (tests only). */
export function resetHeroSlideViewTracking(): void {
  seenHeroSlideIds.clear();
}

export function trackHeroCtaClicked(
  slideId: string,
  meta?: { persona_intent?: PersonaIntent | null }
): void {
  AppEventsService.track({
    eventType: 'ftue.hero.cta_clicked',
    metadata: envelope(
      { slide_id: slideId },
      { onboarding_version: ONBOARDING_VERSION, persona_intent: meta?.persona_intent }
    ),
  });
}

export function trackNudgeShown(nudgeId: string): void {
  AppEventsService.track({
    eventType: 'ftue.nudge.shown',
    metadata: envelope({ nudge_id: nudgeId }),
  });
}

export function trackNudgeClicked(nudgeId: string): void {
  AppEventsService.track({
    eventType: 'ftue.nudge.clicked',
    metadata: envelope({ nudge_id: nudgeId }),
  });
}

export function trackNudgeDismissed(nudgeId: string): void {
  AppEventsService.track({
    eventType: 'ftue.nudge.dismissed',
    metadata: envelope({ nudge_id: nudgeId }),
  });
}

export function trackChecklistViewed(persona: string): void {
  AppEventsService.track({
    eventType: 'ftue.checklist.viewed',
    metadata: envelope({ persona }),
  });
}

export function trackChecklistStepCompleted(
  persona: string,
  stepId: string
): void {
  AppEventsService.track({
    eventType: 'ftue.checklist.step_completed',
    metadata: envelope({ persona, step_id: stepId }),
  });
}

export function trackSignupStarted(meta: {
  source: string;
  persona?: string | null;
}): void {
  AppEventsService.track({
    eventType: 'ftue.signup.started',
    metadata: envelope({
      source: meta.source,
      persona: meta.persona,
    }),
  });
}

export function trackSignupCompleted(meta: {
  source: string;
  persona?: string | null;
}): void {
  AppEventsService.track({
    eventType: 'ftue.signup.completed',
    metadata: envelope({
      source: meta.source,
      persona: meta.persona,
    }),
  });
}

export function trackBrowseSessionStarted(): void {
  AppEventsService.track({
    eventType: 'ftue.browse.session_started',
    metadata: envelope(),
  });
}

export function trackBrowseProductViewed(inventoryItemId: string): void {
  const looksUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      inventoryItemId
    );
  AppEventsService.track({
    eventType: 'ftue.browse.product_viewed',
    metadata: envelope({ inventory_item_id: inventoryItemId }),
    ...(looksUuid
      ? { subjectType: 'inventory_item', subjectId: inventoryItemId }
      : {}),
  });
}
