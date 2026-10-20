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
    posting_filled: 'errors.dedicated.posting_filled',
    posting_not_open: 'errors.dedicated.posting_not_open',
    posting_expired: 'errors.dedicated.posting_not_open',
    posting_already_open: 'errors.dedicated.posting_already_open',
    application_closed: 'errors.dedicated.posting_not_open',
    application_not_pending: 'errors.dedicated.application_not_pending',
    // Agent assignment conflicts
    agent_holds_slot: 'errors.dedicated.agent_holds_slot',
    dedicated_agent_assignment_cap_exceeded: 'errors.dedicated.cap_exceeded',
    dedicated_agent_assignment_duplicate: 'errors.dedicated.duplicate',
    agent_not_verified: 'errors.dedicated.agent_not_verified',
    agent_suspended: 'errors.dedicated.agent_suspended',
    agent_ineligible: 'errors.dedicated.agent_ineligible',
    // Slot/assignment state
    slot_disabled: 'errors.dedicated.slot_disabled',
    assignment_removed: 'errors.dedicated.assignment_removed',
    assignment_changed: 'errors.dedicated.assignment_changed',
    slot_has_dedicated_agents: 'errors.dedicated.slot_has_dedicated_agents',
    // Form validation
    pickup_time_outside_slot: 'errors.dedicated.pickup_time_outside_slot',
    invalid_headcount: 'errors.dedicated.invalid_headcount',
    invalid_slot_keys: 'errors.dedicated.invalid_slot_keys',
    invalid_days_of_week: 'errors.dedicated.invalid_days_of_week',
    terms_too_long: 'errors.dedicated.terms_too_long',
  };

  return errorMap[code as DedicatedAgentsErrorCode] || 'errors.dedicated.generic';
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
