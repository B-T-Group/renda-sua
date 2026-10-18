import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AgentHoldService } from '../agents/agent-hold.service';
import { DELEGATION_PERMISSIONS } from '../delegations/delegation.constants';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  buildDedicatedAgentMessage,
  buildDedicatedAssignedBusinessMessage,
  type DedicatedNoticeEvent,
} from '../notifications/dedicated-agent-push.messages';
import { NotificationsService } from '../notifications/notifications.service';
import { resolveTimeZone } from '../restock-alerts/restock-time.util';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import {
  DEDICATED_SLOT_KEYS,
  type DedicatedAgentsConfig,
  type DedicatedSlotKey,
} from './dedicated-agents.constants';
import { orderAssignmentsForLocking } from './dedicated-assignment-locking.util';
import { runAssignmentWrite } from './dedicated-assignment-write.util';
import {
  DEDICATED_AGENT_BY_USER_QUERY,
  DEDICATED_AGENT_LIVE_ASSIGNMENTS_QUERY,
  DEDICATED_ASSIGN_AGENT_QUERY,
  DEDICATED_ASSIGNMENT_BY_ID_QUERY,
  DEDICATED_ASSIGNMENT_LOCATION_QUERY,
  DEDICATED_CARD_STATS_QUERY,
  DEDICATED_LOCATION_LIVE_ASSIGNMENTS_QUERY,
  DEDICATED_LOCATION_PICKUP_SLOTS_QUERY,
  DEDICATED_NOTICE_DELEGATES_QUERY,
  INSERT_DEDICATED_ASSIGNMENTS_MUTATION,
  UPDATE_DEDICATED_ASSIGNMENT_MUTATION,
  savePickupSlotsMutation,
} from './dedicated-assignments.queries';
import { computeEffectiveCapacity } from './dedicated-capacity.util';
import { DEDICATED_AGENT_LOAD_QUERY, DEDICATED_AGENT_BALANCES_QUERY } from './dedicated-coverage.queries';
import { DEDICATED_ACTIVE_ORDER_STATUSES, DedicatedCoverageService } from './dedicated-coverage.service';
import { localDateTimeAt, timeToMinutes, type DedicatedSlotBounds } from './dedicated-slot.util';

/** AC-B2: default pickup time is slot start + 30 min. */
export const DEFAULT_PICKUP_OFFSET_MINUTES = 30;
const DONE_STATUSES = ['delivered', 'complete'];
const REMOVED_REASON_MAX = 500;

export const DEDICATED_NOTICE_MESSAGE_TYPES: Record<DedicatedNoticeEvent, string> = {
  assigned: 'DEDICATED_AGENT_ASSIGNED',
  paused: 'DEDICATED_AGENT_PAUSED',
  resumed: 'DEDICATED_AGENT_RESUMED',
  removed: 'DEDICATED_AGENT_REMOVED',
};
export const DEDICATED_BUSINESS_NOTICE_PATH = (locationId: string) =>
  `/business/locations/${locationId}/dedicated-agents`;
export const DEDICATED_AGENT_NOTICE_PATH = '/agent/dedicated-assignments';

interface LocationRow {
  id: string;
  name: string | null;
  business_id: string;
  business: {
    id: string;
    name: string | null;
    user_id: string | null;
    user: { id: string; preferred_language: string | null } | null;
  } | null;
  address: { country: string | null; state: string | null } | null;
}

interface AgentRow {
  id: string;
  user_id: string | null;
  is_verified: boolean | null;
  is_internal: boolean | null;
  status: string | null;
  focus: string | null;
  user: { first_name: string | null; last_name: string | null; preferred_language: string | null } | null;
}

export interface AssignmentRow {
  id: string;
  business_location_id: string;
  agent_id: string;
  slot_key: DedicatedSlotKey;
  status: 'active' | 'paused' | 'removed';
  source: 'superuser_assign' | 'posting';
  off_today_date: string | null;
  paused_at: string | null;
  removed_at: string | null;
  created_at: string;
  agent: {
    id: string;
    user_id: string | null;
    is_internal: boolean | null;
    is_verified: boolean | null;
    user: {
      first_name: string | null;
      last_name: string | null;
      profile_picture_url: string | null;
      preferred_language: string | null;
    } | null;
  } | null;
  business_location: {
    id: string;
    name: string | null;
    address: { country: string | null; state: string | null } | null;
  } | null;
}

