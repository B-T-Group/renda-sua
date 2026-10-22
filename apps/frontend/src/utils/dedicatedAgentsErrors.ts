/**
 * Dedicated agents error code mapping to user-friendly translation keys.
 * Maps backend error codes to localized copy (§8 in the spec).
 */

export type DedicatedAgentsErrorCode =
  // Posting errors
  | 'posting_filled'
  | 'posting_not_open'
  | 'posting_expired'
  | 'posting_already_open'
  | 'application_closed'
  | 'application_not_pending'
  // Assignment/agent errors
  | 'agent_holds_slot'
  | 'dedicated_agent_assignment_cap_exceeded'
  | 'dedicated_agent_assignment_duplicate'
  | 'agent_not_verified'
  | 'agent_suspended'
  | 'agent_ineligible'
  | 'slot_disabled'
  | 'assignment_removed'
  | 'assignment_changed'
  | 'slot_has_dedicated_agents'
  // Slot/form errors
  | 'pickup_time_outside_slot'
  | 'invalid_headcount'
  | 'invalid_slot_keys'
  | 'invalid_days_of_week'
  | 'terms_too_long';

/**
 * Map an error code to a translation key. Returns the key for t().
 */
export function mapDedicatedAgentsErrorCode(code: string): string {
  const errorMap: Record<DedicatedAgentsErrorCode, string> = {
    // Posting conflicts
    posting_filled: 'dedicatedAgents.errors.posting_filled',
    posting_not_open: 'dedicatedAgents.errors.posting_not_open',
    posting_expired: 'dedicatedAgents.errors.posting_not_open',
    posting_already_open: 'dedicatedAgents.errors.posting_already_open',
    application_closed: 'dedicatedAgents.errors.posting_not_open',
    application_not_pending: 'dedicatedAgents.errors.application_not_pending',
    // Agent assignment conflicts
    agent_holds_slot: 'dedicatedAgents.errors.agent_holds_slot',
    dedicated_agent_assignment_cap_exceeded: 'dedicatedAgents.errors.cap_exceeded',
    dedicated_agent_assignment_duplicate: 'dedicatedAgents.errors.duplicate',
    agent_not_verified: 'dedicatedAgents.errors.agent_not_verified',
    agent_suspended: 'dedicatedAgents.errors.agent_suspended',
    agent_ineligible: 'dedicatedAgents.errors.agent_ineligible',
    // Slot/assignment state
    slot_disabled: 'dedicatedAgents.errors.slot_disabled',
    assignment_removed: 'dedicatedAgents.errors.assignment_removed',
    assignment_changed: 'dedicatedAgents.errors.assignment_changed',
    slot_has_dedicated_agents: 'dedicatedAgents.errors.slot_has_dedicated_agents',
    // Form validation
    pickup_time_outside_slot: 'dedicatedAgents.errors.pickup_time_outside_slot',
    invalid_headcount: 'dedicatedAgents.errors.invalid_headcount',
    invalid_slot_keys: 'dedicatedAgents.errors.invalid_slot_keys',
    invalid_days_of_week: 'dedicatedAgents.errors.invalid_days_of_week',
    terms_too_long: 'dedicatedAgents.errors.terms_too_long',
  };

  return errorMap[code as DedicatedAgentsErrorCode] || 'dedicatedAgents.errors.generic';
}

/**
 * Extract error code and message from an API error response.
 */
export function extractDedicatedAgentsError(error: any): {
  code: string | null;
  message: string;
  agentsToPause?: number;
} {
  const code = error?.response?.data?.code || null;
  const message = error?.response?.data?.message || 'An error occurred';
  const agentsToPause = error?.response?.data?.agentsToPause;

  return { code, message, agentsToPause };
}

/**
 * Check if an error is a 404 or 403 (feature hidden).
 */
export function isDedicatedAgentsFeatureHidden(error: any): boolean {
  const status = error?.response?.status;
  return status === 404 || status === 403;
}
