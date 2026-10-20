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

type DedicatedAgentsEventName =
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

const EVENT_TYPE_MAP: Record<DedicatedAgentsEventName, typeof SITE_EVENT_DEDICATED_SECTION_VIEWED | typeof SITE_EVENT_DEDICATED_SLOT_TOGGLED | typeof SITE_EVENT_DEDICATED_PICKUP_TIME_CHANGED | typeof SITE_EVENT_DEDICATED_AGENT_PAUSED | typeof SITE_EVENT_DEDICATED_AGENT_RESUMED | typeof SITE_EVENT_DEDICATED_AGENT_REMOVED | typeof SITE_EVENT_DEDICATED_POSTING_FORM_OPENED | typeof SITE_EVENT_DEDICATED_POSTING_CREATED | typeof SITE_EVENT_DEDICATED_POSTING_CLOSED | typeof SITE_EVENT_DEDICATED_POSTING_TERMS_EDITED | typeof SITE_EVENT_DEDICATED_APPLICANTS_VIEWED | typeof SITE_EVENT_DEDICATED_APPLICANT_ACCEPTED | typeof SITE_EVENT_DEDICATED_APPLICANT_DECLINED | typeof SITE_EVENT_DEDICATED_ACTION_CONFLICT> = {
  section_viewed: SITE_EVENT_DEDICATED_SECTION_VIEWED,
  slot_toggled: SITE_EVENT_DEDICATED_SLOT_TOGGLED,
  pickup_time_changed: SITE_EVENT_DEDICATED_PICKUP_TIME_CHANGED,
  agent_paused: SITE_EVENT_DEDICATED_AGENT_PAUSED,
  agent_resumed: SITE_EVENT_DEDICATED_AGENT_RESUMED,
  agent_removed: SITE_EVENT_DEDICATED_AGENT_REMOVED,
  posting_form_opened: SITE_EVENT_DEDICATED_POSTING_FORM_OPENED,
  posting_created: SITE_EVENT_DEDICATED_POSTING_CREATED,
  posting_closed: SITE_EVENT_DEDICATED_POSTING_CLOSED,
  posting_terms_edited: SITE_EVENT_DEDICATED_POSTING_TERMS_EDITED,
  applicants_viewed: SITE_EVENT_DEDICATED_APPLICANTS_VIEWED,
  applicant_accepted: SITE_EVENT_DEDICATED_APPLICANT_ACCEPTED,
  applicant_declined: SITE_EVENT_DEDICATED_APPLICANT_DECLINED,
  action_conflict: SITE_EVENT_DEDICATED_ACTION_CONFLICT,
} as const;

export function useDedicatedAgentsAnalytics() {
  const { trackSiteEvent } = useTrackSiteEvent();

  const track = useCallback(
    (eventName: DedicatedAgentsEventName, metadata: Record<string, unknown> = {}) => {
      trackSiteEvent({
        eventType: EVENT_TYPE_MAP[eventName],
        metadata: {
          ...metadata,
          platform: 'web',
        },
      });
    },
    [trackSiteEvent]
  );

  return { track };
}
