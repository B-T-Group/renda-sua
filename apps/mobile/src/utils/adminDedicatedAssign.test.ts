import { describe, expect, it } from 'vitest';
import en from '../i18n/locales/en.json';
import fr from '../i18n/locales/fr.json';
import {
  adminPreferredSlots,
  isAdminSlotOffPause,
  agentFullName,
  agentInitials,
  buildAdminAssignmentFilters,
  canAdvanceStep,
  canSubmitAssign,
  filterPickerAgents,
  isAdminFeatureOff,
  isAgentBusy,
  isLocationQueryReady,
  keepOfferedSlots,
  mapAdminActionError,
  mapAdminAssignError,
  mapAdminSearchError,
  nextAssignmentStatus,
  parseDisabledSlots,
  shouldShowAdminDedicatedEntry,
  showRelationWarning,
  toggleSlot,
} from './adminDedicatedAssign';
import type { AdminAgentPickerItem, AdminLocationSearchItem, SlotKey } from '../types/dedicatedAgents';

const loc = (enabledSlotKeys: SlotKey[]) =>
  ({ id: 'loc-1', name: 'Main', enabledSlotKeys }) as unknown as AdminLocationSearchItem;
const agent = (over: Partial<AdminAgentPickerItem> = {}) =>
  ({ id: 'ag-1', firstName: 'Ada', lastName: 'Lovelace', assignmentCount: 0, ...over }) as unknown as AdminAgentPickerItem;
const slotLabel = (s: SlotKey) => s;
const ctx = (slots: SlotKey[], enabled: SlotKey[] = ['morning', 'afternoon', 'evening']) => ({
  slots,
  location: loc(enabled),
  slotLabel,
});

describe('shouldShowAdminDedicatedEntry', () => {
  it('needs the permission AND an enabled capability', () => {
    expect(shouldShowAdminDedicatedEntry(true, { enabled: true })).toBe(true);
    expect(shouldShowAdminDedicatedEntry(true, { enabled: false })).toBe(false);
    expect(shouldShowAdminDedicatedEntry(false, { enabled: true })).toBe(false);
  });
  it('hides while capability is unknown or failed', () => {
    expect(shouldShowAdminDedicatedEntry(true, null)).toBe(false);
    expect(shouldShowAdminDedicatedEntry(true, undefined)).toBe(false);
  });
});

describe('list helpers', () => {
  it('builds filters, dropping all/blank values', () => {
    expect(buildAdminAssignmentFilters({ city: '  ', slot: 'all', status: 'all' })).toEqual({});
    expect(buildAdminAssignmentFilters({ city: ' Douala ', slot: 'evening', status: 'paused' })).toEqual({
      city: 'Douala',
      slotKey: 'evening',
      status: 'paused',
    });
  });
  it('#594 addendum AC-P17: preferred-slot filter maps to prefOff or pauseReason', () => {
    expect(buildAdminAssignmentFilters({ pref: 'all' })).toEqual({});
    expect(buildAdminAssignmentFilters({ pref: 'morning' })).toEqual({ prefOff: 'morning' });
    expect(buildAdminAssignmentFilters({ pref: 'paused_slot_off' })).toEqual({ pauseReason: 'paused_slot_off' });
  });
  it('#594 addendum AC-P17: preferred slots default ON; slot-off pause detection', () => {
    expect(adminPreferredSlots({})).toEqual({ morning: true, afternoon: true, evening: true });
    expect(adminPreferredSlots({ preferredSlots: { morning: false, afternoon: true, evening: true } })).toEqual({
      morning: false,
      afternoon: true,
      evening: true,
    });
    expect(isAdminSlotOffPause({ status: 'paused', pauseReason: 'paused_slot_off' })).toBe(true);
    expect(isAdminSlotOffPause({ status: 'paused', pauseReason: 'paused_admin' })).toBe(false);
    expect(isAdminSlotOffPause({ status: 'active', pauseReason: 'paused_slot_off' })).toBe(false);
  });
  it('flips status for pause/resume', () => {
    expect(nextAssignmentStatus('active')).toBe('paused');
    expect(nextAssignmentStatus('paused')).toBe('active');
  });
  it('formats names and initials', () => {
    expect(agentFullName({ firstName: ' Ada ', lastName: null })).toBe('Ada');
    expect(agentFullName({})).toBe('');
    expect(agentInitials({ firstName: 'ada', lastName: 'lovelace' })).toBe('AL');
    expect(agentInitials({})).toBe('?');
  });
  it('shows the relation warning unless dismissed', () => {
    expect(showRelationWarning({ possible_relation: true, relation_dismissed: false })).toBe(true);
    expect(showRelationWarning({ possible_relation: true, relation_dismissed: true })).toBe(false);
    expect(showRelationWarning({ possible_relation: false, relation_dismissed: false })).toBe(false);
  });
});

