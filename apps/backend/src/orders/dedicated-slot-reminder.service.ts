import { Injectable, Logger, Optional } from '@nestjs/common';
import { DateTime } from 'luxon';
import { DedicatedAgentsConfigService } from '../dedicated-agents/dedicated-agents-config.service';
import { DEDICATED_AGENT_NOTICE_PATH } from '../dedicated-agents/dedicated-agents.constants';
import { DEDICATED_LOCATION_PICKUP_SLOTS_QUERY } from '../dedicated-agents/dedicated-assignments.queries';
import {
  DedicatedCoverageService,
  type ResolvedDedicatedSlot,
} from '../dedicated-agents/dedicated-coverage.service';
import { defaultPickupTime, shortTime } from '../dedicated-agents/dedicated-slot.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  buildDedicatedSlotReminderMessage,
  DEDICATED_SLOT_REMINDER_MESSAGE_TYPE,
} from '../notifications/dedicated-order-push.messages';
import { NotificationsService } from '../notifications/notifications.service';
import { emitServerSiteEvent } from '../site-events/server-site-events.helper';
import { SiteEventsService } from '../site-events/site-events.service';
import { isoCountryCode } from './delivery-pricing.util';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

/** Orders still waiting for (or holding) their agent: the ones a reminder counts. */
export const SLOT_REMINDER_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
] as const;

/** A callback this much before its reminder time still counts (SFN timing slack). */
const EARLY_SLACK_SECONDS = 120;

export type SlotReminderOutcome =
  | { kind: 'sent'; recipients: number }
  | {
      kind: 'skipped';
      reason: 'flag_off' | 'not_covered' | 'no_slot' | 'stale' | 'no_orders' | 'no_agents';
    };

interface ReminderOrder {
  id: string;
  current_status: string;
  business_location_id: string;
  fulfillment_timing: string | null;
  coverage_slot_key: string | null;
  business?: { name?: string | null } | null;
  business_location?: { name?: string | null; address?: { country?: string | null } | null } | null;
  delivery_time_windows?: Array<{
    slot_id: string | null;
    preferred_date: string | null;
    is_confirmed: boolean | null;
  }>;
}

const REMINDER_ORDER_QUERY = `
  query DedicatedSlotReminderOrder($orderId: uuid!) {
    orders_by_pk(id: $orderId) {
      id
      current_status
      business_location_id
      fulfillment_timing
      coverage_slot_key
      business { name }
      business_location { name address { country } }
      delivery_time_windows(order_by: { created_at: desc }, limit: 1) {
        slot_id
        preferred_date
        is_confirmed
      }
    }
  }
`;

/** Every confirmed, live order placed on dedicated coverage for the location-slot-date. */
const REMINDER_GROUP_QUERY = `
  query DedicatedSlotReminderGroup(
    $locationId: uuid!
    $slotKey: String!
    $date: date!
    $statuses: [order_status!]!
  ) {
    orders(
      where: {
        business_location_id: { _eq: $locationId }
        coverage_slot_key: { _eq: $slotKey }
        fulfillment_timing: { _eq: "scheduled" }
        current_status: { _in: $statuses }
        delivery_time_windows: { preferred_date: { _eq: $date }, is_confirmed: { _eq: true } }
      }
    ) {
      id
      assigned_agent_id
    }
  }
`;

const RECIPIENT_LOCALES_QUERY = `
  query DedicatedSlotReminderLocales($userIds: [uuid!]!) {
    users(where: { id: { _in: $userIds } }) {
      id
      preferred_language
    }
  }
`;

/** Primary key of dedicated_slot_reminder_sends (location, slot, date, agent): the idempotency key. */
export const SLOT_REMINDER_SENDS_PKEY = 'dedicated_slot_reminder_sends_pkey';

/** Returns null when this agent already got the slot's reminder (primary key conflict). */
const CLAIM_SEND_MUTATION = `
  mutation ClaimDedicatedSlotReminder($object: dedicated_slot_reminder_sends_insert_input!) {
    insert_dedicated_slot_reminder_sends_one(
      object: $object
      on_conflict: { constraint: ${SLOT_REMINDER_SENDS_PKEY}, update_columns: [] }
    ) {
      agent_id
    }
  }
`;

