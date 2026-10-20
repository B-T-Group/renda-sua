/**
 * Dedicated Agents Analytics
 *
 * Thin adapter for standardized dedicated agents event tracking.
 * Wire this to AppEventsService. All dedicated agents code should call
 * these typed functions rather than raw analytics SDK so event names
 * and property shapes stay consistent.
 *
 * Usage:
 *   dedicatedAgentsAnalytics.sectionViewed({ platform: 'ios', role: 'business', ... });
 */

import { Platform } from 'react-native';
import { AppEventsService } from './analytics/AppEventsService';
import type { SlotKey } from '../types/dedicatedAgents';

// ---------------------------------------------------------------------------
// Event properties
// ---------------------------------------------------------------------------

export type DedicatedAgentsPlatform = 'ios' | 'android' | 'web';
export type DedicatedAgentsRole = 'business' | 'agent' | 'admin';

export interface DedicatedAgentsBaseProps {
  platform: DedicatedAgentsPlatform;
  role: DedicatedAgentsRole;
}

export interface SectionViewedProps extends DedicatedAgentsBaseProps {
  locationId?: string;
  slotsEnabled: number;
  agents: number;
  openPostings: number;
}

export interface SlotToggledProps extends DedicatedAgentsBaseProps {
  locationId?: string;
  slotKey: SlotKey;
  enabled: boolean;
  agentsPaused?: number;
}

export interface PickupTimeChangedProps extends DedicatedAgentsBaseProps {
  locationId?: string;
  slotKey: SlotKey;
  time: string;
}

export interface AgentActionProps extends DedicatedAgentsBaseProps {
  locationId?: string;
  slotKey?: SlotKey;
  source?: string;
  isInternal?: boolean;
}

export interface PostingFormOpenedProps extends DedicatedAgentsBaseProps {
  locationId?: string;
}

export interface PostingCreatedProps extends DedicatedAgentsBaseProps {
  locationId?: string;
  postingId?: string;
  headcount: number;
  slots: number;
  days: number;
  termsLength: number;
}

export interface PostingActionProps extends DedicatedAgentsBaseProps {
  locationId?: string;
  postingId?: string;
  autoDeclined?: number;
}

export interface ApplicantsViewedProps extends DedicatedAgentsBaseProps {
  locationId?: string;
  postingId?: string;
  pending: number;
  accepted: number;
}

export interface ApplicantActionProps extends DedicatedAgentsBaseProps {
  locationId?: string;
  postingId?: string;
  applicationId?: string;
  filled?: boolean;
}

export interface ActionConflictProps extends DedicatedAgentsBaseProps {
  endpoint: string;
  code: string;
}

export interface AgentGateProps extends DedicatedAgentsBaseProps {
  reason: string;
}

export interface OpportunitiesViewedProps extends DedicatedAgentsBaseProps {
  count: number;
  disabledCount: number;
}

export interface OpportunityOpenedProps extends DedicatedAgentsBaseProps {
  postingId?: string;
  source: 'list' | 'push';
}

export interface ApplyTappedProps extends DedicatedAgentsBaseProps {
  postingId?: string;
  hadPhoto: boolean;
}

export interface PhotoGateProps extends DedicatedAgentsBaseProps {
  postingId?: string;
  method?: 'camera' | 'gallery';
}

export interface MyStoresViewedProps extends DedicatedAgentsBaseProps {
  count: number;
}

export interface OffTodayToggledProps extends DedicatedAgentsBaseProps {
  assignmentId?: string;
  off: boolean;
}

export interface AdminAssignProps extends DedicatedAgentsBaseProps {
  step?: number;
  slots?: number;
  isInternal?: boolean;
  code?: string;
}

// ---------------------------------------------------------------------------
// Record function
// ---------------------------------------------------------------------------

function record(eventName: string, props: Record<string, unknown>): void {
  AppEventsService.track({
    eventType: `dedicated_ui.${eventName}`,
    metadata: props,
  });
}

// ---------------------------------------------------------------------------
// Typed event emitters
// ---------------------------------------------------------------------------

