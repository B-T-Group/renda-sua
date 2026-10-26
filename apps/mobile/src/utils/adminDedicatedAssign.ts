/**
 * Pure logic behind the admin "Dedicated agents" screen (platform.manage.agents):
 * filters, the 3-step assign flow (store, slots, agent) and error mapping.
 * Kept free of React / native imports so vitest can cover it directly.
 *
 * Mirrors apps/frontend AdminDedicatedAssignmentsSection + AdminDedicatedAssignDialog.
 */
import type {
  AdminAgentPickerItem,
  AdminAssignmentFilters,
  AdminAssignmentView,
  AdminDedicatedCapabilityResponse,
  AdminLocationSearchItem,
  AssignmentStatus,
  SlotKey,
} from '../types/dedicatedAgents';

export const ADMIN_SLOT_KEYS: readonly SlotKey[] = ['morning', 'afternoon', 'evening'];

/** The backend rejects store searches shorter than this with 400 query_too_short. */
export const ADMIN_LOCATION_SEARCH_MIN_CHARS = 2;

/**
 * Default per-agent store cap (`dedicated_max_assignments_per_agent`, config 1-20).
 * Only used to flag busy agents in the picker; the backend 409 is the source of truth,
 * so agents at this count stay selectable.
 */
export const ADMIN_DEFAULT_AGENT_STORE_CAP = 3;

export type AdminAssignStep = 0 | 1 | 2;

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

/**
 * The admin entry shows only for users who hold platform.manage.agents (superuser
 * included, via `can`) AND when /admin/dedicated-agents/capability says the flag is
 * on for at least one country in their scope. A failed or 404 capability call hides it.
 */
