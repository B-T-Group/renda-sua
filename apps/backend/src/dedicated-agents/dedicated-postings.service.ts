import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { emitServerSiteEvent } from '../site-events/server-site-events.helper';
import { SiteEventsService } from '../site-events/site-events.service';
import { randomUUID } from 'crypto';
import { haversineMeters } from '../common/geo.utils';
import { DELEGATION_PERMISSIONS } from '../delegations/delegation.constants';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  buildDedicatedPostingAgentMessage,
  buildDedicatedPostingApplicationMessage,
  type DedicatedPostingAgentEvent,
} from '../notifications/dedicated-posting-push.messages';
import { NotificationsService } from '../notifications/notifications.service';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import {
  DEDICATED_AGENT_OPPORTUNITY_PATH,
  DEDICATED_BUSINESS_POSTING_PATH,
  DEDICATED_SLOT_KEYS,
  type DedicatedAgentsConfig,
  type DedicatedSlotKey,
} from './dedicated-agents.constants';
import { runAssignmentWrite } from './dedicated-assignment-write.util';
import { DEDICATED_LOCATION_PICKUP_SLOTS_QUERY, DEDICATED_NOTICE_DELEGATES_QUERY } from './dedicated-assignments.queries';
import { pickAgentAddress, type AgentAddressRow } from './dedicated-posting-city.util';
import { POSTING_TERMS_MAX, sanitizePostingTerms } from './dedicated-posting-terms.util';
import {
  ACCEPT_DEDICATED_APPLICATION_MUTATION,
  CLOSE_DEDICATED_POSTING_MUTATION,
  DECLINE_DEDICATED_APPLICATION_MUTATION,
  DEDICATED_AGENTS_CONTACT_QUERY,
  DEDICATED_APPLICANT_STATS_QUERY,
  DEDICATED_APPLICATION_ASSIGNMENTS_QUERY,
  DEDICATED_APPLICATION_BY_ID_QUERY,
  DEDICATED_EXPIRED_POSTINGS_QUERY,
  DEDICATED_LOCATION_POSTINGS_QUERY,
  DEDICATED_OPEN_POSTING_FOR_SLOTS_QUERY,
  DEDICATED_POSTING_APPLICATIONS_QUERY,
  DEDICATED_POSTING_BY_ID_QUERY,
  DEDICATED_POSTING_LOCATION_QUERY,
  DEDICATED_POSTING_PENDING_AGENTS_QUERY,
  EXPIRE_DEDICATED_POSTINGS_MUTATION,
  INSERT_DEDICATED_POSTING_MUTATION,
  UPDATE_DEDICATED_POSTING_TERMS_MUTATION,
} from './dedicated-postings.queries';

const DONE_STATUSES = ['delivered', 'complete'];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const CLOSED_REASON_MAX = 500;
const LIST_LIMIT = 20;
export const POSTING_EXPIRY_BATCH = 50;

/** Error codes of the posting endpoints (409 unless noted). */
export const DEDICATED_POSTING_ERRORS = {
  invalidHeadcount: 'invalid_headcount', // 400
  invalidSlots: 'invalid_slot_keys', // 400
  invalidDays: 'invalid_days_of_week', // 400
  termsTooLong: 'terms_too_long', // 400
  slotDisabled: 'slot_disabled',
  alreadyOpen: 'posting_already_open',
  notOpen: 'posting_not_open',
  filled: 'posting_filled',
  expired: 'posting_expired',
  applicationNotPending: 'application_not_pending',
  holdsSlot: 'agent_holds_slot',
  /** QA #613 N3: the applicant is no longer verified, is suspended, or has no signed contract. */
  agentIneligible: 'agent_ineligible',
} as const;

/**
 * QA #613 N2/N3: the accept function refuses (nothing written) when a posting slot
 * was switched off or the applicant is no longer eligible; mapped to 409.
 */
export function acceptCheckRefusal(error: unknown): ConflictException | null {
  const e = error as { message?: unknown; response?: { errors?: unknown } } | null;
  let text = typeof e?.message === 'string' ? e.message : '';
  try {
    if (e?.response?.errors) text += ` ${JSON.stringify(e.response.errors)}`;
  } catch {
    // ignore
  }
  if (text.includes('dedicated_accept_slot_disabled')) {
    return new ConflictException({
      code: DEDICATED_POSTING_ERRORS.slotDisabled,
      message: 'The store has turned off one of this posting\'s slots',
    });
  }
  const m = /dedicated_accept_agent_ineligible: (not_verified|suspended|contract_unsigned)/.exec(text);
  if (m) {
    return new ConflictException({
      code: DEDICATED_POSTING_ERRORS.agentIneligible,
      reason: m[1],
      message: 'This agent can no longer be accepted; choose another applicant',
    });
  }
  return null;
}

