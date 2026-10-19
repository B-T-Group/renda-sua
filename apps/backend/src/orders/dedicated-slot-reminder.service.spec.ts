import type { AgentContractGateService } from '../agent-contracts/agent-contract-gate.service';
import type { AgentHoldService } from '../agents/agent-hold.service';
import { DedicatedAgentsConfigService } from '../dedicated-agents/dedicated-agents-config.service';
import { DedicatedCoverageService } from '../dedicated-agents/dedicated-coverage.service';
import type { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { SiteEventsService } from '../site-events/site-events.service';
import { DedicatedSlotReminderService } from './dedicated-slot-reminder.service';
import type { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

const LOCATION = 'loc-ga';
const NOW = new Date('2026-10-18T09:00:00Z'); // 10:00 in Libreville (UTC+1)
const DATE = '2026-10-19';
/** Afternoon starts 12:00 Libreville = 11:00Z; the reminder is 30 min earlier. */
const REMINDER_AT = new Date('2026-10-19T10:30:00Z');

type Vars = Record<string, unknown>;

interface OrderRow {
  id: string;
  current_status: string;
  business_location_id: string;
  fulfillment_timing: string | null;
  coverage_slot_key: string | null;
  assigned_agent_id: string | null;
  window: { slot_id: string; preferred_date: string; is_confirmed: boolean | null } | null;
}

/** In-memory Hasura for the reminder and the real PR 2 coverage queries (Gabon, Africa/Libreville). */
function world() {
  const state = {
    flag: true,
    reminderMinutes: null as number | null,
    orders: new Map<string, OrderRow>(),
    agents: new Map<string, { id: string; user_id: string; is_verified: boolean; is_internal: boolean; status: string; focus: string; preferred_language: string | null }>(),
    assignments: [] as Array<{ id: string; agent_id: string; slot_key: string; status: string; off_today_date: string | null }>,
    pickupSlots: [] as Array<{ slot_key: string; is_enabled: boolean; pickup_time: string | null }>,
    unsigned: new Set<string>(),
    sends: [] as Array<{ business_location_id: string; slot_key: string; slot_date: string; agent_id: string; order_count: number; trigger_order_id: string }>,
    claimFailsFor: new Set<string>(),
    mutations: [] as string[],
  };
  const op = (q: string) => /(?:query|mutation) (\w+)/.exec(q)?.[1] ?? '?';
  const executeQuery = jest.fn(async (query: string, vars: Vars) => {
    switch (op(query)) {
      case 'DedicatedSlotReminderOrder': {
        const o = state.orders.get(String(vars.orderId));
        if (!o) return { orders_by_pk: null };
        const { window, assigned_agent_id: _a, ...rest } = o;
        void _a;
        return {
          orders_by_pk: {
            ...rest,
            business: { name: 'Chez Mama' },
            business_location: { name: 'Chez Mama Louis', address: { country: 'GA' } },
            delivery_time_windows: window ? [window] : [],
          },
        };
      }
      case 'DedicatedSlotReminderGroup':
        return {
          orders: [...state.orders.values()]
            .filter(
              (o) =>
                o.business_location_id === vars.locationId &&
                o.coverage_slot_key === vars.slotKey &&
                o.fulfillment_timing === 'scheduled' &&
                (vars.statuses as string[]).includes(o.current_status) &&
                o.window?.preferred_date === vars.date &&
                // Read from the query text, so the real where clause is what's tested.
                (!query.includes('is_confirmed: { _eq: true }') || o.window?.is_confirmed === true)
            )
            // Hasura returns rows in no particular order: the service must pick the leader itself.
            .reverse()
            .map((o) => ({ id: o.id, assigned_agent_id: o.assigned_agent_id })),
        };
      case 'DedicatedAgentsConfig':
        return {
          application_configurations: [
            { config_key: 'dedicated_agents_enabled', boolean_value: state.flag, number_value: null, country_code: null },
            ...(state.reminderMinutes == null
              ? []
              : [{ config_key: 'dedicated_slot_reminder_minutes', boolean_value: null, number_value: state.reminderMinutes, country_code: 'GA' }]),
          ],
        };
      case 'DedicatedLocationContext':
        return {
          business_locations_by_pk: {
            id: LOCATION,
            address: { country: 'ga', state: 'Estuaire' },
            pickup_slots: state.pickupSlots.map(({ slot_key, is_enabled }) => ({ slot_key, is_enabled })),
          },
        };
      case 'DedicatedDeliverySlots':
        return {
          delivery_time_slots: [
            { id: 'ga-m', state: 'Estuaire', slot_name: 'Morning', slot_type: 'standard', start_time: '08:00:00', end_time: '12:00:00' },
            { id: 'ga-a', state: 'Estuaire', slot_name: 'Afternoon', slot_type: 'standard', start_time: '12:00:00', end_time: '16:00:00' },
          ],
        };
      case 'DedicatedSlotAssignments':
        return {
          dedicated_agent_assignments: state.assignments
            .filter((a) => a.slot_key === vars.slotKey && a.status === 'active')
            .map((a) => ({ ...a, agent: state.agents.get(a.agent_id) ?? null })),
        };
      case 'DedicatedSlotReminderLocales':
        return {
          users: [...state.agents.values()]
            .filter((a) => (vars.userIds as string[]).includes(a.user_id))
            .map((a) => ({ id: a.user_id, preferred_language: a.preferred_language })),
        };
      case 'DedicatedLocationPickupSlots':
        return { business_location_pickup_slots: state.pickupSlots };
      default:
        throw new Error(`unexpected query ${op(query)}`);
    }
  });
  const executeMutation = jest.fn(async (mutation: string, vars: Vars) => {
    const name = op(mutation);
    state.mutations.push(name);
    if (name === 'ClaimDedicatedSlotReminder') {
      // Primary key (location, slot, date, agent); the insert yields nothing on a conflict
      // only when the mutation asks for it (on_conflict on the pkey), else Postgres errors.
      const o = vars.object as (typeof state.sends)[number];
      if (state.claimFailsFor.has(o.agent_id)) throw new Error('hasura down');
      const dup = state.sends.some(
        (r) =>
          r.business_location_id === o.business_location_id &&
          r.slot_key === o.slot_key &&
          r.slot_date === o.slot_date &&
          r.agent_id === o.agent_id
      );
      if (dup) {
        if (!mutation.includes('constraint: dedicated_slot_reminder_sends_pkey, update_columns: []')) {
          throw new Error('duplicate key value violates unique constraint "dedicated_slot_reminder_sends_pkey"');
        }
        return { insert_dedicated_slot_reminder_sends_one: null };
      }
      state.sends.push({ ...o });
      return { insert_dedicated_slot_reminder_sends_one: { agent_id: o.agent_id } };
    }
    if (name === 'UnclaimDedicatedSlotReminder') {
      const before = state.sends.length;
      state.sends = state.sends.filter(
        (r) =>
          !(
            r.business_location_id === vars.locationId &&
            r.slot_key === vars.slotKey &&
            r.slot_date === vars.slotDate &&
            r.agent_id === vars.agentId
          )
      );
      return { delete_dedicated_slot_reminder_sends_by_pk: before > state.sends.length ? { agent_id: vars.agentId } : null };
    }
    throw new Error(`unexpected mutation ${name}`);
  });
  const hasura = { executeQuery, executeMutation } as unknown as HasuraSystemService;
  const deliveryConfig = { getTimezone: jest.fn().mockResolvedValue('Africa/Libreville') };
  const gate = { signedIdsOrSkip: jest.fn(async (ids: string[]) => new Set(ids.filter((id) => !state.unsigned.has(id)))) };
  const dedicatedConfig = new DedicatedAgentsConfigService(hasura);
  const coverage = new DedicatedCoverageService(
    hasura,
    dedicatedConfig,
    {} as AgentHoldService,
    gate as unknown as AgentContractGateService,
    deliveryConfig as unknown as DeliveryConfigService
  );
  const notifications = { sendDedicatedAgentNotice: jest.fn().mockResolvedValue(true) };
  const schedule = { scheduleDedicatedSlotReminder: jest.fn().mockResolvedValue(undefined) };
  const siteEvents = { trackEvent: jest.fn().mockResolvedValue(undefined) };
  const service = new DedicatedSlotReminderService(
    hasura,
    dedicatedConfig,
    coverage,
    notifications as unknown as NotificationsService,
    schedule as unknown as WaitAndExecuteScheduleService,
    siteEvents as unknown as SiteEventsService
  );

  const addOrder = (id: string, over: Partial<OrderRow> = {}) =>
    state.orders.set(id, {
      id,
      current_status: 'ready_for_pickup',
      business_location_id: LOCATION,
      fulfillment_timing: 'scheduled',
      coverage_slot_key: 'afternoon',
      assigned_agent_id: null,
      window: { slot_id: 'ga-a', preferred_date: DATE, is_confirmed: true },
      ...over,
    });
  const addAgent = (id: string, over: { locale?: string | null; offToday?: string | null; status?: string; slot?: string } = {}) => {
    state.agents.set(id, {
      id,
      user_id: `u-${id}`,
      is_verified: true,
      is_internal: true,
      status: over.status ?? 'active',
      focus: 'delivery',
      preferred_language: over.locale === undefined ? 'en' : over.locale,
    });
    state.assignments.push({ id: `as-${id}`, agent_id: id, slot_key: over.slot ?? 'afternoon', status: 'active', off_today_date: over.offToday ?? null });
  };
  const notices = () => notifications.sendDedicatedAgentNotice.mock.calls.map((c) => c[0]);
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const events = (type: string) =>
    siteEvents.trackEvent.mock.calls
      .map((c) => c[0] as { eventType: string; metadata: Record<string, unknown> })
      .filter((e) => e.eventType === type)
      .map((e) => e.metadata);
  return { state, service, coverage, schedule, notifications, addOrder, addAgent, notices, flush, events };
}

describe('#594 PR 6 (AC-A8) DedicatedSlotReminderService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  describe('scheduleForOrder (at create)', () => {
    it('schedules at slot start - 30 min in the country timezone (Africa/Libreville)', async () => {
      const w = world();
      w.addOrder('o-a', { window: { slot_id: 'ga-a', preferred_date: DATE, is_confirmed: false } });
      await w.service.scheduleForOrder('o-a');
      // 2026-10-19 11:30 Libreville = 10:30Z; 25.5 h after 09:00Z the day before.
      expect(w.schedule.scheduleDedicatedSlotReminder).toHaveBeenCalledWith('o-a', 91_800);
      expect((REMINDER_AT.getTime() - NOW.getTime()) / 1000).toBe(91_800);
    });

    it('uses dedicated_slot_reminder_minutes', async () => {
      const w = world();
      w.state.reminderMinutes = 45;
      w.addOrder('o-a');
      await w.service.scheduleForOrder('o-a');
      expect(w.schedule.scheduleDedicatedSlotReminder).toHaveBeenCalledWith('o-a', 91_800 - 15 * 60);
    });

    it('a reminder time already past is not scheduled', async () => {
      const w = world();
      w.addOrder('o-a', { window: { slot_id: 'ga-a', preferred_date: '2026-10-18', is_confirmed: true } });
      // Today's afternoon reminder (10:30Z) is 1.5 h away: still scheduled ...
      await w.service.scheduleForOrder('o-a');
      expect(w.schedule.scheduleDedicatedSlotReminder).toHaveBeenCalledWith('o-a', 5_400);
      // ... but not once it has passed.
      w.schedule.scheduleDedicatedSlotReminder.mockClear();
      await w.service.scheduleForOrder('o-a', new Date('2026-10-18T10:30:00Z'));
      expect(w.schedule.scheduleDedicatedSlotReminder).not.toHaveBeenCalled();
    });

    it('nothing for an order without coverage_slot_key, with the flag off, or an unknown slot; never throws', async () => {
      const w = world();
      w.addOrder('o-plain', { coverage_slot_key: null });
      w.addOrder('o-asap', { fulfillment_timing: 'asap' });
      w.addOrder('o-noslot', { window: { slot_id: 'unknown', preferred_date: DATE, is_confirmed: true } });
      await w.service.scheduleForOrder('o-plain');
      await w.service.scheduleForOrder('o-asap');
      await w.service.scheduleForOrder('o-noslot');
      await w.service.scheduleForOrder('missing');
      w.state.flag = false;
      jest.setSystemTime(new Date(NOW.getTime() + 31_000));
      w.addOrder('o-a');
      await w.service.scheduleForOrder('o-a');
      expect(w.schedule.scheduleDedicatedSlotReminder).not.toHaveBeenCalled();
      w.schedule.scheduleDedicatedSlotReminder.mockRejectedValueOnce(new Error('sfn down'));
      w.state.flag = true;
      jest.setSystemTime(new Date(NOW.getTime() + 62_000));
      await expect(w.service.scheduleForOrder('o-a')).resolves.toBeUndefined();
    });
  });

  describe('sendForOrder (the callback)', () => {
    it('two orders in the slot: one reminder per on-duty agent with n=2, sent once', async () => {
      const w = world();
      w.addOrder('o-a');
      w.addOrder('o-b');
      w.addAgent('amy');
      w.addAgent('off', { offToday: DATE });
      w.addAgent('sus', { status: 'suspended' });
      w.addAgent('mor', { slot: 'morning' });
      await expect(w.service.sendForOrder('o-a', REMINDER_AT)).resolves.toEqual({ kind: 'sent', recipients: 1 });
      expect(w.notices()).toEqual([
        {
          userId: 'u-amy',
          title: 'Dedicated slot soon (Afternoon)',
          body: '2 scheduled orders at Chez Mama Louis · pickup 12:30',
          messageType: 'DEDICATED_SLOT_REMINDER',
          assignmentId: 'as-amy',
          path: '/agent/dedicated-assignments',
          event: 'dedicated.slot_reminder',
          persona: 'agent',
          locationId: LOCATION,
        },
      ]);
      // The other order's callback, and a repeat of this one, send nothing more.
      await expect(w.service.sendForOrder('o-b', REMINDER_AT)).resolves.toEqual({ kind: 'sent', recipients: 0 });
      await expect(w.service.sendForOrder('o-a', REMINDER_AT)).resolves.toEqual({ kind: 'sent', recipients: 0 });
      expect(w.notices()).toHaveLength(1);
      expect(w.state.sends).toEqual([
        {
          business_location_id: LOCATION,
          slot_key: 'afternoon',
          slot_date: DATE,
          agent_id: 'amy',
          assignment_id: 'as-amy',
          trigger_order_id: 'o-a',
          order_count: 2,
        },
      ]);
      await w.flush();
      expect(w.events('dedicated.slot_reminder_sent')).toEqual([
        expect.objectContaining({ agentId: 'amy', orderCount: 2, slotKey: 'afternoon', slotDate: DATE, reminderMinutes: 30 }),
      ]);
    });

    it('both orders cancelled: no reminder', async () => {
      const w = world();
      w.addOrder('o-a', { current_status: 'cancelled' });
      w.addOrder('o-b', { current_status: 'cancelled' });
      w.addAgent('amy');
      await expect(w.service.sendForOrder('o-a', REMINDER_AT)).resolves.toEqual({ kind: 'skipped', reason: 'no_orders' });
      await expect(w.service.sendForOrder('o-b', REMINDER_AT)).resolves.toEqual({ kind: 'skipped', reason: 'no_orders' });
      expect(w.notices()).toEqual([]);
    });

    it("a cancelled order's callback still reminds for the slot's other orders (singular copy, French agent)", async () => {
      const w = world();
      w.addOrder('o-a', { current_status: 'cancelled' });
      w.addOrder('o-b');
      w.addAgent('amy', { locale: 'fr' });
      // Only o-a's schedule may have succeeded: its callback covers o-b.
      await expect(w.service.sendForOrder('o-a', REMINDER_AT)).resolves.toEqual({ kind: 'sent', recipients: 1 });
      expect(w.notices()[0]).toMatchObject({
        title: 'Créneau dédié bientôt (Après-midi)',
        body: '1 commande programmée chez Chez Mama Louis · collecte à 12:30',
      });
    });

    it("counts only unassigned orders and the agent's own; uses the business pickup time", async () => {
      const w = world();
      w.addOrder('o-a', { assigned_agent_id: 'bob', current_status: 'assigned_to_agent' });
      w.addOrder('o-b');
      w.addOrder('o-c', { assigned_agent_id: 'amy', current_status: 'assigned_to_agent' });
      w.addAgent('amy');
      w.addAgent('bob');
      w.state.pickupSlots = [{ slot_key: 'afternoon', is_enabled: true, pickup_time: '13:15:00' }];
      await w.service.sendForOrder('o-a', REMINDER_AT);
      const byUser = Object.fromEntries(w.notices().map((n) => [n.userId, n.body]));
      expect(byUser).toEqual({
        'u-amy': '2 scheduled orders at Chez Mama Louis · pickup 13:15',
        'u-bob': '2 scheduled orders at Chez Mama Louis · pickup 13:15',
      });
    });

    it("an agent with none of the slot's orders to collect gets nothing", async () => {
      const w = world();
      w.addOrder('o-a', { assigned_agent_id: 'bob', current_status: 'assigned_to_agent' });
      w.addAgent('amy');
      w.addAgent('bob');
      await w.service.sendForOrder('o-a', REMINDER_AT);
      expect(w.notices().map((n) => n.userId)).toEqual(['u-bob']);
    });

    it('unconfirmed windows are not counted; an unconfirmed order\'s callback still covers the confirmed ones', async () => {
      const w = world();
      w.addOrder('o-a', { window: { slot_id: 'ga-a', preferred_date: DATE, is_confirmed: false } });
      w.addOrder('o-b');
      w.addOrder('o-c', { window: { slot_id: 'ga-a', preferred_date: DATE, is_confirmed: null } });
      w.addAgent('amy');
      await w.service.sendForOrder('o-a', REMINDER_AT);
      expect(w.notices().map((n) => n.body)).toEqual(['1 scheduled order at Chez Mama Louis · pickup 12:30']);
    });

    it('only unconfirmed orders: nothing to remind', async () => {
      const w = world();
      w.addOrder('o-a', { window: { slot_id: 'ga-a', preferred_date: DATE, is_confirmed: false } });
      w.addAgent('amy');
      await expect(w.service.sendForOrder('o-a', REMINDER_AT)).resolves.toEqual({ kind: 'skipped', reason: 'no_orders' });
      expect(w.notices()).toEqual([]);
    });

    it('PE gap: the first order\'s schedule failed; the next order created in the slot schedules a callback that covers both', async () => {
      const w = world();
      w.addAgent('amy');
      w.addOrder('o-a');
      w.schedule.scheduleDedicatedSlotReminder.mockRejectedValueOnce(new Error('sfn throttled'));
      await w.service.scheduleForOrder('o-a');
      w.addOrder('o-b');
      await w.service.scheduleForOrder('o-b');
      expect(w.schedule.scheduleDedicatedSlotReminder.mock.calls).toEqual([
        ['o-a', 91_800],
        ['o-b', 91_800],
      ]);
      // Only o-b's callback ever fires.
      await expect(w.service.sendForOrder('o-b', REMINDER_AT)).resolves.toEqual({ kind: 'sent', recipients: 1 });
      expect(w.notices().map((n) => n.body)).toEqual(['2 scheduled orders at Chez Mama Louis · pickup 12:30']);
    });

    it('concurrent callbacks for the same slot send once per agent', async () => {
      const w = world();
      w.addOrder('o-a');
      w.addOrder('o-b');
      w.addOrder('o-c');
      w.addAgent('amy');
      w.addAgent('bob');
      const out = await Promise.all(['o-a', 'o-b', 'o-c'].map((id) => w.service.sendForOrder(id, REMINDER_AT)));
      expect(out.reduce((n, o) => n + (o.kind === 'sent' ? o.recipients : 0), 0)).toBe(2);
      expect(w.notices().map((n) => n.userId).sort()).toEqual(['u-amy', 'u-bob']);
      expect(w.state.sends.map((r) => r.agent_id).sort()).toEqual(['amy', 'bob']);
    });

    it('the send is keyed per agent, slot and date: the same agent still gets another slot\'s reminder', async () => {
      const w = world();
      w.addOrder('o-a');
      w.addOrder('o-m', { coverage_slot_key: 'morning', window: { slot_id: 'ga-m', preferred_date: DATE, is_confirmed: true } });
      w.addAgent('amy');
      w.state.assignments.push({ id: 'as-amy-m', agent_id: 'amy', slot_key: 'morning', status: 'active', off_today_date: null });
      await w.service.sendForOrder('o-a', REMINDER_AT);
      // Morning starts 08:00 Libreville = 07:00Z; reminder 06:30Z.
      await w.service.sendForOrder('o-m', new Date('2026-10-19T06:30:00Z'));
      expect(w.state.sends.map((r) => [r.agent_id, r.slot_key])).toEqual([
        ['amy', 'afternoon'],
        ['amy', 'morning'],
      ]);
      expect(w.notices()).toHaveLength(2);
    });

    it('a failed claim skips only that agent (never a push without a claim)', async () => {
      const w = world();
      w.addOrder('o-a');
      w.addAgent('amy');
      w.addAgent('bob');
      w.state.claimFailsFor.add('amy');
      await expect(w.service.sendForOrder('o-a', REMINDER_AT)).resolves.toEqual({ kind: 'sent', recipients: 1 });
      expect(w.notices().map((n) => n.userId)).toEqual(['u-bob']);
    });

    it('QA #608 N2: the in-app reminder not written -> the claim is given back and the next callback sends it', async () => {
      const w = world();
      w.addOrder('o-a');
      w.addOrder('o-b');
      w.addAgent('amy');
      w.addAgent('bob');
      w.notifications.sendDedicatedAgentNotice.mockImplementationOnce(async () => false);
      await expect(w.service.sendForOrder('o-a', REMINDER_AT)).resolves.toEqual({ kind: 'sent', recipients: 1 });
      const firstUser = w.notices()[0].userId;
      expect(w.state.sends.map((r) => `u-${r.agent_id}`)).not.toContain(firstUser);
      expect(w.state.sends).toHaveLength(1);
      // The next order's callback in the group retries only the agent that missed it.
      w.notifications.sendDedicatedAgentNotice.mockClear();
      await expect(w.service.sendForOrder('o-b', REMINDER_AT)).resolves.toEqual({ kind: 'sent', recipients: 1 });
      expect(w.notices().map((n) => n.userId)).toEqual([firstUser]);
      expect(w.state.sends).toHaveLength(2);
    });

    it('a callback well before the reminder time or after the slot started is stale', async () => {
      const w = world();
      w.addOrder('o-a');
      w.addAgent('amy');
      await expect(w.service.sendForOrder('o-a', new Date(REMINDER_AT.getTime() - 121_000))).resolves.toEqual({
        kind: 'skipped',
        reason: 'stale',
      });
      await expect(w.service.sendForOrder('o-a', new Date('2026-10-19T11:00:00Z'))).resolves.toEqual({
        kind: 'skipped',
        reason: 'stale',
      });
      await expect(w.service.sendForOrder('o-a', new Date(REMINDER_AT.getTime() - 119_000))).resolves.toMatchObject({
        kind: 'sent',
      });
      await expect(w.service.sendForOrder('o-a', new Date('2026-10-19T10:59:59Z'))).resolves.toMatchObject({ kind: 'sent' });
    });

    it('flag off at send time, unknown slot, no agent on duty, an unsigned contract', async () => {
      const w = world();
      w.addOrder('o-a');
      w.addAgent('amy');
      w.state.unsigned.add('amy');
      await expect(w.service.sendForOrder('o-a', REMINDER_AT)).resolves.toEqual({ kind: 'skipped', reason: 'no_agents' });
      w.addOrder('o-a', { window: { slot_id: 'nope', preferred_date: DATE, is_confirmed: true } });
      await expect(w.service.sendForOrder('o-a', REMINDER_AT)).resolves.toEqual({ kind: 'skipped', reason: 'no_slot' });
      w.state.flag = false;
      jest.setSystemTime(new Date(NOW.getTime() + 31_000));
      await expect(w.service.sendForOrder('o-a', REMINDER_AT)).resolves.toEqual({ kind: 'skipped', reason: 'flag_off' });
      expect(w.notices()).toEqual([]);
    });

    it('onDutyAgents: active, profile-eligible, signed agents of an enabled slot, off-today on that date excluded', async () => {
      const w = world();
      w.addAgent('amy');
      w.addAgent('off', { offToday: DATE });
      w.addAgent('yday', { offToday: '2026-10-18' });
      const q = { locationId: LOCATION, slotKey: 'afternoon', date: DATE };
      await expect(w.coverage.onDutyAgents(q)).resolves.toEqual([
        { agentId: 'amy', userId: 'u-amy', assignmentId: 'as-amy' },
        { agentId: 'yday', userId: 'u-yday', assignmentId: 'as-yday' },
      ]);
      w.state.pickupSlots = [{ slot_key: 'afternoon', is_enabled: false, pickup_time: null }];
      await expect(w.coverage.onDutyAgents(q)).resolves.toEqual([]);
      w.state.pickupSlots = [];
      w.state.flag = false;
      jest.setSystemTime(new Date(NOW.getTime() + 31_000));
      await expect(w.coverage.onDutyAgents(q)).resolves.toEqual([]);
    });

    it('a slot the business turned off sends nothing', async () => {
      const w = world();
      w.addOrder('o-a');
      w.addAgent('amy');
      w.state.pickupSlots = [{ slot_key: 'afternoon', is_enabled: false, pickup_time: null }];
      await expect(w.service.sendForOrder('o-a', REMINDER_AT)).resolves.toMatchObject({ kind: 'skipped' });
      expect(w.notices()).toEqual([]);
    });
  });
});