export function shouldShowAdminDedicatedEntry(
  canManageAgents: boolean,
  capability: Pick<AdminDedicatedCapabilityResponse, 'enabled'> | null | undefined
): boolean {
  return canManageAgents === true && capability?.enabled === true;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export type AdminSlotFilter = SlotKey | 'all';
export type AdminStatusFilter = AssignmentStatus | 'all';

export function buildAdminAssignmentFilters(input: {
  city?: string;
  slot?: AdminSlotFilter;
  status?: AdminStatusFilter;
}): AdminAssignmentFilters {
  const filters: AdminAssignmentFilters = {};
  const city = input.city?.trim();
  if (city) filters.city = city;
  if (input.slot && input.slot !== 'all') filters.slotKey = input.slot;
  if (input.status && input.status !== 'all') filters.status = input.status;
  return filters;
}

export function nextAssignmentStatus(current: AssignmentStatus): AssignmentStatus {
  return current === 'active' ? 'paused' : 'active';
}

export function agentFullName(agent: { firstName?: string | null; lastName?: string | null }): string {
  return [agent.firstName, agent.lastName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

export function agentInitials(agent: { firstName?: string | null; lastName?: string | null }): string {
  const first = (agent.firstName ?? '').trim().charAt(0);
  const last = (agent.lastName ?? '').trim().charAt(0);
  return `${first}${last}`.toUpperCase() || '?';
}

/** Show the relation warning unless an admin already dismissed it. */
export function showRelationWarning(a: Pick<AdminAssignmentView, 'possible_relation' | 'relation_dismissed'>): boolean {
  return a.possible_relation === true && a.relation_dismissed !== true;
}

// ---------------------------------------------------------------------------
// Assign flow
// ---------------------------------------------------------------------------

export function isLocationQueryReady(query: string): boolean {
  return query.trim().length >= ADMIN_LOCATION_SEARCH_MIN_CHARS;
}

export function isSlotEnabledAtLocation(
  location: Pick<AdminLocationSearchItem, 'enabledSlotKeys'> | null,
  slot: SlotKey
): boolean {
  return !!location && location.enabledSlotKeys.includes(slot);
}

/** Toggle a slot; slots the store has turned off can never be selected. */
export function toggleSlot(
  selected: readonly SlotKey[],
  slot: SlotKey,
  location: Pick<AdminLocationSearchItem, 'enabledSlotKeys'> | null
): SlotKey[] {
  if (!isSlotEnabledAtLocation(location, slot)) return [...selected];
  if (selected.includes(slot)) return selected.filter((s) => s !== slot);
  // Keep canonical order so the request body and summary are stable.
  return ADMIN_SLOT_KEYS.filter((s) => s === slot || selected.includes(s));
}

/** Drop selected slots a (re)chosen store does not offer. */
export function keepOfferedSlots(
  selected: readonly SlotKey[],
  location: Pick<AdminLocationSearchItem, 'enabledSlotKeys'> | null
): SlotKey[] {
  return selected.filter((s) => isSlotEnabledAtLocation(location, s));
}

export function canAdvanceStep(
  step: AdminAssignStep,
  state: { location: AdminLocationSearchItem | null; slots: readonly SlotKey[] }
): boolean {
  if (step === 0) return !!state.location;
  if (step === 1) return state.slots.length > 0;
  return false;
}

export function canSubmitAssign(state: {
  location: AdminLocationSearchItem | null;
  slots: readonly SlotKey[];
  agent: AdminAgentPickerItem | null;
  submitting: boolean;
  offline: boolean;
}): boolean {
  return (
    !!state.location &&
    !!state.agent &&
    state.slots.length > 0 &&
    !state.submitting &&
    !state.offline
  );
}

export function filterPickerAgents(
  agents: readonly AdminAgentPickerItem[],
  query: string
): AdminAgentPickerItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...agents];
  return agents.filter((a) => agentFullName(a).toLowerCase().includes(q));
}

export function isAgentBusy(agent: Pick<AdminAgentPickerItem, 'assignmentCount'>): boolean {
  return agent.assignmentCount >= ADMIN_DEFAULT_AGENT_STORE_CAP;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface ApiErrorLike {
  status?: number;
  code?: string;
  message?: string;
  response?: { status?: number; data?: { code?: string } };
}

export function errorStatus(err: unknown): number | undefined {
  const e = err as ApiErrorLike | null | undefined;
  return e?.status ?? e?.response?.status;
}

export function errorCode(err: unknown): string | undefined {
  const e = err as ApiErrorLike | null | undefined;
  return e?.code ?? e?.response?.data?.code;
}

/** 404 on any admin route means the flag is off for the country (or the target is gone). */
export function isAdminFeatureOff(err: unknown): boolean {
  return errorStatus(err) === 404;
}

export interface MappedAdminError {
  /** i18n key (use with the default text below). */
  key: string;
  defaultMessage: string;
  params?: Record<string, string>;
  /** Assign flow: wizard step the admin should go back to, or null to stay. */
  step: AdminAssignStep | null;
  /** List actions: refresh the list because the row changed or vanished. */
  reload: boolean;
  /** slot_disabled: the slots the backend says the store turned off. */
  disabledSlots?: SlotKey[];
}

/**
 * The backend names the offending slots in the 409 message
 * ("The store has turned off: morning, evening"). Returns [] when it cannot tell.
 */
export function parseDisabledSlots(message: string | undefined | null): SlotKey[] {
  if (!message) return [];
  const idx = message.indexOf(':');
  const tail = idx >= 0 ? message.slice(idx + 1) : message;
  return ADMIN_SLOT_KEYS.filter((s) => new RegExp(`\\b${s}\\b`).test(tail));
}

const E = 'dedicatedAgents.errors';

/** Map a failed POST /admin/dedicated-agents/assignments. */
export function mapAdminAssignError(
  err: unknown,
  ctx: { slots: readonly SlotKey[]; location: Pick<AdminLocationSearchItem, 'enabledSlotKeys'> | null; slotLabel: (s: SlotKey) => string }
): MappedAdminError {
  const status = errorStatus(err);
  const code = errorCode(err);

  if (code === 'slot_disabled') {
    const fromBackend = parseDisabledSlots((err as ApiErrorLike | null)?.message).filter((s) =>
      ctx.slots.includes(s)
    );
    const stale = ctx.slots.filter((s) => !isSlotEnabledAtLocation(ctx.location, s));
    // The store may have turned a slot off after the search: name what the backend said,
    // else what we already know is off, else the whole selection.
    const off = fromBackend.length > 0 ? fromBackend : stale.length > 0 ? stale : [...ctx.slots];
    return {
      key: `${E}.slot_disabled`,
      defaultMessage: 'Turn {{slot}} back on first',
      params: { slot: off.map(ctx.slotLabel).join(', ') },
      step: 1,
      reload: false,
      disabledSlots: off,
    };
  }
  if (code === 'dedicated_agent_assignment_cap_exceeded' || code === 'cap_exceeded') {
    return { key: `${E}.cap_exceeded`, defaultMessage: 'This agent already has the maximum number of stores', step: 2, reload: false };
  }
  if (code === 'dedicated_agent_assignment_duplicate' || code === 'duplicate' || code === 'agent_holds_slot') {
    return { key: `${E}.duplicate`, defaultMessage: 'This agent is already assigned to this slot', step: 2, reload: false };
  }
  if (code === 'agent_not_verified') {
    return { key: `${E}.agent_not_verified`, defaultMessage: 'This agent is not verified', step: 2, reload: false };
  }
  if (code === 'agent_suspended') {
    return { key: `${E}.agent_suspended`, defaultMessage: 'This agent is suspended', step: 2, reload: false };
  }
  if (code === 'invalid_slot_keys') {
    return { key: `${E}.invalid_slot_keys`, defaultMessage: 'Please select at least one slot', step: 1, reload: false };
  }
  if (status === 403) {
    return { key: `${E}.geo_scope`, defaultMessage: 'Outside your admin scope', step: 0, reload: false };
  }
  if (status === 404) {
    return {
      key: 'dedicatedAgents.admin.errors.notFoundOrOff',
      defaultMessage: 'Dedicated agents is not available for this store, or the store or agent no longer exists',
      step: 0,
      reload: false,
    };
  }
  if (status === 409) {
    return { key: `${E}.assignment_changed`, defaultMessage: 'This assignment has changed', step: null, reload: true };
  }
  return { key: 'dedicatedAgents.generic', defaultMessage: 'Something went wrong', step: null, reload: false };
}

/** Map a failed pause / resume / remove. */
export function mapAdminActionError(err: unknown): MappedAdminError {
  const status = errorStatus(err);
  const code = errorCode(err);

  if (code === 'assignment_removed') {
    return { key: `${E}.assignment_removed`, defaultMessage: 'This assignment was removed', step: null, reload: true };
  }
  if (code === 'assignment_changed') {
    return { key: `${E}.assignment_changed`, defaultMessage: 'This assignment has changed', step: null, reload: true };
  }
  if (code === 'slot_disabled') {
    return {
      key: 'dedicatedAgents.admin.errors.slotDisabledResume',
      defaultMessage: 'The store has turned this slot off. It must be turned back on before the agent can resume',
      step: null,
      reload: true,
    };
  }
  if (code === 'dedicated_agent_assignment_cap_exceeded' || code === 'cap_exceeded') {
    return { key: `${E}.cap_exceeded`, defaultMessage: 'This agent already has the maximum number of stores', step: null, reload: true };
  }
  if (status === 403) {
    return { key: `${E}.geo_scope`, defaultMessage: 'Outside your admin scope', step: null, reload: false };
  }
  if (status === 404) {
    return {
      key: 'dedicatedAgents.admin.errors.assignmentNotFound',
      defaultMessage: 'This assignment no longer exists, or dedicated agents is off for this store',
      step: null,
      reload: true,
    };
  }
  if (status === 409) {
    return { key: `${E}.assignment_changed`, defaultMessage: 'This assignment has changed', step: null, reload: true };
  }
  return { key: 'dedicatedAgents.generic', defaultMessage: 'Something went wrong', step: null, reload: false };
}

/** Map a failed store search (400 query_too_short, 403 scope, 404 flag off). */
export function mapAdminSearchError(err: unknown): MappedAdminError {
  const status = errorStatus(err);
  const code = errorCode(err);
  if (status === 403) {
    return { key: `${E}.geo_scope`, defaultMessage: 'Outside your admin scope', step: null, reload: false };
  }
  if (status === 400 && code === 'query_too_short') {
    return { key: `${E}.query_too_short`, defaultMessage: 'Type at least 2 characters to search', step: null, reload: false };
  }
  if (status === 404) {
    return {
      key: 'dedicatedAgents.admin.errors.notFoundOrOff',
      defaultMessage: 'Dedicated agents is not available for this store, or the store or agent no longer exists',
      step: null,
      reload: false,
    };
  }
  return { key: 'dedicatedAgents.generic', defaultMessage: 'Something went wrong', step: null, reload: false };
}