export interface PostingRow {
  id: string;
  business_location_id: string;
  headcount: number;
  accepted_count: number;
  days_of_week: number[];
  terms: string | null;
  terms_updated_at: string | null;
  status: 'open' | 'filled' | 'closed' | 'expired';
  expires_at: string;
  filled_at: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  created_at: string;
  slots: Array<{ slot_key: DedicatedSlotKey }>;
  pending?: { aggregate: { count: number } } | null;
  business_location?: PostingLocation | null;
}

export interface PostingLocation {
  id: string;
  name: string | null;
  business_id: string;
  business: { name: string | null; user_id: string | null; user: { preferred_language: string | null } | null } | null;
  address: {
    address_line_1: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
  } | null;
}

export interface DedicatedPostingView {
  id: string;
  locationId: string;
  status: PostingRow['status'];
  headcount: number;
  acceptedCount: number;
  slotKeys: DedicatedSlotKey[];
  daysOfWeek: number[];
  terms: string | null;
  termsUpdatedAt: string | null;
  expiresAt: string;
  filledAt: string | null;
  closedAt: string | null;
  createdAt: string;
  pendingApplications?: number;
}

export interface ApplicantCard {
  applicationId: string;
  status: 'applied' | 'accepted';
  appliedAt: string;
  agent: {
    id: string;
    firstName: string;
    photoUrl: string | null;
    joinedAt: string | null;
    isInternal: boolean;
  };
  deliveriesCompleted: number;
  /** Agent-fault failed deliveries plus pickups reassigned away from the agent (no-shows). */
  missedDeliveries: number;
  /** completed / (completed + reassigned) pickups, 0-100; null with no pickups yet. */
  onTimePickupPct: number | null;
  distanceKm: number | null;
  /** Only for accepted applicants (AC-B15); never for pending ones (AC-B14). */
  phone?: string | null;
}

interface ApplicationAgentRow {
  id: string;
  posting_id: string;
  agent_id: string;
  status: 'applied' | 'accepted';
  created_at: string;
  agent: {
    id: string;
    user_id: string | null;
    created_at: string | null;
    is_internal: boolean | null;
    pickups_completed_count: number | null;
    pickups_reassigned_count: number | null;
    user: { first_name: string | null; profile_picture_url: string | null; preferred_language: string | null } | null;
    agent_addresses: AgentAddressRow[];
  } | null;
}

/** The posting's slots in day order (morning, afternoon, evening), whatever order the rows came in. */
export function slotKeysOf(row: Pick<PostingRow, 'slots'>): DedicatedSlotKey[] {
  const keys = new Set((row.slots ?? []).map((s) => s.slot_key));
  return DEDICATED_SLOT_KEYS.filter((k) => keys.has(k));
}

export function postingView(row: PostingRow): DedicatedPostingView {
  return {
    id: row.id,
    locationId: row.business_location_id,
    status: row.status,
    headcount: row.headcount,
    acceptedCount: row.accepted_count,
    slotKeys: slotKeysOf(row),
    daysOfWeek: row.days_of_week,
    terms: row.terms,
    termsUpdatedAt: row.terms_updated_at,
    expiresAt: row.expires_at,
    filledAt: row.filled_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    ...(row.pending ? { pendingApplications: row.pending.aggregate?.count ?? 0 } : {}),
  };
}

export function distanceKm(
  a: { latitude?: number | string | null; longitude?: number | string | null } | null | undefined,
  b: { latitude?: number | string | null; longitude?: number | string | null } | null | undefined
): number | null {
  const nums = [a?.latitude, a?.longitude, b?.latitude, b?.longitude].map((v) => (v == null || v === '' ? NaN : Number(v)));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return Math.round(haversineMeters(nums[0], nums[1], nums[2], nums[3]) / 100) / 10;
}

function parseHeadcount(raw: unknown): number {
  const n = raw === undefined ? 1 : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    throw new BadRequestException({ code: DEDICATED_POSTING_ERRORS.invalidHeadcount, message: 'headcount must be 1 to 10' });
  }
  return n;
}