interface PickupSlotRow {
  slot_key: string;
  is_enabled: boolean;
  pickup_time: string | null;
}

export interface DedicatedActor {
  userId: string;
  /** Business-side calls are scoped to the location in the path; super-user calls are not. */
  locationId?: string;
}

export interface PickupSlotInput {
  slotKey: string;
  isEnabled?: boolean;
  pickupTime?: string | null;
}

export interface DedicatedPickupSlotView {
  slotKey: DedicatedSlotKey;
  startTime: string;
  endTime: string;
  isEnabled: boolean;
  pickupTime: string;
  liveAgents: number;
}

export interface DedicatedAgentCard {
  assignmentId: string;
  slotKey: DedicatedSlotKey;
  status: 'active' | 'paused';
  source: 'superuser_assign' | 'posting';
  /** AC-B17 "Assigned by RendaSua" chip. */
  assignedByRendasua: boolean;
  offToday: boolean;
  agent: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    isInternal: boolean;
  };
  activeOrders: number;
  maxActiveOrders: number;
  outstandingDedicatedOffers: number;
  /** Independents only (non-Stripe hold applies); null for internal agents. */
  availableBalance: number | null;
  /** AC-B7 "balance covers ~n more"; null for internal agents or no typical hold yet. */
  balanceCoversOrders: number | null;
  deliveries: number;
  missedDeliveries: number;
}

export interface MyDedicatedAssignment {
  assignmentId: string;
  locationId: string;
  storeName: string;
  slotKey: DedicatedSlotKey;
  startTime: string | null;
  endTime: string | null;
  status: 'active' | 'paused';
  source: 'superuser_assign' | 'posting';
  offToday: boolean;
  activeOrders: number;
  maxActiveOrders: number;
}

function fullName(user: { first_name?: string | null; last_name?: string | null } | null | undefined): string {
  return [user?.first_name, user?.last_name].map((s) => (s ?? '').trim()).filter(Boolean).join(' ');
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** `HH:MM[:SS]` -> `HH:MM`. */
function shortTime(time: string): string {
  const minutes = timeToMinutes(time);
  return minutes == null ? time : minutesToTime(minutes);
}

export function defaultPickupTime(slot: Pick<DedicatedSlotBounds, 'startTime' | 'endTime'>): string {
  const start = timeToMinutes(slot.startTime) as number;
  const end = timeToMinutes(slot.endTime) as number;
  return minutesToTime(Math.min(start + DEFAULT_PICKUP_OFFSET_MINUTES, Math.max(start, end - 1)));
}

/** AC-B2: a pickup time must fall inside the slot's hours (start <= t < end). */
export function isPickupTimeWithinSlot(
  pickupTime: string,
  slot: Pick<DedicatedSlotBounds, 'startTime' | 'endTime'>
): boolean {
  const t = timeToMinutes(pickupTime);
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);
  if (t == null || start == null || end == null) return false;
  return t >= start && t < end;
}

function assertSlotKeys(raw: unknown): DedicatedSlotKey[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new BadRequestException({ code: 'invalid_slot_keys', message: 'slotKeys must be a non-empty list' });
  }
  const keys = [...new Set(raw.map((k) => String(k ?? '').trim().toLowerCase()))];
  if (!keys.every((k) => (DEDICATED_SLOT_KEYS as readonly string[]).includes(k))) {
    throw new BadRequestException({
      code: 'invalid_slot_keys',
      message: `slotKeys must be among ${DEDICATED_SLOT_KEYS.join(', ')}`,
    });
  }
  return keys as DedicatedSlotKey[];
}

/**
 * #594 PR 3: dedicated-agent assignment lifecycle and location pickup slots.
 * All writes are Nest-only (no Hasura insert/update permissions), go through
 * `runAssignmentWrite` (40P01 retry, cap / duplicate -> 409) with rows in
 * agent_id order, and are behind `dedicated_agents_enabled` for the location's
 * country (off -> 404, as for other flagged routes).
 */
@Injectable()
export class DedicatedAssignmentsService {
  private readonly logger = new Logger(DedicatedAssignmentsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly configService: DedicatedAgentsConfigService,
    private readonly coverage: DedicatedCoverageService,
    private readonly deliveryConfigService: DeliveryConfigService,
    private readonly agentHoldService: AgentHoldService,
    private readonly notifications: NotificationsService
  ) {}

  // ---------------------------------------------------------------- super user

