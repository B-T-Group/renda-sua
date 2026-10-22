import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AgentContractGateService } from '../agent-contracts/agent-contract-gate.service';
import { showsDeliveryChrome } from '../agents/agent-focus.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import { DEDICATED_NOT_FOUND_MESSAGE, isUuidLike } from './dedicated-not-found.util';
import type { DedicatedSlotKey } from './dedicated-agents.constants';
import { DEDICATED_LOCATION_PICKUP_SLOTS_QUERY } from './dedicated-assignments.queries';
import { DedicatedCoverageService } from './dedicated-coverage.service';
import { matchPostingCity, pickAgentAddress, type AgentAddressRow } from './dedicated-posting-city.util';
import {
  AUTO_DECLINE_LATE_APPLICATION_MUTATION,
  DEDICATED_AGENT_HELD_ASSIGNMENTS_QUERY,
  DEDICATED_OPPORTUNITIES_QUERY,
  DEDICATED_OPPORTUNITY_AGENT_QUERY,
  DEDICATED_OPPORTUNITY_BY_ID_QUERY,
  UPSERT_DEDICATED_APPLICATION_MUTATION,
  WITHDRAW_DEDICATED_APPLICATION_MUTATION,
} from './dedicated-postings.queries';
import {
  DEDICATED_POSTING_ERRORS,
  DedicatedPostingsService,
  distanceKm,
  postingView,
  type DedicatedPostingView,
  type PostingRow,
} from './dedicated-postings.service';
import { defaultPickupTime, shortTime } from './dedicated-slot.util';

const OPPORTUNITIES_LIMIT = 100;

const notFound = () => new NotFoundException(DEDICATED_NOT_FOUND_MESSAGE);

export const DEDICATED_OPPORTUNITY_ERRORS = {
  notEligible: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', // 403
  photoRequired: 'PROFILE_PHOTO_REQUIRED', // 422
  applicationClosed: 'application_closed', // 409
  notApplied: 'application_not_pending', // 409
  invalidCountry: 'invalid_country', // 400 (#594 G12)
} as const;

/** #594 G12 capability payload. */
export interface DedicatedCapability {
  enabled: boolean;
  country: string | null;
  reason: 'no_address' | 'no_country' | null;
}

/** AC-A4 disabled reasons. */
export type OpportunityDisabledReason = 'holds_slot' | 'max_assignments';
export type OpportunityIneligibleReason =
  | 'no_agent'
  | 'not_verified'
  | 'contract_unsigned'
  | 'suspended'
  | 'commercial_focus'
  /** #594 G2: postings are for independent agents only. */
  | 'internal_agent'
  /** #594 G6: no active address, so no city to match (only while the global flag is on). */
  | 'no_address';

const INELIGIBLE_MESSAGES: Partial<Record<OpportunityIneligibleReason, string>> = {
  internal_agent: 'Dedicated opportunities are for independent agents',
  no_address: 'Add your address to see stores near you',
};

interface OpportunityAgent {
  id: string;
  user_id: string;
  is_verified: boolean | null;
  is_internal: boolean | null;
  status: string | null;
  focus: string | null;
  user: { first_name: string | null; profile_picture_url: string | null; preferred_language: string | null; country?: string | null } | null;
  agent_addresses: AgentAddressRow[];
}

type OpportunityRow = PostingRow & {
  mine: Array<{ id: string; status: string; created_at: string; updated_at: string }>;
};

export interface DedicatedOpportunity extends DedicatedPostingView {
  storeName: string;
  address: { line1: string | null; city: string | null; state: string | null };
  distanceKm: number | null;
  slots: Array<{ slotKey: DedicatedSlotKey; startTime: string | null; endTime: string | null; pickupTime: string | null }>;
  /** Fixed copy key for "Standard delivery pay" (AC-B11, A1); no money fields. */
  pay: 'standard_delivery_pay';
  application: { id: string; status: string; appliedAt: string } | null;
  /** AC-A1c "Updated" chip: terms changed after this agent applied. */
  termsUpdatedSinceApplied: boolean;
  disabledReason: OpportunityDisabledReason | null;
}