function parseSlotKeys(raw: unknown): DedicatedSlotKey[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new BadRequestException({ code: DEDICATED_POSTING_ERRORS.invalidSlots, message: 'slotKeys must be a non-empty list' });
  }
  const keys = [...new Set(raw.map((k) => String(k ?? '').trim().toLowerCase()))];
  if (!keys.every((k) => (DEDICATED_SLOT_KEYS as readonly string[]).includes(k))) {
    throw new BadRequestException({
      code: DEDICATED_POSTING_ERRORS.invalidSlots,
      message: `slotKeys must be among ${DEDICATED_SLOT_KEYS.join(', ')}`,
    });
  }
  return (DEDICATED_SLOT_KEYS as readonly string[]).filter((k) => keys.includes(k)) as DedicatedSlotKey[];
}

function parseDays(raw: unknown): number[] {
  if (raw === undefined || raw === null) return [...ALL_DAYS];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new BadRequestException({ code: DEDICATED_POSTING_ERRORS.invalidDays, message: 'daysOfWeek must be a non-empty list' });
  }
  const days = [...new Set(raw.map((d) => Number(d)))];
  if (!days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) {
    throw new BadRequestException({
      code: DEDICATED_POSTING_ERRORS.invalidDays,
      message: 'daysOfWeek must be ISO days 1 (Monday) to 7 (Sunday)',
    });
  }
  return days.sort((a, b) => a - b);
}

function parseTerms(raw: unknown): string | null {
  const terms = sanitizePostingTerms(raw);
  if (terms && terms.length > POSTING_TERMS_MAX) {
    throw new BadRequestException({
      code: DEDICATED_POSTING_ERRORS.termsTooLong,
      message: `Terms must be at most ${POSTING_TERMS_MAX} characters`,
    });
  }
  return terms;
}

function isOpenSlotConflict(error: unknown): boolean {
  const e = error as { message?: unknown; response?: { errors?: unknown } } | null;
  let text = typeof e?.message === 'string' ? e.message : '';
  try {
    if (e?.response?.errors) text += JSON.stringify(e.response.errors);
  } catch {
    // ignore
  }
  return text.includes('dedicated_agent_posting_slots_one_open_idx');
}

/**
 * #594 PR 7 business side of postings (AC-B11..B16, E8). Writes are Nest-only;
 * every endpoint is behind `dedicated_agents_enabled` for the location's country
 * (off -> 404). Accept goes through the locked SQL function
 * `dedicated_accept_application` (one transaction: count check, assignments,
 * auto-decline) via `runAssignmentWrite` (cap / duplicate -> 409, 40P01 retry).
 */
@Injectable()
export class DedicatedPostingsService {
  private readonly logger = new Logger(DedicatedPostingsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly configService: DedicatedAgentsConfigService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly siteEventsService?: SiteEventsService
  ) {}

  /** AC section 5 event, fire-and-forget. */
  track(event: Parameters<typeof emitServerSiteEvent>[1], metadata: Record<string, unknown>): void {
    emitServerSiteEvent(this.siteEventsService, event, metadata);
  }

  async create(
    actor: { userId: string; locationId: string },
    input: { headcount?: unknown; slotKeys?: unknown; daysOfWeek?: unknown; terms?: unknown },
    now = new Date()
  ): Promise<{ posting: DedicatedPostingView }> {
    const headcount = parseHeadcount(input?.headcount);
    const slotKeys = parseSlotKeys(input?.slotKeys);
    const days = parseDays(input?.daysOfWeek);
    const terms = parseTerms(input?.terms);
    const location = await this.loadLocation(actor.locationId);
    const { config } = await this.requireEnabled(location.address?.country);

    const disabled = await this.disabledSlots(location.id);
    const off = slotKeys.filter((k) => disabled.has(k));
    if (off.length > 0) {
      throw new ConflictException({ code: DEDICATED_POSTING_ERRORS.slotDisabled, message: `The store has turned off: ${off.join(', ')}` });
    }
    await this.assertNoOpenPosting(location.id, slotKeys);

    const id = randomUUID();
    const expiresAt = new Date(now.getTime() + config.postingExpiryDays * 86_400_000).toISOString();
    try {
      await this.hasuraSystemService.executeMutation(INSERT_DEDICATED_POSTING_MUTATION, {
        posting: {
          id,
          business_location_id: location.id,
          headcount,
          days_of_week: days,
          terms,
          expires_at: expiresAt,
          created_by_user_id: actor.userId,
        },
        slots: slotKeys.map((slot_key) => ({ posting_id: id, business_location_id: location.id, slot_key })),
      });
    } catch (error) {
      // A concurrent create won the open-slot unique index (AC-B12).
      if (isOpenSlotConflict(error)) await this.assertNoOpenPosting(location.id, slotKeys);
      throw error;
    }
    this.logger.log(
      JSON.stringify({ event: 'dedicated.posting_created', postingId: id, locationId: location.id, headcount, slotKeys, expiresAt })
    );
    this.track('dedicated.posting_created', { postingId: id, businessLocationId: location.id, headcount, slotKeys, expiresAt });
    return { posting: postingView(await this.loadPosting(id)) };
  }