  /** AC-S2: direct assign, active immediately; business (owner + managing delegates) and agent notified. */
  async superUserAssign(params: {
    actorUserId: string;
    locationId: string;
    agentId: string;
    slotKeys: unknown;
  }): Promise<{ assignments: Array<{ id: string; agent_id: string; slot_key: string; status: string; source: string }> }> {
    const slotKeys = assertSlotKeys(params.slotKeys);
    const location = await this.loadLocation(params.locationId);
    const { country } = await this.requireEnabled(location.address?.country);
    const agent = await this.loadAgent(params.agentId);
    if (agent.is_verified !== true) {
      throw new BadRequestException({
        code: 'agent_not_verified',
        message: 'Only internal agents and verified independents can be dedicated',
      });
    }
    if (agent.status === 'suspended') {
      throw new BadRequestException({ code: 'agent_suspended', message: 'This agent is suspended' });
    }
    const disabled = await this.disabledSlots(location.id);
    const off = slotKeys.filter((k) => disabled.has(k));
    if (off.length > 0) {
      throw new ConflictException({
        code: 'slot_disabled',
        message: `The store has turned off: ${off.join(', ')}`,
      });
    }

    const objects = orderAssignmentsForLocking(
      slotKeys.map((slotKey) => ({
        business_location_id: location.id,
        agent_id: agent.id,
        slot_key: slotKey,
        status: 'active',
        source: 'superuser_assign',
        assigned_by_user_id: params.actorUserId,
      }))
    );
    const res = await runAssignmentWrite(() =>
      this.hasuraSystemService.executeMutation<{
        insert_dedicated_agent_assignments: {
          returning: Array<{ id: string; agent_id: string; slot_key: string; status: string; source: string }>;
        };
      }>(INSERT_DEDICATED_ASSIGNMENTS_MUTATION, { objects })
    );
    const assignments = res?.insert_dedicated_agent_assignments?.returning ?? [];
    const firstId = assignments[0]?.id;
    if (firstId) {
      await this.notifyBusinessAssigned(location, agent, slotKeys, firstId);
      await this.notifyAgent('assigned', {
        userId: agent.user_id,
        preferredLanguage: agent.user?.preferred_language,
        storeName: location.name ?? location.business?.name ?? '',
        slotKeys,
        assignmentId: firstId,
        locationId: location.id,
      });
    }
    this.logger.log(
      `dedicated superuser_assign location=${location.id} agent=${agent.id} slots=${slotKeys.join(',')} country=${country}`
    );
    return { assignments };
  }

  /** Business + agent of an assignment, for the admin geo-scope check. */
  async assignmentScope(assignmentId: string): Promise<{ businessId: string; agentId: string }> {
    const row = await this.loadAssignment(assignmentId);
    const location = await this.loadLocation(row.business_location_id);
    return { businessId: location.business_id, agentId: row.agent_id };
  }

  /** Business id of a location, for the admin geo-scope check. */
  async locationBusinessId(locationId: string): Promise<string> {
    return (await this.loadLocation(locationId)).business_id;
  }

  // ---------------------------------------------------------------- business

  /** Pause (status paused) or resume (active). Idempotent; the agent is notified on a change. */
  async setPaused(actor: DedicatedActor, assignmentId: string, paused: boolean) {
    const row = await this.loadScopedAssignment(actor, assignmentId);
    await this.requireEnabled(row.business_location?.address?.country);
    if (row.status === 'removed') {
      throw new ConflictException({ code: 'assignment_removed', message: 'This assignment was removed' });
    }
    const target = paused ? 'paused' : 'active';
    if (row.status === target) return { assignment: this.summary(row) };
    if (!paused && (await this.disabledSlots(row.business_location_id)).has(row.slot_key)) {
      throw new ConflictException({
        code: 'slot_disabled',
        message: 'Turn the slot back on before resuming its agents',
      });
    }
    const now = new Date().toISOString();
    const set = paused
      ? { status: 'paused', paused_at: now, paused_by_user_id: actor.userId }
      : { status: 'active', paused_at: null, paused_by_user_id: null };
    const updated = await this.guardedUpdate(row.id, [row.status], set);
    await this.notifyAgentForRow(paused ? 'paused' : 'resumed', row);
    return { assignment: updated };
  }

