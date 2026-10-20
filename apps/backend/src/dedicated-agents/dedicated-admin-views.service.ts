import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { showsDeliveryChrome } from '../agents/agent-focus.util';
import { normalizeCity } from '../common/same-region.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { GeoScopeService } from '../rbac/geo-scope.service';
import type { GeoScope } from '../rbac/platform-permissions';
import { AgentContractGateService } from '../agent-contracts/agent-contract-gate.service';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import {
  DEDICATED_ASSIGNMENT_SOURCES,
  DEDICATED_ASSIGNMENT_STATUSES,
  DEDICATED_POSTING_STATUSES,
  DEDICATED_SLOT_KEYS,
  type DedicatedSlotKey,
} from './dedicated-agents.constants';
import {
  ADMIN_VIEW_LIMIT,
  PICKER_AGENT_LIMIT,
  DEDICATED_ADMIN_ASSIGNMENT_BY_ID_QUERY,
  DEDICATED_ADMIN_ASSIGNMENTS_QUERY,
  DEDICATED_ADMIN_COVERAGE_QUERY,
  DEDICATED_ADMIN_LOCATION_SEARCH_QUERY,
  LOCATION_SEARCH_FETCH_LIMIT,
  DEDICATED_ADMIN_POSTING_SCOPE_QUERY,
  DEDICATED_ADMIN_POSTINGS_QUERY,
  DEDICATED_PICKER_AGENTS_QUERY,
  DISMISS_DEDICATED_RELATION_MUTATION,
} from './dedicated-admin-views.queries';
import { DedicatedAssignmentsService } from './dedicated-assignments.service';
import { DedicatedPostingsService } from './dedicated-postings.service';
import { relationBadge, type RelationSignal } from './relation-signals.util';

/** Pages fetched before the in-memory city filter; the response says when it stopped early. */
export const ADMIN_VIEW_MAX_PAGES = 5;
export const COVERAGE_SHARE_DAYS = 30;
type BoolExp = Record<string, unknown>;

export interface AdminAssignmentFilters {
  city?: string;
  locationId?: string;
  slotKey?: string;
  status?: string;
  source?: string;
}

export interface AdminAssignmentView {
  assignmentId: string;
  slotKey: string;
  status: string;
  source: string;
  createdAt: string;
  location: { id: string; name: string; businessId: string; businessName: string; city: string; state: string; country: string };
  agent: { id: string; firstName: string; lastName: string; photoUrl: string | null; isInternal: boolean };
  possible_relation: boolean;
  relation_signals: RelationSignal[];
  relation_dismissed: boolean;
}

export interface CoverageLocationView {
  locationId: string;
  name: string;
  businessId: string;
  city: string;
  enabledSlots: DedicatedSlotKey[];
  coveredSlots: DedicatedSlotKey[];
  uncoveredSlots: DedicatedSlotKey[];
  orders: { dedicated: number; standard: number };
}

function pick<T extends string>(value: unknown, allowed: readonly T[], name: string): T | undefined {
  if (value == null || value === '') return undefined;
  const v = String(value).trim().toLowerCase();
  if (!(allowed as readonly string[]).includes(v)) {
    throw new BadRequestException({ code: `invalid_${name}`, message: `${name} must be one of ${allowed.join(', ')}` });
  }
  return v as T;
}

/** #594 G10 search bounds. */
export const LOCATION_SEARCH_DEFAULT_LIMIT = 20;
export const LOCATION_SEARCH_MAX_LIMIT = 50;
export const LOCATION_SEARCH_MIN_QUERY = 2;

export interface AdminLocationSearchItem {
  id: string;
  name: string;
  businessId: string;
  businessName: string;
  address: { line1: string | null; city: string | null; state: string | null; country: string | null };
  enabledSlotKeys: DedicatedSlotKey[];
  liveAgents: number;
}