export const dedicatedAgentsAnalytics = {
  sectionViewed(props: SectionViewedProps): void {
    record('section_viewed', props as unknown as Record<string, unknown>);
  },

  slotToggled(props: SlotToggledProps): void {
    record('slot_toggled', props as unknown as Record<string, unknown>);
  },

  pickupTimeChanged(props: PickupTimeChangedProps): void {
    record('pickup_time_changed', props as unknown as Record<string, unknown>);
  },

  agentPaused(props: AgentActionProps): void {
    record('agent_paused', props as unknown as Record<string, unknown>);
  },

  agentResumed(props: AgentActionProps): void {
    record('agent_resumed', props as unknown as Record<string, unknown>);
  },

  agentRemoved(props: AgentActionProps): void {
    record('agent_removed', props as unknown as Record<string, unknown>);
  },

  postingFormOpened(props: PostingFormOpenedProps): void {
    record('posting_form_opened', props as unknown as Record<string, unknown>);
  },

  postingCreated(props: PostingCreatedProps): void {
    record('posting_created', props as unknown as Record<string, unknown>);
  },

  postingClosed(props: PostingActionProps): void {
    record('posting_closed', props as unknown as Record<string, unknown>);
  },

  postingTermsEdited(props: PostingActionProps): void {
    record('posting_terms_edited', props as unknown as Record<string, unknown>);
  },

  applicantsViewed(props: ApplicantsViewedProps): void {
    record('applicants_viewed', props as unknown as Record<string, unknown>);
  },

  applicantAccepted(props: ApplicantActionProps): void {
    record('applicant_accepted', props as unknown as Record<string, unknown>);
  },

  applicantDeclined(props: ApplicantActionProps): void {
    record('applicant_declined', props as unknown as Record<string, unknown>);
  },

  actionConflict(props: ActionConflictProps): void {
    record('action_conflict', props as unknown as Record<string, unknown>);
  },

  agentGateShown(props: AgentGateProps): void {
    record('agent_gate_shown', props as unknown as Record<string, unknown>);
  },

  agentGateCtaTapped(props: AgentGateProps): void {
    record('agent_gate_cta_tapped', props as unknown as Record<string, unknown>);
  },

  opportunitiesViewed(props: OpportunitiesViewedProps): void {
    record('opportunities_viewed', props as unknown as Record<string, unknown>);
  },

  opportunityOpened(props: OpportunityOpenedProps): void {
    record('opportunity_opened', props as unknown as Record<string, unknown>);
  },

  applyTapped(props: ApplyTappedProps): void {
    record('apply_tapped', props as unknown as Record<string, unknown>);
  },

  applySucceeded(props: ApplyTappedProps): void {
    record('apply_succeeded', props as unknown as Record<string, unknown>);
  },

  photoGateShown(props: PhotoGateProps): void {
    record('photo_gate_shown', props as unknown as Record<string, unknown>);
  },

  photoGateCompleted(props: PhotoGateProps): void {
    record('photo_gate_completed', props as unknown as Record<string, unknown>);
  },

  photoGateCancelled(props: PhotoGateProps): void {
    record('photo_gate_cancelled', props as unknown as Record<string, unknown>);
  },

  applicationWithdrawn(props: OpportunityOpenedProps): void {
    record('application_withdrawn', props as unknown as Record<string, unknown>);
  },

  myStoresViewed(props: MyStoresViewedProps): void {
    record('my_stores_viewed', props as unknown as Record<string, unknown>);
  },

  offTodayToggled(props: OffTodayToggledProps): void {
    record('off_today_toggled', props as unknown as Record<string, unknown>);
  },

  adminAssignStarted(props: AdminAssignProps): void {
    record('admin_assign_started', props as unknown as Record<string, unknown>);
  },

  adminAssignStep(props: AdminAssignProps): void {
    record('admin_assign_step', props as unknown as Record<string, unknown>);
  },

  adminAssignSucceeded(props: AdminAssignProps): void {
    record('admin_assign_succeeded', props as unknown as Record<string, unknown>);
  },

  adminAssignFailed(props: AdminAssignProps): void {
    record('admin_assign_failed', props as unknown as Record<string, unknown>);
  },
};