  /** Remove (audited). Never reopens a posting (AC-B15). The agent is notified. */
  async remove(actor: DedicatedActor, assignmentId: string, reason?: string | null) {
    const row = await this.loadScopedAssignment(actor, assignmentId);
    await this.requireEnabled(row.business_location?.address?.country);
    if (row.status === 'removed') return { assignment: this.summary(row) };
    const trimmed = typeof reason === 'string' ? reason.trim().slice(0, REMOVED_REASON_MAX) : '';
    const updated = await this.guardedUpdate(row.id, ['active', 'paused'], {
      status: 'removed',
      removed_at: new Date().toISOString(),
      removed_by_user_id: actor.userId,
      removed_reason: trimmed || null,
    });
    await this.notifyAgentForRow('removed', row);
    return { assignment: updated };
  }

  /** AC-B7 / B17 cards for a location (live assignments). */
  async listForLocation(locationId: string, now = new Date()): Promise<{
    maxActiveOrders: number;
    assignments: DedicatedAgentCard[];
  }> {
    const location = await this.loadLocation(locationId);
    const { country, config } = await this.requireEnabled(location.address?.country);
    const rows = await this.liveAssignmentsForLocation(locationId);
    const localToday = localDateTimeAt(now, await this.timeZone(country)).date;
    if (rows.length === 0) return { maxActiveOrders: config.maxActiveOrders, assignments: [] };

    const agentIds = [...new Set(rows.map((r) => r.agent_id))];
    const [load, stats] = await Promise.all([this.loadAgentLoad(agentIds, now), this.loadCardStats(locationId, agentIds)]);
    const independents = rows.filter((r) => r.agent?.is_internal !== true);
    const balances = await this.loadBalances(
      [...new Set(independents.map((r) => r.agent?.user_id).filter((id): id is string => !!id))],
      country
    );
    const holds = new Map<string, number>();
    if (stats.typicalSubtotal > 0) {
      for (const agentId of new Set(independents.map((r) => r.agent_id))) {
        const hold = await this.agentHoldService.resolveOrderHoldWithCeiling(stats.typicalSubtotal, agentId, 'mobile_money');
        holds.set(agentId, Number(hold.holdAmount) || 0);
      }
    }

    const assignments = rows.map((row): DedicatedAgentCard => {
      const isInternal = row.agent?.is_internal === true;
      const activeOrders = load.active.get(row.agent_id) ?? 0;
      const outstanding = load.offers.get(row.agent_id) ?? 0;
      const balance = isInternal ? null : balances.get(row.agent?.user_id ?? '') ?? 0;
      const hold = holds.get(row.agent_id) ?? 0;
      return {
        assignmentId: row.id,
        slotKey: row.slot_key,
        status: row.status as 'active' | 'paused',
        source: row.source,
        assignedByRendasua: row.source === 'superuser_assign',
        offToday: row.off_today_date === localToday,
        agent: {
          id: row.agent_id,
          firstName: row.agent?.user?.first_name ?? '',
          lastName: row.agent?.user?.last_name ?? '',
          photoUrl: row.agent?.user?.profile_picture_url ?? null,
          isInternal,
        },
        activeOrders,
        maxActiveOrders: config.maxActiveOrders,
        outstandingDedicatedOffers: outstanding,
        availableBalance: balance,
        balanceCoversOrders:
          isInternal || !(hold > 0)
            ? null
            : computeEffectiveCapacity({
                maxActiveOrders: config.maxActiveOrders,
                activeOrders,
                outstandingDedicatedOffers: outstanding,
                isInternal,
                rail: 'mobile_money',
                availableBalance: balance,
                typicalHold: hold,
              }),
        deliveries: stats.delivered.get(row.agent_id) ?? 0,
        missedDeliveries: stats.missed.get(row.agent_id) ?? 0,
      };
    });
    return { maxActiveOrders: config.maxActiveOrders, assignments };
  }

  /** AC-B1/B2: the three standard slots offered in the location's market, with toggle + pickup time. */
  async getPickupSlots(locationId: string): Promise<{ slots: DedicatedPickupSlotView[] }> {
    const location = await this.loadLocation(locationId);
    const { country } = await this.requireEnabled(location.address?.country);
    const [bounds, settings, live] = await Promise.all([
      this.coverage.slotBoundsFor(country, location.address?.state?.trim() ?? ''),
      this.pickupSlotRows(locationId),
      this.liveAssignmentsForLocation(locationId),
    ]);
    const byKey = new Map(settings.map((s) => [s.slot_key, s]));
    return {
      slots: bounds.map((b) => {
        const row = byKey.get(b.slotKey);
        return {
          slotKey: b.slotKey,
          startTime: shortTime(b.startTime),
          endTime: shortTime(b.endTime),
          isEnabled: row ? row.is_enabled !== false : true,
          pickupTime: row?.pickup_time ? shortTime(row.pickup_time) : defaultPickupTime(b),
          liveAgents: live.filter((a) => a.slot_key === b.slotKey).length,
        };
      }),
    };
  }