describe('assign flow', () => {
  it('requires 2 characters before searching', () => {
    expect(isLocationQueryReady('a')).toBe(false);
    expect(isLocationQueryReady(' a ')).toBe(false);
    expect(isLocationQueryReady('ab')).toBe(true);
  });
  it('toggles slots in canonical order and never selects disabled ones', () => {
    const l = loc(['morning', 'evening']);
    expect(toggleSlot([], 'evening', l)).toEqual(['evening']);
    expect(toggleSlot(['evening'], 'morning', l)).toEqual(['morning', 'evening']);
    expect(toggleSlot(['morning', 'evening'], 'morning', l)).toEqual(['evening']);
    expect(toggleSlot(['morning'], 'afternoon', l)).toEqual(['morning']);
    expect(toggleSlot([], 'morning', null)).toEqual([]);
  });
  it('drops slots a newly chosen store does not offer', () => {
    expect(keepOfferedSlots(['morning', 'evening'], loc(['evening']))).toEqual(['evening']);
  });
  it('gates each step', () => {
    expect(canAdvanceStep(0, { location: null, slots: [] })).toBe(false);
    expect(canAdvanceStep(0, { location: loc([]), slots: [] })).toBe(true);
    expect(canAdvanceStep(1, { location: loc(['morning']), slots: [] })).toBe(false);
    expect(canAdvanceStep(1, { location: loc(['morning']), slots: ['morning'] })).toBe(true);
    expect(canAdvanceStep(2, { location: loc(['morning']), slots: ['morning'] })).toBe(false);
  });
  it('submits only with store, slots, agent, online and not already submitting', () => {
    const ok = { location: loc(['morning']), slots: ['morning' as SlotKey], agent: agent(), submitting: false, offline: false };
    expect(canSubmitAssign(ok)).toBe(true);
    expect(canSubmitAssign({ ...ok, agent: null })).toBe(false);
    expect(canSubmitAssign({ ...ok, slots: [] })).toBe(false);
    expect(canSubmitAssign({ ...ok, submitting: true })).toBe(false);
    expect(canSubmitAssign({ ...ok, offline: true })).toBe(false);
  });
  it('filters the picker by name, case-insensitively', () => {
    const list = [agent(), agent({ id: 'ag-2', firstName: 'Grace', lastName: 'Hopper' })];
    expect(filterPickerAgents(list, '')).toHaveLength(2);
    expect(filterPickerAgents(list, ' hop ').map((a) => a.id)).toEqual(['ag-2']);
    expect(filterPickerAgents(list, 'zzz')).toEqual([]);
  });
  it('flags busy agents softly (backend cap is the source of truth)', () => {
    expect(isAgentBusy(agent({ assignmentCount: 2 }))).toBe(false);
    expect(isAgentBusy(agent({ assignmentCount: 3 }))).toBe(true);
  });
});

