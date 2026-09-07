/**
 * Site analytics client — posts to Nest `POST /track-site-event`.
 * Fire-and-forget; never throws to callers.
 */

import { Platform } from 'react-native';
import { publicApiPost } from '../publicApiClient';
import { api } from '../apiClient';
import { getOrCreateRsAnonymousId } from '../../utils/rsAnonymousId';
import Auth0DirectService from '../auth0DirectService';

export type SiteEventType = string;

export type TrackSiteEventInput = {
  eventType: SiteEventType;
  metadata?: Record<string, unknown>;
  subjectType?: string;
  subjectId?: string;
};

async function postTrackSiteEvent(body: TrackSiteEventInput): Promise<void> {
  const headers: Record<string, string> = {
    'x-rendasua-platform': Platform.OS,
  };
  const token = await Auth0DirectService.getAccessToken().catch(() => null);
  if (token) {
    await api.post('/track-site-event', body, { headers });
    return;
  }
  const anonId = await getOrCreateRsAnonymousId();
  await publicApiPost('/track-site-event', body, {
    headers: { ...headers, 'X-Anonymous-Id': anonId },
  });
}

export function trackSiteEvent(input: TrackSiteEventInput): void {
  void postTrackSiteEvent(input).catch(() => {
    // analytics errors must never surface to the user
  });
}

export const AppEventsService = {
  track: trackSiteEvent,
};

export default AppEventsService;