  /**
   * Toggle slots / set pickup times (AC-B1, B2). Turning off a slot that has
   * active dedicated agents pauses them (AC-B4, never removes); the caller must
   * confirm with `confirmPauseAgents` (the "asks once"), else 409.
   */
  async updatePickupSlots(
    actor: DedicatedActor & { locationId: string },
    input: { slots?: unknown; confirmPauseAgents?: boolean }
  ) {
    const location = await this.loadLocation(actor.locationId);
    const { country } = await this.requireEnabled(location.address?.country);
    if (!Array.isArray(input?.slots) || input.slots.length === 0) {
      throw new BadRequestException({ code: 'invalid_slots', message: 'slots must be a non-empty list' });
    }
    const changes = input.slots as PickupSlotInput[];
    const keys = assertSlotKeys(changes.map((c) => c?.slotKey));
    if (keys.length !== changes.length) {
      throw new BadRequestException({ code: 'invalid_slots', message: 'Each slot may appear once' });
    }
    const [bounds, settings, live] = await Promise.all([
      this.coverage.slotBoundsFor(country, location.address?.state?.trim() ?? ''),
      this.pickupSlotRows(location.id),
      this.liveAssignmentsForLocation(location.id),
    ]);
    const existing = new Map(settings.map((s) => [s.slot_key, s]));

    const objects = changes.map((change) => {
      const slotKey = String(change.slotKey).trim().toLowerCase() as DedicatedSlotKey;
      const bound = bounds.find((b) => b.slotKey === slotKey);
      if (!bound) {
        throw new BadRequestException({
          code: 'slot_not_offered',
          message: `The ${slotKey} slot is not offered in this market`,
        });
      }
      const prev = existing.get(slotKey);
      if (change.isEnabled !== undefined && typeof change.isEnabled !== 'boolean') {
        throw new BadRequestException({ code: 'invalid_slots', message: 'isEnabled must be a boolean' });
      }
      const isEnabled = change.isEnabled ?? (prev ? prev.is_enabled !== false : true);
      let pickupTime = prev?.pickup_time ?? null;
      if (change.pickupTime !== undefined) {
        pickupTime = change.pickupTime === null ? null : String(change.pickupTime).trim();
        if (pickupTime !== null && !isPickupTimeWithinSlot(pickupTime, bound)) {
          throw new BadRequestException({
            code: 'pickup_time_outside_slot',
            message: `Pickup time must be between ${shortTime(bound.startTime)} and ${shortTime(bound.endTime)}`,
          });
        }
        if (pickupTime !== null) pickupTime = shortTime(pickupTime);
      }
      return {
        business_location_id: location.id,
        slot_key: slotKey,
        is_enabled: isEnabled,
        pickup_time: pickupTime,
        updated_by_user_id: actor.userId,
      };
    });

    const turningOff = new Set(objects.filter((o) => !o.is_enabled).map((o) => o.slot_key));
    const toPause = live.filter((a) => a.status === 'active' && turningOff.has(a.slot_key));
    if (toPause.length > 0 && input.confirmPauseAgents !== true) {
      throw new ConflictException({
        code: 'slot_has_dedicated_agents',
        message: 'Turning off this slot pauses its dedicated agents',
        agentsToPause: toPause.length,
      });
    }

    const now = new Date().toISOString();
    const pauses = orderAssignmentsForLocking(toPause).map((a) => ({
      where: { id: { _eq: a.id }, status: { _eq: 'active' } },
      _set: { status: 'paused', paused_at: now, paused_by_user_id: actor.userId },
    }));
    await runAssignmentWrite(() =>
      this.hasuraSystemService.executeMutation(
        savePickupSlotsMutation(pauses.length > 0),
        pauses.length > 0 ? { slots: objects, pauses } : { slots: objects }
      )
    );
    for (const row of toPause) await this.notifyAgentForRow('paused', row);
    return { ...(await this.getPickupSlots(location.id)), pausedAssignmentIds: toPause.map((a) => a.id) };
  }

