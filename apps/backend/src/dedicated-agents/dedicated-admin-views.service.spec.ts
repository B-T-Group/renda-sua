import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { GeoScopeService } from '../rbac/geo-scope.service';
import type { GeoScope } from '../rbac/platform-permissions';
import type { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import {
  ADMIN_VIEW_MAX_PAGES,
  DedicatedAdminViewsService,
  deliveryShare,
  slotCoverage,
} from './dedicated-admin-views.service';
import { ADMIN_VIEW_LIMIT, DEDICATED_ADMIN_COVERAGE_QUERY } from './dedicated-admin-views.queries';
import type { DedicatedAssignmentsService } from './dedicated-assignments.service';
import type { DedicatedPostingsService } from './dedicated-postings.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose in-memory fixture rows
type Loose = Record<string, any>;
const op = (q: string) => /(?:query|mutation)\s+(\w+)/.exec(q)?.[1] ?? '';

/** Locations: CM Douala (biz-1), CM Yaoundé (biz-2), GA Libreville (biz-3, flag off). */
function world() {
  const state = {
    flags: new Map<string, boolean>([
      ['CM', true],
      ['GA', false],
    ]),
    locations: [
      { id: 'loc-dla', name: 'Chez Mama', business_id: 'biz-1', phone: null, order_alert_phone: null, mobile_payment_phone: null, address: { city: 'Douala', state: 'Littoral', country: 'CM' }, business: { id: 'biz-1', name: 'Mama', referred_by_agent_id: 'ag-ref', user: { phone_number: '+237699000001' } }, location_delegations: [{ user: { phone_number: '0655000002' } }] },
      { id: 'loc-yde', name: 'Yaoundé Shop', business_id: 'biz-2', phone: '+237699000009', order_alert_phone: null, mobile_payment_phone: null, address: { city: 'Yaoundé', state: 'Centre', country: 'CM' }, business: { id: 'biz-2', name: 'Y', referred_by_agent_id: null, user: { phone_number: null } }, location_delegations: [] },
      { id: 'loc-lbv', name: 'Libreville', business_id: 'biz-3', phone: null, order_alert_phone: null, mobile_payment_phone: null, address: { city: 'Libreville', state: 'Estuaire', country: 'GA' }, business: { id: 'biz-3', name: 'L', referred_by_agent_id: null, user: { phone_number: null } }, location_delegations: [] },
    ] as Loose[],
    assignments: [] as Loose[],
    postings: [] as Loose[],
    mutations: [] as Array<{ op: string; vars: Loose }>,
    queries: [] as Array<{ op: string; vars: Loose }>,
    agents: [] as Loose[],
    pageSize: ADMIN_VIEW_LIMIT,
  };
  const loc = (id: string) => state.locations.find((l) => l.id === id) as Loose;
  /** The fake applies the geo where the service builds: { country: { _in } } on the location address. */
  const inGeo = (where: Loose, address: Loose | undefined) => {
    const findGeo = (w: Loose): Loose | null => {
      if (!w || typeof w !== 'object') return null;
      if (w.business_location?.address) return w.business_location.address;
      if (w.address?.country?._in) return w.address;
      for (const part of w._and ?? []) {
        const g = findGeo(part);
        if (g) return g;
      }
      return null;
    };
    const g = findGeo(where);
    return !g || (g.country?._in as string[]).includes(address?.country);
  };
  const eqs = (where: Loose): Loose => {
    const out: Loose = {};
    for (const part of where._and ?? [where]) for (const [k, v] of Object.entries(part)) if ((v as Loose)?._eq !== undefined) out[k] = (v as Loose)._eq;
    return out;
  };
  const page = <T>(rows: T[], vars: Loose) => rows.slice(vars.offset ?? 0, (vars.offset ?? 0) + Math.min(vars.limit, state.pageSize));

  const executeQuery = jest.fn(async (q: string, vars: Loose) => {
    const name = op(q);
    state.queries.push({ op: name, vars });
    switch (name) {
      case 'DedicatedAdminAssignments': {
        const e = eqs(vars.where);
        const rows = state.assignments
          .map((a) => ({ ...a, business_location: loc(a.business_location_id) }))
          .filter((a) => inGeo(vars.where, a.business_location.address))
          .filter((a) => Object.entries(e).every(([k, v]) => a[k] === v));
        return { dedicated_agent_assignments: page(rows, vars) };
      }
      case 'DedicatedAdminAssignmentById': {
        const a = state.assignments.find((x) => x.id === vars.id);
        return { dedicated_agent_assignments_by_pk: a ? { ...a, business_location: loc(a.business_location_id) } : null };
      }
      case 'DedicatedAdminPostings': {
        const e = eqs(vars.where);
        const rows = state.postings
          .map((p) => ({ ...p, business_location: loc(p.business_location_id) }))
          .filter((p) => inGeo(vars.where, p.business_location.address))
          .filter((p) => Object.entries(e).every(([k, v]) => p[k] === v));
        return { dedicated_agent_postings: page(rows, vars) };
      }
      case 'DedicatedAdminPostingScope': {
        const p = state.postings.find((x) => x.id === vars.id);
        return { dedicated_agent_postings_by_pk: p ? { ...p, business_location: loc(p.business_location_id) } : null };
      }
      case 'DedicatedAdminCoverage': {
        const rows = state.locations
          .filter((l) => inGeo(vars.where, l.address))
          .filter((l) => (l.pickup_slots ?? []).length || state.assignments.some((a) => a.business_location_id === l.id))
          .map((l) => ({
            ...l,
            pickup_slots: l.pickup_slots ?? [],
            dedicated_agent_assignments: state.assignments.filter((a) => a.business_location_id === l.id && a.status === 'active'),
            orders: (l.orders ?? []).filter((o: Loose) => o.created_at >= vars.since),
          }));
        return { business_locations: page(rows, vars) };
      }
      case 'DedicatedPickerLocation':
        return { business_locations_by_pk: { address: loc(vars.id)?.address ?? null } };
      case 'DedicatedPickerAgents':
        return { agents: state.agents };
      default:
        throw new Error(`unexpected query ${name}`);
    }
  });
  const executeMutation = jest.fn(async (q: string, vars: Loose) => {
    const name = op(q);
    state.mutations.push({ op: name, vars });
    if (name === 'DismissDedicatedRelation') {
      const a = state.assignments.find((x) => x.id === vars.id && !x.relation_dismissed_at);
      if (a) {
        a.relation_dismissed_at = vars.at;
        a.relation_dismissed_by_user_id = vars.by;
      }
      return { update_dedicated_agent_assignments: { affected_rows: a ? 1 : 0 } };
    }
    throw new Error(`unexpected mutation ${name}`);
  });
  const hasura = { executeQuery, executeMutation } as unknown as HasuraSystemService;
  const config = { isEnabled: jest.fn(async (c: string) => state.flags.get(c) === true) };
  const geo = {
    addressWhere: jest.fn(async (scope: GeoScope) => (scope.all ? null : { country: { _in: scope.countries } })),
    assertBusiness: jest.fn(async (scope: GeoScope, businessId: string) => {
      if (scope.all) return;
      const l = state.locations.find((x) => x.business_id === businessId);
      if (!l || !scope.countries.includes(l.address.country)) throw new NotFoundException('Business not found');
    }),
  };
  const assignments = {
    locationBusinessId: jest.fn(async (id: string) => loc(id).business_id),
    pickerStats: jest.fn(async (_l: string, _c: string, agents: Array<{ id: string; isInternal: boolean }>) =>
      new Map(agents.map((a) => [a.id, { activeOrders: 2, outstandingDedicatedOffers: 1, balanceCoversOrders: a.isInternal ? null : 3 }]))
    ),
  };
  const postings = { close: jest.fn(async () => ({ posting: { id: 'p' }, autoDeclined: 2 })) };
  const contractGate = { isRequired: jest.fn(async () => true) };
  const service = new DedicatedAdminViewsService(
    hasura,
    config as unknown as DedicatedAgentsConfigService,
    geo as unknown as GeoScopeService,
    assignments as unknown as DedicatedAssignmentsService,
    postings as unknown as DedicatedPostingsService,
    contractGate as unknown as AgentContractGateService
  );
  let n = 0;
  const addAssignment = (over: Loose = {}) => {
    const a = {
      id: `as-${++n}`,
      business_location_id: 'loc-dla',
      agent_id: `ag-${n}`,
      slot_key: 'morning',
      status: 'active',
      source: 'posting',
      off_today_date: null,
      created_at: `2026-10-${String(n).padStart(2, '0')}T00:00:00Z`,
      relation_dismissed_at: null,
      agent: { id: `ag-${n}`, is_internal: false, is_verified: true, referred_by_business_id: null, mobile_payment_phone: null, user: { first_name: 'A', last_name: 'B', phone_number: `+23767000${String(n).padStart(4, '0')}`, profile_picture_url: null } },
      ...over,
    };
    state.assignments.push(a);
    return a;
  };
  return { state, service, geo, config, assignments, postings, contractGate, addAssignment, executeQuery };
}

const ALL: GeoScope = { all: true };
const CM: GeoScope = { all: false, countries: ['CM'], states: [] };
const GA: GeoScope = { all: false, countries: ['GA'], states: [] };

describe('DedicatedAdminViewsService.listAssignments (AC-S1, S5)', () => {
  it('filters by city (normalised), location, slot, status and source', async () => {
    const w = world();
    const a = w.addAssignment();
    w.addAssignment({ business_location_id: 'loc-yde' });
    w.addAssignment({ slot_key: 'evening', status: 'paused', source: 'superuser_assign' });
    const ids = async (f: Loose) => (await w.service.listAssignments(ALL, f)).assignments.map((x) => x.assignmentId);
    expect(await ids({ city: '  DOUALA city ' })).toEqual([a.id, 'as-3']);
    expect(await ids({ city: 'yaounde' })).toEqual(['as-2']);
    expect(await ids({ locationId: 'loc-yde' })).toEqual(['as-2']);
    expect(await ids({ slotKey: 'Evening' })).toEqual(['as-3']);
    expect(await ids({ status: 'paused' })).toEqual(['as-3']);
    expect(await ids({ source: 'posting' })).toEqual([a.id, 'as-2']);
  });

  it('rejects unknown filter values with 400', async () => {
    const w = world();
    for (const f of [{ slotKey: 'night' }, { status: 'gone' }, { source: 'invite' }]) {
      await expect(w.service.listAssignments(ALL, f)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('a geo-scoped super user only sees their countries; flag-off countries are hidden even for superuser', async () => {
    const w = world();
    w.addAssignment();
    w.addAssignment({ business_location_id: 'loc-lbv' });
    expect((await w.service.listAssignments(CM, {})).assignments.map((x) => x.location.country)).toEqual(['CM']);
    expect(w.geo.addressWhere).toHaveBeenCalledWith(CM);
    expect((await w.service.listAssignments(GA, {})).assignments).toEqual([]);
    // superuser: GA rows exist but the flag is off there
    expect((await w.service.listAssignments(ALL, {})).assignments.map((x) => x.location.country)).toEqual(['CM']);
    w.state.flags.set('GA', true);
    expect((await w.service.listAssignments(ALL, {})).assignments.map((x) => x.location.country).sort()).toEqual(['CM', 'GA']);
  });

  it('badge: shared phone with the owner, a delegate or the location; referral either way; internal never', async () => {
    const w = world();
    const owner = w.addAssignment();
    owner.agent.user.phone_number = '0699000001';
    const delegate = w.addAssignment();
    delegate.agent.mobile_payment_phone = { phone_e164: '+237655000002' };
    const shop = w.addAssignment({ business_location_id: 'loc-yde' });
    shop.agent.user.phone_number = '237699000009';
    const referred = w.addAssignment({ agent_id: 'ag-ref' });
    const byBusiness = w.addAssignment();
    byBusiness.agent.referred_by_business_id = 'biz-1';
    const plain = w.addAssignment();
    const internal = w.addAssignment({ agent_id: 'ag-ref' });
    internal.agent.is_internal = true;
    internal.agent.user.phone_number = '0699000001';
    const byId = Object.fromEntries(
      (await w.service.listAssignments(ALL, {})).assignments.map((x) => [x.assignmentId, [x.possible_relation, x.relation_signals]])
    );
    expect(byId).toEqual({
      [owner.id]: [true, ['shared_phone']],
      [delegate.id]: [true, ['shared_phone']],
      [shop.id]: [true, ['shared_phone']],
      [referred.id]: [true, ['referral_link']],
      [byBusiness.id]: [true, ['referral_link']],
      [plain.id]: [false, []],
      [internal.id]: [false, []],
    });
  });

  it('reads every page up to the cap and says when it stopped early', async () => {
    const w = world();
    w.state.pageSize = 2;
    for (let i = 0; i < 5; i++) w.addAssignment();
    const small = await w.service.listAssignments(ALL, {});
    // pages of 2 are "short" against ADMIN_VIEW_LIMIT, so the first page ends the read
    expect(small.truncated).toBe(false);
    w.state.pageSize = ADMIN_VIEW_LIMIT;
    for (let i = 0; i < ADMIN_VIEW_LIMIT * ADMIN_VIEW_MAX_PAGES; i++) w.addAssignment();
    const big = await w.service.listAssignments(ALL, {});
    expect(big.truncated).toBe(true);
    expect(big.assignments).toHaveLength(ADMIN_VIEW_LIMIT * ADMIN_VIEW_MAX_PAGES);
    const offsets = w.state.queries.filter((q) => q.op === 'DedicatedAdminAssignments').slice(-ADMIN_VIEW_MAX_PAGES).map((q) => q.vars.offset);
    expect(offsets).toEqual([0, 1, 2, 3, 4].map((p) => p * ADMIN_VIEW_LIMIT));
  });
});

describe('DedicatedAdminViewsService.dismissRelation (AC-S5)', () => {
  it('dismisses once (audited by and at); the badge stays off afterwards; a second call changes nothing', async () => {
    const w = world();
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const a = w.addAssignment({ agent_id: 'ag-ref' });
    const at = new Date('2026-10-19T12:00:00Z');
    await expect(w.service.dismissRelation(ALL, 'u-admin', a.id, at)).resolves.toEqual({
      assignmentId: a.id,
      relationDismissedAt: at.toISOString(),
      changed: true,
    });
    expect(a).toMatchObject({ relation_dismissed_at: at.toISOString(), relation_dismissed_by_user_id: 'u-admin' });
    expect(log.mock.calls.map((c) => JSON.parse(String(c[0])))).toContainEqual({
      event: 'dedicated.relation_dismissed',
      assignmentId: a.id,
      by: 'u-admin',
      at: at.toISOString(),
      changed: true,
    });
    const view = (await w.service.listAssignments(ALL, {})).assignments[0];
    expect(view).toMatchObject({ possible_relation: false, relation_signals: ['referral_link'], relation_dismissed: true });
    const again = await w.service.dismissRelation(ALL, 'u-other', a.id, new Date('2026-10-20T00:00:00Z'));
    expect(again).toEqual({ assignmentId: a.id, relationDismissedAt: at.toISOString(), changed: false });
    expect(w.state.mutations).toHaveLength(1);
    expect(a.relation_dismissed_by_user_id).toBe('u-admin');
    log.mockRestore();
  });

  it('404 out of scope, for an unknown id, and when the flag is off; nothing written', async () => {
    const w = world();
    const a = w.addAssignment();
    const ga = w.addAssignment({ business_location_id: 'loc-lbv' });
    await expect(w.service.dismissRelation(GA, 'u', a.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(w.service.dismissRelation(ALL, 'u', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    await expect(w.service.dismissRelation(ALL, 'u', ga.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(w.state.mutations).toEqual([]);
  });
});

describe('DedicatedAdminViewsService postings (AC-S3)', () => {
  const posting = (over: Loose) => ({ id: 'p', business_location_id: 'loc-dla', headcount: 2, accepted_count: 1, status: 'open', expires_at: 'x', created_at: 'x', closed_at: null, terms: null, slots: [{ slot_key: 'morning' }], pending: { aggregate: { count: 3 } }, ...over });

  it('lists per city and status, in scope and flag-on countries only', async () => {
    const w = world();
    w.state.postings.push(posting({ id: 'p1' }), posting({ id: 'p2', business_location_id: 'loc-yde', status: 'filled' }), posting({ id: 'p3', business_location_id: 'loc-lbv' }));
    expect((await w.service.listPostings(ALL, { city: 'douala' })).postings.map((p) => [p.id, p.pendingApplications, p.slotKeys])).toEqual([['p1', 3, ['morning']]]);
    expect((await w.service.listPostings(ALL, { status: 'filled' })).postings.map((p) => p.id)).toEqual(['p2']);
    expect((await w.service.listPostings(ALL, {})).postings.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect((await w.service.listPostings(GA, {})).postings).toEqual([]);
    await expect(w.service.listPostings(ALL, { status: 'gone' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('close goes through the business close for the posting’s own location, as the admin', async () => {
    const w = world();
    w.state.postings.push(posting({ id: 'p1' }));
    await expect(w.service.closePosting(CM, 'u-admin', 'p1', 'policy')).resolves.toEqual({ posting: { id: 'p' }, autoDeclined: 2 });
    expect(w.postings.close).toHaveBeenCalledWith({ userId: 'u-admin', locationId: 'loc-dla' }, 'p1', 'policy');
  });

  it('close out of scope or unknown is 404 and never reaches the close', async () => {
    const w = world();
    w.state.postings.push(posting({ id: 'p1' }));
    await expect(w.service.closePosting(GA, 'u', 'p1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(w.service.closePosting(ALL, 'u', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(w.postings.close).not.toHaveBeenCalled();
  });
});

describe('DedicatedAdminViewsService.coverage (AC-S4)', () => {
  it('2 covered / 1 uncovered enabled slot (one slot turned off), and the dedicated share (3 of 5) over 30 days', async () => {
    const w = world();
    const NOW = new Date('2026-10-19T12:00:00Z');
    Object.assign(w.state.locations[0], {
      pickup_slots: [{ slot_key: 'evening', is_enabled: true }],
      orders: [
        { assignment_source: 'dedicated_auto', created_at: '2026-10-18T00:00:00Z' },
        { assignment_source: 'dedicated_offer', created_at: '2026-10-10T00:00:00Z' },
        { assignment_source: 'dedicated_auto', created_at: '2026-10-15T00:00:00Z' },
        { assignment_source: 'offer', created_at: '2026-10-11T00:00:00Z' },
        { assignment_source: 'open_claim', created_at: '2026-10-12T00:00:00Z' },
        { assignment_source: 'dedicated_auto', created_at: '2026-09-01T00:00:00Z' },
      ],
    });
    Object.assign(w.state.locations[1], { pickup_slots: [{ slot_key: 'evening', is_enabled: false }] });
    w.addAssignment({ slot_key: 'morning' });
    w.addAssignment({ slot_key: 'afternoon' });
    w.addAssignment({ slot_key: 'evening', status: 'paused' });
    w.addAssignment({ business_location_id: 'loc-yde', slot_key: 'morning', status: 'removed' });

    const res = await w.service.coverage(ALL, {}, NOW);
    expect(res.locations).toEqual([
      expect.objectContaining({ locationId: 'loc-dla', enabledSlots: ['morning', 'afternoon', 'evening'], coveredSlots: ['morning', 'afternoon'], uncoveredSlots: ['evening'], orders: { dedicated: 3, standard: 2 } }),
      expect.objectContaining({ locationId: 'loc-yde', enabledSlots: ['morning', 'afternoon'], coveredSlots: [], uncoveredSlots: ['morning', 'afternoon'], orders: { dedicated: 0, standard: 0 } }),
    ]);
    expect(res.totals).toEqual({ enabledSlots: 5, coveredSlots: 2, uncoveredSlots: 3, dedicatedOrders: 3, standardOrders: 2, dedicatedShare: 0.6 });
    expect(w.state.queries.find((q) => q.op === 'DedicatedAdminCoverage')?.vars.since).toBe('2026-09-19T12:00:00.000Z');
  });

  it('city filter, scope and flag', async () => {
    const w = world();
    w.addAssignment();
    w.addAssignment({ business_location_id: 'loc-yde' });
    w.addAssignment({ business_location_id: 'loc-lbv' });
    expect((await w.service.coverage(ALL, { city: 'Yaounde' })).locations.map((l) => l.locationId)).toEqual(['loc-yde']);
    expect((await w.service.coverage(GA, {})).locations).toEqual([]);
    expect((await w.service.coverage(ALL, {})).totals.dedicatedShare).toBeNull();
  });

  it('helpers: no row = enabled; only an active assignment covers; unknown and NULL sources count as standard', () => {
    expect(slotCoverage([], [])).toEqual({ enabledSlots: ['morning', 'afternoon', 'evening'], coveredSlots: [], uncoveredSlots: ['morning', 'afternoon', 'evening'] });
    expect(slotCoverage([{ slot_key: 'morning', is_enabled: false }], ['morning'])).toEqual({ enabledSlots: ['afternoon', 'evening'], coveredSlots: [], uncoveredSlots: ['afternoon', 'evening'] });
    // QA #619 N1: every assigned order counts; NULL source (standard offer / open claim) = standard.
    expect(deliveryShare(['dedicated_auto', 'dedicated_offer', 'admin', 'offer', null, undefined])).toEqual({ dedicated: 2, standard: 4 });
    expect(deliveryShare([null, null, 'dedicated_auto'])).toEqual({ dedicated: 1, standard: 2 });
    // ...and the coverage query fetches every assigned order, not only stamped ones.
    expect(DEDICATED_ADMIN_COVERAGE_QUERY).toContain('assigned_agent_id: { _is_null: false }');
    expect(DEDICATED_ADMIN_COVERAGE_QUERY).not.toContain('assignment_source: { _is_null: false }');
  });
});

describe('DedicatedAdminViewsService.picker (AC-S2)', () => {
  const agent = (over: Loose) => ({ id: 'x', user_id: 'u-x', is_internal: false, is_verified: true, status: 'active', focus: 'delivery', user: { first_name: 'F', last_name: 'L', profile_picture_url: null }, live: { aggregate: { count: 1 } }, ...over });

  it('internal and verified independents with chip, assignment count, load and balance coverage; commercial-focus agents dropped', async () => {
    const w = world();
    w.state.agents = [agent({ id: 'int', is_internal: true, live: { aggregate: { count: 2 } } }), agent({ id: 'ind' }), agent({ id: 'sales', focus: 'commercial' })];
    const res = await w.service.picker(CM, 'loc-dla');
    expect(res.agents.map((a) => [a.id, a.chip, a.assignmentCount, a.activeOrders, a.balanceCoversOrders])).toEqual([
      ['int', 'internal', 2, 2, null],
      ['ind', 'verified_independent', 1, 2, 3],
    ]);
    // QA #619 N3: no raw balance in the response.
    expect(JSON.stringify(res)).not.toContain('availableBalance');
    const where = (w.executeQuery.mock.calls.find(([q]) => op(q) === 'DedicatedPickerAgents') as [string, Loose])[1].where;
    // QA #619 N4: verified for everyone (internal too), contracted while the flag is on.
    expect(JSON.stringify(where)).not.toContain('is_internal');
    expect(JSON.stringify(where)).toContain('"is_verified":{"_eq":true}');
    expect(JSON.stringify(where)).toContain('"agent_contracts":{"status":{"_eq":"signed"}}');
    expect(JSON.stringify(where)).toContain('"_not":{"status":{"_eq":"suspended"}}');
    expect(JSON.stringify(where)).toContain('"country":{"_ilike":"CM"}');
    expect(w.assignments.pickerStats).toHaveBeenCalledWith('loc-dla', 'CM', [
      { id: 'int', userId: 'u-x', isInternal: true },
      { id: 'ind', userId: 'u-x', isInternal: false },
      ], expect.any(Date));
  });

  it('QA #619 N4: with the contract flag off, unsigned agents are listed', async () => {
    const w = world();
    w.contractGate.isRequired.mockResolvedValue(false);
    w.state.agents = [agent({ id: 'ind' })];
    await w.service.picker(CM, 'loc-dla');
    const where = (w.executeQuery.mock.calls.find(([q]) => op(q) === 'DedicatedPickerAgents') as [string, Loose])[1].where;
    expect(JSON.stringify(where)).not.toContain('agent_contracts');
    expect(JSON.stringify(where)).toContain('"is_verified":{"_eq":true}');
  });

  it('404 out of scope and when the flag is off for the store', async () => {
    const w = world();
    await expect(w.service.picker(GA, 'loc-dla')).rejects.toBeInstanceOf(NotFoundException);
    await expect(w.service.picker(ALL, 'loc-lbv')).rejects.toBeInstanceOf(NotFoundException);
    expect(w.assignments.pickerStats).not.toHaveBeenCalled();
  });
});
