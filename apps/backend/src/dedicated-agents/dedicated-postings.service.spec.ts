import type { SiteEventsService } from '../site-events/site-events.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AgentContractGateService } from '../agent-contracts/agent-contract-gate.service';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import { DEDICATED_ASSIGNMENT_CONFLICTS } from './dedicated-assignment-write.util';
import type { DedicatedCoverageService } from './dedicated-coverage.service';
import { DedicatedOpportunitiesService, opportunityDisabledReason } from './dedicated-opportunities.service';
import { DedicatedPostingsSweeperService } from './dedicated-postings-sweeper.service';
import { DedicatedPostingsService, distanceKm, POSTING_EXPIRY_BATCH } from './dedicated-postings.service';

/** GraphQL variables / rows as the fake receives them (shape varies per operation). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;
type Notice = Parameters<NotificationsService['sendDedicatedAgentNotice']>[0];

const OWNER = 'u-owner';
const DELEGATE = 'u-del';
const LOC = 'loc-dla';
const NOW = new Date('2026-10-20T09:00:00Z');

function hasuraError(message: string) {
  const errors = [{ message, extensions: { code: 'constraint-violation' } }];
  return Object.assign(new Error(`${message}: ${JSON.stringify({ response: { errors } })}`), { response: { errors } });
}

interface LocationFake {
  id: string;
  name: string;
  owner: string;
  ownerLang: string | null;
  country: string;
  state: string;
  city: string;
  lat: number | null;
  lng: number | null;
}
interface AgentFake {
  id: string;
  user_id: string;
  is_verified: boolean;
  is_internal: boolean;
  status: string;
  focus: string;
  created_at: string;
  pickups_completed_count: number;
  pickups_reassigned_count: number;
  user: { first_name: string; profile_picture_url: string | null; preferred_language: string | null; phone_number: string | null };
  addresses: Array<{ city: string; state: string; country: string; latitude: number | null; longitude: number | null; is_primary: boolean }>;
}
interface PostingFake {
  id: string;
  business_location_id: string;
  headcount: number;
  accepted_count: number;
  days_of_week: number[];
  terms: string | null;
  terms_updated_at: string | null;
  status: string;
  expires_at: string;
  filled_at: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  closed_by_user_id?: string | null;
  created_by_user_id: string;
  created_at: string;
}
interface AppFake {
  id: string;
  posting_id: string;
  agent_id: string;
  status: string;
  decided_by_user_id: string | null;
  decided_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * In-memory Hasura for the PR 7 reads and writes. Writes enforce what the
 * database does (one open posting per location-slot, the locked accept's
 * rules from 20261018220000, guarded transitions); the real function is
 * covered against Postgres in dedicated-accept-application.pg.spec.ts.
 */