  // ---------------------------------------------------------------- agent

  /** AC-A5 "My stores": the agent's live assignments (flag on for that store's country). */
  async listMine(userId: string, now = new Date()): Promise<{ assignments: MyDedicatedAssignment[] }> {
    const agent = await this.agentForUser(userId);
    if (!agent) return { assignments: [] };
    const res = await this.hasuraSystemService.executeQuery<{ dedicated_agent_assignments: AssignmentRow[] }>(
      DEDICATED_AGENT_LIVE_ASSIGNMENTS_QUERY,
      { agentId: agent.id }
    );
    const rows = res?.dedicated_agent_assignments ?? [];
    const visible: Array<{ row: AssignmentRow; config: DedicatedAgentsConfig; country: string }> = [];
    for (const row of rows) {
      const country = row.business_location?.address?.country?.trim().toUpperCase();
      if (!country) continue;
      const config = await this.configService.getConfig(country);
      if (config.enabled) visible.push({ row, config, country });
    }
    if (visible.length === 0) return { assignments: [] };
    const load = await this.loadAgentLoad([agent.id], now);
    const boundsCache = new Map<string, DedicatedSlotBounds[]>();
    const assignments: MyDedicatedAssignment[] = [];
    for (const { row, config, country } of visible) {
      const state = row.business_location?.address?.state?.trim() ?? '';
      const cacheKey = `${country}|${state}`;
      if (!boundsCache.has(cacheKey)) boundsCache.set(cacheKey, await this.coverage.slotBoundsFor(country, state));
      const bound = boundsCache.get(cacheKey)?.find((b) => b.slotKey === row.slot_key);
      const localToday = localDateTimeAt(now, await this.timeZone(country)).date;
      assignments.push({
        assignmentId: row.id,
        locationId: row.business_location_id,
        storeName: row.business_location?.name ?? '',
        slotKey: row.slot_key,
        startTime: bound ? shortTime(bound.startTime) : null,
        endTime: bound ? shortTime(bound.endTime) : null,
        status: row.status as 'active' | 'paused',
        source: row.source,
        offToday: row.off_today_date === localToday,
        activeOrders: load.active.get(agent.id) ?? 0,
        maxActiveOrders: config.maxActiveOrders,
      });
    }
    return { assignments };
  }

  /**
   * AC-A5 Off today: off_today_date = today in the store's country timezone,
   * so it applies at once and lapses at the next local midnight.
   */
  async setOffToday(userId: string, assignmentId: string, off: boolean, now = new Date()) {
    if (typeof off !== 'boolean') {
      throw new BadRequestException({ code: 'invalid_off_today', message: 'off must be a boolean' });
    }
    const agent = await this.agentForUser(userId);
    const row = agent ? await this.loadAssignment(assignmentId).catch(() => null) : null;
    if (!agent || !row || row.agent_id !== agent.id) throw new NotFoundException('Assignment not found');
    const { country } = await this.requireEnabled(row.business_location?.address?.country);
    if (row.status === 'removed') {
      throw new ConflictException({ code: 'assignment_removed', message: 'This assignment was removed' });
    }
    const localToday = localDateTimeAt(now, await this.timeZone(country)).date;
    const updated = await this.guardedUpdate(row.id, ['active', 'paused'], {
      off_today_date: off ? localToday : null,
    });
    return { assignment: updated, offToday: off, localDate: localToday };
  }

  // ---------------------------------------------------------------- internals

  private summary(row: AssignmentRow) {
    return {
      id: row.id,
      status: row.status,
      off_today_date: row.off_today_date,
      paused_at: row.paused_at,
      removed_at: row.removed_at,
    };
  }

  private async guardedUpdate(id: string, from: string[], set: Record<string, unknown>) {
    const res = await runAssignmentWrite(() =>
      this.hasuraSystemService.executeMutation<{
        update_dedicated_agent_assignments: { affected_rows: number; returning: Array<Record<string, unknown>> };
      }>(UPDATE_DEDICATED_ASSIGNMENT_MUTATION, { id, from, set })
    );
    const out = res?.update_dedicated_agent_assignments;
    if (!out || out.affected_rows === 0) {
      throw new ConflictException({ code: 'assignment_changed', message: 'This assignment changed; reload and retry' });
    }
    return out.returning[0];
  }

