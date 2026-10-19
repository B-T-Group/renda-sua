import type { SiteEventsService } from '../site-events/site-events.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { AgentContractGateService } from '../agent-contracts/agent-contract-gate.service';
import type { AgentHoldService } from '../agents/agent-hold.service';
import type { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import { DEDICATED_ASSIGNMENT_CONFLICTS } from './dedicated-assignment-write.util';
import {
  DedicatedAssignmentsService,
  defaultPickupTime,
  isPickupTimeWithinSlot,
} from './dedicated-assignments.service';
import { DedicatedCoverageService } from './dedicated-coverage.service';
import { dedicatedProfileIneligibleReason } from './dedicated-eligibility.util';
import { localDateTimeAt } from './dedicated-slot.util';

const LOC = 'loc-1';
const OTHER_LOC = 'loc-2';
const OWNER = 'u-owner';
const ADMIN = 'u-admin';
// Uppercase / mixed ids so the lock-order assertion checks the helper's lowercase sort.
const A1 = 'aaaaaaaa-0000-0000-0000-000000000001';
const A2 = 'BBBBBBBB-0000-0000-0000-000000000002';
const A3 = 'cccccccc-0000-0000-0000-000000000003';
const A4 = 'dddddddd-0000-0000-0000-000000000004';

/** GraphQL variables / rows as the fake receives them (shape varies per operation). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;
type Notice = Parameters<NotificationsService['sendDedicatedAgentNotice']>[0];

interface Row {
  id: string;
  business_location_id: string;
  agent_id: string;
  slot_key: string;
  status: string;
  source: string;
  assigned_by_user_id?: string | null;
  off_today_date: string | null;
  paused_at: string | null;
  paused_by_user_id?: string | null;
  removed_at: string | null;
  removed_by_user_id?: string | null;
  removed_reason?: string | null;
  posting_id?: string | null;
  created_at: string;
}

interface AgentFake {
  id: string;
  user_id: string;
  is_verified: boolean;
  is_internal: boolean;
  status: string;
  focus: string;
  user: { first_name: string; last_name: string; preferred_language: string | null; profile_picture_url: string | null };
}

/** Hasura errors as graphql-request surfaces them (message carries the Postgres text). */
function hasuraError(message: string, statusCode?: string) {
  const errors = [
    { message, extensions: { code: 'constraint-violation', ...(statusCode ? { internal: { error: { status_code: statusCode } } } : {}) } },
  ];
  return Object.assign(new Error(`${message}: ${JSON.stringify({ response: { errors } })}`), { response: { errors } });
}

/**
 * In-memory Hasura for the PR 3 reads and writes. Writes enforce what the
 * database enforces (cap trigger per agent, live-unique index per
 * location-slot-agent, guarded status transitions), so the service is tested
 * against behaviour, not canned answers.
 */
function world() {
  const state = {
    flag: true,
    cap: 3,
    country: 'CM',
    locations: new Map<string, { name: string; owner: string; ownerLang: string | null; business: string }>([
      [LOC, { name: 'Chez Mama', owner: OWNER, ownerLang: 'fr', business: 'biz-1' }],
      [OTHER_LOC, { name: 'Other', owner: 'u-other', ownerLang: 'en', business: 'biz-2' }],
    ]),
    delegates: [] as Array<{ user_id: string; location: string; permissions: string[]; lang: string | null; status: string }>,
    agents: new Map<string, AgentFake>(),
    rows: [] as Row[],
    pickup: [] as Array<{ business_location_id: string; slot_key: string; is_enabled: boolean; pickup_time: string | null }>,
    orders: [] as Array<{ assigned_agent_id: string; current_status: string; business_location_id: string; subtotal: number }>,
    faults: [] as Array<{ assigned_agent_id: string; business_location_id: string }>,
    accounts: [] as Array<{ user_id: string; currency: string; available_balance: number }>,
    deadlocksLeft: 0,
    mutations: [] as Array<{ op: string; vars: Loose }>,
    nextId: 1,
  };

  const agentView = (id: string) => {
    const a = state.agents.get(id);
    return a ? { ...a } : null;
  };
  const locationView = (id: string) => {
    const l = state.locations.get(id);
    return l ? { id, name: l.name, address: { country: state.country.toLowerCase(), state: 'Littoral' } } : null;
  };
  const rowView = (r: Row) => ({ ...r, agent: agentView(r.agent_id), business_location: locationView(r.business_location_id) });
  const live = (r: Row) => r.status === 'active' || r.status === 'paused';

  const insertRow = (o: Loose) => {
    const capCount = state.rows.filter((r) => r.agent_id === o.agent_id && live(r)).length;
    if (capCount >= state.cap) {
      throw hasuraError(
        `Check constraint violation. dedicated_agent_assignment_cap_exceeded: agent ${o.agent_id} already has ${capCount} live assignments (max ${state.cap})`
      );
    }
    if (state.rows.some((r) => live(r) && r.business_location_id === o.business_location_id && r.slot_key === o.slot_key && r.agent_id === o.agent_id)) {
      throw hasuraError(
        'Uniqueness violation. duplicate key value violates unique constraint "dedicated_agent_assignments_live_unique_idx"'
      );
    }
    const row: Row = {
      id: `as-${state.nextId++}`,
      off_today_date: null,
      paused_at: null,
      removed_at: null,
      created_at: new Date(2026, 9, state.nextId).toISOString(),
      ...o,
    };
    return row;
  };

  const applyUpdate = (where: { id: string; from: string[] }, set: Record<string, unknown>) => {
    const row = state.rows.find((r) => r.id === where.id && where.from.includes(r.status));
    if (!row) return [];
    Object.assign(row, set);
    return [row];
  };

  const executeQuery = jest.fn(async (query: string, vars: Loose) => {
    const op = /query (\w+)/.exec(query)?.[1] ?? '?';
    switch (op) {
      case 'DedicatedAgentsConfig':
        return {
          application_configurations: [
            { config_key: 'dedicated_agents_enabled', boolean_value: state.flag, country_code: null },
          ],
        };
      case 'DedicatedAssignmentLocation': {
        const l = state.locations.get(vars.locationId);
        return {
          business_locations_by_pk: l
            ? {
                id: vars.locationId,
                name: l.name,
                business_id: l.business,
                business: { id: l.business, name: `${l.name} SARL`, user_id: l.owner, user: { id: l.owner, preferred_language: l.ownerLang } },
                address: { country: state.country.toLowerCase(), state: 'Littoral' },
              }
            : null,
        };
      }
      case 'DedicatedAssignAgent':
        return { agents_by_pk: agentView(vars.agentId) };
      case 'DedicatedAgentByUser':
        return { agents: [...state.agents.values()].filter((a) => a.user_id === vars.userId).map((a) => ({ id: a.id, user_id: a.user_id })) };
      case 'DedicatedAssignmentById': {
        const r = state.rows.find((x) => x.id === vars.id);
        return { dedicated_agent_assignments_by_pk: r ? rowView(r) : null };
      }
      case 'DedicatedLocationLiveAssignments':
        return { dedicated_agent_assignments: state.rows.filter((r) => r.business_location_id === vars.locationId && live(r)).map(rowView) };
      case 'DedicatedAgentLiveAssignments':
        return { dedicated_agent_assignments: state.rows.filter((r) => r.agent_id === vars.agentId && live(r)).map(rowView) };
      case 'DedicatedNoticeDelegates':
        return {
          location_delegations: state.delegates
            .filter((d) => d.location === vars.locationId && d.status === 'active' && d.permissions.includes(vars.permission))
            .map((d) => ({ user_id: d.user_id, user: { preferred_language: d.lang } })),
        };
      case 'DedicatedLocationPickupSlots':
        return { business_location_pickup_slots: state.pickup.filter((p) => p.business_location_id === vars.locationId) };
      case 'DedicatedDeliverySlots':
        return {
          delivery_time_slots: [
            { id: 'm', state: 'Littoral', slot_name: 'Morning', slot_type: 'standard', start_time: '08:00:00', end_time: '12:00:00' },
            { id: 'a', state: 'Littoral', slot_name: 'Afternoon', slot_type: 'standard', start_time: '12:00:00', end_time: '16:00:00' },
            { id: 'e', state: 'Littoral', slot_name: 'Evening', slot_type: 'standard', start_time: '16:00:00', end_time: '20:00:00' },
          ].filter((s) => vars.states.includes(s.state)),
        };
      case 'DedicatedAgentLoad':
        return {
          orders: state.orders.filter((o) => vars.agentIds.includes(o.assigned_agent_id) && vars.activeStatuses.includes(o.current_status)),
          order_offers: [],
        };
      case 'DedicatedCardStats':
        return {
          delivered: state.orders.filter(
            (o) => o.business_location_id === vars.locationId && vars.agentIds.includes(o.assigned_agent_id) && vars.doneStatuses.includes(o.current_status)
          ),
          missed: state.faults
            .filter((f) => f.business_location_id === vars.locationId && vars.agentIds.includes(f.assigned_agent_id))
            .map((f) => ({ order: { assigned_agent_id: f.assigned_agent_id } })),
          recent: state.orders
            .filter((o) => o.business_location_id === vars.locationId && vars.doneStatuses.includes(o.current_status))
            .map((o) => ({ subtotal: o.subtotal })),
        };
      case 'DedicatedAgentBalances':
        return { accounts: state.accounts.filter((a) => vars.userIds.includes(a.user_id) && a.currency === vars.currency) };
      default:
        throw new Error(`unexpected query ${op}`);
    }
  });

  const executeMutation = jest.fn(async (mutation: string, vars: Loose) => {
    const op = /mutation (\w+)/.exec(mutation)?.[1] ?? '?';
    state.mutations.push({ op, vars: JSON.parse(JSON.stringify(vars)) });
    if (state.deadlocksLeft > 0) {
      state.deadlocksLeft--;
      throw hasuraError('database query error: deadlock detected', '40P01');
    }
    switch (op) {
      case 'InsertDedicatedAssignments': {
        // One transaction: all rows or none.
        const snapshot = state.rows.map((r) => ({ ...r }));
        try {
          const inserted = (vars.objects as Loose[]).map((o) => {
            const row = insertRow(o);
            state.rows.push(row);
            return row;
          });
          return { insert_dedicated_agent_assignments: { returning: inserted } };
        } catch (e) {
          state.rows = snapshot;
          throw e;
        }
      }
      case 'UpdateDedicatedAssignment': {
        const changed = applyUpdate({ id: vars.id, from: vars.from }, vars.set);
        return { update_dedicated_agent_assignments: { affected_rows: changed.length, returning: changed.map((r) => ({ ...r })) } };
      }
      case 'SaveDedicatedPickupSlots': {
        for (const s of vars.slots) {
          const existing = state.pickup.find((p) => p.business_location_id === s.business_location_id && p.slot_key === s.slot_key);
          if (existing) Object.assign(existing, { is_enabled: s.is_enabled, pickup_time: s.pickup_time });
          else state.pickup.push({ business_location_id: s.business_location_id, slot_key: s.slot_key, is_enabled: s.is_enabled, pickup_time: s.pickup_time });
        }
        let affected = 0;
        for (const u of vars.pauses ?? []) {
          affected += applyUpdate({ id: u.where.id._eq, from: [u.where.status._eq] }, u._set).length;
        }
        return { insert_business_location_pickup_slots: { affected_rows: vars.slots.length }, update_dedicated_agent_assignments_many: [{ affected_rows: affected }] };
      }
      default:
        throw new Error(`unexpected mutation ${op}`);
    }
  });

  const hasura = { executeQuery, executeMutation } as unknown as HasuraSystemService;
  const notices: Notice[] = [];
  const notifications = { sendDedicatedAgentNotice: jest.fn(async (p: Notice) => void notices.push(p)) };
  const deliveryConfig = {
    getTimezone: jest.fn(async () => 'Africa/Douala'),
    getCurrency: jest.fn(async () => 'XAF'),
  };
  const agentHold = {
    resolveOrderHoldWithCeiling: jest.fn(async (subtotal: number) => ({ holdAmount: Math.round(subtotal * 0.5) })),
  };
  const config = new DedicatedAgentsConfigService(hasura);
  const coverage = new DedicatedCoverageService(
    hasura,
    config,
    agentHold as unknown as AgentHoldService,
    { signedIdsOrSkip: jest.fn(async () => null) } as unknown as AgentContractGateService,
    deliveryConfig as unknown as DeliveryConfigService
  );
  const siteEvents = { trackEvent: jest.fn().mockResolvedValue(undefined) };
  const events = (type: string) =>
    siteEvents.trackEvent.mock.calls
      .map((c) => c[0] as { eventType: string; metadata: Record<string, unknown> })
      .filter((e) => e.eventType === type)
      .map((e) => e.metadata);
  const service = new DedicatedAssignmentsService(
    hasura,
    config,
    coverage,
    deliveryConfig as unknown as DeliveryConfigService,
    agentHold as unknown as AgentHoldService,
    notifications as unknown as NotificationsService,
    siteEvents as unknown as SiteEventsService
  );

  const addAgent = (id: string, over: Partial<AgentFake> & { lang?: string | null } = {}) => {
    state.agents.set(id, {
      id,
      user_id: `u-${id}`,
      is_verified: true,
      is_internal: false,
      status: 'active',
      focus: 'delivery',
      user: { first_name: 'Paul', last_name: 'Biya', preferred_language: over.lang === undefined ? 'en' : over.lang, profile_picture_url: 'https://x/p.png' },
      ...over,
    });
  };
  const seedRow = (over: Partial<Row> & { agent_id: string; slot_key: string }): Row => {
    const row: Row = {
      id: `seed-${state.nextId++}`,
      business_location_id: LOC,
      status: 'active',
      source: 'posting',
      off_today_date: null,
      paused_at: null,
      removed_at: null,
      created_at: new Date(2026, 8, state.nextId).toISOString(),
      ...over,
    };
    state.rows.push(row);
    return row;
  };
  const writes = (op: string) => state.mutations.filter((m) => m.op === op);
  return { state, service, notifications, notices, executeMutation, executeQuery, addAgent, seedRow, writes, agentHold, events };
}

const assign = (w: ReturnType<typeof world>, agentId: string, slotKeys: unknown, locationId = LOC) =>
  w.service.superUserAssign({ actorUserId: ADMIN, locationId, agentId, slotKeys });

async function expectConflict(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e) => e
  );
  expect(err).toBeInstanceOf(ConflictException);
  expect((err as ConflictException).getResponse()).toMatchObject({ code });
}