  async list(locationId: string): Promise<{ postings: DedicatedPostingView[] }> {
    const location = await this.loadLocation(locationId);
    await this.requireEnabled(location.address?.country);
    const res = await this.hasuraSystemService.executeQuery<{ dedicated_agent_postings: PostingRow[] }>(
      DEDICATED_LOCATION_POSTINGS_QUERY,
      { locationId, limit: LIST_LIMIT }
    );
    return { postings: (res?.dedicated_agent_postings ?? []).map(postingView) };
  }

  /** AC-A1c: new terms set terms_updated_at and push "{{store}} updated its terms" to pending applicants. */
  async updateTerms(
    actor: { userId: string; locationId: string },
    postingId: string,
    rawTerms: unknown,
    now = new Date()
  ): Promise<{ posting: DedicatedPostingView }> {
    const posting = await this.loadScopedPosting(actor.locationId, postingId);
    await this.requireEnabled(posting.business_location?.address?.country);
    if (posting.status !== 'open') this.throwNotOpen(posting);
    const terms = parseTerms(rawTerms);
    if ((terms ?? null) === (posting.terms ?? null)) return { posting: postingView(posting) };
    const res = await this.hasuraSystemService.executeMutation<{
      update_dedicated_agent_postings: { affected_rows: number };
    }>(UPDATE_DEDICATED_POSTING_TERMS_MUTATION, { id: posting.id, terms, at: now.toISOString() });
    if (!res?.update_dedicated_agent_postings?.affected_rows) this.throwNotOpen(await this.loadPosting(posting.id));

    const pending = await this.hasuraSystemService.executeQuery<{
      dedicated_agent_applications: Array<{ agent: { user_id: string | null; user: { preferred_language: string | null } | null } | null }>;
    }>(DEDICATED_POSTING_PENDING_AGENTS_QUERY, { postingId: posting.id });
    for (const app of pending?.dedicated_agent_applications ?? []) {
      await this.notifyAgent('terms_updated', posting, app.agent?.user_id ?? null, app.agent?.user?.preferred_language);
    }
    return { posting: postingView(await this.loadPosting(posting.id)) };
  }

  /** AC-B13: close at any time; pending applicants are auto-declined in the same transaction. */
  async close(
    actor: { userId: string; locationId: string },
    postingId: string,
    reason?: unknown,
    now = new Date()
  ): Promise<{ posting: DedicatedPostingView; autoDeclined: number }> {
    const posting = await this.loadScopedPosting(actor.locationId, postingId);
    await this.requireEnabled(posting.business_location?.address?.country);
    if (posting.status !== 'open') this.throwNotOpen(posting);
    const trimmed = typeof reason === 'string' ? reason.trim().slice(0, CLOSED_REASON_MAX) : '';
    const res = await this.hasuraSystemService.executeMutation<{
      update_dedicated_agent_postings: { affected_rows: number };
      update_dedicated_agent_applications: { returning: Array<{ id: string; agent_id: string }> };
    }>(CLOSE_DEDICATED_POSTING_MUTATION, { id: posting.id, by: actor.userId, at: now.toISOString(), reason: trimmed || null });
    if (!res?.update_dedicated_agent_postings?.affected_rows) this.throwNotOpen(await this.loadPosting(posting.id));
    const declined = res.update_dedicated_agent_applications?.returning ?? [];
    await this.notifyAgentIds('closed', posting, declined.map((d) => d.agent_id));
    this.logger.log(
      JSON.stringify({ event: 'dedicated.posting_closed', postingId: posting.id, by: actor.userId, autoDeclined: declined.length })
    );
    if (declined.length > 0) {
      this.track('dedicated.application_auto_declined', { postingId: posting.id, count: declined.length, cause: 'closed' });
    }
    return { posting: postingView(await this.loadPosting(posting.id)), autoDeclined: declined.length };
  }