function world() {
  const state = {
    flag: true,
    flagByCountry: {} as Record<string, boolean>,
    cap: 3,
    expiryDays: 14,
    locations: new Map<string, LocationFake>(),
    delegates: [] as Array<{ user_id: string; location: string; lang: string | null }>,
    agents: new Map<string, AgentFake>(),
    postings: [] as PostingFake[],
    slots: [] as Array<{ posting_id: string; business_location_id: string; slot_key: string; is_open: boolean }>,
    apps: [] as AppFake[],
    assignments: [] as Array<{ id: string; business_location_id: string; agent_id: string; slot_key: string; status: string; source: string; application_id: string | null }>,
    pickup: [] as Array<{ business_location_id: string; slot_key: string; is_enabled: boolean; pickup_time: string | null }>,
    delivered: [] as string[],
    faults: [] as string[],
    contractRequired: true,
    signed: new Set<string>(),
    capFails: false,
    /** Simulates a close landing between the apply insert and its re-check. */
    closeDuringApply: false,
    /** Simulates a concurrent create winning the open-slot unique index. */
    raceOpenOnInsert: false,
    mutations: [] as Array<{ op: string; vars: Loose }>,
    nextId: 1,
  };
  const id = (p: string) => `${p}-${state.nextId++}`;
  const stamp = () => new Date(NOW.getTime() + state.nextId++ * 1000).toISOString();

  const locationView = (l: LocationFake) => ({
    id: l.id,
    name: l.name,
    business_id: `biz-${l.id}`,
    business: { name: `${l.name} SARL`, user_id: l.owner, user: { preferred_language: l.ownerLang } },
    address: { address_line_1: 'Rue 1', city: l.city, state: l.state, country: l.country.toLowerCase(), latitude: l.lat, longitude: l.lng },
  });
  const postingView = (p: PostingFake) => ({
    ...p,
    slots: state.slots
      .filter((s) => s.posting_id === p.id)
      .map((s) => ({ slot_key: s.slot_key }))
      .sort((a, b) => a.slot_key.localeCompare(b.slot_key)),
    business_location: locationView(state.locations.get(p.business_location_id) as LocationFake),
  });
  const agentAddresses = (a: AgentFake) => a.addresses.map((address) => ({ address }));
  const live = (s: string) => s === 'active' || s === 'paused';
  const setPostingStatus = (p: PostingFake, status: string) => {
    p.status = status;
    for (const s of state.slots) if (s.posting_id === p.id) s.is_open = status === 'open';
  };

  const executeQuery = jest.fn(async (query: string, vars: Loose) => {
    const op = /query (\w+)/.exec(query)?.[1] ?? '?';
    switch (op) {
      case 'DedicatedAgentsConfig':
        return {
          application_configurations: [
            { config_key: 'dedicated_agents_enabled', boolean_value: state.flag, country_code: null },
            ...Object.entries(state.flagByCountry).map(([c, v]) => ({
              config_key: 'dedicated_agents_enabled',
              boolean_value: v,
              country_code: c,
            })),
            { config_key: 'dedicated_posting_expiry_days', number_value: state.expiryDays, country_code: null },
            { config_key: 'dedicated_max_assignments_per_agent', number_value: state.cap, country_code: null },
          ],
        };
      case 'DedicatedPostingLocation': {
        const l = state.locations.get(vars.locationId);
        return { business_locations_by_pk: l ? locationView(l) : null };
      }
      case 'DedicatedLocationPickupSlots':
        return { business_location_pickup_slots: state.pickup.filter((p) => p.business_location_id === vars.locationId) };
      case 'DedicatedOpenPostingForSlots':
        return {
          dedicated_agent_posting_slots: state.slots
            .filter((s) => s.business_location_id === vars.locationId && s.is_open && vars.slotKeys.includes(s.slot_key))
            .slice(0, 1)
            .map((s) => ({ posting_id: s.posting_id })),
        };
      case 'DedicatedPostingById': {
        const p = state.postings.find((x) => x.id === vars.id);
        return { dedicated_agent_postings_by_pk: p ? postingView(p) : null };
      }
      case 'DedicatedLocationPostings':
        return {
          dedicated_agent_postings: state.postings
            .filter((p) => p.business_location_id === vars.locationId)
            .slice(0, vars.limit)
            .map((p) => ({
              ...postingView(p),
              pending: { aggregate: { count: state.apps.filter((a) => a.posting_id === p.id && a.status === 'applied').length } },
            })),
        };
      case 'DedicatedPostingPendingAgents':
        return {
          dedicated_agent_applications: state.apps
            .filter((a) => a.posting_id === vars.postingId && a.status === 'applied')
            .map((a) => {
              const ag = state.agents.get(a.agent_id) as AgentFake;
              return { id: a.id, agent: { user_id: ag.user_id, user: { preferred_language: ag.user.preferred_language } } };
            }),
        };
      case 'DedicatedPostingApplications':
        return {
          dedicated_agent_applications: state.apps
            .filter((a) => a.posting_id === vars.postingId && ['applied', 'accepted'].includes(a.status))
            .map((a) => {
              const ag = state.agents.get(a.agent_id) as AgentFake;
              return {
                ...a,
                agent: {
                  id: ag.id,
                  user_id: ag.user_id,
                  created_at: ag.created_at,
                  is_internal: ag.is_internal,
                  pickups_completed_count: ag.pickups_completed_count,
                  pickups_reassigned_count: ag.pickups_reassigned_count,
                  // The list query has no phone_number: assert the service cannot leak it.
                  user: { first_name: ag.user.first_name, profile_picture_url: ag.user.profile_picture_url, preferred_language: ag.user.preferred_language },
                  agent_addresses: agentAddresses(ag),
                },
              };
            }),
        };
      case 'DedicatedApplicationById': {
        const a = state.apps.find((x) => x.id === vars.id);
        const ag = a ? (state.agents.get(a.agent_id) as AgentFake) : null;
        return {
          dedicated_agent_applications_by_pk: a
            ? {
                id: a.id,
                posting_id: a.posting_id,
                agent_id: a.agent_id,
                status: a.status,
                agent: { id: ag?.id, user_id: ag?.user_id, user: { first_name: ag?.user.first_name, phone_number: ag?.user.phone_number, preferred_language: ag?.user.preferred_language } },
              }
            : null,
        };
      }
      case 'DedicatedApplicantStats':
        return {
          delivered: state.delivered.filter((x) => vars.agentIds.includes(x)).map((x) => ({ assigned_agent_id: x })),
          missed: state.faults.filter((x) => vars.agentIds.includes(x)).map((x) => ({ order: { assigned_agent_id: x } })),
        };
      case 'DedicatedApplicationAssignments':
        return {
          dedicated_agent_assignments: state.assignments
            .filter((x) => x.application_id === vars.applicationId)
            .map((x) => ({ id: x.id, slot_key: x.slot_key, status: x.status, source: x.source })),
        };
      case 'DedicatedAgentsContact':
        return {
          agents: [...state.agents.values()]
            .filter((a) => vars.agentIds.includes(a.id))
            .map((a) => ({ id: a.id, user_id: a.user_id, user: { preferred_language: a.user.preferred_language } })),
        };
      case 'DedicatedNoticeDelegates':
        return {
          location_delegations: state.delegates
            .filter((d) => d.location === vars.locationId)
            .map((d) => ({ user_id: d.user_id, user: { preferred_language: d.lang } })),
        };
      case 'DedicatedExpiredPostings':
        return {
          dedicated_agent_postings: state.postings
            .filter((p) => p.status === 'open' && p.expires_at <= vars.now)
            .slice(0, vars.limit)
            .map((p) => ({ id: p.id, business_location: { address: { country: state.locations.get(p.business_location_id)?.country } } })),
        };
      case 'DedicatedOpportunityAgent':
        return {
          agents: [...state.agents.values()]
            .filter((a) => a.user_id === vars.userId)
            .map((a) => ({ ...a, user: { ...a.user, phone_number: undefined }, agent_addresses: agentAddresses(a) })),
        };
      case 'DedicatedOpportunities': {
        const country = String(vars.country).toLowerCase();
        return {
          dedicated_agent_postings: state.postings
            .filter((p) => p.status === 'open' && p.expires_at > vars.now)
            .filter((p) => state.locations.get(p.business_location_id)?.country.toLowerCase() === country)
            .map((p) => ({
              ...postingView(p),
              mine: state.apps
                .filter((a) => a.posting_id === p.id && a.agent_id === vars.agentId)
                .map((a) => ({ id: a.id, status: a.status, created_at: a.created_at, updated_at: a.updated_at })),
            })),
          held: state.assignments.filter((x) => x.agent_id === vars.agentId && live(x.status)),
        };
      }
      case 'DedicatedOpportunityById': {
        const p = state.postings.find((x) => x.id === vars.id);
        return {
          dedicated_agent_postings_by_pk: p
            ? {
                ...postingView(p),
                mine: state.apps
                  .filter((a) => a.posting_id === p.id && a.agent_id === vars.agentId)
                  .map((a) => ({ id: a.id, status: a.status, created_at: a.created_at, updated_at: a.updated_at })),
              }
            : null,
          held: state.assignments.filter((x) => x.agent_id === vars.agentId && live(x.status)),
        };
      }
      case 'DedicatedAgentHeldAssignments':
        return {
          held: state.assignments.filter((x) => x.agent_id === vars.agentId && live(x.status)),
          mine: state.apps.filter((a) => a.agent_id === vars.agentId).map((a) => ({ id: a.id, posting_id: a.posting_id, status: a.status })),
        };
      default:
        throw new Error(`unexpected query ${op}`);
    }
  });

  const executeMutation = jest.fn(async (query: string, vars: Loose) => {
    const op = /mutation (\w+)/.exec(query)?.[1] ?? '?';
    state.mutations.push({ op, vars });
    const at = vars.at ?? vars.now;
    switch (op) {
      case 'InsertDedicatedPosting': {
        if (state.raceOpenOnInsert) {
          state.raceOpenOnInsert = false;
          const winner = seedPosting({ slotKeys: vars.slots.map((s: Loose) => s.slot_key) });
          void winner;
        }
        for (const s of vars.slots) {
          if (state.slots.some((x) => x.business_location_id === s.business_location_id && x.slot_key === s.slot_key && x.is_open)) {
            throw hasuraError(
              'Uniqueness violation. duplicate key value violates unique constraint "dedicated_agent_posting_slots_one_open_idx"'
            );
          }
        }
        state.postings.push({
          accepted_count: 0,
          terms_updated_at: null,
          status: 'open',
          filled_at: null,
          closed_at: null,
          closed_reason: null,
          created_at: stamp(),
          ...vars.posting,
        });
        for (const s of vars.slots) state.slots.push({ ...s, is_open: true });
        return { insert_dedicated_agent_postings_one: { id: vars.posting.id }, insert_dedicated_agent_posting_slots: { affected_rows: vars.slots.length } };
      }
      case 'UpdateDedicatedPostingTerms': {
        const p = state.postings.find((x) => x.id === vars.id && x.status === 'open');
        if (p) Object.assign(p, { terms: vars.terms, terms_updated_at: vars.at });
        return { update_dedicated_agent_postings: { affected_rows: p ? 1 : 0 } };
      }
      case 'CloseDedicatedPosting': {
        const p = state.postings.find((x) => x.id === vars.id && x.status === 'open');
        if (p) {
          setPostingStatus(p, 'closed');
          Object.assign(p, { closed_at: at, closed_by_user_id: vars.by, closed_reason: vars.reason });
        }
        const closed = state.postings.find((x) => x.id === vars.id)?.status === 'closed';
        const declined = closed ? state.apps.filter((a) => a.posting_id === vars.id && a.status === 'applied') : [];
        for (const a of declined) Object.assign(a, { status: 'auto_declined', decided_at: at, updated_at: at });
        return {
          update_dedicated_agent_postings: { affected_rows: p ? 1 : 0 },
          update_dedicated_agent_applications: { returning: declined.map((a) => ({ id: a.id, agent_id: a.agent_id })) },
        };
      }
      case 'ExpireDedicatedPostings': {
        const expired = state.postings.filter((p) => vars.ids.includes(p.id) && p.status === 'open' && p.expires_at <= vars.now);
        for (const p of expired) {
          setPostingStatus(p, 'expired');
          Object.assign(p, { closed_at: vars.now, closed_reason: 'expired' });
        }
        const declined = state.apps.filter(
          (a) => vars.ids.includes(a.posting_id) && a.status === 'applied' && state.postings.find((p) => p.id === a.posting_id)?.status === 'expired'
        );
        for (const a of declined) Object.assign(a, { status: 'auto_declined', decided_at: vars.now });
        return {
          update_dedicated_agent_postings: { returning: expired.map((p) => ({ id: p.id })) },
          update_dedicated_agent_applications: {
            returning: declined.map((a) => ({ id: a.id, agent_id: a.agent_id, posting_id: a.posting_id })),
          },
        };
      }
      case 'AcceptDedicatedApplication': {
        // Mirrors dedicated_accept_application (20261018220000).
        const app = state.apps.find((a) => a.id === vars.applicationId);
        if (!app) return { dedicated_accept_application: [] };
        const p = state.postings.find((x) => x.id === app.posting_id) as PostingFake;
        const slotKeys = state.slots.filter((s) => s.posting_id === p.id).map((s) => s.slot_key).sort();
        const holds = state.assignments.some(
          (x) => x.agent_id === app.agent_id && x.business_location_id === p.business_location_id && live(x.status) && slotKeys.includes(x.slot_key)
        );
        const view = (a: AppFake) => ({ id: a.id, agent_id: a.agent_id, status: a.status });
        if (p.status !== 'open' || p.expires_at <= NOW.toISOString() || app.status !== 'applied' || p.accepted_count >= p.headcount || holds) {
          return { dedicated_accept_application: [view(app)] };
        }
        if (state.capFails) {
          throw hasuraError(
            `Check constraint violation. dedicated_agent_assignment_cap_exceeded: agent ${app.agent_id} already has 3 live assignments (max 3)`
          );
        }
        for (const slot_key of slotKeys) {
          state.assignments.push({
            id: id('as'),
            business_location_id: p.business_location_id,
            agent_id: app.agent_id,
            slot_key,
            status: 'active',
            source: 'posting',
            application_id: app.id,
          });
        }
        Object.assign(app, { status: 'accepted', decided_by_user_id: vars.actorUserId, decided_at: NOW.toISOString() });
        p.accepted_count += 1;
        const out = [] as AppFake[];
        if (p.accepted_count >= p.headcount) {
          setPostingStatus(p, 'filled');
          p.filled_at = NOW.toISOString();
          for (const a of state.apps.filter((x) => x.posting_id === p.id && x.status === 'applied')) {
            Object.assign(a, { status: 'auto_declined', decided_at: NOW.toISOString() });
            out.push(a);
          }
        }
        return { dedicated_accept_application: [...out.map(view), view(app)] };
      }
      case 'DeclineDedicatedApplication': {
        const a = state.apps.find((x) => x.id === vars.id && x.status === 'applied');
        if (a) Object.assign(a, { status: 'declined', decided_by_user_id: vars.by, decided_at: vars.at });
        return { update_dedicated_agent_applications: { affected_rows: a ? 1 : 0 } };
      }
      case 'UpsertDedicatedApplication': {
        const o = vars.object;
        const existing = state.apps.find((a) => a.posting_id === o.posting_id && a.agent_id === o.agent_id);
        if (existing) {
          if (existing.status !== 'withdrawn') return { insert_dedicated_agent_applications_one: null };
          Object.assign(existing, { status: o.status, withdrawn_at: o.withdrawn_at, updated_at: stamp() });
          return { insert_dedicated_agent_applications_one: { id: existing.id, status: existing.status } };
        }
        const t = stamp();
        const row: AppFake = { id: id('app'), decided_by_user_id: null, decided_at: null, created_at: t, updated_at: t, ...o };
        state.apps.push(row);
        if (state.closeDuringApply) setPostingStatus(state.postings.find((p) => p.id === o.posting_id) as PostingFake, 'closed');
        return { insert_dedicated_agent_applications_one: { id: row.id, status: row.status } };
      }
      case 'AutoDeclineLateApplication': {
        const a = state.apps.find((x) => x.id === vars.id && x.status === 'applied');
        const shut = a && state.postings.find((p) => p.id === a.posting_id)?.status !== 'open';
        if (a && shut) Object.assign(a, { status: 'auto_declined', decided_at: vars.at });
        return { update_dedicated_agent_applications: { affected_rows: a && shut ? 1 : 0 } };
      }
      case 'WithdrawDedicatedApplication': {
        const a = state.apps.find((x) => x.posting_id === vars.postingId && x.agent_id === vars.agentId && x.status === 'applied');
        if (a) Object.assign(a, { status: 'withdrawn', withdrawn_at: vars.at, updated_at: vars.at });
        return { update_dedicated_agent_applications: { affected_rows: a ? 1 : 0 } };
      }
      default:
        throw new Error(`unexpected mutation ${op}`);
    }
  });

  function addLocation(over: Partial<LocationFake> & { id: string }): LocationFake {
    const l: LocationFake = {
      name: 'Chez Mama',
      owner: OWNER,
      ownerLang: 'fr',
      country: 'CM',
      state: 'Littoral',
      city: 'Douala',
      lat: 4.05,
      lng: 9.7,
      ...over,
    };
    state.locations.set(l.id, l);
    return l;
  }
  function addAgent(agentId: string, over: Partial<AgentFake> = {}, user: Partial<AgentFake['user']> = {}): AgentFake {
    const a: AgentFake = {
      id: agentId,
      user_id: `u-${agentId}`,
      is_verified: true,
      is_internal: false,
      status: 'active',
      focus: 'delivery',
      created_at: '2025-03-01T10:00:00Z',
      pickups_completed_count: 18,
      pickups_reassigned_count: 2,
      addresses: [{ city: 'Douala', state: 'Littoral', country: 'CM', latitude: 4.06, longitude: 9.7, is_primary: true }],
      ...over,
      user: { first_name: 'Awa', profile_picture_url: 'https://cdn/x.png', preferred_language: 'en', phone_number: '+237677000111', ...user },
    };
    state.agents.set(agentId, a);
    state.signed.add(agentId);
    return a;
  }
  function seedPosting(over: Partial<PostingFake> & { slotKeys?: string[] } = {}): PostingFake {
    const { slotKeys = ['morning'], ...rest } = over;
    const p: PostingFake = {
      id: id('po'),
      business_location_id: LOC,
      headcount: 1,
      accepted_count: 0,
      days_of_week: [1, 2, 3, 4, 5, 6, 7],
      terms: null,
      terms_updated_at: null,
      status: 'open',
      expires_at: '2026-11-01T00:00:00Z',
      filled_at: null,
      closed_at: null,
      closed_reason: null,
      created_by_user_id: OWNER,
      created_at: stamp(),
      ...rest,
    };
    state.postings.push(p);
    for (const slot_key of slotKeys) state.slots.push({ posting_id: p.id, business_location_id: p.business_location_id, slot_key, is_open: p.status === 'open' });
    return p;
  }
  function seedApp(postingId: string, agentId: string, over: Partial<AppFake> = {}): AppFake {
    const t = stamp();
    const a: AppFake = {
      id: id('app'),
      posting_id: postingId,
      agent_id: agentId,
      status: 'applied',
      decided_by_user_id: null,
      decided_at: null,
      withdrawn_at: null,
      created_at: t,
      updated_at: t,
      ...over,
    };
    state.apps.push(a);
    return a;
  }

  const hasura = { executeQuery, executeMutation } as unknown as HasuraSystemService;
  const notices: Notice[] = [];
  const notifications = { sendDedicatedAgentNotice: jest.fn(async (p: Notice) => void notices.push(p)) };
  const config = new DedicatedAgentsConfigService(hasura);
  const siteEvents = { trackEvent: jest.fn().mockResolvedValue(undefined) };
  const events = (type: string) =>
    siteEvents.trackEvent.mock.calls
      .map((c) => c[0] as { eventType: string; metadata: Record<string, unknown> })
      .filter((e) => e.eventType === type)
      .map((e) => e.metadata);
  const postings = new DedicatedPostingsService(
    hasura,
    config,
    notifications as unknown as NotificationsService,
    siteEvents as unknown as SiteEventsService
  );
  const coverage = {
    slotBoundsFor: jest.fn(async () => [
      { slotKey: 'morning', slotId: 's-m', startTime: '08:00:00', endTime: '12:00:00' },
      { slotKey: 'afternoon', slotId: 's-a', startTime: '12:00:00', endTime: '16:00:00' },
      { slotKey: 'evening', slotId: 's-e', startTime: '16:00:00', endTime: '20:00:00' },
    ]),
  };
  const contractGate = {
    canOperate: jest.fn(async (agentId: string) => !state.contractRequired || state.signed.has(agentId)),
  };
  const opportunities = new DedicatedOpportunitiesService(
    hasura,
    postings,
    coverage as unknown as DedicatedCoverageService,
    contractGate as unknown as AgentContractGateService,
    config
  );
  addLocation({ id: LOC });
  const writes = (op: string) => state.mutations.filter((m) => m.op === op);
  return { state, postings, opportunities, notices, addLocation, addAgent, seedPosting, seedApp, writes, executeMutation, contractGate, events };
}