describe('DedicatedAssignmentsService — super-user assign (AC-S2)', () => {
  it('creates active superuser_assign rows at once and notifies business owner, managing delegates and agent (FR/EN)', async () => {
    const w = world();
    w.addAgent(A1, { lang: 'en' });
    w.state.delegates.push(
      { user_id: 'u-del-ok', location: LOC, permissions: ['delegation.dedicated_agents.manage'], lang: 'en', status: 'active' },
      { user_id: 'u-del-noperm', location: LOC, permissions: ['delegation.orders.manage'], lang: 'en', status: 'active' },
      { user_id: 'u-del-revoked', location: LOC, permissions: ['delegation.dedicated_agents.manage'], lang: 'en', status: 'revoked' },
      { user_id: OWNER, location: LOC, permissions: ['delegation.dedicated_agents.manage'], lang: 'en', status: 'active' }
    );

    const res = await assign(w, A1, ['evening', 'morning']);

    expect(res.assignments.map((a) => [a.slot_key, a.status, a.source])).toEqual([
      ['evening', 'active', 'superuser_assign'],
      ['morning', 'active', 'superuser_assign'],
    ]);
    expect(w.state.rows.every((r) => r.assigned_by_user_id === ADMIN && r.status === 'active')).toBe(true);

    const byUser = Object.fromEntries(w.notices.map((n) => [n.userId, n]));
    expect(Object.keys(byUser).sort()).toEqual([OWNER, 'u-del-ok', `u-${A1}`].sort());
    // Owner prefers French, the delegate English; owner is notified once even if also a delegate.
    expect(w.notices.filter((n) => n.userId === OWNER)).toHaveLength(1);
    expect(byUser[OWNER]).toMatchObject({
      body: 'RendaSua a affecté Paul Biya au créneau Soir, Matin',
      messageType: 'DEDICATED_AGENT_ASSIGNED',
      persona: 'business',
      path: `/business/locations/${LOC}/dedicated-agents`,
      assignmentId: res.assignments[0].id,
      locationId: LOC,
    });
    expect(byUser['u-del-ok'].body).toBe('RendaSua assigned Paul Biya to Evening, Morning');
    expect(byUser[`u-${A1}`]).toMatchObject({
      body: "You're now dedicated to Chez Mama (Evening, Morning)",
      messageType: 'DEDICATED_AGENT_ASSIGNED',
      persona: 'agent',
      path: '/agent/dedicated-assignments',
    });
  });

  it('notifies the agent in French when that is their language', async () => {
    const w = world();
    w.addAgent(A1, { lang: 'fr' });
    await assign(w, A1, ['afternoon']);
    expect(w.notices.find((n) => n.userId === `u-${A1}`)?.body).toBe(
      'Vous êtes désormais livreur dédié de Chez Mama (Après-midi)'
    );
  });

  it('accepts internal agents and verified independents, rejects unverified independents (400, no write)', async () => {
    const w = world();
    w.addAgent(A1, { is_internal: true });
    w.addAgent(A2, { is_verified: false });
    await expect(assign(w, A1, ['morning'])).resolves.toBeDefined();
    const err = await assign(w, A2, ['morning']).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()).toMatchObject({ code: 'agent_not_verified' });
    expect(w.state.rows.filter((r) => r.agent_id === A2)).toHaveLength(0);
  });

  it('rejects a suspended agent', async () => {
    const w = world();
    w.addAgent(A1, { status: 'suspended' });
    await expect(assign(w, A1, ['morning'])).rejects.toBeInstanceOf(BadRequestException);
    expect(w.writes('InsertDedicatedAssignments')).toHaveLength(0);
  });

  it('a 4th live assignment is refused by the cap (409 cap code) and nobody is notified', async () => {
    const w = world();
    w.addAgent(A1);
    w.seedRow({ agent_id: A1, slot_key: 'morning', business_location_id: OTHER_LOC });
    w.seedRow({ agent_id: A1, slot_key: 'evening', business_location_id: OTHER_LOC, status: 'paused', paused_at: 'x' });
    await assign(w, A1, ['morning']);
    w.notices.length = 0;
    await expectConflict(assign(w, A1, ['afternoon']), DEDICATED_ASSIGNMENT_CONFLICTS.capExceeded);
    expect(w.state.rows.filter((r) => r.agent_id === A1 && r.status !== 'removed')).toHaveLength(3);
    expect(w.notices).toHaveLength(0);
  });

  it('a removed assignment frees a cap place', async () => {
    const w = world();
    w.addAgent(A1);
    for (const slot of ['morning', 'afternoon', 'evening']) w.seedRow({ agent_id: A1, slot_key: slot, business_location_id: OTHER_LOC });
    w.state.rows[0].status = 'removed';
    w.state.rows[0].removed_at = 'x';
    await expect(assign(w, A1, ['morning'])).resolves.toBeDefined();
  });

  it('assigning the same agent to the same live slot again is a 409 duplicate', async () => {
    const w = world();
    w.addAgent(A1);
    await assign(w, A1, ['morning']);
    await expectConflict(assign(w, A1, ['morning']), DEDICATED_ASSIGNMENT_CONFLICTS.duplicate);
  });

  it('retries a 40P01 deadlock abort and then succeeds (one row, one set of notices)', async () => {
    const w = world();
    w.addAgent(A1);
    w.state.deadlocksLeft = 2;
    await assign(w, A1, ['morning']);
    expect(w.writes('InsertDedicatedAssignments')).toHaveLength(3);
    expect(w.state.rows).toHaveLength(1);
    expect(w.notices.filter((n) => n.userId === `u-${A1}`)).toHaveLength(1);
  });

  it('gives up after 3 deadlock attempts and surfaces the error', async () => {
    const w = world();
    w.addAgent(A1);
    w.state.deadlocksLeft = 5;
    await expect(assign(w, A1, ['morning'])).rejects.toThrow(/deadlock detected/);
    expect(w.writes('InsertDedicatedAssignments')).toHaveLength(3);
    expect(w.notices).toHaveLength(0);
  });

  it('refuses a slot the store has turned off', async () => {
    const w = world();
    w.addAgent(A1);
    w.state.pickup.push({ business_location_id: LOC, slot_key: 'evening', is_enabled: false, pickup_time: null });
    await expectConflict(assign(w, A1, ['evening']), 'slot_disabled');
  });

  it('validates slot keys', async () => {
    const w = world();
    w.addAgent(A1);
    await expect(assign(w, A1, [])).rejects.toBeInstanceOf(BadRequestException);
    await expect(assign(w, A1, ['night'])).rejects.toBeInstanceOf(BadRequestException);
    await expect(assign(w, A1, 'morning')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('flag off: 404 and nothing written or sent', async () => {
    const w = world();
    w.state.flag = false;
    w.addAgent(A1);
    await expect(assign(w, A1, ['morning'])).rejects.toBeInstanceOf(NotFoundException);
    expect(w.executeMutation).not.toHaveBeenCalled();
    expect(w.notices).toHaveLength(0);
  });
});

describe('DedicatedAssignmentsService — business pause / resume / remove', () => {
  it('pause sets paused_at / paused_by from active only and notifies the agent', async () => {
    const w = world();
    w.addAgent(A1, { lang: 'fr' });
    const row = w.seedRow({ agent_id: A1, slot_key: 'morning' });
    await w.service.setPaused({ userId: OWNER, locationId: LOC }, row.id, true);
    expect(row).toMatchObject({ status: 'paused', paused_by_user_id: OWNER });
    expect(row.paused_at).toEqual(expect.any(String));
    expect(w.writes('UpdateDedicatedAssignment')[0].vars.from).toEqual(['active']);
    expect(w.notices).toEqual([
      expect.objectContaining({
        userId: `u-${A1}`,
        body: 'Chez Mama a mis en pause votre créneau dédié (Matin)',
        messageType: 'DEDICATED_AGENT_PAUSED',
      }),
    ]);
  });

  it('resume clears the pause and notifies; resuming into a turned-off slot is refused', async () => {
    const w = world();
    w.addAgent(A1);
    const row = w.seedRow({ agent_id: A1, slot_key: 'morning', status: 'paused', paused_at: 'x', paused_by_user_id: OWNER });
    await w.service.setPaused({ userId: OWNER, locationId: LOC }, row.id, false);
    expect(row).toMatchObject({ status: 'active', paused_at: null, paused_by_user_id: null });
    expect(w.notices[0]).toMatchObject({ body: 'Chez Mama resumed your dedicated slot (Morning)', messageType: 'DEDICATED_AGENT_RESUMED' });

    const other = w.seedRow({ agent_id: A1, slot_key: 'evening', status: 'paused', paused_at: 'x' });
    w.state.pickup.push({ business_location_id: LOC, slot_key: 'evening', is_enabled: false, pickup_time: null });
    await expectConflict(w.service.setPaused({ userId: OWNER, locationId: LOC }, other.id, false), 'slot_disabled');
    expect(other.status).toBe('paused');
  });

  it('is idempotent: pausing a paused row writes nothing and sends nothing', async () => {
    const w = world();
    w.addAgent(A1);
    const row = w.seedRow({ agent_id: A1, slot_key: 'morning', status: 'paused', paused_at: 'x' });
    await w.service.setPaused({ userId: OWNER, locationId: LOC }, row.id, true);
    expect(w.executeMutation).not.toHaveBeenCalled();
    expect(w.notices).toHaveLength(0);
  });

  it('a business caller cannot touch another location’s assignment (404)', async () => {
    const w = world();
    w.addAgent(A1);
    const row = w.seedRow({ agent_id: A1, slot_key: 'morning', business_location_id: OTHER_LOC });
    await expect(w.service.setPaused({ userId: OWNER, locationId: LOC }, row.id, true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(w.service.remove({ userId: OWNER, locationId: LOC }, row.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(row.status).toBe('active');
  });

  it('a lost race (row changed underneath) is a 409, not a silent success', async () => {
    const w = world();
    w.addAgent(A1);
    const row = w.seedRow({ agent_id: A1, slot_key: 'morning' });
    w.executeMutation.mockImplementationOnce(async () => ({
      update_dedicated_agent_assignments: { affected_rows: 0, returning: [] },
    }));
    await expectConflict(w.service.setPaused({ userId: OWNER, locationId: LOC }, row.id, true), 'assignment_changed');
    expect(w.notices).toHaveLength(0);
  });

  it('remove is audited (by, at, reason), works from paused, never touches the posting, and notifies the agent', async () => {
    const w = world();
    w.addAgent(A1);
    const row = w.seedRow({ agent_id: A1, slot_key: 'afternoon', status: 'paused', paused_at: 'x', posting_id: 'post-1' });
    await w.service.remove({ userId: 'u-del-ok', locationId: LOC }, row.id, `  late every day ${'x'.repeat(600)}`);
    expect(row).toMatchObject({ status: 'removed', removed_by_user_id: 'u-del-ok', posting_id: 'post-1' });
    expect(row.removed_at).toEqual(expect.any(String));
    expect(row.removed_reason?.startsWith('late every day')).toBe(true);
    expect(row.removed_reason).toHaveLength(500);
    expect(w.writes('UpdateDedicatedAssignment')[0].vars.from).toEqual(['active', 'paused']);
    expect(w.state.mutations.map((m) => m.op)).toEqual(['UpdateDedicatedAssignment']);
    expect(w.notices[0]).toMatchObject({
      body: 'Chez Mama removed you as a dedicated agent (Afternoon)',
      messageType: 'DEDICATED_AGENT_REMOVED',
    });
  });

  it('pause and remove also retry a 40P01 abort', async () => {
    const w = world();
    w.addAgent(A1);
    const row = w.seedRow({ agent_id: A1, slot_key: 'morning' });
    w.state.deadlocksLeft = 1;
    await w.service.remove({ userId: OWNER, locationId: LOC }, row.id, null);
    expect(w.writes('UpdateDedicatedAssignment')).toHaveLength(2);
    expect(row.status).toBe('removed');
    expect(row.removed_reason).toBeNull();
  });

  it('flag off: pause/remove are 404', async () => {
    const w = world();
    w.addAgent(A1);
    const row = w.seedRow({ agent_id: A1, slot_key: 'morning' });
    w.state.flag = false;
    await expect(w.service.setPaused({ userId: OWNER, locationId: LOC }, row.id, true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(w.service.remove({ userId: OWNER, locationId: LOC }, row.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(w.executeMutation).not.toHaveBeenCalled();
  });
});

describe('DedicatedAssignmentsService — Off today and My stores (Africa/Douala)', () => {
  // 23:30 UTC on Oct 18 is 00:30 on Oct 19 in Douala (UTC+1): the local day decides.
  const LATE = new Date('2026-10-18T23:30:00Z');
  const NEXT_DAY = new Date('2026-10-19T23:30:00Z');

  it('sets off_today_date to the local date; it hides the agent that day and not the next', async () => {
    const w = world();
    w.addAgent(A1);
    const row = w.seedRow({ agent_id: A1, slot_key: 'morning' });
    const res = await w.service.setOffToday(`u-${A1}`, row.id, true, LATE);
    expect(res.localDate).toBe('2026-10-19');
    expect(row.off_today_date).toBe('2026-10-19');

    const facts = {
      assignmentStatus: row.status,
      offTodayDate: row.off_today_date,
      isVerified: true,
      isInternal: false,
      agentStatus: 'active',
      focus: 'delivery',
      contractSigned: true,
      activeOrders: 0,
      outstandingDedicatedOffers: 0,
    };
    const ctxAt = (at: Date) => ({
      localToday: localDateTimeAt(at, 'Africa/Douala').date,
      maxActiveOrders: 10,
      rail: 'mobile_money' as const,
      verifiedAgentDelivery: false,
    });
    expect(dedicatedProfileIneligibleReason(facts, ctxAt(LATE))).toBe('off_today');
    expect(dedicatedProfileIneligibleReason(facts, ctxAt(NEXT_DAY))).toBeNull();

    expect((await w.service.listMine(`u-${A1}`, LATE)).assignments[0].offToday).toBe(true);
    expect((await w.service.listMine(`u-${A1}`, NEXT_DAY)).assignments[0].offToday).toBe(false);
  });

  it('turning Off today off clears the date', async () => {
    const w = world();
    w.addAgent(A1);
    const row = w.seedRow({ agent_id: A1, slot_key: 'morning', off_today_date: '2026-10-19' });
    await w.service.setOffToday(`u-${A1}`, row.id, false, LATE);
    expect(row.off_today_date).toBeNull();
  });

  it('an agent cannot set Off today on someone else’s assignment (404), nor with a non-boolean', async () => {
    const w = world();
    w.addAgent(A1);
    w.addAgent(A2);
    const row = w.seedRow({ agent_id: A2, slot_key: 'morning' });
    await expect(w.service.setOffToday(`u-${A1}`, row.id, true, LATE)).rejects.toBeInstanceOf(NotFoundException);
    await expect(w.service.setOffToday(`u-${A2}`, row.id, 'yes' as unknown as boolean, LATE)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(row.off_today_date).toBeNull();
  });

  it('Off today on a removed assignment is refused', async () => {
    const w = world();
    w.addAgent(A1);
    const row = w.seedRow({ agent_id: A1, slot_key: 'morning', status: 'removed', removed_at: 'x' });
    await expectConflict(w.service.setOffToday(`u-${A1}`, row.id, true, LATE), 'assignment_removed');
  });

  it('My stores lists live assignments with store, slot hours, status and active/max; removed ones are hidden', async () => {
    const w = world();
    w.addAgent(A1);
    w.seedRow({ agent_id: A1, slot_key: 'evening', status: 'paused', paused_at: 'x', source: 'superuser_assign' });
    w.seedRow({ agent_id: A1, slot_key: 'morning', status: 'removed', removed_at: 'x' });
    w.state.orders.push(
      { assigned_agent_id: A1, current_status: 'in_transit', business_location_id: OTHER_LOC, subtotal: 1 },
      { assigned_agent_id: A1, current_status: 'delivered', business_location_id: LOC, subtotal: 1 }
    );
    const { assignments } = await w.service.listMine(`u-${A1}`, LATE);
    expect(assignments).toEqual([
      expect.objectContaining({
        storeName: 'Chez Mama',
        slotKey: 'evening',
        startTime: '16:00',
        endTime: '20:00',
        status: 'paused',
        source: 'superuser_assign',
        activeOrders: 1,
        maxActiveOrders: 10,
      }),
    ]);
  });

  it('flag off: My stores is empty and Off today is 404', async () => {
    const w = world();
    w.addAgent(A1);
    const row = w.seedRow({ agent_id: A1, slot_key: 'morning' });
    w.state.flag = false;
    expect((await w.service.listMine(`u-${A1}`, LATE)).assignments).toEqual([]);
    await expect(w.service.setOffToday(`u-${A1}`, row.id, true, LATE)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DedicatedAssignmentsService — pickup slots (AC-B1, B2, B4)', () => {
  const actor = { userId: OWNER, locationId: LOC };

  it('defaults: all on, pickup time = slot start + 30 min', async () => {
    const w = world();
    const { slots } = await w.service.getPickupSlots(LOC);
    expect(slots.map((s) => [s.slotKey, s.isEnabled, s.startTime, s.endTime, s.pickupTime])).toEqual([
      ['morning', true, '08:00', '12:00', '08:30'],
      ['afternoon', true, '12:00', '16:00', '12:30'],
      ['evening', true, '16:00', '20:00', '16:30'],
    ]);
  });

  it('saves a pickup time inside the slot and refuses one outside it', async () => {
    const w = world();
    await w.service.updatePickupSlots(actor, { slots: [{ slotKey: 'morning', pickupTime: '09:15' }] });
    expect(w.state.pickup).toEqual([{ business_location_id: LOC, slot_key: 'morning', is_enabled: true, pickup_time: '09:15' }]);
    expect(w.writes('SaveDedicatedPickupSlots')[0].vars.slots[0].updated_by_user_id).toBe(OWNER);

    for (const bad of ['12:00', '07:59', '25:00', 'soon']) {
      const err = await w.service.updatePickupSlots(actor, { slots: [{ slotKey: 'morning', pickupTime: bad }] }).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toMatchObject({ code: 'pickup_time_outside_slot' });
    }
    expect(w.state.pickup[0].pickup_time).toBe('09:15');
  });

  it('keeps the saved pickup time when only the toggle changes', async () => {
    const w = world();
    w.state.pickup.push({ business_location_id: LOC, slot_key: 'evening', is_enabled: true, pickup_time: '17:00:00' });
    await w.service.updatePickupSlots(actor, { slots: [{ slotKey: 'evening', isEnabled: false }] });
    expect(w.state.pickup[0]).toMatchObject({ is_enabled: false, pickup_time: '17:00:00' });
  });

  it('turning off a slot with active agents asks once (409 with the count) and writes nothing', async () => {
    const w = world();
    w.addAgent(A1);
    w.seedRow({ agent_id: A1, slot_key: 'evening' });
    const err = await w.service.updatePickupSlots(actor, { slots: [{ slotKey: 'evening', isEnabled: false }] }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({ code: 'slot_has_dedicated_agents', agentsToPause: 1 });
    expect(w.executeMutation).not.toHaveBeenCalled();
  });

  it('confirmed: pauses (not removes) the slot’s active agents in agent_id order, in the same write, and notifies them', async () => {
    const w = world();
    for (const id of [A1, A2, A3, A4]) w.addAgent(id);
    const r3 = w.seedRow({ agent_id: A3, slot_key: 'evening' });
    const r1 = w.seedRow({ agent_id: A1, slot_key: 'evening' });
    const r2 = w.seedRow({ agent_id: A2, slot_key: 'evening' });
    const already = w.seedRow({ agent_id: A4, slot_key: 'evening', status: 'paused', paused_at: 'old' });
    const morning = w.seedRow({ agent_id: A4, slot_key: 'morning' });

    const res = await w.service.updatePickupSlots(actor, {
      slots: [{ slotKey: 'evening', isEnabled: false }],
      confirmPauseAgents: true,
    });

    const save = w.writes('SaveDedicatedPickupSlots');
    expect(save).toHaveLength(1);
    expect(save[0].vars.pauses.map((p: Loose) => p.where.id._eq)).toEqual([r1.id, r2.id, r3.id]);
    expect([r1, r2, r3].every((r) => r.status === 'paused' && r.paused_by_user_id === OWNER)).toBe(true);
    expect(already.paused_at).toBe('old');
    expect(morning.status).toBe('active');
    expect(w.state.rows.some((r) => r.status === 'removed')).toBe(false);
    expect(res.pausedAssignmentIds.sort()).toEqual([r1.id, r2.id, r3.id].sort());
    expect(w.notices.map((n) => n.userId).sort()).toEqual([`u-${A1}`, `u-${A2}`, `u-${A3}`].sort());
    expect(res.slots.find((s) => s.slotKey === 'evening')?.isEnabled).toBe(false);
  });

  it('the pickup-slot write retries a 40P01 abort', async () => {
    const w = world();
    w.addAgent(A1);
    w.seedRow({ agent_id: A1, slot_key: 'evening' });
    w.state.deadlocksLeft = 1;
    await w.service.updatePickupSlots({ userId: OWNER, locationId: LOC }, { slots: [{ slotKey: 'evening', isEnabled: false }], confirmPauseAgents: true });
    expect(w.writes('SaveDedicatedPickupSlots')).toHaveLength(2);
    expect(w.state.rows[0].status).toBe('paused');
  });

  it('validates input and flag', async () => {
    const w = world();
    await expect(w.service.updatePickupSlots(actor, { slots: [] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      w.service.updatePickupSlots(actor, { slots: [{ slotKey: 'morning' }, { slotKey: 'morning' }] })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      w.service.updatePickupSlots(actor, { slots: [{ slotKey: 'morning', isEnabled: 'no' as unknown as boolean }] })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.executeMutation).not.toHaveBeenCalled();
    // Fresh world: the config service caches the flag for 30 s.
    const off = world();
    off.state.flag = false;
    await expect(off.service.updatePickupSlots(actor, { slots: [{ slotKey: 'morning' }] })).rejects.toBeInstanceOf(NotFoundException);
    await expect(off.service.getPickupSlots(LOC)).rejects.toBeInstanceOf(NotFoundException);
    expect(off.executeMutation).not.toHaveBeenCalled();
  });

  it('pickup time helpers', () => {
    expect(defaultPickupTime({ startTime: '16:00:00', endTime: '20:00:00' })).toBe('16:30');
    expect(defaultPickupTime({ startTime: '16:00', endTime: '16:20' })).toBe('16:19');
    expect(isPickupTimeWithinSlot('16:00', { startTime: '16:00', endTime: '20:00' })).toBe(true);
    expect(isPickupTimeWithinSlot('20:00', { startTime: '16:00', endTime: '20:00' })).toBe(false);
  });
});

describe('DedicatedAssignmentsService — business cards (AC-B7, B17)', () => {
  it('shows chips, load, balance coverage and this store’s deliveries / missed', async () => {
    const w = world();
    w.addAgent(A1, { is_internal: true });
    w.addAgent(A2);
    w.seedRow({ agent_id: A1, slot_key: 'morning', source: 'superuser_assign', off_today_date: '2026-10-18' });
    w.seedRow({ agent_id: A2, slot_key: 'morning', status: 'paused', paused_at: 'x' });
    w.seedRow({ agent_id: A2, slot_key: 'evening', status: 'removed', removed_at: 'x' });
    w.state.orders.push(
      { assigned_agent_id: A2, current_status: 'in_transit', business_location_id: OTHER_LOC, subtotal: 0 },
      { assigned_agent_id: A2, current_status: 'picked_up', business_location_id: LOC, subtotal: 0 },
      { assigned_agent_id: A2, current_status: 'delivered', business_location_id: LOC, subtotal: 10_000 },
      { assigned_agent_id: A2, current_status: 'complete', business_location_id: LOC, subtotal: 10_000 },
      { assigned_agent_id: A2, current_status: 'complete', business_location_id: OTHER_LOC, subtotal: 50_000 },
      { assigned_agent_id: A1, current_status: 'complete', business_location_id: LOC, subtotal: 10_000 }
    );
    w.state.faults.push({ assigned_agent_id: A2, business_location_id: LOC }, { assigned_agent_id: A2, business_location_id: OTHER_LOC });
    w.state.accounts.push({ user_id: `u-${A2}`, currency: 'XAF', available_balance: 12_000 });

    const { assignments, maxActiveOrders } = await w.service.listForLocation(LOC, new Date('2026-10-18T10:00:00Z'));
    expect(maxActiveOrders).toBe(10);
    expect(assignments).toHaveLength(2);
    const [internal, indep] = assignments;
    expect(internal).toMatchObject({
      assignedByRendasua: true,
      offToday: true,
      status: 'active',
      agent: { id: A1, firstName: 'Paul', isInternal: true, photoUrl: 'https://x/p.png' },
      availableBalance: null,
      balanceCoversOrders: null,
      deliveries: 1,
      missedDeliveries: 0,
    });
    // Typical subtotal 10 000 -> hold 5 000; 12 000 covers 2; 2 active (all stores) of 10.
    expect(indep).toMatchObject({
      assignedByRendasua: false,
      offToday: false,
      status: 'paused',
      activeOrders: 2,
      availableBalance: 12_000,
      balanceCoversOrders: 2,
      deliveries: 2,
      missedDeliveries: 1,
    });
    expect(w.agentHold.resolveOrderHoldWithCeiling).toHaveBeenCalledWith(10_000, A2, 'mobile_money');
    expect(w.agentHold.resolveOrderHoldWithCeiling).not.toHaveBeenCalledWith(expect.anything(), A1, expect.anything());
  });

  it('flag off: 404', async () => {
    const w = world();
    w.state.flag = false;
    await expect(w.service.listForLocation(LOC)).rejects.toBeInstanceOf(NotFoundException);
  });
});


describe('DedicatedAssignmentsService — PR 8 analytics (AC section 5)', () => {
  it('assignment_status_changed carries the source for assign, pause, resume and remove', async () => {
    const w = world();
    w.addAgent(A1);
    await assign(w, A1, ['morning']);
    const row = w.state.rows[0];
    await w.service.setPaused({ userId: OWNER, locationId: LOC }, row.id, true);
    await w.service.setPaused({ userId: ADMIN }, row.id, false);
    await w.service.remove({ userId: OWNER, locationId: LOC }, row.id, 'x');
    expect(w.events('dedicated.assignment_status_changed').map((e) => [e.source, e.from, e.to, e.cause])).toEqual([
      ['superuser_assign', null, 'active', 'superuser_assign'],
      ['superuser_assign', 'active', 'paused', 'business'],
      ['superuser_assign', 'paused', 'active', 'superuser'],
      ['superuser_assign', 'active', 'removed', 'business'],
    ]);
    expect(w.events('dedicated.assignment_status_changed')[0]).toMatchObject({ assignmentId: row.id, agentId: A1, businessLocationId: LOC, slotKey: 'morning' });
  });

  it('no event when nothing changed (idempotent pause / remove) or the write is refused', async () => {
    const w = world();
    w.addAgent(A1);
    const paused = w.seedRow({ agent_id: A1, slot_key: 'morning', status: 'paused', paused_at: 'x' });
    await w.service.setPaused({ userId: OWNER, locationId: LOC }, paused.id, true);
    const removed = w.seedRow({ agent_id: A1, slot_key: 'evening', status: 'removed', removed_at: 'x' });
    await w.service.remove({ userId: OWNER, locationId: LOC }, removed.id, null);
    expect(w.events('dedicated.assignment_status_changed')).toEqual([]);
  });

  it('turning a slot off reports each paused agent with cause slot_disabled', async () => {
    const w = world();
    for (const id of [A1, A2]) w.addAgent(id);
    w.seedRow({ agent_id: A2, slot_key: 'evening', source: 'superuser_assign' });
    w.seedRow({ agent_id: A1, slot_key: 'evening' });
    await w.service.updatePickupSlots({ userId: OWNER, locationId: LOC }, { slots: [{ slotKey: 'evening', isEnabled: false }], confirmPauseAgents: true });
    const got = w.events('dedicated.assignment_status_changed').map((e) => [e.agentId, e.source, e.to, e.cause]);
    expect(got).toHaveLength(2);
    expect(got).toEqual(
      expect.arrayContaining([
        [A1, 'posting', 'paused', 'slot_disabled'],
        [A2, 'superuser_assign', 'paused', 'slot_disabled'],
      ])
    );
  });

  it('off_today_toggled on set and clear, with the local date', async () => {
    const w = world();
    w.addAgent(A1);
    const row = w.seedRow({ agent_id: A1, slot_key: 'morning' });
    const LATE = new Date('2026-10-18T23:30:00Z');
    await w.service.setOffToday(`u-${A1}`, row.id, true, LATE);
    await w.service.setOffToday(`u-${A1}`, row.id, false, LATE);
    expect(w.events('dedicated.off_today_toggled')).toEqual([
      { assignmentId: row.id, agentId: A1, businessLocationId: LOC, slotKey: 'morning', off: true, localDate: '2026-10-19' },
      { assignmentId: row.id, agentId: A1, businessLocationId: LOC, slotKey: 'morning', off: false, localDate: '2026-10-19' },
    ]);
  });
});

describe('DedicatedAssignmentsService.pickerStats (AC-S2 picker)', () => {
  it('load for everyone; balance and orders covered only for independents; none when there is no typical order', async () => {
    const w = world();
    w.addAgent(A1, { is_internal: true });
    w.addAgent(A2);
    w.state.orders.push(
      { assigned_agent_id: A2, current_status: 'in_transit', business_location_id: OTHER_LOC, subtotal: 0 },
      { assigned_agent_id: A1, current_status: 'picked_up', business_location_id: LOC, subtotal: 0 },
      { assigned_agent_id: A2, current_status: 'delivered', business_location_id: LOC, subtotal: 10_000 }
    );
    w.state.accounts.push({ user_id: `u-${A2}`, currency: 'XAF', available_balance: 12_000 });
    const stats = await w.service.pickerStats(
      LOC,
      'CM',
      [
        { id: A1, userId: `u-${A1}`, isInternal: true },
        { id: A2, userId: `u-${A2}`, isInternal: false },
      ],
      new Date('2026-10-18T10:00:00Z')
    );
    expect(stats.get(A1)).toEqual({ activeOrders: 1, outstandingDedicatedOffers: 0, availableBalance: null, balanceCoversOrders: null });
    // Typical subtotal 10 000 -> hold 5 000; 12 000 covers 2 (1 active of 10).
    expect(stats.get(A2)).toEqual({ activeOrders: 1, outstandingDedicatedOffers: 0, availableBalance: 12_000, balanceCoversOrders: 2 });
    expect(w.agentHold.resolveOrderHoldWithCeiling).not.toHaveBeenCalledWith(expect.anything(), A1, expect.anything());

    const empty = world();
    empty.addAgent(A2);
    const none = await empty.service.pickerStats(LOC, 'CM', [{ id: A2, userId: `u-${A2}`, isInternal: false }]);
    expect(none.get(A2)).toMatchObject({ balanceCoversOrders: null, availableBalance: 0 });
    await expect(empty.service.pickerStats(LOC, 'CM', [])).resolves.toEqual(new Map());
  });
});
