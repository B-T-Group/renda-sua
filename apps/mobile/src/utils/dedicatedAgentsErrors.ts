import type { TFunction } from 'i18next';

export function mapDedicatedError(code: string, t: TFunction): string {
  const errorKey = `dedicatedAgents.errors.${code}`;
  return t(errorKey, t('dedicatedAgents.generic', 'Something went wrong'));
}

export function shouldHideOnError(status: number, code?: string, reason?: string): boolean {
  // 404 means feature is off
  if (status === 404) return true;
  // 403 should be handled elsewhere (gate or no_address prompt)
  return false;
}

export type GateReason = 'not_verified' | 'contract_unsigned' | 'suspended';

export function shouldShowGate(status: number, code: string, reason: string | null): boolean {
  if (status !== 403) return false;
  if (code !== 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE') return false;
  // Never default to a gate if reason is missing
  if (!reason) return false;
  // Show gates for these specific reasons (no_address shows empty state with prompt, not a gate)
  const gateReasons: GateReason[] = ['not_verified', 'contract_unsigned', 'suspended'];
  return gateReasons.includes(reason as GateReason);
}

export function getGateIcon(reason: GateReason): string {
  switch (reason) {
    case 'not_verified':
      return 'shield-check';
    case 'contract_unsigned':
      return 'file-document-edit';
    case 'suspended':
      return 'alert-circle';
    default:
      return 'alert-circle';
  }
}

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
  const code = error?.code || error?.response?.data?.code || null;
  const message = error?.message || error?.response?.data?.message || 'An error occurred';
  const agentsToPause = error?.agentsToPause || error?.response?.data?.agentsToPause;

  return { code, message, agentsToPause };
}

/**
 * Check if an error is a 404 or 403 (feature hidden).
 */
export function isDedicatedAgentsFeatureHidden(error: any): boolean {
  const status = error?.response?.status || error?.status;
  return status === 404 || status === 403;
}

/**
 * Status / code / reason / body from a dedicated API error. `apiClient` throws an
 * Error with `status`, `code` and `data` (raw JSON body), not an axios-style
 * `response`; reading only `err.response` turned every failure (e.g. 422
 * PROFILE_PHOTO_REQUIRED) into the generic message. Both shapes are accepted.
 */
export function dedicatedApiError(err: any): {
  status: number | null;
  code: string | null;
  reason: string | null;
  data: any;
} {
  const data = err?.data ?? err?.response?.data ?? null;
  const status = err?.status ?? err?.response?.status ?? null;
  const code = data?.code ?? err?.code ?? null;
  const reason = data?.reason ?? null;
  return { status: typeof status === 'number' ? status : null, code: code || null, reason, data };
}
