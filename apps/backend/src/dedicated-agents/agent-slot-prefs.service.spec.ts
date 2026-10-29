import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { AgentContractGateService } from '../agent-contracts/agent-contract-gate.service';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { SiteEventsService } from '../site-events/site-events.service';
import { AgentSlotPrefsService, parseChanges } from './agent-slot-prefs.service';
import type { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import type { DedicatedAssignmentsService } from './dedicated-assignments.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

const USER = 'u-agent';
const AGENT = 'agent-1';

function setup(opts: { agent?: Loose; rows?: Loose[]; storeSlotOff?: boolean; contractSigned?: boolean; flag?: boolean } = {}) {
  const agent: Loose = {
    id: AGENT,
    user_id: USER,
    is_verified: true,
    status: 'active',
    focus: 'delivery',
    pref_morning: true,
    pref_afternoon: true,
    pref_evening: true,
    ...opts.agent,
  };
  const rows: Loose[] = (opts.rows ?? []).map((r) => ({
    business_location_id: 'loc-1',
    agent_id: AGENT,
    source: 'posting',
    pause_reason: null,
    business_location: { name: 'Shop A', address: { country: 'CM', state: 'Centre' } },
    ...r,
  }));
  const mutations: Array<{ query: string; vars: Loose }> = [];
  const events: Array<{ type: string; meta: Loose }> = [];
  const statusChanges: Loose[] = [];

  const hasura = {
    executeQuery: jest.fn(async (query: string, vars: Loose) => {
      if (query.includes('AgentSlotPrefsByUser')) return { agents: vars.userId === USER ? [agent] : [] };
      if (query.includes('AgentActiveAssignmentsInSlots')) {
        return {
          dedicated_agent_assignments: rows.filter(
            (r) => r.agent_id === vars.agentId && r.status === 'active' && vars.slotKeys.includes(r.slot_key)
          ),
        };
      }
      if (query.includes('DedicatedAssignmentById')) {
        return { dedicated_agent_assignments_by_pk: rows.find((r) => r.id === vars.id) ?? null };
      }
      throw new Error(`unexpected query ${query.slice(0, 60)}`);
    }),
    executeMutation: jest.fn(async (query: string, vars: Loose) => {
      mutations.push({ query, vars });
      if (query.includes('SaveAgentSlotPrefs')) {
        Object.assign(agent, vars.prefs);
        const out: Loose = { update_agents_by_pk: { ...agent } };
        if (vars.offSlots) {
          const hit = rows.filter((r) => r.status === 'active' && vars.offSlots.includes(r.slot_key));
          for (const r of hit) Object.assign(r, vars.pauseSet);
          out.paused = { returning: hit.map((r) => ({ ...r })) };
        }
        return out;
      }
      if (query.includes('ResumeSlotOffAssignment')) {
        const r = rows.find((x) => x.id === vars.id);
        const prefCol = `pref_${vars.slotKey}`;
        const ok =
          r && r.status === 'paused' && r.pause_reason === 'paused_slot_off' && agent[prefCol] === true && !opts.storeSlotOff;
        if (!ok) return { update_dedicated_agent_assignments: { affected_rows: 0, returning: [] } };
        Object.assign(r, vars.set);
        return { update_dedicated_agent_assignments: { affected_rows: 1, returning: [{ ...r }] } };
      }
      throw new Error('unexpected mutation');
    }),
  };
  const config = { getConfig: jest.fn(async () => ({ enabled: opts.flag ?? true })) };
  const assignments = {
    statusChanged: jest.fn((r: Loose[], from: string, to: string, cause: string) =>
      statusChanges.push(...r.map((x) => ({ id: x.id, from, to, cause })))
    ),
  };
  const gate = { canOperate: jest.fn(async () => opts.contractSigned ?? true) };
  const site = {};
  void events;
  const service = new AgentSlotPrefsService(
    hasura as unknown as HasuraSystemService,
    config as unknown as DedicatedAgentsConfigService,
    assignments as unknown as DedicatedAssignmentsService,
    gate as unknown as AgentContractGateService,
    site as unknown as SiteEventsService
  );
  return { service, agent, rows, mutations, events, statusChanges, hasura };
}

jest.mock('../site-events/server-site-events.helper', () => ({
  emitServerSiteEvent: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const helper = require('../site-events/server-site-events.helper') as { emitServerSiteEvent: jest.Mock };
const eventsOf = (type: string) => helper.emitServerSiteEvent.mock.calls.filter((c) => c[1] === type).map((c) => c[2]);

beforeEach(() => helper.emitServerSiteEvent.mockClear());

describe('AgentSlotPrefsService (#594 addendum PR1)', () => {
  it('GET returns all ON for a backfilled agent', async () => {
    const { service } = setup();
    await expect(service.get(USER)).resolves.toEqual({
      preferences: { morning: true, afternoon: true, evening: true },
      allOff: false,
    });
  });

  it('GET 404s a user without an agent persona', async () => {
    const { service } = setup();
    await expect(service.get('someone-else')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('turning ON never confirms and is idempotent (no write on a repeat)', async () => {
    const { service, mutations } = setup({ agent: { pref_evening: false } });
    const res = await service.update(USER, { evening: true });
    expect(res.preferences.evening).toBe(true);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].vars).toEqual({ agentId: AGENT, prefs: { pref_evening: true } });
    expect(eventsOf('pref_slot.toggled')).toEqual([{ agentId: AGENT, slot: 'evening', on: true, had_assignment: false }]);
    await service.update(USER, { evening: true });
    expect(mutations).toHaveLength(1);
  });

  it('turning OFF without assignments saves at once', async () => {
    const { service, mutations } = setup({ rows: [{ id: 'a1', slot_key: 'evening', status: 'active' }] });
    const res = await service.update(USER, { morning: false });
    expect(res).toEqual({
      preferences: { morning: false, afternoon: true, evening: true },
      allOff: false,
      pausedAssignmentIds: [],
    });
    expect(mutations[0].vars.offSlots).toEqual(['morning']);
  });

  it('turning OFF with an active assignment 409s with the stores and writes nothing (Keep on)', async () => {
    const { service, mutations, agent } = setup({
      rows: [
        { id: 'a1', slot_key: 'morning', status: 'active' },
        { id: 'a2', slot_key: 'morning', status: 'paused', pause_reason: 'paused_business' },
      ],
    });
    const err = await service.update(USER, { morning: false }).catch((e: Loose) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({
      code: 'slot_has_dedicated_assignments',
      slots: ['morning'],
      stores: [{ assignmentId: 'a1', locationId: 'loc-1', storeName: 'Shop A', slotKey: 'morning' }],
    });
    expect(mutations).toHaveLength(0);
    expect(agent.pref_morning).toBe(true);
  });

  it('confirm pauses all that slot\'s active assignments with paused_slot_off and logs events once', async () => {
    const { service, rows, statusChanges, mutations } = setup({
      rows: [
        { id: 'a1', slot_key: 'morning', status: 'active' },
        { id: 'a3', slot_key: 'morning', status: 'active', business_location_id: 'loc-2' },
        { id: 'a4', slot_key: 'evening', status: 'active' },
      ],
    });
    const res = await service.update(USER, { morning: false, confirmPause: true });
    expect(res.pausedAssignmentIds).toEqual(['a1', 'a3']);
    expect(mutations[0].vars.pauseSet).toMatchObject({
      status: 'paused',
      paused_by_user_id: USER,
      pause_reason: 'paused_slot_off',
    });
    expect(typeof mutations[0].vars.pauseSet.paused_at).toBe('string');
    expect(rows.find((r) => r.id === 'a4')?.status).toBe('active');
    expect(statusChanges).toEqual([
      { id: 'a1', from: 'active', to: 'paused', cause: 'agent_slot_off' },
      { id: 'a3', from: 'active', to: 'paused', cause: 'agent_slot_off' },
    ]);
    expect(eventsOf('pref_slot.assignment_paused')).toHaveLength(2);
    expect(eventsOf('pref_slot.toggled')).toEqual([{ agentId: AGENT, slot: 'morning', on: false, had_assignment: true }]);
    // Rapid re-toggle: already off -> no write, no duplicate pause events.
    await service.update(USER, { morning: false, confirmPause: true });
    expect(mutations).toHaveLength(1);
    expect(eventsOf('pref_slot.assignment_paused')).toHaveLength(2);
  });

  it('logs all_off_state when the last slot goes off', async () => {
    const { service } = setup({ agent: { pref_morning: false, pref_afternoon: false } });
    const res = await service.update(USER, { evening: false });
    expect(res.allOff).toBe(true);
    expect(eventsOf('pref_slot.all_off_state')).toEqual([{ agentId: AGENT, allOff: true }]);
  });

  it('rejects bad bodies', () => {
    expect(() => parseChanges({})).toThrow(BadRequestException);
    expect(() => parseChanges({ morning: 'no' })).toThrow(BadRequestException);
    expect(parseChanges({ morning: false, night: true } as Loose)).toEqual({ morning: false });
  });

  describe('resume (AC-P5)', () => {
    const paused = { id: 'a1', slot_key: 'morning', status: 'paused', pause_reason: 'paused_slot_off' };

    it('refuses while the slot pref is still OFF (no auto-resume, P5)', async () => {
      const { service } = setup({ agent: { pref_morning: false }, rows: [paused] });
      const err = await service.resume(USER, 'a1').catch((e: Loose) => e);
      expect(err.getResponse()).toMatchObject({ code: 'slot_pref_off', slotKey: 'morning' });
    });

    it('turning the slot back ON does not resume the assignment', async () => {
      const { service, rows } = setup({ agent: { pref_morning: false }, rows: [paused] });
      await service.update(USER, { morning: true });
      expect(rows[0].status).toBe('paused');
    });

    it('resumes a slot-off pause once the slot is ON, clears pause_reason, logs events', async () => {
      const { service, rows, statusChanges } = setup({ rows: [paused] });
      const res = await service.resume(USER, 'a1');
      expect(res.assignment).toMatchObject({ status: 'active', pause_reason: null, paused_at: null });
      expect(rows[0].pause_reason).toBeNull();
      expect(statusChanges).toEqual([{ id: 'a1', from: 'paused', to: 'active', cause: 'agent_resume' }]);
      expect(eventsOf('pref_slot.assignment_resumed')).toHaveLength(1);
      // Idempotent.
      await expect(service.resume(USER, 'a1')).resolves.toMatchObject({ assignment: { status: 'active' } });
    });

    it.each([
      [{ is_verified: false }, 'not_verified'],
      [{ status: 'suspended' }, 'suspended'],
      [{ focus: 'commercial' }, 'commercial_focus'],
    ])('re-checks D5 eligibility %p -> %s', async (agentPatch, code) => {
      const { service } = setup({ agent: agentPatch, rows: [paused] });
      const err = await service.resume(USER, 'a1').catch((e: Loose) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({ code });
    });

    it('refuses an unsigned contract', async () => {
      const { service } = setup({ rows: [paused], contractSigned: false });
      const err = await service.resume(USER, 'a1').catch((e: Loose) => e);
      expect(err.getResponse()).toMatchObject({ code: 'contract_unsigned' });
    });

    it('agent cannot resume a business / admin pause', async () => {
      const { service } = setup({ rows: [{ ...paused, pause_reason: 'paused_business' }] });
      const err = await service.resume(USER, 'a1').catch((e: Loose) => e);
      expect(err.getResponse()).toMatchObject({ code: 'not_slot_off_pause' });
    });

    it('409s when the store slot was switched off (guarded write affects 0 rows)', async () => {
      const { service } = setup({ rows: [paused], storeSlotOff: true });
      const err = await service.resume(USER, 'a1').catch((e: Loose) => e);
      expect(err.getResponse()).toMatchObject({ code: 'assignment_changed' });
    });

    it('404s another agent\'s assignment and a flag-off country', async () => {
      const other = setup({ rows: [{ ...paused, agent_id: 'agent-2' }] });
      await expect(other.service.resume(USER, 'a1')).rejects.toBeInstanceOf(NotFoundException);
      const off = setup({ rows: [paused], flag: false });
      await expect(off.service.resume(USER, 'a1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
