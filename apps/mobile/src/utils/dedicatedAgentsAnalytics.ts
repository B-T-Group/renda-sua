/**
 * Dedicated agents analytics events (§7 in the spec).
 * Fire-and-forget — errors are silently swallowed so they never affect UX.
 */

import { Platform } from 'react-native';
import { AppEventsService } from '../services/analytics/AppEventsService';

export type DedicatedAgentsEventName =
  | 'section_viewed'
  | 'slot_toggled'
  | 'pickup_time_changed'
  | 'agent_paused'
  | 'agent_resumed'
  | 'agent_removed'
  | 'posting_form_opened'
  | 'posting_created'
  | 'posting_closed'
  | 'posting_terms_edited'
  | 'applicants_viewed'
  | 'applicant_accepted'
  | 'applicant_declined'
  | 'action_conflict';

const EVENT_TYPE_MAP: Record<DedicatedAgentsEventName, string> = {
  section_viewed: 'dedicated_ui.section_viewed',
  slot_toggled: 'dedicated_ui.slot_toggled',
  pickup_time_changed: 'dedicated_ui.pickup_time_changed',
  agent_paused: 'dedicated_ui.agent_paused',
  agent_resumed: 'dedicated_ui.agent_resumed',
  agent_removed: 'dedicated_ui.agent_removed',
  posting_form_opened: 'dedicated_ui.posting_form_opened',
  posting_created: 'dedicated_ui.posting_created',
  posting_closed: 'dedicated_ui.posting_closed',
  posting_terms_edited: 'dedicated_ui.posting_terms_edited',
  applicants_viewed: 'dedicated_ui.applicants_viewed',
  applicant_accepted: 'dedicated_ui.applicant_accepted',
  applicant_declined: 'dedicated_ui.applicant_declined',
  action_conflict: 'dedicated_ui.action_conflict',
};

export function trackDedicatedAgentsEvent(
  event: DedicatedAgentsEventName,
  properties?: Record<string, unknown>
): void {
  AppEventsService.track({
    eventType: EVENT_TYPE_MAP[event],
    metadata: {
      ...properties,
      platform: Platform.OS,
    },
  });
}

export function trackDedicatedOpportunitiesViewed(count: number) {
  AppEventsService.track({
    eventType: 'dedicated_ui.opportunities_viewed',
    metadata: { count },
  });
}

export function trackDedicatedOpportunityOpened(postingId: string, source: 'hub' | 'deeplink' | 'push') {
  AppEventsService.track({
    eventType: 'dedicated_ui.opportunity_opened',
    metadata: { postingId, source },
  });
}

export function trackDedicatedApplyTapped(postingId: string) {
  AppEventsService.track({
    eventType: 'dedicated_ui.apply_tapped',
    metadata: { postingId },
  });
}

export function trackDedicatedApplySucceeded(postingId: string, storeName: string) {
  AppEventsService.track({
    eventType: 'dedicated_ui.apply_succeeded',
    metadata: { postingId, storeName },
  });
}

export function trackDedicatedPhotoGateShown(reason: string) {
  AppEventsService.track({
    eventType: 'dedicated_ui.photo_gate_shown',
    metadata: { reason },
  });
}

export function trackDedicatedPhotoGateCameraOpened() {
  AppEventsService.track({
    eventType: 'dedicated_ui.photo_gate_camera_opened',
  });
}

export function trackDedicatedPhotoGateGalleryOpened() {
  AppEventsService.track({
    eventType: 'dedicated_ui.photo_gate_gallery_opened',
  });
}

export function trackDedicatedPhotoGateCompleted() {
  AppEventsService.track({
    eventType: 'dedicated_ui.photo_gate_completed',
  });
}

export function trackDedicatedApplicationWithdrawn(postingId: string) {
  AppEventsService.track({
    eventType: 'dedicated_ui.application_withdrawn',
    metadata: { postingId },
  });
}

export function trackDedicatedMyStoresViewed(count: number) {
  AppEventsService.track({
    eventType: 'dedicated_ui.my_stores_viewed',
    metadata: { count },
  });
}

export function trackDedicatedOffTodayToggled(postingId: string, isOffToday: boolean) {
  AppEventsService.track({
    eventType: 'dedicated_ui.off_today_toggled',
    metadata: { postingId, isOffToday },
  });
}

export function trackDedicatedActionConflict(action: string, reason: string) {
  AppEventsService.track({
    eventType: 'dedicated_ui.action_conflict',
    metadata: { action, reason },
  });
}

export function trackDedicatedAgentGateShown(reason: string) {
  AppEventsService.track({
    eventType: 'dedicated_ui.agent_gate_shown',
    metadata: { reason },
  });
}

export function trackDedicatedAgentGateDismissed(reason: string) {
  AppEventsService.track({
    eventType: 'dedicated_ui.agent_gate_dismissed',
    metadata: { reason },
  });
}
