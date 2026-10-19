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
      reason:
        | 'flag_off'
        | 'not_covered'
        | 'not_confirmed'
        | 'not_live'
        | 'no_slot'
        | 'stale'
        | 'not_leader'
        | 'no_agents';
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

const DEDUPE_QUERY = `
  query DedicatedSlotReminderDedupe($keys: [String!]!) {
    notification_events(where: { dedupe_key: { _in: $keys } }) {
      dedupe_key
    }
  }
`;

const RECORD_DEDUPE_MUTATION = `
  mutation RecordDedicatedSlotReminder($object: notification_events_insert_input!) {
    insert_notification_events_one(object: $object) {
      id
    }
  }
`;

/**
 * #594 PR 6 (AC-A8): day-of reminder at slot start - `dedicated_slot_reminder_minutes`
 * (30) in the country timezone, to each agent on duty for the slot at the
 * store: "{{n}} scheduled orders at {{store}} · pickup {{time}}". Every order
 * placed on dedicated coverage schedules one wait-and-execute callback at
 * create; at send time the order with the smallest id among the slot's live,
 * confirmed orders sends for all of them (the others skip), and a per-agent
 * dedupe key in notification_events stops a repeated callback. Behind the flag.
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
    if (!ctx.confirmed) return { kind: 'skipped', reason: 'not_confirmed' };
    if (!(SLOT_REMINDER_ORDER_STATUSES as readonly string[]).includes(order.current_status)) {
      return { kind: 'skipped', reason: 'not_live' };
    }
    // A window moved since scheduling (or a late retry): this callback is not the reminder.
    if (
      now.getTime() < reminderAt.getTime() - EARLY_SLACK_SECONDS * 1000 ||
      now.getTime() >= slotStart.getTime()
    ) {
      return { kind: 'skipped', reason: 'stale' };
    }
    const group = await this.loadGroup(order.business_location_id, slot);
    if (group[0]?.id !== order.id) return { kind: 'skipped', reason: 'not_leader' };

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
        dedupeKey: `dedicated.slot_reminder:${order.business_location_id}:${slot.slotKey}:${slot.date}:${a.userId}`,
      }))
      .filter((a) => a.orderCount > 0);
    if (targets.length === 0) return { kind: 'skipped', reason: 'no_agents' };

    const [sent, locales, pickupTime] = await Promise.all([
      this.alreadySent(targets.map((t) => t.dedupeKey)),
      this.loadLocales(targets.map((t) => t.userId)),
      this.pickupTime(order.business_location_id, slot),
    ]);
    const storeName = order.business_location?.name || order.business?.name || '';
    let recipients = 0;
    for (const t of targets) {
      if (sent.has(t.dedupeKey)) continue;
      const msg = buildDedicatedSlotReminderMessage({
        orderCount: t.orderCount,
        storeName,
        pickupTime,
        slotKey: slot.slotKey,
        preferredLanguage: locales.get(t.userId) ?? null,
      });
      await this.recordSent(t.dedupeKey, t.userId, t.assignmentId);
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
        /** Scheduling happens at create, before confirmation; sending needs it (PE). */
        confirmed: boolean;
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
    return { order, slot, reminderAt, slotStart, config, confirmed: window.is_confirmed === true };
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

  private async alreadySent(keys: string[]): Promise<Set<string>> {
    const res = await this.hasuraSystemService.executeQuery<{
      notification_events: Array<{ dedupe_key: string | null }>;
    }>(DEDUPE_QUERY, { keys });
    return new Set((res?.notification_events ?? []).map((r) => r.dedupe_key as string));
  }

  private async recordSent(dedupeKey: string, userId: string, assignmentId: string): Promise<void> {
    await this.hasuraSystemService.executeMutation(RECORD_DEDUPE_MUTATION, {
      object: {
        notification_type: 'dedicated.slot_reminder',
        category: 'actionable',
        user_id: userId,
        channel: 'push',
        status: 'sent',
        dedupe_key: dedupeKey,
        entity_type: 'dedicated_agent_assignment',
        entity_id: assignmentId,
      },
    });
  }
}
