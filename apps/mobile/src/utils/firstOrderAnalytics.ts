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

export function trackFirstOrderReceived(meta: {
  order_id: string;
  fulfillment_method?: string | null;
  source: 'overlay' | 'dashboard' | 'detail';
}): void {
  AppEventsService.track({
    eventType: 'ftue.first_order.received',
    metadata: envelope(meta),
    subjectType: 'order',
    subjectId: meta.order_id,
  });
}

export function trackFirstOrderOpened(meta: {
  order_id: string;
  fulfillment_method?: string | null;
  status?: string | null;
}): void {
  AppEventsService.track({
    eventType: 'ftue.first_order.opened',
    metadata: envelope(meta),
    subjectType: 'order',
    subjectId: meta.order_id,
  });
}

export function trackFirstOrderStepViewed(meta: {
  order_id: string;
  step_id: string;
  status?: string | null;
}): void {
  AppEventsService.track({
    eventType: 'ftue.first_order.step_viewed',
    metadata: envelope(meta),
    subjectType: 'order',
    subjectId: meta.order_id,
  });
}

export function trackFirstOrderConfirmStarted(meta: { order_id: string }): void {
  AppEventsService.track({
    eventType: 'ftue.first_order.confirm_started',
    metadata: envelope(meta),
    subjectType: 'order',
    subjectId: meta.order_id,
  });
}

export function trackFirstOrderConfirmed(meta: { order_id: string }): void {
  AppEventsService.track({
    eventType: 'ftue.first_order.confirmed',
    metadata: envelope(meta),
    subjectType: 'order',
    subjectId: meta.order_id,
  });
}

export function trackFirstOrderReadyMarked(meta: { order_id: string }): void {
  AppEventsService.track({
    eventType: 'ftue.first_order.ready_marked',
    metadata: envelope(meta),
    subjectType: 'order',
    subjectId: meta.order_id,
  });
}

export function trackFirstOrderCompleted(meta: {
  order_id: string;
  minutes_to_complete?: number | null;
}): void {
  AppEventsService.track({
    eventType: 'ftue.first_order.completed',
    metadata: envelope(meta),
    subjectType: 'order',
    subjectId: meta.order_id,
  });
}

export function trackFirstOrderLost(meta: {
  order_id: string;
  terminal_status: string;
}): void {
  AppEventsService.track({
    eventType: 'ftue.first_order.lost',
    metadata: envelope(meta),
    subjectType: 'order',
    subjectId: meta.order_id,
  });
}