  private async requireEnabled(rawCountry: string | null | undefined): Promise<{
    country: string;
    config: DedicatedAgentsConfig;
  }> {
    const country = rawCountry?.trim().toUpperCase();
    if (!country) throw new NotFoundException('Not found');
    const config = await this.configService.getConfig(country);
    if (!config.enabled) throw new NotFoundException('Not found');
    return { country, config };
  }

  private async timeZone(country: string): Promise<string> {
    const configured = await this.deliveryConfigService.getTimezone(country).catch(() => null);
    return resolveTimeZone(configured, country);
  }

  private async loadLocation(locationId: string): Promise<LocationRow> {
    const res = await this.hasuraSystemService.executeQuery<{ business_locations_by_pk: LocationRow | null }>(
      DEDICATED_ASSIGNMENT_LOCATION_QUERY,
      { locationId }
    );
    const row = res?.business_locations_by_pk;
    if (!row) throw new NotFoundException('Location not found');
    return row;
  }

  private async loadAgent(agentId: string): Promise<AgentRow> {
    const res = await this.hasuraSystemService.executeQuery<{ agents_by_pk: AgentRow | null }>(
      DEDICATED_ASSIGN_AGENT_QUERY,
      { agentId }
    );
    if (!res?.agents_by_pk) throw new NotFoundException('Agent not found');
    return res.agents_by_pk;
  }

  private async agentForUser(userId: string): Promise<{ id: string; user_id: string } | null> {
    const res = await this.hasuraSystemService.executeQuery<{ agents: Array<{ id: string; user_id: string }> }>(
      DEDICATED_AGENT_BY_USER_QUERY,
      { userId }
    );
    return res?.agents?.[0] ?? null;
  }

  private async loadAssignment(id: string): Promise<AssignmentRow> {
    const res = await this.hasuraSystemService.executeQuery<{
      dedicated_agent_assignments_by_pk: AssignmentRow | null;
    }>(DEDICATED_ASSIGNMENT_BY_ID_QUERY, { id });
    const row = res?.dedicated_agent_assignments_by_pk;
    if (!row) throw new NotFoundException('Assignment not found');
    return row;
  }

  /** A business caller only sees assignments of the location in its path (404 otherwise). */
  private async loadScopedAssignment(actor: DedicatedActor, id: string): Promise<AssignmentRow> {
    const row = await this.loadAssignment(id);
    if (actor.locationId && row.business_location_id !== actor.locationId) {
      throw new NotFoundException('Assignment not found');
    }
    return row;
  }

  private async liveAssignmentsForLocation(locationId: string): Promise<AssignmentRow[]> {
    const res = await this.hasuraSystemService.executeQuery<{ dedicated_agent_assignments: AssignmentRow[] }>(
      DEDICATED_LOCATION_LIVE_ASSIGNMENTS_QUERY,
      { locationId }
    );
    return res?.dedicated_agent_assignments ?? [];
  }

  private async pickupSlotRows(locationId: string): Promise<PickupSlotRow[]> {
    const res = await this.hasuraSystemService.executeQuery<{ business_location_pickup_slots: PickupSlotRow[] }>(
      DEDICATED_LOCATION_PICKUP_SLOTS_QUERY,
      { locationId }
    );
    return res?.business_location_pickup_slots ?? [];
  }

  private async disabledSlots(locationId: string): Promise<Set<string>> {
    const rows = await this.pickupSlotRows(locationId);
    return new Set(rows.filter((r) => r.is_enabled === false).map((r) => r.slot_key));
  }

  private async loadAgentLoad(agentIds: string[], now: Date) {
    const res = await this.hasuraSystemService.executeQuery<{
      orders: Array<{ assigned_agent_id: string }>;
      order_offers: Array<{ agent_id: string }>;
    }>(DEDICATED_AGENT_LOAD_QUERY, {
      agentIds,
      activeStatuses: [...DEDICATED_ACTIVE_ORDER_STATUSES],
      now: now.toISOString(),
    });
    const active = new Map<string, number>();
    for (const o of res?.orders ?? []) active.set(o.assigned_agent_id, (active.get(o.assigned_agent_id) ?? 0) + 1);
    const offers = new Map<string, number>();
    for (const o of res?.order_offers ?? []) offers.set(o.agent_id, (offers.get(o.agent_id) ?? 0) + 1);
    return { active, offers };
  }