const actor = { userId: OWNER, locationId: LOC };

async function rejection(p: Promise<unknown>): Promise<{ err: unknown; body: Loose }> {
  const err = await p.then(
    () => null,
    (e) => e
  );
  expect(err).not.toBeNull();
  const body = (err as { getResponse?: () => unknown }).getResponse?.() as Loose;
  return { err, body: body ?? {} };
}
async function expectConflict(p: Promise<unknown>, code: string): Promise<Loose> {
  const { err, body } = await rejection(p);
  expect(err).toBeInstanceOf(ConflictException);
  expect(body).toMatchObject({ code });
  return body;
}

// ------------------------------------------------------------------ business

describe('DedicatedPostingsService.create (AC-B11, B12)', () => {
  it('stores headcount, slots in fixed order, days, sanitised terms and a 14-day expiry, in one mutation', async () => {
    const w = world();
    const { posting } = await w.postings.create(
      actor,
      { headcount: 2, slotKeys: ['evening', 'Morning', 'morning'], daysOfWeek: [6, 1, 1], terms: 'Tenue noire. Appelez le 6 77 12 34 56' },
      NOW
    );
    expect(posting).toMatchObject({
      locationId: LOC,
      status: 'open',
      headcount: 2,
      acceptedCount: 0,
      slotKeys: ['morning', 'evening'],
      daysOfWeek: [1, 6],
      terms: 'Tenue noire. Appelez le',
      expiresAt: '2026-11-03T09:00:00.000Z',
    });
    const [insert] = w.writes('InsertDedicatedPosting');
    expect(w.writes('InsertDedicatedPosting')).toHaveLength(1);
    expect(insert.vars.posting).toMatchObject({ created_by_user_id: OWNER, business_location_id: LOC });
    expect(insert.vars.slots.map((s: Loose) => [s.posting_id, s.slot_key])).toEqual([
      [insert.vars.posting.id, 'morning'],
      [insert.vars.posting.id, 'evening'],
    ]);
  });

  it('defaults: headcount 1, all days; expiry follows dedicated_posting_expiry_days', async () => {
    const w = world();
    w.state.expiryDays = 7;
    const { posting } = await w.postings.create(actor, { slotKeys: ['afternoon'] }, NOW);
    expect(posting).toMatchObject({ headcount: 1, daysOfWeek: [1, 2, 3, 4, 5, 6, 7], terms: null, expiresAt: '2026-10-27T09:00:00.000Z' });
  });

  it.each([
    [{ headcount: 0, slotKeys: ['morning'] }, 'invalid_headcount'],
    [{ headcount: 11, slotKeys: ['morning'] }, 'invalid_headcount'],
    [{ headcount: 1.5, slotKeys: ['morning'] }, 'invalid_headcount'],
    [{ slotKeys: [] }, 'invalid_slot_keys'],
    [{ slotKeys: ['night'] }, 'invalid_slot_keys'],
    [{ slotKeys: ['morning'], daysOfWeek: [0] }, 'invalid_days_of_week'],
    [{ slotKeys: ['morning'], daysOfWeek: [] }, 'invalid_days_of_week'],
    [{ slotKeys: ['morning'], terms: 'x'.repeat(1001) }, 'terms_too_long'],
  ])('400 for %j', async (input, code) => {
    const w = world();
    const { err, body } = await rejection(w.postings.create(actor, input, NOW));
    expect(err).toBeInstanceOf(BadRequestException);
    expect(body.code).toBe(code);
    expect(w.writes('InsertDedicatedPosting')).toHaveLength(0);
  });

  it('terms at 1,000 characters after stripping a phone number are accepted', async () => {
    const w = world();
    const terms = `${'a'.repeat(1000)} 677123456`;
    const { posting } = await w.postings.create(actor, { slotKeys: ['morning'], terms }, NOW);
    expect(posting.terms).toHaveLength(1000);
  });

  it('a slot the store turned off cannot be posted (409 slot_disabled)', async () => {
    const w = world();
    w.state.pickup.push({ business_location_id: LOC, slot_key: 'evening', is_enabled: false, pickup_time: null });
    await expectConflict(w.postings.create(actor, { slotKeys: ['morning', 'evening'] }, NOW), 'slot_disabled');
    expect(w.writes('InsertDedicatedPosting')).toHaveLength(0);
  });

  it('one open posting per location-slot: 409 posting_already_open returns the open one', async () => {
    const w = world();
    const open = w.seedPosting({ slotKeys: ['morning', 'afternoon'], headcount: 3 });
    const body = await expectConflict(w.postings.create(actor, { slotKeys: ['afternoon'] }, NOW), 'posting_already_open');
    expect(body.posting).toMatchObject({ id: open.id, headcount: 3, slotKeys: ['morning', 'afternoon'] });
    expect(w.writes('InsertDedicatedPosting')).toHaveLength(0);
  });

  it('a closed posting does not block a new one for the same slot', async () => {
    const w = world();
    w.seedPosting({ slotKeys: ['morning'], status: 'closed' });
    await expect(w.postings.create(actor, { slotKeys: ['morning'] }, NOW)).resolves.toBeDefined();
  });

  it('a concurrent create that wins the unique index is reported as posting_already_open', async () => {
    const w = world();
    w.state.raceOpenOnInsert = true;
    const body = await expectConflict(w.postings.create(actor, { slotKeys: ['morning'] }, NOW), 'posting_already_open');
    expect(body.posting.status).toBe('open');
  });

  it('flag off -> 404 (create and list)', async () => {
    const w = world();
    w.state.flag = false;
    await expect(w.postings.create(actor, { slotKeys: ['morning'] }, NOW)).rejects.toBeInstanceOf(NotFoundException);
    await expect(w.postings.list(LOC)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('flag is read for the store’s country', async () => {
    const w = world();
    w.state.flag = false;
    w.state.flagByCountry = { CM: true };
    await expect(w.postings.create(actor, { slotKeys: ['morning'] }, NOW)).resolves.toBeDefined();
  });
});

describe('DedicatedPostingsService.list', () => {
  it('lists the location’s postings with pending counts', async () => {
    const w = world();
    const p = w.seedPosting({ headcount: 2 });
    w.addAgent('a1');
    w.addAgent('a2');
    w.seedApp(p.id, 'a1');
    w.seedApp(p.id, 'a2', { status: 'withdrawn' });
    const { postings } = await w.postings.list(LOC);
    expect(postings).toEqual([expect.objectContaining({ id: p.id, pendingApplications: 1, acceptedCount: 0, headcount: 2 })]);
  });
});

describe('DedicatedPostingsService.updateTerms (AC-A1c)', () => {
  it('saves sanitised terms with terms_updated_at and pushes only pending applicants', async () => {
    const w = world();
    const p = w.seedPosting({ headcount: 2, terms: 'old' });
    w.addAgent('a1', {}, { preferred_language: 'fr' });
    w.addAgent('a2');
    w.addAgent('a3');
    w.seedApp(p.id, 'a1');
    w.seedApp(p.id, 'a2', { status: 'withdrawn' });
    w.seedApp(p.id, 'a3', { status: 'accepted' });
    const { posting } = await w.postings.updateTerms(actor, p.id, 'Casque obligatoire, voir www.x.com', NOW);
    expect(posting).toMatchObject({ terms: 'Casque obligatoire, voir', termsUpdatedAt: NOW.toISOString() });
    expect(w.notices).toEqual([
      expect.objectContaining({
        userId: 'u-a1',
        body: 'Chez Mama a mis à jour ses conditions',
        messageType: 'DEDICATED_POSTING_TERMS_UPDATED',
        postingId: p.id,
        path: `/agent/dedicated-opportunities/${p.id}`,
        persona: 'agent',
      }),
    ]);
  });

  it('unchanged terms: no write, no push', async () => {
    const w = world();
    const p = w.seedPosting({ terms: 'Same' });
    w.addAgent('a1');
    w.seedApp(p.id, 'a1');
    await w.postings.updateTerms(actor, p.id, '  Same ', NOW);
    expect(w.writes('UpdateDedicatedPostingTerms')).toHaveLength(0);
    expect(w.notices).toHaveLength(0);
  });

  it('409 on a posting that is not open; 404 for another location’s posting', async () => {
    const w = world();
    const filled = w.seedPosting({ status: 'filled', accepted_count: 1 });
    await expectConflict(w.postings.updateTerms(actor, filled.id, 'x', NOW), 'posting_filled');
    w.addLocation({ id: 'loc-other', owner: 'u-o' });
    const other = w.seedPosting({ business_location_id: 'loc-other' });
    await expect(w.postings.updateTerms(actor, other.id, 'x', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DedicatedPostingsService.close (AC-B13)', () => {
  it('closes and auto-declines pending applicants in one mutation, telling each of them', async () => {
    const w = world();
    const p = w.seedPosting({ headcount: 3, slotKeys: ['morning', 'evening'] });
    w.addAgent('a1');
    w.addAgent('a2', {}, { preferred_language: 'fr' });
    w.addAgent('a3');
    w.seedApp(p.id, 'a1');
    w.seedApp(p.id, 'a2');
    w.seedApp(p.id, 'a3', { status: 'accepted' });
    const res = await w.postings.close(actor, p.id, '  enough ', NOW);
    expect(res.autoDeclined).toBe(2);
    expect(res.posting.status).toBe('closed');
    expect(w.writes('CloseDedicatedPosting')).toHaveLength(1);
    expect(w.writes('CloseDedicatedPosting')[0].vars).toMatchObject({ by: OWNER, reason: 'enough' });
    expect(w.state.apps.map((a) => a.status)).toEqual(['auto_declined', 'auto_declined', 'accepted']);
    expect(w.state.slots.filter((s) => s.posting_id === p.id).every((s) => !s.is_open)).toBe(true);
    expect(w.notices.map((n) => [n.userId, n.body, n.messageType])).toEqual([
      ['u-a1', 'Chez Mama is no longer looking for a dedicated agent (Morning, Evening)', 'DEDICATED_POSTING_CLOSED'],
      ['u-a2', 'Chez Mama ne recherche plus de livreur dédié (Matin, Soir)', 'DEDICATED_POSTING_CLOSED'],
    ]);
  });

  it('409 when the posting is no longer open', async () => {
    const w = world();
    const p = w.seedPosting({ status: 'expired' });
    await expectConflict(w.postings.close(actor, p.id, undefined, NOW), 'posting_not_open');
    expect(w.writes('CloseDedicatedPosting')).toHaveLength(0);
  });

  it('flag off -> 404', async () => {
    const w = world();
    const p = w.seedPosting();
    w.state.flag = false;
    await expect(w.postings.close(actor, p.id, undefined, NOW)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DedicatedPostingsService.applications (AC-B14)', () => {
  it('cards: first name, photo, date joined, deliveries, missed (faults + reassigned), on-time %, distance; no phone while pending', async () => {
    const w = world();
    const p = w.seedPosting({ headcount: 2 });
    w.addAgent('a1', { pickups_completed_count: 18, pickups_reassigned_count: 2 }, { first_name: 'Awa' });
    w.addAgent('a2', { pickups_completed_count: 0, pickups_reassigned_count: 0, addresses: [] }, { first_name: 'Bo' });
    w.addAgent('a3');
    w.state.delivered.push('a1', 'a1', 'a1', 'a2');
    w.state.faults.push('a1');
    w.seedApp(p.id, 'a1');
    w.seedApp(p.id, 'a2');
    w.seedApp(p.id, 'a3', { status: 'declined' });
    const { applications } = await w.postings.applications(LOC, p.id);
    expect(applications).toHaveLength(2);
    expect(applications[0]).toEqual({
      applicationId: expect.any(String),
      status: 'applied',
      appliedAt: expect.any(String),
      agent: { id: 'a1', firstName: 'Awa', photoUrl: 'https://cdn/x.png', joinedAt: '2025-03-01T10:00:00Z', isInternal: false },
      deliveriesCompleted: 3,
      missedDeliveries: 3,
      onTimePickupPct: 90,
      distanceKm: 1.1,
    });
    expect(applications[1]).toMatchObject({ deliveriesCompleted: 1, missedDeliveries: 0, onTimePickupPct: null, distanceKm: null });
    expect(JSON.stringify(applications)).not.toContain('+237');
    expect(applications.every((a) => !('phone' in a))).toBe(true);
  });

  it('an accepted applicant shows the phone', async () => {
    const w = world();
    const p = w.seedPosting({ headcount: 2 });
    w.addAgent('a1');
    w.seedApp(p.id, 'a1', { status: 'accepted' });
    const { applications } = await w.postings.applications(LOC, p.id);
    expect(applications[0]).toMatchObject({ status: 'accepted', phone: '+237677000111' });
  });
});

describe('DedicatedPostingsService.accept (AC-B15, E8)', () => {
  it('accepting the last spot: assignments for every slot, posting filled, others told "This spot was filled", phone returned', async () => {
    const w = world();
    const p = w.seedPosting({ headcount: 1, slotKeys: ['morning', 'evening'] });
    w.addAgent('a1', {}, { first_name: 'Awa' });
    w.addAgent('a2', {}, { preferred_language: 'fr' });
    w.addAgent('a3');
    const x1 = w.seedApp(p.id, 'a1');
    w.seedApp(p.id, 'a2');
    w.seedApp(p.id, 'a3', { status: 'withdrawn' });
    const res = await w.postings.accept(actor, p.id, x1.id);
    expect(res).toMatchObject({
      application: { id: x1.id, status: 'accepted' },
      posting: { status: 'filled', acceptedCount: 1, headcount: 1 },
      autoDeclined: 1,
      agent: { id: 'a1', firstName: 'Awa', phone: '+237677000111' },
    });
    expect(res.assignments.map((a) => [a.slot_key, a.source, a.status])).toEqual([
      ['evening', 'posting', 'active'],
      ['morning', 'posting', 'active'],
    ]);
    expect(w.writes('AcceptDedicatedApplication')[0].vars).toEqual({ applicationId: x1.id, actorUserId: OWNER });
    expect(w.notices.map((n) => [n.userId, n.messageType, n.body])).toEqual([
      ['u-a1', 'DEDICATED_POSTING_ACCEPTED', 'Chez Mama accepted you as its dedicated agent (Morning, Evening)'],
      ['u-a2', 'DEDICATED_POSTING_FILLED', 'Ce poste a été pourvu : Chez Mama (Matin, Soir)'],
    ]);
  });

  it('accept #2 of 3 keeps the posting open and nobody else is declined', async () => {
    const w = world();
    const p = w.seedPosting({ headcount: 3, accepted_count: 1 });
    w.addAgent('a1');
    w.addAgent('a2');
    const x = w.seedApp(p.id, 'a1');
    w.seedApp(p.id, 'a2');
    const res = await w.postings.accept(actor, p.id, x.id);
    expect(res.posting).toMatchObject({ status: 'open', acceptedCount: 2 });
    expect(res.autoDeclined).toBe(0);
    expect(w.notices.map((n) => n.messageType)).toEqual(['DEDICATED_POSTING_ACCEPTED']);
  });

  it.each([
    ['the posting was filled by another accept', { posting: { status: 'filled', accepted_count: 1 }, app: { status: 'auto_declined' } }, 'posting_filled'],
    ['the posting was closed', { posting: { status: 'closed' }, app: {} }, 'posting_not_open'],
    ['the posting expired (sweeper not run yet)', { posting: { expires_at: '2020-01-01T00:00:00Z' }, app: {} }, 'posting_expired'],
    ['the application was withdrawn', { posting: {}, app: { status: 'withdrawn' } }, 'application_not_pending'],
  ])('409 when %s; nothing is written or sent', async (_l, over, code) => {
    const w = world();
    const p = w.seedPosting(over.posting);
    w.addAgent('a1');
    const x = w.seedApp(p.id, 'a1', over.app);
    const body = await expectConflict(w.postings.accept(actor, p.id, x.id), code);
    expect(body).toMatchObject({ postingStatus: expect.any(String), applicationStatus: expect.any(String) });
    expect(w.state.assignments).toEqual([]);
    expect(w.notices).toEqual([]);
  });

  it('409 agent_holds_slot when the agent already holds one of the slots here', async () => {
    const w = world();
    const p = w.seedPosting({ slotKeys: ['morning', 'evening'] });
    w.addAgent('a1');
    w.state.assignments.push({ id: 'as-x', business_location_id: LOC, agent_id: 'a1', slot_key: 'evening', status: 'paused', source: 'superuser_assign', application_id: null });
    const x = w.seedApp(p.id, 'a1');
    await expectConflict(w.postings.accept(actor, p.id, x.id), 'agent_holds_slot');
  });

  it('the cap trigger refusing inside the function is a 409 with the cap code', async () => {
    const w = world();
    const p = w.seedPosting();
    w.addAgent('a1');
    const x = w.seedApp(p.id, 'a1');
    w.state.capFails = true;
    await expectConflict(w.postings.accept(actor, p.id, x.id), DEDICATED_ASSIGNMENT_CONFLICTS.capExceeded);
    expect(w.state.apps[0].status).toBe('applied');
  });

  it('an application of another posting is 404', async () => {
    const w = world();
    const p = w.seedPosting({ slotKeys: ['morning'] });
    const q = w.seedPosting({ slotKeys: ['evening'] });
    w.addAgent('a1');
    const x = w.seedApp(q.id, 'a1');
    await expect(w.postings.accept(actor, p.id, x.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(w.writes('AcceptDedicatedApplication')).toHaveLength(0);
  });

  it('flag off -> 404 for accept, decline and applications', async () => {
    const w = world();
    const p = w.seedPosting();
    w.addAgent('a1');
    const x = w.seedApp(p.id, 'a1');
    w.state.flag = false;
    await expect(w.postings.accept(actor, p.id, x.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(w.postings.decline(actor, p.id, x.id, NOW)).rejects.toBeInstanceOf(NotFoundException);
    await expect(w.postings.applications(LOC, p.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(w.state.mutations).toEqual([]);
  });
});

describe('DedicatedPostingsService.decline', () => {
  it('declines a pending applicant; a second decline is 409', async () => {
    const w = world();
    const p = w.seedPosting();
    w.addAgent('a1');
    const x = w.seedApp(p.id, 'a1');
    await expect(w.postings.decline(actor, p.id, x.id, NOW)).resolves.toEqual({ application: { id: x.id, status: 'declined' } });
    expect(w.state.apps[0]).toMatchObject({ status: 'declined', decided_by_user_id: OWNER });
    await expectConflict(w.postings.decline(actor, p.id, x.id, NOW), 'application_not_pending');
  });
});

describe('DedicatedPostingsService.expireDue (AC-B13, 14 days)', () => {
  it('expires open postings past expires_at, auto-declines their applicants and tells them', async () => {
    const w = world();
    const due = w.seedPosting({ expires_at: '2026-10-20T08:59:00Z' });
    const notYet = w.seedPosting({ expires_at: '2026-10-20T09:01:00Z', slotKeys: ['evening'] });
    w.addAgent('a1');
    w.addAgent('a2');
    w.seedApp(due.id, 'a1');
    w.seedApp(notYet.id, 'a2');
    const res = await w.postings.expireDue(NOW);
    expect(res).toEqual({ found: 1, expired: 1, autoDeclined: 1, skipped: 0 });
    expect(w.state.postings.map((p) => p.status)).toEqual(['expired', 'open']);
    expect(w.state.apps.map((a) => a.status)).toEqual(['auto_declined', 'applied']);
    expect(w.notices.map((n) => [n.userId, n.messageType])).toEqual([['u-a1', 'DEDICATED_POSTING_CLOSED']]);
  });

  it('skips countries where the flag is off (stays dark)', async () => {
    const w = world();
    w.addLocation({ id: 'loc-ga', country: 'GA', state: 'Estuaire', city: 'Libreville' });
    w.seedPosting({ expires_at: '2026-10-01T00:00:00Z' });
    w.seedPosting({ business_location_id: 'loc-ga', expires_at: '2026-10-01T00:00:00Z' });
    w.state.flagByCountry = { GA: false };
    const res = await w.postings.expireDue(NOW);
    expect(res).toEqual({ found: 2, expired: 1, autoDeclined: 0, skipped: 1 });
    expect(w.writes('ExpireDedicatedPostings')[0].vars.ids).toHaveLength(1);
    expect(w.state.postings.map((p) => p.status)).toEqual(['expired', 'open']);
  });

  it('nothing due: no write', async () => {
    const w = world();
    w.seedPosting();
    expect(await w.postings.expireDue(NOW)).toEqual({ found: 0, expired: 0, autoDeclined: 0, skipped: 0 });
    expect(w.writes('ExpireDedicatedPostings')).toHaveLength(0);
  });

  it('reads at most one batch per run', () => {
    expect(POSTING_EXPIRY_BATCH).toBe(50);
  });
});

describe('DedicatedPostingsSweeperService', () => {
  it('runs expireDue, never overlaps itself and never throws', async () => {
    let release: () => void = () => undefined;
    const postings = {
      expireDue: jest.fn(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ found: 0, expired: 0, autoDeclined: 0, skipped: 0 });
          })
      ),
    };
    const sweeper = new DedicatedPostingsSweeperService(postings as unknown as DedicatedPostingsService);
    const first = sweeper.handleCron();
    await sweeper.handleCron();
    expect(postings.expireDue).toHaveBeenCalledTimes(1);
    release();
    await first;
    postings.expireDue.mockRejectedValueOnce(new Error('db down'));
    await expect(sweeper.handleCron()).resolves.toBeUndefined();
    expect(postings.expireDue).toHaveBeenCalledTimes(2);
  });
});

describe('distanceKm', () => {
  it('km to one decimal, null when a coordinate is missing', () => {
    expect(distanceKm({ latitude: 4.05, longitude: 9.7 }, { latitude: '4.06', longitude: '9.7' })).toBe(1.1);
    expect(distanceKm({ latitude: null, longitude: 9.7 }, { latitude: 4, longitude: 9 })).toBeNull();
    expect(distanceKm(null, { latitude: 4, longitude: 9 })).toBeNull();
  });
});

// ------------------------------------------------------------------ agent

describe('DedicatedOpportunitiesService.list (AC-A1, A4, E7)', () => {
  const setup = () => {
    const w = world();
    w.addLocation({ id: 'loc-dla2', name: 'Akwa Grill', city: 'douala ' });
    w.addLocation({ id: 'loc-yde', name: 'Yaoundé Shop', state: 'Centre', city: 'Yaoundé' });
    w.addLocation({ id: 'loc-edea', name: 'Edéa Shop', city: 'Edéa' });
    w.addLocation({ id: 'loc-blank', name: 'No City', city: ' ' });
    w.addAgent('a1');
    return w;
  };

  it('a Douala agent sees Douala and "douala " stores, not Yaoundé or Edéa; blank city falls back to state and is logged', async () => {
    const w = setup();
    const log = jest.spyOn((w.opportunities as unknown as { logger: { log: (m: string) => void } }).logger, 'log');
    const dla = w.seedPosting({ slotKeys: ['morning'] });
    const dla2 = w.seedPosting({ business_location_id: 'loc-dla2' });
    w.seedPosting({ business_location_id: 'loc-yde' });
    w.seedPosting({ business_location_id: 'loc-edea' });
    const blank = w.seedPosting({ business_location_id: 'loc-blank' });
    w.seedPosting({ status: 'closed', slotKeys: ['evening'] });
    const { opportunities } = await w.opportunities.list('u-a1', NOW);
    expect(opportunities.map((o) => o.id).sort()).toEqual([dla.id, dla2.id, blank.id].sort());
    const line = JSON.parse(log.mock.calls.map((c) => c[0]).find((m) => m.includes('dedicated.opportunities_city_match')) as string);
    expect(line).toEqual({
      event: 'dedicated.opportunities_city_match',
      agentId: 'a1',
      agentCity: 'Douala',
      agentState: 'Littoral',
      country: 'CM',
      candidates: 5,
      visible: 3,
      cityMisses: 2,
      stateFallbacks: 1,
      stateFallbackPostingIds: [blank.id],
    });
  });

  it('card fields: store, address, distance, slot times with pickup time, days, counts, fixed pay, no disabled reason', async () => {
    const w = setup();
    w.state.pickup.push({ business_location_id: LOC, slot_key: 'evening', is_enabled: true, pickup_time: '17:15:00' });
    const p = w.seedPosting({ slotKeys: ['morning', 'evening'], headcount: 2, accepted_count: 1, days_of_week: [1, 2, 3], terms: 'Tenue noire' });
    const [o] = (await w.opportunities.list('u-a1', NOW)).opportunities;
    expect(o).toMatchObject({
      id: p.id,
      storeName: 'Chez Mama',
      address: { line1: 'Rue 1', city: 'Douala', state: 'Littoral' },
      distanceKm: 1.1,
      slots: [
        { slotKey: 'morning', startTime: '08:00', endTime: '12:00', pickupTime: '08:30' },
        { slotKey: 'evening', startTime: '16:00', endTime: '20:00', pickupTime: '17:15' },
      ],
      daysOfWeek: [1, 2, 3],
      headcount: 2,
      acceptedCount: 1,
      terms: 'Tenue noire',
      pay: 'standard_delivery_pay',
      application: null,
      termsUpdatedSinceApplied: false,
      disabledReason: null,
    });
  });

  it('AC-A4: holds_slot when the agent holds one of the slots at that store; max_assignments past the cap', async () => {
    const w = setup();
    const here = w.seedPosting({ slotKeys: ['morning', 'evening'] });
    const there = w.seedPosting({ business_location_id: 'loc-dla2', slotKeys: ['afternoon', 'evening'] });
    w.state.assignments.push(
      { id: 'as-1', business_location_id: LOC, agent_id: 'a1', slot_key: 'evening', status: 'active', source: 'posting', application_id: null },
      { id: 'as-2', business_location_id: 'loc-blank', agent_id: 'a1', slot_key: 'morning', status: 'paused', source: 'superuser_assign', application_id: null }
    );
    const byId = new Map((await w.opportunities.list('u-a1', NOW)).opportunities.map((o) => [o.id, o.disabledReason]));
    expect(byId.get(here.id)).toBe('holds_slot');
    expect(byId.get(there.id)).toBe('max_assignments');
  });

  it('A3 / A1c: the agent’s application shows, with "Updated" when terms changed after applying', async () => {
    const w = setup();
    const p = w.seedPosting({ terms: 'v2', terms_updated_at: '2026-10-20T09:30:00Z' });
    w.seedApp(p.id, 'a1', { updated_at: '2026-10-20T09:10:00Z', created_at: '2026-10-20T09:10:00Z' });
    const q = w.seedPosting({ business_location_id: 'loc-dla2', terms: 'v1', terms_updated_at: '2026-10-19T09:30:00Z' });
    w.seedApp(q.id, 'a1', { updated_at: '2026-10-20T09:10:00Z' });
    const byId = new Map((await w.opportunities.list('u-a1', NOW)).opportunities.map((o) => [o.id, o]));
    expect(byId.get(p.id)).toMatchObject({ application: { status: 'applied' }, termsUpdatedSinceApplied: true });
    expect(byId.get(q.id)).toMatchObject({ application: { status: 'applied' }, termsUpdatedSinceApplied: false });
  });

  it('#594 G6: no active address and the global flag on -> 403 reason no_address (not 200 [])', async () => {
    const w = world();
    w.addAgent('a1', { addresses: [] });
    w.seedPosting();
    const { err, body } = await rejection(w.opportunities.list('u-a1', NOW));
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(body).toMatchObject({
      error: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE',
      code: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE',
      reason: 'no_address',
      message: 'Add your address to see stores near you',
    });
  });

  it('#594 G6: no active address and the global flag off -> 404 even when a country row is on', async () => {
    const w = world();
    w.state.flag = false;
    w.state.flagByCountry = { CM: true };
    w.addAgent('a1', { addresses: [] });
    w.seedPosting();
    await expect(w.opportunities.list('u-a1', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('#594 G6: an eligible agent with an address and nothing in the city still gets 200 []', async () => {
    const w = world();
    w.addAgent('a1');
    expect(await w.opportunities.list('u-a1', NOW)).toEqual({ opportunities: [] });
  });

  it.each([
    ['unverified independent', { is_verified: false }, true, 'not_verified'],
    ['independent without a signed contract', {}, false, 'contract_unsigned'],
    ['suspended agent', { status: 'suspended' }, true, 'suspended'],
    ['commercial-focus agent', { focus: 'commercial' }, true, 'commercial_focus'],
  ])('403 for an %s', async (_l, over, signed, reason) => {
    const w = world();
    w.addAgent('a1', over);
    if (!signed) w.state.signed.delete('a1');
    const { err, body } = await rejection(w.opportunities.list('u-a1', NOW));
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(body).toMatchObject({ code: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', reason });
  });

  it('#594 G2: internal agents (even verified and signed) -> 403 reason internal_agent', async () => {
    const w = world();
    w.addAgent('a1', { is_internal: true });
    w.seedPosting();
    const { err, body } = await rejection(w.opportunities.list('u-a1', NOW));
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(body).toMatchObject({
      code: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE',
      reason: 'internal_agent',
      message: 'Dedicated opportunities are for independent agents',
    });
  });

  it('#594 G2: flag off wins over internal_agent (404 before 403)', async () => {
    const w = world();
    w.state.flagByCountry = { CM: false };
    w.addAgent('a1', { is_internal: true });
    await expect(w.opportunities.list('u-a1', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the contract gate off lets unsigned independents in', async () => {
    const v = world();
    v.addAgent('a2');
    v.state.signed.delete('a2');
    v.state.contractRequired = false;
    await expect(v.opportunities.list('u-a2', NOW)).resolves.toBeDefined();
  });

  it('flag off for the agent’s country -> 404', async () => {
    const w = world();
    w.addAgent('a1');
    w.state.flagByCountry = { CM: false };
    await expect(w.opportunities.list('u-a1', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DedicatedOpportunitiesService.apply / withdraw (AC-A2, A3, B16)', () => {
  it('applies and notifies the owner and managing delegates (each in their language)', async () => {
    const w = world();
    w.state.delegates.push({ user_id: DELEGATE, location: LOC, lang: 'en' });
    w.addAgent('a1', {}, { first_name: 'Awa' });
    const p = w.seedPosting({ slotKeys: ['morning'] });
    const res = await w.opportunities.apply('u-a1', p.id, NOW);
    expect(res).toEqual({ application: { id: expect.any(String), status: 'applied' } });
    expect(w.state.apps).toEqual([expect.objectContaining({ posting_id: p.id, agent_id: 'a1', status: 'applied' })]);
    expect(w.notices.map((n) => [n.userId, n.title, n.body, n.messageType, n.path, n.persona])).toEqual([
      [OWNER, 'Nouvelle candidature', 'Awa a postulé comme livreur dédié (Matin)', 'DEDICATED_POSTING_NEW_APPLICATION', `/business/locations/${LOC}/dedicated-agents/postings/${p.id}`, 'business'],
      [DELEGATE, 'New applicant', 'Awa applied to be your dedicated agent (Morning)', 'DEDICATED_POSTING_NEW_APPLICATION', `/business/locations/${LOC}/dedicated-agents/postings/${p.id}`, 'business'],
    ]);
  });

  it('no profile photo -> 422 PROFILE_PHOTO_REQUIRED and nothing written', async () => {
    const w = world();
    w.addAgent('a1', {}, { profile_picture_url: '  ' });
    const p = w.seedPosting();
    const { err, body } = await rejection(w.opportunities.apply('u-a1', p.id, NOW));
    expect(err).toBeInstanceOf(UnprocessableEntityException);
    expect(body).toEqual({ error: 'PROFILE_PHOTO_REQUIRED', code: 'PROFILE_PHOTO_REQUIRED', message: 'Add a profile photo to apply' });
    expect(w.state.mutations).toEqual([]);
  });

  it('applying twice is idempotent (one row, one notice set)', async () => {
    const w = world();
    w.addAgent('a1');
    const p = w.seedPosting();
    const a = await w.opportunities.apply('u-a1', p.id, NOW);
    const b = await w.opportunities.apply('u-a1', p.id, NOW);
    expect(b).toEqual(a);
    expect(w.state.apps).toHaveLength(1);
    expect(w.notices).toHaveLength(1);
  });

  it('re-apply after withdrawing revives the row; after a decline it is 409 application_closed', async () => {
    const w = world();
    w.addAgent('a1');
    const p = w.seedPosting();
    const x = w.seedApp(p.id, 'a1', { status: 'withdrawn', withdrawn_at: '2026-10-19T00:00:00Z' });
    await w.opportunities.apply('u-a1', p.id, NOW);
    expect(w.state.apps).toEqual([expect.objectContaining({ id: x.id, status: 'applied', withdrawn_at: null })]);
    const q = w.seedPosting({ slotKeys: ['evening'] });
    w.seedApp(q.id, 'a1', { status: 'declined' });
    await expectConflict(w.opportunities.apply('u-a1', q.id, NOW), 'application_closed');
  });

  it.each([
    ['closed', { status: 'closed' }],
    ['past expires_at', { expires_at: '2026-10-20T08:00:00Z' }],
  ])('409 posting_not_open when the posting is %s', async (_l, over) => {
    const w = world();
    w.addAgent('a1');
    const p = w.seedPosting(over);
    await expectConflict(w.opportunities.apply('u-a1', p.id, NOW), 'posting_not_open');
    expect(w.state.apps).toEqual([]);
  });

  it('409 holds_slot / max_assignments (AC-A4)', async () => {
    const w = world();
    w.addAgent('a1');
    const p = w.seedPosting({ slotKeys: ['morning'] });
    w.state.assignments.push({ id: 'as-1', business_location_id: LOC, agent_id: 'a1', slot_key: 'morning', status: 'active', source: 'posting', application_id: null });
    await expectConflict(w.opportunities.apply('u-a1', p.id, NOW), 'holds_slot');
    w.state.cap = 1;
    const v = world();
    v.state.cap = 1;
    v.addAgent('a2');
    v.state.assignments.push({ id: 'as-2', business_location_id: 'loc-x', agent_id: 'a2', slot_key: 'morning', status: 'active', source: 'posting', application_id: null });
    const q = v.seedPosting({ slotKeys: ['evening'] });
    await expectConflict(v.opportunities.apply('u-a2', q.id, NOW), 'max_assignments');
  });

  it('a close racing the insert auto-declines the new application at once (409, no business notice)', async () => {
    const w = world();
    w.addAgent('a1');
    const p = w.seedPosting();
    w.state.closeDuringApply = true;
    await expectConflict(w.opportunities.apply('u-a1', p.id, NOW), 'posting_not_open');
    expect(w.state.apps[0].status).toBe('auto_declined');
    expect(w.notices).toEqual([]);
  });

  it('403 for an unverified independent; 404 when the flag is off for the store', async () => {
    const w = world();
    w.addAgent('a1', { is_verified: false });
    const p = w.seedPosting();
    await expect(w.opportunities.apply('u-a1', p.id, NOW)).rejects.toBeInstanceOf(ForbiddenException);
    const v = world();
    v.addAgent('a2');
    const q = v.seedPosting();
    v.state.flag = false;
    await expect(v.opportunities.apply('u-a2', q.id, NOW)).rejects.toBeInstanceOf(NotFoundException);
    await expect(v.opportunities.withdraw('u-a2', q.id, NOW)).rejects.toBeInstanceOf(NotFoundException);
    expect(v.state.mutations).toEqual([]);
  });

  it('withdraw a pending application; nothing pending is 409', async () => {
    const w = world();
    w.addAgent('a1');
    const p = w.seedPosting();
    w.seedApp(p.id, 'a1');
    await expect(w.opportunities.withdraw('u-a1', p.id, NOW)).resolves.toEqual({ application: { postingId: p.id, status: 'withdrawn' } });
    expect(w.state.apps[0]).toMatchObject({ status: 'withdrawn', withdrawn_at: NOW.toISOString() });
    await expectConflict(w.opportunities.withdraw('u-a1', p.id, NOW), 'application_not_pending');
  });
});

describe('#594 G2: internal agents cannot apply', () => {
  it('apply -> 403 internal_agent, nothing written; withdraw of a legacy application still works', async () => {
    const w = world();
    w.addAgent('a1', { is_internal: true });
    const p = w.seedPosting();
    const { err, body } = await rejection(w.opportunities.apply('u-a1', p.id, NOW));
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(body).toMatchObject({ code: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', reason: 'internal_agent' });
    expect(w.writes('UpsertDedicatedApplication')).toHaveLength(0);
    expect(w.state.apps).toHaveLength(0);
    w.seedApp(p.id, 'a1');
    await expect(w.opportunities.withdraw('u-a1', p.id, NOW)).resolves.toEqual({ application: { postingId: p.id, status: 'withdrawn' } });
  });
});

describe('#594 G1: DedicatedOpportunitiesService.detail', () => {
  const setup = () => {
    const w = world();
    w.addLocation({ id: 'loc-yde', name: 'Yaoundé Shop', state: 'Centre', city: 'Yaoundé' });
    w.addAgent('a1');
    return w;
  };

  it('an open posting in the agent’s city: same shape as a list item', async () => {
    const w = setup();
    const p = w.seedPosting({ slotKeys: ['morning'] });
    const { opportunity } = await w.opportunities.detail('u-a1', p.id, NOW);
    const [fromList] = (await w.opportunities.list('u-a1', NOW)).opportunities;
    expect(opportunity).toEqual(fromList);
    expect(opportunity).toMatchObject({ id: p.id, storeName: 'Chez Mama', pay: 'standard_delivery_pay', application: null, disabledReason: null });
  });

  it('open posting the agent holds a slot for keeps disabledReason holds_slot', async () => {
    const w = setup();
    const p = w.seedPosting({ slotKeys: ['morning'] });
    w.state.assignments.push({ id: 'as-1', business_location_id: LOC, agent_id: 'a1', slot_key: 'morning', status: 'active', source: 'posting', application_id: null });
    expect((await w.opportunities.detail('u-a1', p.id, NOW)).opportunity.disabledReason).toBe('holds_slot');
  });

  it('a filled posting the agent was accepted on is visible (not in the open list), disabledReason null', async () => {
    const w = setup();
    const p = w.seedPosting({ status: 'filled', business_location_id: 'loc-yde' });
    w.seedApp(p.id, 'a1', { status: 'accepted' });
    w.state.assignments.push({ id: 'as-1', business_location_id: 'loc-yde', agent_id: 'a1', slot_key: 'morning', status: 'active', source: 'posting', application_id: null });
    const { opportunity } = await w.opportunities.detail('u-a1', p.id, NOW);
    expect(opportunity).toMatchObject({ id: p.id, status: 'filled', application: { status: 'accepted' }, disabledReason: null });
    expect((await w.opportunities.list('u-a1', NOW)).opportunities).toHaveLength(0);
  });

  it.each([
    ['another city, no application', { business_location_id: 'loc-yde' }],
    ['closed in my city, no application', { status: 'closed' }],
    ['expired in my city, no application', { expires_at: '2026-10-20T08:59:00Z' }],
  ])('404 Posting not found: %s', async (_l, over) => {
    const w = setup();
    const p = w.seedPosting(over as Partial<PostingFake>);
    const { err, body } = await rejection(w.opportunities.detail('u-a1', p.id, NOW));
    expect(err).toBeInstanceOf(NotFoundException);
    expect(body).toMatchObject({ message: 'Posting not found' });
  });

  it('unknown posting -> 404', async () => {
    const w = setup();
    await expect(w.opportunities.detail('u-a1', 'po-missing', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('flag off for the store’s country -> 404 (before eligibility)', async () => {
    const w = setup();
    w.state.flagByCountry = { CM: false };
    const p = w.seedPosting();
    await expect(w.opportunities.detail('u-a1', p.id, NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('internal agent -> 403 internal_agent; no address -> 403 no_address', async () => {
    const w = world();
    w.addAgent('a1', { is_internal: true });
    w.addAgent('a2', { addresses: [] });
    const p = w.seedPosting();
    expect((await rejection(w.opportunities.detail('u-a1', p.id, NOW))).body).toMatchObject({ reason: 'internal_agent' });
    const { err, body } = await rejection(w.opportunities.detail('u-a2', p.id, NOW));
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(body).toMatchObject({ code: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', reason: 'no_address' });
  });
});

describe('#594 G12: capability', () => {
  it('agent: enabled follows the country row; global off + CM on -> enabled', async () => {
    const w = world();
    w.state.flag = false;
    w.state.flagByCountry = { CM: true };
    w.addAgent('a1');
    expect(await w.opportunities.capabilityForAgent('u-a1')).toEqual({ enabled: true, country: 'CM', reason: null });
  });

  it('agent: flag off -> 200 enabled false (no throw)', async () => {
    const w = world();
    w.state.flagByCountry = { CM: false };
    w.addAgent('a1');
    expect(await w.opportunities.capabilityForAgent('u-a1')).toEqual({ enabled: false, country: 'CM', reason: null });
  });

  it('agent with no address, or no agent row -> enabled false, reason no_address', async () => {
    const w = world();
    w.addAgent('a1', { addresses: [] });
    expect(await w.opportunities.capabilityForAgent('u-a1')).toEqual({ enabled: false, country: null, reason: 'no_address' });
    expect(await w.opportunities.capabilityForAgent('u-nobody')).toEqual({ enabled: false, country: null, reason: 'no_address' });
  });

  it('internal agents still see the flag (eligibility is not encoded)', async () => {
    const w = world();
    w.addAgent('a1', { is_internal: true });
    expect((await w.opportunities.capabilityForAgent('u-a1')).enabled).toBe(true);
  });

  it('country variant: case-insensitive code; missing -> no_country; bad -> 400 invalid_country', async () => {
    const w = world();
    w.state.flagByCountry = { GA: false };
    expect(await w.opportunities.capabilityForCountry(' cm ')).toEqual({ enabled: true, country: 'CM', reason: null });
    expect(await w.opportunities.capabilityForCountry('ga')).toEqual({ enabled: false, country: 'GA', reason: null });
    expect(await w.opportunities.capabilityForCountry(undefined)).toEqual({ enabled: false, country: null, reason: 'no_country' });
    expect(await w.opportunities.capabilityForCountry('  ')).toEqual({ enabled: false, country: null, reason: 'no_country' });
    for (const bad of ['CMR', 'C', '1A']) {
      const { err, body } = await rejection(w.opportunities.capabilityForCountry(bad));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(body).toMatchObject({ code: 'invalid_country' });
    }
  });
});

describe('opportunityDisabledReason', () => {
  const posting = { business_location_id: 'L', slots: [{ slot_key: 'morning' }, { slot_key: 'evening' }] };
  it('holds_slot beats max_assignments; the cap counts every slot the accept would add', () => {
    expect(opportunityDisabledReason(posting, [], 3)).toBeNull();
    expect(opportunityDisabledReason(posting, [{ business_location_id: 'X', slot_key: 'morning' }], 3)).toBeNull();
    expect(opportunityDisabledReason(posting, [{ business_location_id: 'X', slot_key: 'a' }, { business_location_id: 'Y', slot_key: 'b' }], 3)).toBe('max_assignments');
    expect(opportunityDisabledReason(posting, [{ business_location_id: 'L', slot_key: 'evening' }], 1)).toBe('holds_slot');
    expect(opportunityDisabledReason(posting, [{ business_location_id: 'L', slot_key: 'afternoon' }], 3)).toBeNull();
  });
});


describe('PR 8 analytics (AC section 5): postings and applications', () => {
  it('posting_created on create', async () => {
    const w = world();
    const { posting } = await w.postings.create(actor, { headcount: 2, slotKeys: ['morning'] }, NOW);
    expect(w.events('dedicated.posting_created')).toEqual([
      expect.objectContaining({ postingId: posting.id, businessLocationId: LOC, headcount: 2, slotKeys: ['morning'] }),
    ]);
  });

  it('accepting the last spot: application_accepted, one assignment_status_changed per slot (source posting), posting_filled, auto_declined (filled)', async () => {
    const w = world();
    const p = w.seedPosting({ headcount: 1, slotKeys: ['morning', 'evening'] });
    w.addAgent('a1');
    w.addAgent('a2');
    const x1 = w.seedApp(p.id, 'a1');
    w.seedApp(p.id, 'a2');
    await w.postings.accept(actor, p.id, x1.id);
    expect(w.events('dedicated.application_accepted')).toEqual([{ postingId: p.id, applicationId: x1.id, agentId: 'a1' }]);
    expect(w.events('dedicated.assignment_status_changed').map((e) => [e.slotKey, e.source, e.from, e.to, e.cause])).toEqual([
      ['evening', 'posting', null, 'active', 'posting_accept'],
      ['morning', 'posting', null, 'active', 'posting_accept'],
    ]);
    expect(w.events('dedicated.posting_filled')).toEqual([{ postingId: p.id, headcount: 1, acceptedCount: 1 }]);
    expect(w.events('dedicated.application_auto_declined')).toEqual([{ postingId: p.id, count: 1, cause: 'filled' }]);
  });

  it('accept #1 of 2: no posting_filled and no auto_declined', async () => {
    const w = world();
    const p = w.seedPosting({ headcount: 2 });
    w.addAgent('a1');
    w.addAgent('a2');
    const x1 = w.seedApp(p.id, 'a1');
    w.seedApp(p.id, 'a2');
    await w.postings.accept(actor, p.id, x1.id);
    expect(w.events('dedicated.posting_filled')).toEqual([]);
    expect(w.events('dedicated.application_auto_declined')).toEqual([]);
  });

  it('close: auto_declined (closed) with the count; none when nobody was pending', async () => {
    const w = world();
    const p = w.seedPosting();
    w.addAgent('a1');
    w.seedApp(p.id, 'a1');
    await w.postings.close(actor, p.id, null, NOW);
    expect(w.events('dedicated.application_auto_declined')).toEqual([{ postingId: p.id, count: 1, cause: 'closed' }]);
    const q = w.seedPosting({ slotKeys: ['evening'] });
    await w.postings.close(actor, q.id, null, NOW);
    expect(w.events('dedicated.application_auto_declined')).toHaveLength(1);
  });

  it('expiry: posting_expired per posting and auto_declined (expired)', async () => {
    const w = world();
    const due = w.seedPosting({ expires_at: '2026-10-20T08:59:00Z' });
    const empty = w.seedPosting({ expires_at: '2026-10-20T08:59:00Z', slotKeys: ['evening'] });
    w.addAgent('a1');
    w.seedApp(due.id, 'a1');
    await w.postings.expireDue(NOW);
    expect(w.events('dedicated.posting_expired')).toEqual(
      expect.arrayContaining([
        { postingId: due.id, autoDeclined: 1 },
        { postingId: empty.id, autoDeclined: 0 },
      ])
    );
    expect(w.events('dedicated.posting_expired')).toHaveLength(2);
    expect(w.events('dedicated.application_auto_declined')).toEqual([{ postingId: due.id, count: 1, cause: 'expired' }]);
  });

  it('apply: application_submitted once (idempotent re-apply sends none); withdraw: application_withdrawn', async () => {
    const w = world();
    w.addAgent('a1');
    const p = w.seedPosting();
    const { application } = await w.opportunities.apply('u-a1', p.id, NOW);
    await w.opportunities.apply('u-a1', p.id, NOW);
    expect(w.events('dedicated.application_submitted')).toEqual([{ postingId: p.id, applicationId: application.id, agentId: 'a1' }]);
    await w.opportunities.withdraw('u-a1', p.id, NOW);
    expect(w.events('dedicated.application_withdrawn')).toEqual([{ postingId: p.id, agentId: 'a1' }]);
  });

  it('no photo: photo_gate_shown and no application_submitted', async () => {
    const w = world();
    w.addAgent('a1', {}, { profile_picture_url: null });
    const p = w.seedPosting();
    await w.opportunities.apply('u-a1', p.id, NOW).catch(() => undefined);
    expect(w.events('dedicated.photo_gate_shown')).toEqual([{ postingId: p.id, agentId: 'a1' }]);
    expect(w.events('dedicated.application_submitted')).toEqual([]);
  });

  it('a close racing the insert: auto_declined (late), no application_submitted', async () => {
    const w = world();
    w.addAgent('a1');
    const p = w.seedPosting();
    w.state.closeDuringApply = true;
    await w.opportunities.apply('u-a1', p.id, NOW).catch(() => undefined);
    expect(w.events('dedicated.application_auto_declined')).toEqual([{ postingId: p.id, count: 1, cause: 'late' }]);
    expect(w.events('dedicated.application_submitted')).toEqual([]);
  });
});