/** ilike pattern with the user's % _ \\ escaped. */
export function ilikeContains(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function and(parts: Array<BoolExp | null | undefined>): BoolExp {
  const list = parts.filter((p): p is BoolExp => !!p && Object.keys(p).length > 0);
  return list.length === 0 ? {} : list.length === 1 ? list[0] : { _and: list };
}

/** AC-S4 per-location slot coverage: enabled = no row or is_enabled; covered = an active assignment. */
export function slotCoverage(
  pickupSlots: Array<{ slot_key: string; is_enabled: boolean }>,
  activeSlotKeys: string[]
): Pick<CoverageLocationView, 'enabledSlots' | 'coveredSlots' | 'uncoveredSlots'> {
  const off = new Set(pickupSlots.filter((s) => s.is_enabled === false).map((s) => s.slot_key));
  const enabledSlots = DEDICATED_SLOT_KEYS.filter((k) => !off.has(k));
  const active = new Set(activeSlotKeys);
  return {
    enabledSlots,
    coveredSlots: enabledSlots.filter((k) => active.has(k)),
    uncoveredSlots: enabledSlots.filter((k) => !active.has(k)),
  };
}

/**
 * Dedicated (dedicated_offer / dedicated_auto) vs every other assigned order.
 * QA #619 N1: every assigned order counts; only the dedicated claim path stamps a
 * source, so a NULL source (standard offer accept, open claim) is standard.
 * QA #619 N9: built from two aggregates (dedicated count, assigned count), so
 * standard = assigned - dedicated. Cancelled-after-assignment orders are included.
 */
export function deliveryShare(dedicatedCount: number | null | undefined, assignedCount: number | null | undefined): {
  dedicated: number;
  standard: number;
} {
  const dedicated = Math.max(0, Number(dedicatedCount) || 0);
  const assigned = Math.max(0, Number(assignedCount) || 0);
  return { dedicated, standard: Math.max(0, assigned - dedicated) };
}

/**
 * #594 PR 8 super-user views: assignments list with the S5 relation badge
 * (S1), postings per city with Close (S3), coverage (S4) and the assign
 * picker (S2). Every read is limited to the caller's geo scope and to
 * countries where `dedicated_agents_enabled` is on; writes 404 when it's off.
 *
 * QA #619 N11, `truncated` (for the future admin UI). Every list response
 * (`listAssignments`, `listPostings`, `coverage`, `picker`) carries `truncated: boolean`:
 * - `false`: the list is complete for the caller's scope and filters.
 * - `true`: the server stopped at its cap and more rows MAY exist. Lists stop after
 *   ADMIN_VIEW_MAX_PAGES (5) pages of ADMIN_VIEW_LIMIT (500), so 2 500 rows. The picker
 *   stops at PICKER_AGENT_LIMIT (200) and logs `dedicated.picker_truncated`. A list
 *   that is exactly at the cap also reports true, because it is not counted.
 * - On `coverage`, `totals` (and `dedicatedShare`) cover only the rows returned.
 * - There is no cursor or offset parameter yet. When `truncated` is true the UI
 *   should say "Showing the first N; narrow the filters (city, status) to see the
 *   rest", not present the list or totals as complete.
 */
@Injectable()
export class DedicatedAdminViewsService {
  private readonly logger = new Logger(DedicatedAdminViewsService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly config: DedicatedAgentsConfigService,
    private readonly geo: GeoScopeService,
    private readonly assignments: DedicatedAssignmentsService,
    private readonly postings: DedicatedPostingsService,
    private readonly contractGate: AgentContractGateService
  ) {}

  async listAssignments(scope: GeoScope, filters: AdminAssignmentFilters) {
    const slotKey = pick(filters.slotKey, DEDICATED_SLOT_KEYS, 'slotKey');
    const status = pick(filters.status, DEDICATED_ASSIGNMENT_STATUSES, 'status');
    const source = pick(filters.source, DEDICATED_ASSIGNMENT_SOURCES, 'source');
    const geoAddress = await this.geo.addressWhere(scope);
    const where = and([
      geoAddress ? { business_location: { address: geoAddress } } : null,
      filters.locationId ? { business_location_id: { _eq: filters.locationId } } : null,
      slotKey ? { slot_key: { _eq: slotKey } } : null,
      status ? { status: { _eq: status } } : null,
      source ? { source: { _eq: source } } : null,
    ]);
    const { rows, truncated } = await this.pages<AssignmentListRow>(DEDICATED_ADMIN_ASSIGNMENTS_QUERY, where, 'dedicated_agent_assignments');
    const visible = await this.enabledOnly(rows, (r) => r.business_location?.address?.country);
    const city = normalizeCity(filters.city);
    const items = visible
      .filter((r) => !city || normalizeCity(r.business_location?.address?.city) === city)
      .map((r) => this.assignmentView(r));
    return { assignments: items, truncated };
  }

  /** AC-S5: remove the badge (audited). Idempotent; signals stay listed for audit. */
  async dismissRelation(scope: GeoScope, actorUserId: string, assignmentId: string, now = new Date()) {
    const res = await this.hasura.executeQuery<{
      dedicated_agent_assignments_by_pk: {
        id: string;
        relation_dismissed_at: string | null;
        business_location: { business_id: string; address: { country: string | null } | null } | null;
      } | null;
    }>(DEDICATED_ADMIN_ASSIGNMENT_BY_ID_QUERY, { id: assignmentId });
    const row = res?.dedicated_agent_assignments_by_pk;
    if (!row?.business_location) throw new NotFoundException('Assignment not found');
    await this.geo.assertBusiness(scope, row.business_location.business_id);
    await this.requireEnabled(row.business_location.address?.country);
    if (row.relation_dismissed_at) return { assignmentId, relationDismissedAt: row.relation_dismissed_at, changed: false };
    const at = now.toISOString();
    const out = await this.hasura.executeMutation<{ update_dedicated_agent_assignments: { affected_rows: number } }>(
      DISMISS_DEDICATED_RELATION_MUTATION,
      { id: assignmentId, by: actorUserId, at }
    );
    const changed = (out?.update_dedicated_agent_assignments?.affected_rows ?? 0) > 0;
    this.logger.log(JSON.stringify({ event: 'dedicated.relation_dismissed', assignmentId, by: actorUserId, at, changed }));
    return { assignmentId, relationDismissedAt: at, changed };
  }

  async listPostings(scope: GeoScope, filters: { city?: string; status?: string }) {
    const status = pick(filters.status, DEDICATED_POSTING_STATUSES, 'status');
    const geoAddress = await this.geo.addressWhere(scope);
    const where = and([
      geoAddress ? { business_location: { address: geoAddress } } : null,
      status ? { status: { _eq: status } } : null,
    ]);
    const { rows, truncated } = await this.pages<PostingListRow>(DEDICATED_ADMIN_POSTINGS_QUERY, where, 'dedicated_agent_postings');
    const visible = await this.enabledOnly(rows, (r) => r.business_location?.address?.country);
    const city = normalizeCity(filters.city);
    const postings = visible
      .filter((r) => !city || normalizeCity(r.business_location?.address?.city) === city)
      .map((r) => ({
        id: r.id,
        status: r.status,
        headcount: r.headcount,
        acceptedCount: r.accepted_count,
        pendingApplications: r.pending?.aggregate?.count ?? 0,
        slotKeys: (r.slots ?? []).map((s) => s.slot_key),
        terms: r.terms,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
        closedAt: r.closed_at,
        location: {
          id: r.business_location?.id ?? r.business_location_id,
          name: r.business_location?.name ?? '',
          businessId: r.business_location?.business_id ?? '',
          businessName: r.business_location?.business?.name ?? '',
          city: r.business_location?.address?.city ?? '',
          state: r.business_location?.address?.state ?? '',
          country: r.business_location?.address?.country ?? '',
        },
      }));
    return { postings, truncated };
  }

  /** AC-S3 Close by a super user (e.g. terms that break policy); same path as the business close. */
  async closePosting(scope: GeoScope, actorUserId: string, postingId: string, reason?: unknown) {
    const res = await this.hasura.executeQuery<{
      dedicated_agent_postings_by_pk: { id: string; business_location_id: string; business_location: { business_id: string } | null } | null;
    }>(DEDICATED_ADMIN_POSTING_SCOPE_QUERY, { id: postingId });
    const row = res?.dedicated_agent_postings_by_pk;
    if (!row?.business_location) throw new NotFoundException('Posting not found');
    await this.geo.assertBusiness(scope, row.business_location.business_id);
    return this.postings.close({ userId: actorUserId, locationId: row.business_location_id }, row.id, reason);
  }

  /** AC-S4: locations with dedicated setup in scope; covered vs uncovered enabled slots; order share over 30 days. */
  async coverage(scope: GeoScope, filters: { city?: string }, now = new Date()) {
    const geoAddress = await this.geo.addressWhere(scope);
    const where = and([
      geoAddress ? { address: geoAddress } : null,
      { _or: [{ dedicated_agent_assignments: {} }, { dedicated_agent_postings: {} }, { pickup_slots: {} }] },
    ]);
    const since = new Date(now.getTime() - COVERAGE_SHARE_DAYS * 86_400_000).toISOString();
    const { rows, truncated } = await this.pages<CoverageRow>(DEDICATED_ADMIN_COVERAGE_QUERY, where, 'business_locations', { since });
    const visible = await this.enabledOnly(rows, (r) => r.address?.country);
    const city = normalizeCity(filters.city);
    const locations: CoverageLocationView[] = visible
      .filter((r) => !city || normalizeCity(r.address?.city) === city)
      .map((r) => ({
        locationId: r.id,
        name: r.name ?? '',
        businessId: r.business_id,
        city: r.address?.city ?? '',
        ...slotCoverage(r.pickup_slots ?? [], (r.dedicated_agent_assignments ?? []).map((a) => a.slot_key)),
        orders: deliveryShare(r.dedicatedOrders?.aggregate?.count, r.assignedOrders?.aggregate?.count),
      }));
    const totals = locations.reduce(
      (t, l) => ({
        enabledSlots: t.enabledSlots + l.enabledSlots.length,
        coveredSlots: t.coveredSlots + l.coveredSlots.length,
        uncoveredSlots: t.uncoveredSlots + l.uncoveredSlots.length,
        dedicatedOrders: t.dedicatedOrders + l.orders.dedicated,
        standardOrders: t.standardOrders + l.orders.standard,
      }),
      { enabledSlots: 0, coveredSlots: 0, uncoveredSlots: 0, dedicatedOrders: 0, standardOrders: 0 }
    );
    const delivered = totals.dedicatedOrders + totals.standardOrders;
    return {
      sinceDays: COVERAGE_SHARE_DAYS,
      totals: { ...totals, dedicatedShare: delivered > 0 ? Math.round((totals.dedicatedOrders / delivered) * 1000) / 1000 : null },
      locations,
      truncated,
    };
  }

  /** AC-S2 picker: verified (and, under the contract flag, contracted) internal agents and independents in the store's country and the caller's scope. */
  async picker(scope: GeoScope, locationId: string, now = new Date()) {
    const businessId = await this.assignments.locationBusinessId(locationId);
    await this.geo.assertBusiness(scope, businessId);
    const country = await this.locationCountry(locationId);
    await this.requireEnabled(country);
    const geoAddress = await this.geo.addressWhere(scope);
    const where = and([
      // QA #619 N4: only agents the assign accepts and coverage can use: verified
      // (internal too) and, while the contract flag is on, with a signed contract.
      { is_verified: { _eq: true } },
      (await this.contractGate.isRequired()) ? { agent_contracts: { status: { _eq: 'signed' } } } : null,
      { _not: { status: { _eq: 'suspended' } } },
      { agent_addresses: { address: { country: { _ilike: country } } } },
      geoAddress ? { agent_addresses: { address: geoAddress } } : null,
    ]);
    const res = await this.hasura.executeQuery<{ agents: PickerAgentRow[] }>(DEDICATED_PICKER_AGENTS_QUERY, {
      where,
      limit: PICKER_AGENT_LIMIT,
    });
    const fetched = res?.agents ?? [];
    const truncated = fetched.length >= PICKER_AGENT_LIMIT;
    if (truncated) this.logger.warn(`dedicated.picker_truncated location=${locationId} limit=${PICKER_AGENT_LIMIT}`);
    const rows = fetched.filter((a) => showsDeliveryChrome(a.focus));
    const stats = await this.assignments.pickerStats(
      locationId,
      country,
      rows.map((a) => ({ id: a.id, userId: a.user_id, isInternal: a.is_internal === true })),
      now
    );
    return {
      agents: rows.map((a) => ({
        id: a.id,
        firstName: a.user?.first_name ?? '',
        lastName: a.user?.last_name ?? '',
        photoUrl: a.user?.profile_picture_url ?? null,
        isInternal: a.is_internal === true,
        chip: a.is_internal === true ? ('internal' as const) : ('verified_independent' as const),
        assignmentCount: a.live?.aggregate?.count ?? 0,
        ...(stats.get(a.id) ?? { activeOrders: 0, outstandingDedicatedOffers: 0, balanceCoversOrders: null }),
      })),
      truncated,
    };
  }

  // ------------------------------------------------------------------ internals

  private assignmentView(r: AssignmentListRow): AdminAssignmentView {
    const loc = r.business_location;
    const agent = r.agent;
    const badge = relationBadge({
      agentId: r.agent_id,
      isInternal: agent?.is_internal === true,
      agentPhones: [agent?.user?.phone_number, agent?.mobile_payment_phone?.phone_e164],
      businessId: loc?.business_id ?? '',
      businessPhones: [
        loc?.business?.user?.phone_number,
        loc?.phone,
        loc?.order_alert_phone,
        loc?.mobile_payment_phone?.phone_e164,
        ...(loc?.location_delegations ?? []).map((d) => d.user?.phone_number),
      ],
      businessReferredByAgentId: loc?.business?.referred_by_agent_id,
      agentReferredByBusinessId: agent?.referred_by_business_id,
      dismissedAt: r.relation_dismissed_at,
    });
    return {
      assignmentId: r.id,
      slotKey: r.slot_key,
      status: r.status,
      source: r.source,
      createdAt: r.created_at,
      location: {
        id: loc?.id ?? r.business_location_id,
        name: loc?.name ?? '',
        businessId: loc?.business_id ?? '',
        businessName: loc?.business?.name ?? '',
        city: loc?.address?.city ?? '',
        state: loc?.address?.state ?? '',
        country: loc?.address?.country ?? '',
      },
      agent: {
        id: r.agent_id,
        firstName: agent?.user?.first_name ?? '',
        lastName: agent?.user?.last_name ?? '',
        photoUrl: agent?.user?.profile_picture_url ?? null,
        isInternal: agent?.is_internal === true,
      },
      ...badge,
    };
  }

  /**
   * #594 G10: admin location search by store / business name or city, limited to
   * the caller's geo scope and to countries with the flag on (filtered, never 404).
   * `enabledSlotKeys` lets the assign step skip disabled slots (G11 light).
   */
  async searchLocations(scope: GeoScope, filters: { q?: string; city?: string; limit?: string | number }) {
    const q = String(filters.q ?? '').trim();
    if (q.length < LOCATION_SEARCH_MIN_QUERY) {
      throw new BadRequestException({ code: 'query_too_short', message: `q must be at least ${LOCATION_SEARCH_MIN_QUERY} characters` });
    }
    const rawLimit = Number(filters.limit);
    const limit =
      Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, LOCATION_SEARCH_MAX_LIMIT) : LOCATION_SEARCH_DEFAULT_LIMIT;
    const geoAddress = await this.geo.addressWhere(scope);
    const pattern = ilikeContains(q);
    const where = and([
      { is_active: { _eq: true } },
      geoAddress ? { address: geoAddress } : null,
      { _or: [{ name: { _ilike: pattern } }, { business: { name: { _ilike: pattern } } }, { address: { city: { _ilike: pattern } } }] },
    ]);
    const res = await this.hasura.executeQuery<{ business_locations: LocationSearchRow[] }>(DEDICATED_ADMIN_LOCATION_SEARCH_QUERY, {
      where,
      limit: LOCATION_SEARCH_FETCH_LIMIT,
    });
    const fetched = res?.business_locations ?? [];
    const city = normalizeCity(filters.city);
    const visible = (await this.enabledOnly(fetched, (r) => r.address?.country)).filter(
      (r) => !city || normalizeCity(r.address?.city) === city
    );
    const locations: AdminLocationSearchItem[] = visible.slice(0, limit).map((r) => ({
      id: r.id,
      name: r.name ?? '',
      businessId: r.business_id,
      businessName: r.business?.name ?? '',
      address: {
        line1: r.address?.address_line_1 ?? null,
        city: r.address?.city ?? null,
        state: r.address?.state ?? null,
        country: r.address?.country?.trim().toUpperCase() ?? null,
      },
      enabledSlotKeys: slotCoverage(r.pickup_slots ?? [], []).enabledSlots,
      liveAgents: (r.dedicated_agent_assignments ?? []).length,
    }));
    return { locations, truncated: visible.length > limit || fetched.length >= LOCATION_SEARCH_FETCH_LIMIT };
  }

  /** #594 G11: read-only pickup slots of a location in the caller's scope (owner payload reused); 404 out of scope / flag off. */
  async locationPickupSlots(scope: GeoScope, locationId: string) {
    const businessId = await this.assignments.locationBusinessId(locationId);
    await this.geo.assertBusiness(scope, businessId);
    return this.assignments.getPickupSlots(locationId);
  }

  private async pages<T>(query: string, where: BoolExp, root: string, extra: Record<string, unknown> = {}) {
    const rows: T[] = [];
    for (let page = 0; page < ADMIN_VIEW_MAX_PAGES; page++) {
      const res = await this.hasura.executeQuery<Record<string, T[]>>(query, {
        where,
        limit: ADMIN_VIEW_LIMIT,
        offset: page * ADMIN_VIEW_LIMIT,
        ...extra,
      });
      const batch = res?.[root] ?? [];
      rows.push(...batch);
      if (batch.length < ADMIN_VIEW_LIMIT) return { rows, truncated: false };
    }
    return { rows, truncated: true };
  }

  /** Drops rows of countries where the flag is off (memoised per country). */
  private async enabledOnly<T>(rows: T[], countryOf: (row: T) => string | null | undefined): Promise<T[]> {
    const memo = new Map<string, Promise<boolean>>();
    const on = (raw: string | null | undefined) => {
      const c = raw?.trim().toUpperCase();
      if (!c) return Promise.resolve(false);
      if (!memo.has(c)) memo.set(c, this.config.isEnabled(c));
      return memo.get(c) as Promise<boolean>;
    };
    const flags = await Promise.all(rows.map((r) => on(countryOf(r))));
    return rows.filter((_, i) => flags[i]);
  }

  private async requireEnabled(raw: string | null | undefined): Promise<void> {
    const c = raw?.trim().toUpperCase();
    if (!c || !(await this.config.isEnabled(c))) throw new NotFoundException('Not found');
  }

  private async locationCountry(locationId: string): Promise<string> {
    const res = await this.hasura.executeQuery<{ business_locations_by_pk: { address: { country: string | null } | null } | null }>(
      `query DedicatedPickerLocation($id: uuid!) { business_locations_by_pk(id: $id) { address { country } } }`,
      { id: locationId }
    );
    const country = res?.business_locations_by_pk?.address?.country?.trim().toUpperCase();
    if (!country) throw new NotFoundException('Not found');
    return country;
  }
}