describe('error mapping', () => {
  it('reads status/code from the mobile api client and axios shapes', () => {
    expect(isAdminFeatureOff({ status: 404 })).toBe(true);
    expect(isAdminFeatureOff({ response: { status: 404 } })).toBe(true);
    expect(isAdminFeatureOff({ status: 409 })).toBe(false);
    expect(mapAdminAssignError({ response: { status: 409, data: { code: 'duplicate' } } }, ctx(['morning'])).key).toBe(
      'dedicatedAgents.errors.duplicate'
    );
  });

  it('parses disabled slots out of the backend message', () => {
    expect(parseDisabledSlots('The store has turned off: morning, evening')).toEqual(['morning', 'evening']);
    expect(parseDisabledSlots('nothing useful')).toEqual([]);
    expect(parseDisabledSlots(undefined)).toEqual([]);
  });

  it('409 slot_disabled returns to the slot step and names the slots the backend reported', () => {
    const m = mapAdminAssignError(
      { status: 409, code: 'slot_disabled', message: 'The store has turned off: evening' },
      ctx(['morning', 'evening'])
    );
    expect(m).toMatchObject({
      key: 'dedicatedAgents.errors.slot_disabled',
      step: 1,
      params: { slot: 'evening' },
      disabledSlots: ['evening'],
    });
  });
  it('slot_disabled falls back to known-off slots, then the whole selection', () => {
    const known = mapAdminAssignError({ status: 409, code: 'slot_disabled' }, ctx(['morning', 'evening'], ['morning']));
    expect(known.disabledSlots).toEqual(['evening']);
    const all = mapAdminAssignError({ status: 409, code: 'slot_disabled' }, ctx(['morning', 'evening']));
    expect(all.disabledSlots).toEqual(['morning', 'evening']);
  });
  it('maps the agent cap to the agent step without hard-coding a number', () => {
    for (const code of ['dedicated_agent_assignment_cap_exceeded', 'cap_exceeded']) {
      expect(mapAdminAssignError({ status: 409, code }, ctx(['morning']))).toMatchObject({
        key: 'dedicatedAgents.errors.cap_exceeded',
        step: 2,
      });
    }
  });
  it('maps already-assigned to the agent step', () => {
    for (const code of ['dedicated_agent_assignment_duplicate', 'duplicate', 'agent_holds_slot']) {
      expect(mapAdminAssignError({ status: 409, code }, ctx(['morning']))).toMatchObject({
        key: 'dedicatedAgents.errors.duplicate',
        step: 2,
      });
    }
  });
  it('maps 404 to feature off / missing target, 403 to scope', () => {
    expect(mapAdminAssignError({ status: 404 }, ctx(['morning'])).key).toBe('dedicatedAgents.admin.errors.notFoundOrOff');
    expect(mapAdminAssignError({ status: 403 }, ctx(['morning'])).key).toBe('dedicatedAgents.errors.geo_scope');
  });
  it('an unknown 409 reloads; anything else is generic', () => {
    expect(mapAdminAssignError({ status: 409, code: 'x' }, ctx(['morning']))).toMatchObject({ reload: true });
    expect(mapAdminAssignError(new Error('boom'), ctx(['morning'])).key).toBe('dedicatedAgents.generic');
    expect(mapAdminAssignError(null, ctx(['morning'])).key).toBe('dedicatedAgents.generic');
  });
  it('maps pause/resume/remove failures and reloads when the row changed', () => {
    expect(mapAdminActionError({ status: 409, code: 'assignment_removed' })).toMatchObject({
      key: 'dedicatedAgents.errors.assignment_removed',
      reload: true,
    });
    expect(mapAdminActionError({ status: 409, code: 'slot_disabled' }).key).toBe(
      'dedicatedAgents.admin.errors.slotDisabledResume'
    );
    expect(mapAdminActionError({ status: 409, code: 'cap_exceeded' }).key).toBe('dedicatedAgents.errors.cap_exceeded');
    expect(mapAdminActionError({ status: 404 })).toMatchObject({
      key: 'dedicatedAgents.admin.errors.assignmentNotFound',
      reload: true,
    });
    expect(mapAdminActionError({ status: 409 }).key).toBe('dedicatedAgents.errors.assignment_changed');
    expect(mapAdminActionError({ status: 403 })).toMatchObject({ key: 'dedicatedAgents.errors.geo_scope', reload: false });
    expect(mapAdminActionError({ status: 500 }).key).toBe('dedicatedAgents.generic');
  });
  it('maps store search errors', () => {
    expect(mapAdminSearchError({ status: 400, code: 'query_too_short' }).key).toBe('dedicatedAgents.errors.query_too_short');
    expect(mapAdminSearchError({ status: 403 }).key).toBe('dedicatedAgents.errors.geo_scope');
    expect(mapAdminSearchError({ status: 404 }).key).toBe('dedicatedAgents.admin.errors.notFoundOrOff');
    expect(mapAdminSearchError({ status: 500 }).key).toBe('dedicatedAgents.generic');
  });
});

describe('locale coverage for the admin dedicated agents screen', () => {
  const get = (d: unknown, key: string) =>
    key.split('.').reduce<unknown>((acc, p) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[p] : undefined), d);
  const keys = [
    'admin.dedicatedAgents.title',
    'admin.dedicatedAgents.menuSubtitle',
    'admin.dedicatedAgents.dashboardDescription',
    'admin.dedicatedAgents.accessDenied',
    'admin.dedicatedAgents.unavailableTitle',
    'dedicatedAgents.admin.assignTitle',
    'dedicatedAgents.admin.stepOf',
    'dedicatedAgents.admin.steps.store',
    'dedicatedAgents.admin.steps.slots',
    'dedicatedAgents.admin.steps.agent',
    'dedicatedAgents.admin.errors.notFoundOrOff',
    'dedicatedAgents.admin.errors.slotDisabledResume',
    'dedicatedAgents.admin.errors.assignmentNotFound',
    'dedicatedAgents.errors.geo_scope',
    'dedicatedAgents.errors.query_too_short',
    'dedicatedAgents.errors.slot_disabled',
    'dedicatedAgents.errors.cap_exceeded',
    'dedicatedAgents.errors.duplicate',
    'dedicatedAgents.superuser.removeConfirmDetail',
    'common.all',
    'common.city',
  ];
  it.each(['en', 'fr'] as const)('has every key in %s', (lng) => {
    const dict = lng === 'en' ? en : fr;
    const missing = keys.filter((k) => typeof get(dict, k) !== 'string');
    expect(missing).toEqual([]);
  });
});