/** AC-A4: the agent already holds one of the posting's slots at that store, or accepting would pass the cap. */
export function opportunityDisabledReason(
  posting: { business_location_id: string; slots: Array<{ slot_key: string }> },
  held: Array<{ business_location_id: string; slot_key: string }>,
  maxAssignmentsPerAgent: number
): OpportunityDisabledReason | null {
  const slotKeys = posting.slots.map((s) => s.slot_key);
  if (held.some((h) => h.business_location_id === posting.business_location_id && slotKeys.includes(h.slot_key))) {
    return 'holds_slot';
  }
  if (held.length + slotKeys.length > maxAssignmentsPerAgent) return 'max_assignments';
  return null;
}

/**
 * #594 PR 7 agent side: Opportunities (AC-A1..A4, E7), one-tap apply with a
 * profile photo, withdraw, single posting (G1). Verified, contract-signed
 * independents only (else 403; internal agents -> reason internal_agent, #594 G2).
 * Behind `dedicated_agents_enabled` for the agent's (list) or the store's
 * (detail / apply / withdraw) country: off -> 404. No address: the global flag
 * decides between 404 (off) and 403 reason no_address (on), #594 G6.
 */
@Injectable()
export class DedicatedOpportunitiesService {
  private readonly logger = new Logger(DedicatedOpportunitiesService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly postings: DedicatedPostingsService,
    private readonly coverage: DedicatedCoverageService,
    private readonly contractGate: AgentContractGateService,
    private readonly configService: DedicatedAgentsConfigService
  ) {}

  async list(userId: string, now = new Date()): Promise<{ opportunities: DedicatedOpportunity[] }> {
    const agent = await this.loadAgent(userId);
    const address = pickAgentAddress(agent?.agent_addresses);
    if (agent && !address?.country?.trim()) {
      // No active address: no city to match and no country to read the flag for.
      this.logger.log(JSON.stringify({ event: 'dedicated.opportunities_city_match', agentId: agent.id, skipped: 'no_agent_address' }));
      await this.requireNoAddressFlag(agent.user?.country);
    }
    const { config } = await this.postings.requireEnabled(address?.country);
    await this.assertEligible(agent);
    const eligible = agent as OpportunityAgent;
    const country = address?.country?.trim() ?? '';
    const res = await this.hasuraSystemService.executeQuery<{
      dedicated_agent_postings: OpportunityRow[];
      held: Array<{ business_location_id: string; slot_key: string }>;
    }>(DEDICATED_OPPORTUNITIES_QUERY, { country, now: now.toISOString(), agentId: eligible.id, limit: OPPORTUNITIES_LIMIT });
    const held = res?.held ?? [];

    const visible: OpportunityRow[] = [];
    const fallbacks: string[] = [];
    let cityMisses = 0;
    for (const row of res?.dedicated_agent_postings ?? []) {
      const m = matchPostingCity(address ?? {}, row.business_location?.address ?? {});
      if (!m.match) {
        cityMisses += 1;
        continue;
      }
      if (m.basis === 'state_fallback') fallbacks.push(row.id);
      visible.push(row);
    }
    this.logger.log(
      JSON.stringify({
        event: 'dedicated.opportunities_city_match',
        agentId: eligible.id,
        agentCity: address?.city ?? null,
        agentState: address?.state ?? null,
        country,
        candidates: (res?.dedicated_agent_postings ?? []).length,
        visible: visible.length,
        cityMisses,
        stateFallbacks: fallbacks.length,
        stateFallbackPostingIds: fallbacks,
      })
    );

    const opportunities: DedicatedOpportunity[] = [];
    for (const row of visible) {
      opportunities.push(await this.toOpportunity(row, address, held, config.maxAssignmentsPerAgent));
    }
    return { opportunities };
  }

  /**
   * #594 G12: is the feature on for the agent's country? Never 404s, so clients
   * stop probing. Eligibility is not encoded here.
   */
  async capabilityForAgent(userId: string): Promise<DedicatedCapability> {
    const agent = await this.loadAgent(userId);
    const country = pickAgentAddress(agent?.agent_addresses)?.country?.trim().toUpperCase() || null;
    if (!country) {
      // #648 (PE): same rule as the no-address list (#641 QA N3): the account's market
      // (users.country) when known, else the global row; `country` is the one used.
      const market = agent?.user?.country?.trim().toUpperCase() || null;
      return { enabled: await this.configService.isEnabled(market), country: market, reason: 'no_address' };
    }
    return { enabled: await this.configService.isEnabled(country), country, reason: null };
  }