interface LocationSearchRow {
  id: string;
  name: string | null;
  business_id: string;
  business: { name: string | null } | null;
  address: { address_line_1: string | null; city: string | null; state: string | null; country: string | null } | null;
  pickup_slots: Array<{ slot_key: string; is_enabled: boolean }> | null;
  dedicated_agent_assignments: Array<{ id: string }> | null;
}

interface AssignmentListRow {
  id: string;
  business_location_id: string;
  agent_id: string;
  slot_key: string;
  status: string;
  source: string;
  off_today_date: string | null;
  created_at: string;
  relation_dismissed_at: string | null;
  agent: {
    id: string;
    is_internal: boolean | null;
    is_verified: boolean | null;
    referred_by_business_id: string | null;
    mobile_payment_phone: { phone_e164: string | null } | null;
    user: { first_name: string | null; last_name: string | null; phone_number: string | null; profile_picture_url: string | null } | null;
  } | null;
  business_location: {
    id: string;
    name: string | null;
    phone: string | null;
    order_alert_phone: string | null;
    business_id: string;
    mobile_payment_phone: { phone_e164: string | null } | null;
    address: { city: string | null; state: string | null; country: string | null } | null;
    business: { id: string; name: string | null; referred_by_agent_id: string | null; user: { phone_number: string | null } | null } | null;
    location_delegations: Array<{ user: { phone_number: string | null } | null }> | null;
  } | null;
}

