import { AppEventsService } from '../services/analytics/AppEventsService';

export function trackDedicatedOpportunitiesViewed(count: number) {
  AppEventsService.track({
    eventType: 'dedicated_ui.opportunities_viewed',
    metadata: { count },
  });
}

export function trackDedicatedOpportunityOpened(postingId: string, storeName: string) {
  AppEventsService.track({
    eventType: 'dedicated_ui.opportunity_opened',
    metadata: { postingId, storeName },
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