  /** #594 G12 generic variant (business / admin clients that know the location's country). */
  async capabilityForCountry(raw: string | null | undefined): Promise<DedicatedCapability> {
    const value = raw?.trim() ?? '';
    if (!value) return { enabled: false, country: null, reason: 'no_country' };
    if (!/^[A-Za-z]{2}$/.test(value)) {
      throw new BadRequestException({ code: DEDICATED_OPPORTUNITY_ERRORS.invalidCountry, message: 'country must be a 2-letter ISO code' });
    }
    const country = value.toUpperCase();
    return { enabled: await this.configService.isEnabled(country), country, reason: null };
  }

  /**
   * #594 G1: one posting, same shape as a list item. Visible when it is open (not
   * expired) in the agent's city, or when the agent has an application on it in
   * any status (accepted / closed / expired postings drop out of the list).
   */
  async detail(userId: string, postingId: string, now = new Date()): Promise<{ opportunity: DedicatedOpportunity }> {
    const agent = await this.loadAgent(userId);
    const posting = await this.loadPostingOr404(postingId);
    const { config } = await this.postings.requireEnabled(posting.business_location?.address?.country);
    await this.assertEligible(agent);
    const eligible = agent as OpportunityAgent;
    const address = pickAgentAddress(eligible.agent_addresses);
    if (!address?.country?.trim()) this.throwIneligible('no_address');
    const res = await this.hasuraSystemService.executeQuery<{
      dedicated_agent_postings_by_pk: OpportunityRow | null;
      held: Array<{ business_location_id: string; slot_key: string }>;
    }>(DEDICATED_OPPORTUNITY_BY_ID_QUERY, { id: posting.id, agentId: eligible.id });
    const row = res?.dedicated_agent_postings_by_pk;
    if (!row) throw notFound();
    const isOpen = row.status === 'open' && new Date(row.expires_at).getTime() > now.getTime();
    const inCity = matchPostingCity(address ?? {}, row.business_location?.address ?? {}).match;
    if ((row.mine?.length ?? 0) === 0 && !(isOpen && inCity)) throw notFound();
    const opportunity = await this.toOpportunity(row, address, res?.held ?? [], config.maxAssignmentsPerAgent);
    if (!isOpen) opportunity.disabledReason = null;
    return { opportunity };
  }

