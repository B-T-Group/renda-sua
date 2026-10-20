import { useCallback } from 'react';
import { useTrackSiteEvent } from './useTrackSiteEvent';

// Dedicated agents analytics event types (§7 in the spec)
export const SITE_EVENT_DEDICATED_SECTION_VIEWED = 'dedicated_ui.section_viewed' as const;
export const SITE_EVENT_DEDICATED_SLOT_TOGGLED = 'dedicated_ui.slot_toggled' as const;
export const SITE_EVENT_DEDICATED_PICKUP_TIME_CHANGED = 'dedicated_ui.pickup_time_changed' as const;
export const SITE_EVENT_DEDICATED_AGENT_PAUSED = 'dedicated_ui.agent_paused' as const;
export const SITE_EVENT_DEDICATED_AGENT_RESUMED = 'dedicated_ui.agent_resumed' as const;
export const SITE_EVENT_DEDICATED_AGENT_REMOVED = 'dedicated_ui.agent_removed' as const;
export const SITE_EVENT_DEDICATED_POSTING_FORM_OPENED = 'dedicated_ui.posting_form_opened' as const;
export const SITE_EVENT_DEDICATED_POSTING_CREATED = 'dedicated_ui.posting_created' as const;
export const SITE_EVENT_DEDICATED_POSTING_CLOSED = 'dedicated_ui.posting_closed' as const;
export const SITE_EVENT_DEDICATED_POSTING_TERMS_EDITED = 'dedicated_ui.posting_terms_edited' as const;
export const SITE_EVENT_DEDICATED_APPLICANTS_VIEWED = 'dedicated_ui.applicants_viewed' as const;
export const SITE_EVENT_DEDICATED_APPLICANT_ACCEPTED = 'dedicated_ui.applicant_accepted' as const;
export const SITE_EVENT_DEDICATED_APPLICANT_DECLINED = 'dedicated_ui.applicant_declined' as const;
export const SITE_EVENT_DEDICATED_ACTION_CONFLICT = 'dedicated_ui.action_conflict' as const;

type DedicatedAgentsEventType =
  | typeof SITE_EVENT_DEDICATED_SECTION_VIEWED
  | typeof SITE_EVENT_DEDICATED_SLOT_TOGGLED
  | typeof SITE_EVENT_DEDICATED_PICKUP_TIME_CHANGED
  | typeof SITE_EVENT_DEDICATED_AGENT_PAUSED
  | typeof SITE_EVENT_DEDICATED_AGENT_RESUMED
  | typeof SITE_EVENT_DEDICATED_AGENT_REMOVED
  | typeof SITE_EVENT_DEDICATED_POSTING_FORM_OPENED
  | typeof SITE_EVENT_DEDICATED_POSTING_CREATED
  | typeof SITE_EVENT_DEDICATED_POSTING_CLOSED
  | typeof SITE_EVENT_DEDICATED_POSTING_TERMS_EDITED
  | typeof SITE_EVENT_DEDICATED_APPLICANTS_VIEWED
  | typeof SITE_EVENT_DEDICATED_APPLICANT_ACCEPTED
  | typeof SITE_EVENT_DEDICATED_APPLICANT_DECLINED
  | typeof SITE_EVENT_DEDICATED_ACTION_CONFLICT;

interface DedicatedAgentsAnalyticsPayload {
  eventType: DedicatedAgentsEventType;
  metadata?: Record<string, unknown>;
}

export function useDedicatedAgentsAnalytics() {
  const { trackSiteEvent } = useTrackSiteEvent();

  const track = useCallback(
    (eventType: DedicatedAgentsEventType, metadata: Record<string, unknown> = {}) => {
      const payload: DedicatedAgentsAnalyticsPayload = {
        eventType,
        metadata: {
          ...metadata,
          platform: 'web',
        },
      };
      trackSiteEvent(payload);
    },
    [trackSiteEvent]
  );

  return { track };
}