interface PostingListRow {
  id: string;
  business_location_id: string;
  headcount: number;
  accepted_count: number;
  status: string;
  expires_at: string;
  created_at: string;
  closed_at: string | null;
  terms: string | null;
  slots: Array<{ slot_key: string }> | null;
  pending: { aggregate: { count: number } | null } | null;
  business_location: {
    id: string;
    name: string | null;
    business_id: string;
    address: { city: string | null; state: string | null; country: string | null } | null;
    business: { name: string | null } | null;
  } | null;
}

interface CoverageRow {
  id: string;
  name: string | null;
  business_id: string;
  address: { city: string | null; state: string | null; country: string | null } | null;
  pickup_slots: Array<{ slot_key: string; is_enabled: boolean }> | null;
  dedicated_agent_assignments: Array<{ slot_key: string; agent_id: string }> | null;
  dedicatedOrders: { aggregate: { count: number } | null } | null;
  assignedOrders: { aggregate: { count: number } | null } | null;
}

interface PickerAgentRow {
  id: string;
  user_id: string | null;
  is_internal: boolean | null;
  is_verified: boolean | null;
  focus: string | null;
  user: { first_name: string | null; last_name: string | null; profile_picture_url: string | null } | null;
  live: { aggregate: { count: number } | null } | null;
}