  /** AC-A2: one tap; 422 PROFILE_PHOTO_REQUIRED sends the app to the photo step first. Idempotent while applied. */
  async apply(userId: string, postingId: string, now = new Date()) {
    const agent = await this.loadAgent(userId);
    const posting = await this.loadPostingOr404(postingId);
    const { config } = await this.postings.requireEnabled(posting.business_location?.address?.country);
    await this.assertEligible(agent);
    const eligible = agent as OpportunityAgent;
    await this.assertApplyCity(eligible, posting);
    if (!eligible.user?.profile_picture_url?.trim()) {
      this.postings.track('dedicated.photo_gate_shown', { postingId: posting.id, agentId: eligible.id });
      throw new UnprocessableEntityException({
        error: DEDICATED_OPPORTUNITY_ERRORS.photoRequired,
        code: DEDICATED_OPPORTUNITY_ERRORS.photoRequired,
        message: 'Add a profile photo to apply',
      });
    }
    if (posting.status !== 'open' || new Date(posting.expires_at).getTime() <= now.getTime()) {
      throw new ConflictException({ code: DEDICATED_POSTING_ERRORS.notOpen, message: 'This posting is no longer open' });
    }
    const mine = await this.hasuraSystemService.executeQuery<{
      held: Array<{ business_location_id: string; slot_key: string }>;
      mine: Array<{ id: string; posting_id: string; status: string }>;
    }>(DEDICATED_AGENT_HELD_ASSIGNMENTS_QUERY, { agentId: eligible.id });
    const existing = (mine?.mine ?? []).find((a) => a.posting_id === posting.id);
    if (existing?.status === 'applied') return { application: { id: existing.id, status: 'applied' as const } };
    const disabled = opportunityDisabledReason(posting, mine?.held ?? [], config.maxAssignmentsPerAgent);
    if (disabled) {
      throw new ConflictException({
        code: disabled,
        message:
          disabled === 'holds_slot'
            ? 'You already hold one of these slots at this store'
            : `This would put you past ${config.maxAssignmentsPerAgent} dedicated assignments`,
      });
    }

    const res = await this.hasuraSystemService.executeMutation<{
      insert_dedicated_agent_applications_one: { id: string; status: string } | null;
    }>(UPSERT_DEDICATED_APPLICATION_MUTATION, {
      object: { posting_id: posting.id, agent_id: eligible.id, status: 'applied', withdrawn_at: null },
    });
    const row = res?.insert_dedicated_agent_applications_one;
    if (!row) {
      throw new ConflictException({
        code: DEDICATED_OPPORTUNITY_ERRORS.applicationClosed,
        message: 'You can no longer apply to this posting',
      });
    }
    // Close / fill / expiry raced the insert: decline at once rather than leave a pending row on a shut posting.
    const late = await this.hasuraSystemService.executeMutation<{ update_dedicated_agent_applications: { affected_rows: number } }>(
      AUTO_DECLINE_LATE_APPLICATION_MUTATION,
      { id: row.id, at: now.toISOString() }
    );
    if (late?.update_dedicated_agent_applications?.affected_rows) {
      this.postings.track('dedicated.application_auto_declined', { postingId: posting.id, count: 1, cause: 'late' });
      throw new ConflictException({ code: DEDICATED_POSTING_ERRORS.notOpen, message: 'This posting is no longer open' });
    }
    await this.postings.notifyBusinessNewApplication(posting, eligible.user?.first_name?.trim() || 'Agent');
    this.logger.log(
      JSON.stringify({ event: 'dedicated.posting_applied', postingId: posting.id, applicationId: row.id, agentId: eligible.id })
    );
    this.postings.track('dedicated.application_submitted', { postingId: posting.id, applicationId: row.id, agentId: eligible.id });
    return { application: { id: row.id, status: 'applied' as const } };
  }

  async withdraw(userId: string, postingId: string, now = new Date()) {
    const agent = await this.loadAgent(userId);
    const posting = await this.loadPostingOr404(postingId);
    await this.postings.requireEnabled(posting.business_location?.address?.country);
    if (!agent) throw notFound();
    const res = await this.hasuraSystemService.executeMutation<{ update_dedicated_agent_applications: { affected_rows: number } }>(
      WITHDRAW_DEDICATED_APPLICATION_MUTATION,
      { postingId: posting.id, agentId: agent.id, at: now.toISOString() }
    );
    if (!res?.update_dedicated_agent_applications?.affected_rows) {
      throw new ConflictException({ code: DEDICATED_OPPORTUNITY_ERRORS.notApplied, message: 'There is no pending application to withdraw' });
    }
    this.postings.track('dedicated.application_withdrawn', { postingId: posting.id, agentId: agent.id });
    return { application: { postingId: posting.id, status: 'withdrawn' as const } };
  }

  // ---------------------------------------------------------------- internals

  private async loadAgent(userId: string): Promise<OpportunityAgent | null> {
    const res = await this.hasuraSystemService.executeQuery<{ agents: OpportunityAgent[] }>(DEDICATED_OPPORTUNITY_AGENT_QUERY, {
      userId,
    });
    return res?.agents?.[0] ?? null;
  }

  /** AC-A1: internal agents, and verified independents with a signed contract (when the contract gate is on). */
  private async ineligibleReason(agent: OpportunityAgent | null): Promise<OpportunityIneligibleReason | null> {
    if (!agent) return 'no_agent';
    if (agent.status === 'suspended') return 'suspended';
    if (!showsDeliveryChrome(agent.focus)) return 'commercial_focus';
    if (agent.is_internal === true) return 'internal_agent';
    if (agent.is_verified !== true) return 'not_verified';
    if (!(await this.contractGate.canOperate(agent.id))) return 'contract_unsigned';
    return null;
  }

  private async assertEligible(agent: OpportunityAgent | null): Promise<void> {
    const reason = await this.ineligibleReason(agent);
    if (!reason) return;
    this.throwIneligible(reason);
  }