/**
 * #594 PR 6 (AC-A8): day-of reminder at slot start - `dedicated_slot_reminder_minutes`
 * (30) in the country timezone, to each agent on duty for the slot at the
 * store: "{{n}} scheduled orders at {{store}} · pickup {{time}}". Every order
 * placed on dedicated coverage schedules its own wait-and-execute callback at
 * create, and any of those callbacks sends for the whole slot (its live,
 * confirmed orders), whatever the triggering order's own state. The send is
 * idempotent per agent and slot: a row in dedicated_slot_reminder_sends is
 * claimed (insert on the primary key, on conflict nothing) before the push.
 * So one failed schedule doesn't drop the group's reminder: the next order
 * created in the group schedules a callback that covers it, and concurrent or
 * repeated callbacks still send once. Behind the flag.
 */
@Injectable()
export class DedicatedSlotReminderService {
  private readonly logger = new Logger(DedicatedSlotReminderService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly dedicatedConfig: DedicatedAgentsConfigService,
    private readonly coverage: DedicatedCoverageService,
    private readonly notificationsService: NotificationsService,
    private readonly waitAndExecuteScheduleService: WaitAndExecuteScheduleService,
    @Optional()
    private readonly siteEventsService?: SiteEventsService
  ) {}

  /** At order create (orders placed on dedicated coverage only). Never throws. */
  async scheduleForOrder(orderId: string, now: Date = new Date()): Promise<void> {
    try {
      const ctx = await this.loadContext(orderId);
      if ('skip' in ctx) return;
      const waitSeconds = Math.floor((ctx.reminderAt.getTime() - now.getTime()) / 1000);
      // Too late for a heads-up: dispatch reaches the agent at about the same time.
      if (waitSeconds <= 0) return;
      await this.waitAndExecuteScheduleService.scheduleDedicatedSlotReminder(orderId, waitSeconds);
    } catch (error: unknown) {
      this.logger.warn(
        `Dedicated slot reminder not scheduled for ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** The wait-and-execute callback. */
  async sendForOrder(orderId: string, now: Date = new Date()): Promise<SlotReminderOutcome> {
    const ctx = await this.loadContext(orderId);
    if ('skip' in ctx) return { kind: 'skipped', reason: ctx.skip };
    const { order, slot, reminderAt, slotStart, config } = ctx;
    // The triggering order only names the slot: it may be cancelled or
    // unconfirmed by now, and the slot's other orders still get their reminder.
    // A window moved since scheduling (or a late retry): this callback is not the reminder.
    if (
      now.getTime() < reminderAt.getTime() - EARLY_SLACK_SECONDS * 1000 ||
      now.getTime() >= slotStart.getTime()
    ) {
      return { kind: 'skipped', reason: 'stale' };
    }
    const group = await this.loadGroup(order.business_location_id, slot);
    if (group.length === 0) return { kind: 'skipped', reason: 'no_orders' };

    const agents = await this.coverage.onDutyAgents({
      locationId: order.business_location_id,
      slotKey: slot.slotKey,
      date: slot.date,
    });
    const targets = agents
      .map((a) => ({
        ...a,
        // Orders already with another agent aren't this agent's to collect.
        orderCount: group.filter((o) => !o.assigned_agent_id || o.assigned_agent_id === a.agentId).length,
      }))
      .filter((a) => a.orderCount > 0);
    if (targets.length === 0) return { kind: 'skipped', reason: 'no_agents' };

    const [locales, pickupTime] = await Promise.all([
      this.loadLocales(targets.map((t) => t.userId)),
      this.pickupTime(order.business_location_id, slot),
    ]);
    const storeName = order.business_location?.name || order.business?.name || '';
    let recipients = 0;
    for (const t of targets) {
      const msg = buildDedicatedSlotReminderMessage({
        orderCount: t.orderCount,
        storeName,
        pickupTime,
        slotKey: slot.slotKey,
        preferredLanguage: locales.get(t.userId) ?? null,
      });
      // Claim before the push: at most one reminder per agent and slot.
      if (!(await this.claimSend(order, slot, t))) continue;
      await this.notificationsService.sendDedicatedAgentNotice({
        userId: t.userId,
        title: msg.title,
        body: msg.body,
        messageType: DEDICATED_SLOT_REMINDER_MESSAGE_TYPE,
        assignmentId: t.assignmentId,
        path: DEDICATED_AGENT_NOTICE_PATH,
        event: 'dedicated.slot_reminder',
        persona: 'agent',
        locationId: order.business_location_id,
      });
      emitServerSiteEvent(this.siteEventsService, 'dedicated.slot_reminder_sent', {
        orderId: order.id,
        agentId: t.agentId,
        assignmentId: t.assignmentId,
        businessLocationId: order.business_location_id,
        slotKey: slot.slotKey,
        slotDate: slot.date,
        orderCount: t.orderCount,
        reminderMinutes: config.slotReminderMinutes,
      });
      recipients += 1;
    }
    return { kind: 'sent', recipients };
  }

  private async loadContext(orderId: string): Promise<
    | { skip: 'flag_off' | 'not_covered' | 'no_slot' }
    | {
        order: ReminderOrder;
        slot: ResolvedDedicatedSlot;
        reminderAt: Date;
        slotStart: Date;
        config: { slotReminderMinutes: number };
      }
  > {
    const res = await this.hasuraSystemService.executeQuery<{ orders_by_pk: ReminderOrder | null }>(
      REMINDER_ORDER_QUERY,
      { orderId }
    );
    const order = res?.orders_by_pk;
    const window = order?.delivery_time_windows?.[0];
    if (!order?.coverage_slot_key || order.fulfillment_timing !== 'scheduled') return { skip: 'not_covered' };
    if (!window?.slot_id || !window.preferred_date) return { skip: 'not_covered' };
    const country = isoCountryCode(order.business_location?.address?.country);
    if (!(await this.dedicatedConfig.isEnabled(country))) return { skip: 'flag_off' };
    const slot = await this.coverage.resolveSlot({
      locationId: order.business_location_id,
      preferredDate: window.preferred_date,
      slotId: window.slot_id,
    });
    if (!slot) return { skip: 'no_slot' };
    const config = await this.dedicatedConfig.getConfig(country);
    const start = DateTime.fromISO(`${slot.date}T${shortTime(slot.startTime)}`, { zone: slot.timeZone });
    const slotStart = start.toJSDate();
    const reminderAt = start.minus({ minutes: config.slotReminderMinutes }).toJSDate();
    return { order, slot, reminderAt, slotStart, config };
  }

  private async loadGroup(
    locationId: string,
    slot: ResolvedDedicatedSlot
  ): Promise<Array<{ id: string; assigned_agent_id: string | null }>> {
    const res = await this.hasuraSystemService.executeQuery<{
      orders: Array<{ id: string; assigned_agent_id: string | null }>;
    }>(REMINDER_GROUP_QUERY, {
      locationId,
      slotKey: slot.slotKey,
      date: slot.date,
      statuses: [...SLOT_REMINDER_ORDER_STATUSES],
    });
    return [...(res?.orders ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  private async pickupTime(locationId: string, slot: ResolvedDedicatedSlot): Promise<string> {
    try {
      const res = await this.hasuraSystemService.executeQuery<{
        business_location_pickup_slots: Array<{ slot_key: string; pickup_time: string | null }>;
      }>(DEDICATED_LOCATION_PICKUP_SLOTS_QUERY, { locationId });
      const custom = res?.business_location_pickup_slots?.find((r) => r.slot_key === slot.slotKey)?.pickup_time;
      if (custom) return shortTime(custom);
    } catch (error: unknown) {
      this.logger.warn(
        `Pickup time lookup failed for ${locationId}; slot default used: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return defaultPickupTime({ startTime: slot.startTime, endTime: slot.endTime });
  }

  private async loadLocales(userIds: string[]): Promise<Map<string, string | null>> {
    try {
      const res = await this.hasuraSystemService.executeQuery<{
        users: Array<{ id: string; preferred_language: string | null }>;
      }>(RECIPIENT_LOCALES_QUERY, { userIds });
      return new Map((res?.users ?? []).map((u) => [u.id, u.preferred_language]));
    } catch {
      return new Map();
    }
  }

  private async claimSend(
    order: ReminderOrder,
    slot: ResolvedDedicatedSlot,
    target: { agentId: string; assignmentId: string; orderCount: number }
  ): Promise<boolean> {
    try {
      const res = await this.hasuraSystemService.executeMutation<{
        insert_dedicated_slot_reminder_sends_one: { agent_id: string } | null;
      }>(CLAIM_SEND_MUTATION, {
        object: {
          business_location_id: order.business_location_id,
          slot_key: slot.slotKey,
          slot_date: slot.date,
          agent_id: target.agentId,
          assignment_id: target.assignmentId,
          trigger_order_id: order.id,
          order_count: target.orderCount,
        },
      });
      return !!res?.insert_dedicated_slot_reminder_sends_one;
    } catch (error: unknown) {
      this.logger.warn(
        `Dedicated slot reminder claim failed for agent ${target.agentId} (${slot.slotKey} ${slot.date}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }
}