  private async loadCardStats(locationId: string, agentIds: string[]) {
    const res = await this.hasuraSystemService.executeQuery<{
      delivered: Array<{ assigned_agent_id: string }>;
      missed: Array<{ order: { assigned_agent_id: string | null } | null }>;
      recent: Array<{ subtotal: number | string | null }>;
    }>(DEDICATED_CARD_STATS_QUERY, { locationId, agentIds, doneStatuses: DONE_STATUSES });
    const delivered = new Map<string, number>();
    for (const o of res?.delivered ?? []) delivered.set(o.assigned_agent_id, (delivered.get(o.assigned_agent_id) ?? 0) + 1);
    const missed = new Map<string, number>();
    for (const f of res?.missed ?? []) {
      const id = f.order?.assigned_agent_id;
      if (id) missed.set(id, (missed.get(id) ?? 0) + 1);
    }
    const subtotals = (res?.recent ?? []).map((o) => Number(o.subtotal)).filter((n) => n > 0);
    const typicalSubtotal = subtotals.length ? subtotals.reduce((a, b) => a + b, 0) / subtotals.length : 0;
    return { delivered, missed, typicalSubtotal };
  }

  /** Read-only (no account creation), oldest active personal account in the market currency. */
  private async loadBalances(userIds: string[], country: string): Promise<Map<string, number>> {
    const balances = new Map<string, number>();
    if (userIds.length === 0) return balances;
    try {
      const currency = await this.deliveryConfigService.getCurrency(country);
      if (!currency) return balances;
      const res = await this.hasuraSystemService.executeQuery<{
        accounts: Array<{ user_id: string; available_balance: number | string | null }>;
      }>(DEDICATED_AGENT_BALANCES_QUERY, { userIds, currency });
      for (const a of res?.accounts ?? []) {
        if (!balances.has(a.user_id)) balances.set(a.user_id, Number(a.available_balance ?? 0));
      }
    } catch (error) {
      this.logger.warn(`Dedicated card balance lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return balances;
  }

  private async notifyBusinessAssigned(
    location: LocationRow,
    agent: AgentRow,
    slotKeys: DedicatedSlotKey[],
    assignmentId: string
  ): Promise<void> {
    const recipients = new Map<string, string | null>();
    if (location.business?.user_id) {
      recipients.set(location.business.user_id, location.business.user?.preferred_language ?? null);
    }
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
      this.logger.warn(`Dedicated notice delegate lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const agentName = fullName(agent.user) || 'Agent';
    for (const [userId, lang] of recipients) {
      const { title, body } = buildDedicatedAssignedBusinessMessage({ agentName, slotKeys, preferredLanguage: lang });
      await this.notifications.sendDedicatedAgentNotice({
        userId,
        title,
        body,
        messageType: DEDICATED_NOTICE_MESSAGE_TYPES.assigned,
        assignmentId,
        path: DEDICATED_BUSINESS_NOTICE_PATH(location.id),
        event: 'dedicated_agent_assigned',
        persona: 'business',
        locationId: location.id,
      });
    }
  }

  private async notifyAgentForRow(event: DedicatedNoticeEvent, row: AssignmentRow): Promise<void> {
    await this.notifyAgent(event, {
      userId: row.agent?.user_id ?? null,
      preferredLanguage: row.agent?.user?.preferred_language,
      storeName: row.business_location?.name ?? '',
      slotKeys: [row.slot_key],
      assignmentId: row.id,
      locationId: row.business_location_id,
    });
  }

  private async notifyAgent(
    event: DedicatedNoticeEvent,
    params: {
      userId: string | null;
      preferredLanguage?: string | null;
      storeName: string;
      slotKeys: DedicatedSlotKey[];
      assignmentId: string;
      locationId: string;
    }
  ): Promise<void> {
    if (!params.userId) return;
    const { title, body } = buildDedicatedAgentMessage({
      event,
      storeName: params.storeName,
      slotKeys: params.slotKeys,
      preferredLanguage: params.preferredLanguage,
    });
    await this.notifications.sendDedicatedAgentNotice({
      userId: params.userId,
      title,
      body,
      messageType: DEDICATED_NOTICE_MESSAGE_TYPES[event],
      assignmentId: params.assignmentId,
      path: DEDICATED_AGENT_NOTICE_PATH,
      event: `dedicated_agent_${event}`,
      persona: 'agent',
      locationId: params.locationId,
    });
  }
}