  private throwIneligible(reason: OpportunityIneligibleReason): never {
    throw new ForbiddenException({
      error: DEDICATED_OPPORTUNITY_ERRORS.notEligible,
      code: DEDICATED_OPPORTUNITY_ERRORS.notEligible,
      reason,
      message: INELIGIBLE_MESSAGES[reason] ?? 'Dedicated opportunities are for verified agents with a signed agreement',
    });
  }

  /**
   * AC-E7 / #594 G6: apply uses the same city and no-address rules as list/detail.
   * A leaked posting UUID must not create a pending application the business can accept.
   */
  private async assertApplyCity(agent: OpportunityAgent, posting: PostingRow): Promise<void> {
    const address = pickAgentAddress(agent.agent_addresses);
    if (!address?.country?.trim()) await this.requireNoAddressFlag(agent.user?.country);
    if (!matchPostingCity(address ?? {}, posting.business_location?.address ?? {}).match) {
      throw notFound();
    }
  }

  /**
   * #594 G6 / #641 QA N3: no active address, so no city to match. The flag still
   * follows a country when one is known: the account's market (`users.country`,
   * ISO-2, set at signup and the canonical market source), resolved country row
   * over global row. Without it, the global row decides. Off -> 404, on -> 403 no_address.
   */
  private async requireNoAddressFlag(userCountry: string | null | undefined): Promise<never> {
    // The resolver trims / upper-cases; a blank country reads the global row.
    if (!(await this.configService.isEnabled(userCountry ?? null))) throw notFound();
    this.throwIneligible('no_address');
  }

  /** #641 QA N1/N2: non-uuid or unknown posting -> the one 404 body. */
  private async loadPostingOr404(postingId: string) {
    if (!isUuidLike(postingId)) throw notFound();
    try {
      return await this.postings.loadPosting(postingId.trim());
    } catch (error) {
      if (error instanceof NotFoundException) throw notFound();
      throw error;
    }
  }

  private async toOpportunity(
    row: OpportunityRow,
    agentAddress: ReturnType<typeof pickAgentAddress>,
    held: Array<{ business_location_id: string; slot_key: string }>,
    cap: number
  ): Promise<DedicatedOpportunity> {
    const loc = row.business_location;
    const country = loc?.address?.country?.trim().toUpperCase() ?? '';
    const [bounds, pickup] = await Promise.all([
      this.coverage.slotBoundsFor(country, loc?.address?.state?.trim() ?? ''),
      this.hasuraSystemService.executeQuery<{
        business_location_pickup_slots: Array<{ slot_key: string; is_enabled: boolean; pickup_time: string | null }>;
      }>(DEDICATED_LOCATION_PICKUP_SLOTS_QUERY, { locationId: row.business_location_id }),
    ]);
    const settings = new Map((pickup?.business_location_pickup_slots ?? []).map((s) => [s.slot_key, s]));
    const mine = row.mine?.[0] ?? null;
    const view = postingView(row);
    return {
      ...view,
      storeName: loc?.name ?? loc?.business?.name ?? '',
      address: { line1: loc?.address?.address_line_1 ?? null, city: loc?.address?.city ?? null, state: loc?.address?.state ?? null },
      distanceKm: distanceKm(agentAddress, loc?.address),
      slots: view.slotKeys.map((slotKey) => {
        const b = bounds.find((x) => x.slotKey === slotKey);
        const s = settings.get(slotKey);
        return {
          slotKey,
          startTime: b ? shortTime(b.startTime) : null,
          endTime: b ? shortTime(b.endTime) : null,
          pickupTime: s?.pickup_time ? shortTime(s.pickup_time) : b ? defaultPickupTime(b) : null,
        };
      }),
      pay: 'standard_delivery_pay',
      application: mine ? { id: mine.id, status: mine.status, appliedAt: mine.created_at } : null,
      termsUpdatedSinceApplied:
        !!mine &&
        mine.status === 'applied' &&
        !!row.terms_updated_at &&
        new Date(row.terms_updated_at).getTime() > new Date(mine.updated_at).getTime(),
      disabledReason: opportunityDisabledReason(row, held, cap),
    };
  }
}