  /** AC-B14 applicant cards (pending + accepted). No phone for pending applicants. */
  async applications(locationId: string, postingId: string): Promise<{ posting: DedicatedPostingView; applications: ApplicantCard[] }> {
    const posting = await this.loadScopedPosting(locationId, postingId);
    await this.requireEnabled(posting.business_location?.address?.country);
    const res = await this.hasuraSystemService.executeQuery<{ dedicated_agent_applications: ApplicationAgentRow[] }>(
      DEDICATED_POSTING_APPLICATIONS_QUERY,
      { postingId: posting.id }
    );
    const rows = res?.dedicated_agent_applications ?? [];
    const stats = await this.applicantStats([...new Set(rows.map((r) => r.agent_id))]);
    const phones = await this.acceptedPhones(rows.filter((r) => r.status === 'accepted').map((r) => r.id));
    const store = posting.business_location?.address;
    return {
      posting: postingView(posting),
      applications: rows.map((row): ApplicantCard => {
        const completed = Number(row.agent?.pickups_completed_count ?? 0);
        const reassigned = Number(row.agent?.pickups_reassigned_count ?? 0);
        const card: ApplicantCard = {
          applicationId: row.id,
          status: row.status,
          appliedAt: row.created_at,
          agent: {
            id: row.agent_id,
            firstName: row.agent?.user?.first_name ?? '',
            photoUrl: row.agent?.user?.profile_picture_url ?? null,
            joinedAt: row.agent?.created_at ?? null,
            isInternal: row.agent?.is_internal === true,
          },
          deliveriesCompleted: stats.delivered.get(row.agent_id) ?? 0,
          missedDeliveries: (stats.faults.get(row.agent_id) ?? 0) + reassigned,
          onTimePickupPct: completed + reassigned > 0 ? Math.round((100 * completed) / (completed + reassigned)) : null,
          distanceKm: distanceKm(pickAgentAddress(row.agent?.agent_addresses), store),
        };
        if (row.status === 'accepted') card.phone = phones.get(row.id) ?? null;
        return card;
      }),
    };
  }

  /**
   * AC-B15 / E8: accept through the locked function. On success: the
   * assignments, the posting counts and the agent's phone; the agent is told
   * and every applicant auto-declined by this accept gets "This spot was filled".
   */
  async accept(actor: { userId: string; locationId: string }, postingId: string, applicationId: string) {
    const posting = await this.loadScopedPosting(actor.locationId, postingId);
    await this.requireEnabled(posting.business_location?.address?.country);
    const application = await this.loadApplication(applicationId);
    if (application.posting_id !== posting.id) throw new NotFoundException('Application not found');

    const res = await runAssignmentWrite(() =>
      this.hasuraSystemService.executeMutation<{
        dedicated_accept_application: Array<{ id: string; agent_id: string; status: string }>;
      }>(ACCEPT_DEDICATED_APPLICATION_MUTATION, { applicationId, actorUserId: actor.userId })
    ).catch((error: unknown) => {
      throw acceptCheckRefusal(error) ?? error;
    });
    const rows = res?.dedicated_accept_application ?? [];
    const mine = rows.find((r) => r.id === applicationId);
    if (mine?.status !== 'accepted') {
      throw await this.acceptRefusal(posting.id, applicationId);
    }
    const autoDeclined = rows.filter((r) => r.id !== applicationId && r.status === 'auto_declined');
    const after = await this.loadPosting(posting.id);
    const assignments = await this.hasuraSystemService.executeQuery<{
      dedicated_agent_assignments: Array<{ id: string; slot_key: string; status: string; source: string }>;
    }>(DEDICATED_APPLICATION_ASSIGNMENTS_QUERY, { applicationId });

    await this.notifyAgent('accepted', after, application.agent?.user_id ?? null, application.agent?.user?.preferred_language);
    await this.notifyAgentIds('filled', after, autoDeclined.map((r) => r.agent_id));
    this.logger.log(
      JSON.stringify({
        event: 'dedicated.posting_accepted',
        postingId: posting.id,
        applicationId,
        agentId: application.agent_id,
        by: actor.userId,
        acceptedCount: after.accepted_count,
        headcount: after.headcount,
        filled: after.status === 'filled',
        autoDeclined: autoDeclined.length,
      })
    );
    const created = assignments?.dedicated_agent_assignments ?? [];
    this.track('dedicated.application_accepted', { postingId: posting.id, applicationId, agentId: application.agent_id });
    for (const a of created) {
      this.track('dedicated.assignment_status_changed', {
        assignmentId: a.id,
        agentId: application.agent_id,
        businessLocationId: posting.business_location_id,
        slotKey: a.slot_key,
        source: 'posting',
        from: null,
        to: 'active',
        cause: 'posting_accept',
      });
    }
    if (after.status === 'filled') {
      this.track('dedicated.posting_filled', { postingId: posting.id, headcount: after.headcount, acceptedCount: after.accepted_count });
    }
    if (autoDeclined.length > 0) {
      this.track('dedicated.application_auto_declined', { postingId: posting.id, count: autoDeclined.length, cause: 'filled' });
    }
    return {
      application: { id: applicationId, status: 'accepted' as const },
      assignments: assignments?.dedicated_agent_assignments ?? [],
      posting: postingView(after),
      autoDeclined: autoDeclined.length,
      agent: { id: application.agent_id, firstName: application.agent?.user?.first_name ?? '', phone: application.agent?.user?.phone_number ?? null },
    };
  }

