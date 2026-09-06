import { ONBOARDING_VERSION } from '../constants/onboarding';
import { AppEventsService } from '../services/analytics/AppEventsService';
import { isFirstOrderGuidanceForced } from '../config/firstOrderDebug';
import { getExperimentVariant } from './ftueExperiments';

type Envelope = Record<string, unknown>;

function envelope(extra: Envelope = {}): Envelope {
  return {
    onboarding_version: ONBOARDING_VERSION,
    variant: getExperimentVariant('ftue_skip_timing_v1'),
    platform: 'mobile',
    debug: isFirstOrderGuidanceForced(),
    ...extra,
  };
}

export function trackFirstOrderClientPlaced(meta: {
  fulfillment_method?: string | null;
}): void {
  AppEventsService.track({
    eventType: 'ftue.first_order_client.placed',
    metadata: envelope(meta),
    subjectType: 'order',
  });
}

export function trackFirstOrderClientOpened(meta: {
  order_id: string;
  fulfillment_method?: string | null;
  status?: string | null;
}): void {
  AppEventsService.track({
    eventType: 'ftue.first_order_client.opened',
    metadata: envelope(meta),
    subjectType: 'order',
    subjectId: meta.order_id,
  });
}

export function trackFirstOrderClientStepViewed(meta: {
  order_id: string;
  step_id: string;
  status?: string | null;
}): void {
  AppEventsService.track({
    eventType: 'ftue.first_order_client.step_viewed',
    metadata: envelope(meta),
    subjectType: 'order',
    subjectId: meta.order_id,
  });
}

export function trackFirstOrderClientCompleted(meta: {
  order_id: string;
  minutes_to_complete?: number | null;
}): void {
  AppEventsService.track({
    eventType: 'ftue.first_order_client.completed',
    metadata: envelope(meta),
    subjectType: 'order',
    subjectId: meta.order_id,
  });
}

export function trackFirstOrderClientLost(meta: {
  order_id: string;
  terminal_status: string;
}): void {
  AppEventsService.track({
    eventType: 'ftue.first_order_client.lost',
    metadata: envelope(meta),
    subjectType: 'order',
    subjectId: meta.order_id,
  });
}