  async decline(actor: { userId: string; locationId: string }, postingId: string, applicationId: string, now = new Date()) {
    const posting = await this.loadScopedPosting(actor.locationId, postingId);
    await this.requireEnabled(posting.business_location?.address?.country);
    const application = await this.loadApplication(applicationId);
    if (application.posting_id !== posting.id) throw new NotFoundException('Application not found');
    const res = await this.hasuraSystemService.executeMutation<{ update_dedicated_agent_applications: { affected_rows: number } }>(
      DECLINE_DEDICATED_APPLICATION_MUTATION,
      { id: applicationId, by: actor.userId, at: now.toISOString() }
    );
    if (!res?.update_dedicated_agent_applications?.affected_rows) {
      throw new ConflictException({
        code: DEDICATED_POSTING_ERRORS.applicationNotPending,
        message: 'This application is no longer pending',
      });
    }
    return { application: { id: applicationId, status: 'declined' as const } };
  }

  /**
   * AC-B13 14-day expiry: open postings past expires_at become expired and
   * their pending applicants auto-declined (one transaction per batch). Skips
   * countries where the flag is off (stays dark). Called by the sweeper.
   */
  async expireDue(now = new Date()): Promise<{ found: number; expired: number; autoDeclined: number; skipped: number }> {
    const res = await this.hasuraSystemService.executeQuery<{
      dedicated_agent_postings: Array<{ id: string; business_location: { address: { country: string | null } | null } | null }>;
    }>(DEDICATED_EXPIRED_POSTINGS_QUERY, { now: now.toISOString(), limit: POSTING_EXPIRY_BATCH });
    const due = res?.dedicated_agent_postings ?? [];
    const ids: string[] = [];
    for (const p of due) {
      const country = p.business_location?.address?.country?.trim().toUpperCase();
      if (country && (await this.configService.getConfig(country)).enabled) ids.push(p.id);
    }
    const result = { found: due.length, expired: 0, autoDeclined: 0, skipped: due.length - ids.length };
    if (ids.length === 0) return result;
    const out = await this.hasuraSystemService.executeMutation<{
      update_dedicated_agent_postings: { returning: Array<{ id: string }> };
      update_dedicated_agent_applications: { returning: Array<{ id: string; agent_id: string; posting_id: string }> };
    }>(EXPIRE_DEDICATED_POSTINGS_MUTATION, { ids, now: now.toISOString() });
    const expired = out?.update_dedicated_agent_postings?.returning ?? [];
    const declined = out?.update_dedicated_agent_applications?.returning ?? [];
    result.expired = expired.length;
    result.autoDeclined = declined.length;
    for (const p of expired) {
      const agentIds = declined.filter((d) => d.posting_id === p.id).map((d) => d.agent_id);
      this.track('dedicated.posting_expired', { postingId: p.id, autoDeclined: agentIds.length });
      if (agentIds.length > 0) {
        this.track('dedicated.application_auto_declined', { postingId: p.id, count: agentIds.length, cause: 'expired' });
      }
      if (agentIds.length === 0) continue;
      try {
        await this.notifyAgentIds('closed', await this.loadPosting(p.id), agentIds);
      } catch (error) {
        this.logger.warn(`Dedicated posting expiry notice failed for ${p.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return result;
  }

  /** B16: owner + managing delegates of the location, for a new applicant. */
  async notifyBusinessNewApplication(posting: PostingRow, agentFirstName: string): Promise<void> {
    const location = posting.business_location;
    if (!location) return;
    const recipients = new Map<string, string | null>();
    if (location.business?.user_id) recipients.set(location.business.user_id, location.business.user?.preferred_language ?? null);
    try {
      const res = await this.hasuraSystemService.executeQuery<{
        location_delegations: Array<{ user_id: string; user: { preferred_language: string | null } | null }>;
      }>(DEDICATED_NOTICE_DELEGATES_QUERY, {
        locationId: location.id,
        permission: DELEGATION_PERMISSIONS.DEDICATED_AGENTS_MANAGE,
      });
      for (const d of res?.location_delegations ?? []) {
        if (d.user_id && !recipients.has(d.user_id)) recipients.set(d.user_id, d.user?.preferred_language ?? null);
      }
    } catch (error) {
      this.logger.warn(`Dedicated posting delegate lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const slotKeys = slotKeysOf(posting);
    for (const [userId, lang] of recipients) {
      const { title, body } = buildDedicatedPostingApplicationMessage({ agentFirstName, slotKeys, preferredLanguage: lang });
      await this.notifications.sendDedicatedAgentNotice({
        userId,
        title,
        body,
        messageType: 'DEDICATED_POSTING_NEW_APPLICATION',
        postingId: posting.id,
        path: DEDICATED_BUSINESS_POSTING_PATH(location.id, posting.id),
        event: 'dedicated_posting_new_application',
        persona: 'business',
        locationId: location.id,
      });
    }
  }

  // ---------------------------------------------------------------- shared reads

  async loadPosting(id: string): Promise<PostingRow> {
    const res = await this.hasuraSystemService.executeQuery<{ dedicated_agent_postings_by_pk: PostingRow | null }>(
      DEDICATED_POSTING_BY_ID_QUERY,
      { id }
    );
    const row = res?.dedicated_agent_postings_by_pk;
    if (!row) throw new NotFoundException('Posting not found');
    return row;
  }

  async requireEnabled(rawCountry: string | null | undefined): Promise<{ country: string; config: DedicatedAgentsConfig }> {
    const country = rawCountry?.trim().toUpperCase();
    if (!country) throw new NotFoundException('Not found');
    const config = await this.configService.getConfig(country);
    if (!config.enabled) throw new NotFoundException('Not found');
    return { country, config };
  }

  // ---------------------------------------------------------------- internals

  private async loadLocation(locationId: string): Promise<PostingLocation> {
    const res = await this.hasuraSystemService.executeQuery<{ business_locations_by_pk: PostingLocation | null }>(
      DEDICATED_POSTING_LOCATION_QUERY,
      { locationId }
    );
    const row = res?.business_locations_by_pk;
    if (!row) throw new NotFoundException('Location not found');
    return row;
  }

  /** A business caller only sees postings of the location in its path (404 otherwise). */
  private async loadScopedPosting(locationId: string, postingId: string): Promise<PostingRow> {
    const posting = await this.loadPosting(postingId);
    if (posting.business_location_id !== locationId) throw new NotFoundException('Posting not found');
    return posting;
  }

  private async loadApplication(id: string) {
    const res = await this.hasuraSystemService.executeQuery<{
      dedicated_agent_applications_by_pk: {
        id: string;
        posting_id: string;
        agent_id: string;
        status: string;
        agent: {
          id: string;
          user_id: string | null;
          user: { first_name: string | null; phone_number: string | null; preferred_language: string | null } | null;
        } | null;
      } | null;
    }>(DEDICATED_APPLICATION_BY_ID_QUERY, { id });
    const row = res?.dedicated_agent_applications_by_pk;
    if (!row) throw new NotFoundException('Application not found');
    return row;
  }

  private async disabledSlots(locationId: string): Promise<Set<string>> {
    const res = await this.hasuraSystemService.executeQuery<{
      business_location_pickup_slots: Array<{ slot_key: string; is_enabled: boolean }>;
    }>(DEDICATED_LOCATION_PICKUP_SLOTS_QUERY, { locationId });
    return new Set((res?.business_location_pickup_slots ?? []).filter((r) => r.is_enabled === false).map((r) => r.slot_key));
  }

  /** AC-B12: one open posting per location-slot; 409 returns the open one so the app shows it. */
  private async assertNoOpenPosting(locationId: string, slotKeys: string[]): Promise<void> {
    const res = await this.hasuraSystemService.executeQuery<{ dedicated_agent_posting_slots: Array<{ posting_id: string }> }>(
      DEDICATED_OPEN_POSTING_FOR_SLOTS_QUERY,
      { locationId, slotKeys }
    );
    const existing = res?.dedicated_agent_posting_slots?.[0]?.posting_id;
    if (!existing) return;
    throw new ConflictException({
      code: DEDICATED_POSTING_ERRORS.alreadyOpen,
      message: 'This store already has an open posting for that slot',
      posting: postingView(await this.loadPosting(existing)),
    });
  }

  private throwNotOpen(posting: PostingRow): never {
    throw new ConflictException({
      code: posting.status === 'filled' ? DEDICATED_POSTING_ERRORS.filled : DEDICATED_POSTING_ERRORS.notOpen,
      message: 'This posting is no longer open',
      status: posting.status,
    });
  }

  /** Why the function refused (it changed nothing): read the posting and the application back. */
  private async acceptRefusal(postingId: string, applicationId: string): Promise<ConflictException> {
    const [posting, application] = await Promise.all([this.loadPosting(postingId), this.loadApplication(applicationId)]);
    const fail = (code: string, message: string) =>
      new ConflictException({ code, message, postingStatus: posting.status, applicationStatus: application.status });
    if (posting.status === 'filled') return fail(DEDICATED_POSTING_ERRORS.filled, 'All the spots of this posting are filled');
    if (posting.status !== 'open') return fail(DEDICATED_POSTING_ERRORS.notOpen, 'This posting is no longer open');
    if (new Date(posting.expires_at).getTime() <= Date.now()) return fail(DEDICATED_POSTING_ERRORS.expired, 'This posting has expired');
    if (application.status !== 'applied') {
      return fail(DEDICATED_POSTING_ERRORS.applicationNotPending, 'This application is no longer pending');
    }
    return fail(DEDICATED_POSTING_ERRORS.holdsSlot, 'This agent already holds one of these slots at this store');
  }

  private async applicantStats(agentIds: string[]) {
    const delivered = new Map<string, number>();
    const faults = new Map<string, number>();
    if (agentIds.length === 0) return { delivered, faults };
    const res = await this.hasuraSystemService.executeQuery<{
      delivered: Array<{ assigned_agent_id: string }>;
      missed: Array<{ order: { assigned_agent_id: string | null } | null }>;
    }>(DEDICATED_APPLICANT_STATS_QUERY, { agentIds, doneStatuses: DONE_STATUSES });
    for (const o of res?.delivered ?? []) delivered.set(o.assigned_agent_id, (delivered.get(o.assigned_agent_id) ?? 0) + 1);
    for (const f of res?.missed ?? []) {
      const id = f.order?.assigned_agent_id;
      if (id) faults.set(id, (faults.get(id) ?? 0) + 1);
    }
    return { delivered, faults };
  }

  private async acceptedPhones(applicationIds: string[]): Promise<Map<string, string | null>> {
    const phones = new Map<string, string | null>();
    for (const id of applicationIds) {
      const app = await this.loadApplication(id).catch(() => null);
      if (app?.status === 'accepted') phones.set(id, app.agent?.user?.phone_number ?? null);
    }
    return phones;
  }

  private async notifyAgentIds(event: DedicatedPostingAgentEvent, posting: PostingRow, agentIds: string[]): Promise<void> {
    if (agentIds.length === 0) return;
    const res = await this.hasuraSystemService.executeQuery<{
      agents: Array<{ id: string; user_id: string | null; user: { preferred_language: string | null } | null }>;
    }>(DEDICATED_AGENTS_CONTACT_QUERY, { agentIds });
    for (const a of res?.agents ?? []) await this.notifyAgent(event, posting, a.user_id, a.user?.preferred_language);
  }

  private async notifyAgent(
    event: DedicatedPostingAgentEvent,
    posting: PostingRow,
    userId: string | null,
    preferredLanguage?: string | null
  ): Promise<void> {
    if (!userId) return;
    const { title, body } = buildDedicatedPostingAgentMessage({
      event,
      storeName: posting.business_location?.name ?? posting.business_location?.business?.name ?? '',
      slotKeys: slotKeysOf(posting),
      preferredLanguage,
    });
    await this.notifications.sendDedicatedAgentNotice({
      userId,
      title,
      body,
      messageType: `DEDICATED_POSTING_${event.toUpperCase()}`,
      postingId: posting.id,
      path: DEDICATED_AGENT_OPPORTUNITY_PATH(posting.id),
      event: `dedicated_posting_${event}`,
      persona: 'agent',
      locationId: posting.business_location_id,
    });
  }
}
