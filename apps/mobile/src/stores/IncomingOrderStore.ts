import { makeAutoObservable, runInAction } from 'mobx';
import { InteractionManager, Vibration } from 'react-native';
import { BUSY_SNOOZE_MS } from '../constants/incomingOrder';
import i18n from '../i18n';
import { BUSINESS_PERSONA_HEADERS } from '../notifications/personaHeaders';
import { businessApi } from '../services/businessApi';
import {
  pulseOrderAlertSound,
  startOrderAlertSound,
  stopOrderAlertSound,
} from '../services/orderAlertSound';
import type { IncomingOrderDetails } from '../types/incomingOrder';
import { isDeliverySlotPast } from '../utils/isDeliverySlotPast';
import type { RootStore } from './RootStore';
import { syncFirstOrderPinAfterOrderUpdate } from '../utils/firstOrderPinSync';

type PendingQueueResponse = {
  active?: boolean;
  order?: { id: string } | null;
  queue?: Array<{ id: string }> | null;
} | null;

function queueIds(res: PendingQueueResponse): string[] {
  if (res?.queue?.length) {
    return res.queue.map((row) => row.id).filter((id) => !!id);
  }
  return res?.order?.id ? [res.order.id] : [];
}

function nextQueuedId(
  res: PendingQueueResponse,
  isSnoozed: (id: string) => boolean
): string | null {
  return queueIds(res).find((id) => !isSnoozed(id)) ?? null;
}

function waitingAfter(
  res: PendingQueueResponse,
  shownId: string | null,
  isSnoozed: (id: string) => boolean
): number {
  if (!shownId) return 0;
  const open = queueIds(res).filter((id) => !isSnoozed(id));
  const index = open.indexOf(shownId);
  if (index < 0) return open.length;
  return Math.max(0, open.length - index - 1);
}

export type IncomingOrderUiState =
  | 'loading'
  | 'active'
  | 'confirming'
  | 'busy'
  | 'resolved'
  | 'error';

const ACTIONABLE_ACCEPTANCE = new Set([
  'awaiting_acceptance',
  'no_response',
  'grace',
]);

/** Cap the details fetch so a stalled request can't pin the interrupt on "loading". */
const ORDER_LOAD_TIMEOUT_MS = 15_000;

/**
 * Buffer after in-flight interactions before presenting the fullScreen Modal.
 * Presenting while the navigator tree is mounting/remounting (persona switch,
 * PersonaSessionGate → main app) freezes iOS on Fabric + native-stack.
 */
const PRESENT_SETTLE_MS = 350;

function waitForNavigationSettle(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, PRESENT_SETTLE_MS);
    });
  });
}

function withLoadTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('INCOMING_ORDER_LOAD_TIMEOUT')),
        ORDER_LOAD_TIMEOUT_MS
      )
    ),
  ]);
}

function isActionableIncomingOrder(order: IncomingOrderDetails): boolean {
  if (order.current_status !== 'pending') return false;
  if (!order.acceptance_state) return true;
  return ACTIONABLE_ACCEPTANCE.has(order.acceptance_state);
}

/**
 * Full-screen interrupt for business pending-acceptance orders.
 */
export class IncomingOrderStore {
  visible = false;
  orderId: string | null = null;
  uiState: IncomingOrderUiState = 'loading';
  details: IncomingOrderDetails | null = null;
  message: string | null = null;
  showConfirmDialog = false;
  showCancelDialog = false;
  /** Bumped on foreground location/delegate pushes so open-order lists can refresh. */
  ordersRefreshEpoch = 0;
  /** Other unsnoozed pending orders behind the one on screen. */
  waitingCount = 0;

  private root: RootStore;
  private reminderTimer: ReturnType<typeof setInterval> | null = null;
  private busyReminderTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  /** Invalidates in-flight present() loads (incl. their timeout timers) on re-present/dismiss. */
  private loadEpoch = 0;
  /** Presents in flight (visibility is deferred, so `visible` alone can't dedupe). */
  private presentsInFlight = 0;
  /** Queued order id when push arrives off the business persona. */
  private pendingOrderId: string | null = null;
  private pendingCheck = false;
  /** Order ids snoozed by "Need more time" until Date.now() exceeds the value. */
  private snoozedUntilMs: Record<string, number> = {};

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  private t(key: string, fallback: string): string {
    return i18n.t(key, fallback);
  }

  private get canPresent(): boolean {
    const p = this.root.persona;
    return (
      this.root.auth.isAuthenticated &&
      p.loadState === 'ready' &&
      p.showMainApp &&
      !p.pickingPersona &&
      !p.isDelegationContext
    );
  }

  private async maybeSwitchToBusiness(): Promise<void> {
    const p = this.root.persona;
    if (
      p.showMainApp &&
      !p.isDelegationContext &&
      p.activePersona !== 'business' &&
      p.personas.includes('business') &&
      !p.pickingPersona
    ) {
      try {
        await p.selectPersona('business');
      } catch {
        // Present anyway; the fetch below is header-scoped to business.
      }
    }
  }

  async handleIncomingPush(orderId: string): Promise<void> {
    if (!orderId || this.isSnoozed(orderId)) return;
    if (this.root.persona.isDelegationContext) {
      this.notifyDelegateForegroundOrder();
      return;
    }
    if (this.orderId === orderId && this.isHealthyOverlay()) return;
    if (this.isDifferentOrderHeld(orderId)) {
      await this.refreshWaitingCount();
      return;
    }
    if (!this.canPresent) {
      this.pendingOrderId = orderId;
      this.pendingCheck = true;
      return;
    }
    const epoch = this.claimInterrupt(orderId);
    const nextId = await this.resolveQueuedOrderId(orderId);
    if (epoch !== this.loadEpoch) return;
    if (!nextId || this.isSnoozed(nextId)) {
      this.hideOverlay();
      return;
    }
    await this.present(nextId);
  }

  /** Vibrate + list refresh without presenting the owner acceptance overlay. */
  notifyDelegateForegroundOrder(): void {
    Vibration.vibrate([0, 600, 200, 600]);
    pulseOrderAlertSound();
    this.ordersRefreshEpoch += 1;
  }

  async checkPendingIncoming(): Promise<void> {
    if (!this.canPresent) {
      this.pendingCheck = true;
      return;
    }
    if (this.visible || this.presentsInFlight > 0) {
      await this.refreshWaitingCount();
      return;
    }
    const fallback = this.pendingOrderId;
    this.pendingOrderId = null;
    try {
      const res = await businessApi.orders.getPendingAcceptance(
        BUSINESS_PERSONA_HEADERS
      );
      const nextId =
        nextQueuedId(res, (id) => this.isSnoozed(id)) ??
        (fallback && !this.isSnoozed(fallback) ? fallback : null);
      runInAction(() => {
        this.waitingCount = waitingAfter(res, nextId, (id) => this.isSnoozed(id));
      });
      if (!nextId) return;
      await this.present(nextId);
    } catch {
      if (fallback && !this.isSnoozed(fallback)) await this.present(fallback);
    }
  }

  flushPending(): void {
    if (!this.canPresent) return;
    if (!this.pendingOrderId && !this.pendingCheck) return;
    this.pendingCheck = false;
    void this.checkPendingIncoming();
  }

  async present(orderId: string): Promise<void> {
    if (this.isSnoozed(orderId)) return;
    const epoch = this.loadEpoch + 1;
    runInAction(() => {
      this.loadEpoch = epoch;
      this.orderId = orderId;
      this.uiState = 'loading';
      this.message = null;
      if (this.details?.id !== orderId) this.details = null;
      this.presentsInFlight += 1;
    });
    try {
      // Sequence, don't race: switch persona first (navigator remount), then let
      // transitions settle before mounting the fullScreen Modal. Presenting it
      // while react-native-screens replaces the hierarchy hangs iOS (Fabric).
      await this.maybeSwitchToBusiness();
      await waitForNavigationSettle();
      if (epoch !== this.loadEpoch) return;
      runInAction(() => {
        this.visible = true;
      });
      startOrderAlertSound('incomingOrder');
      const res = await withLoadTimeout(
        businessApi.orders.getById(orderId, BUSINESS_PERSONA_HEADERS)
      );
      // The overlay can be dismissed or re-presented while loading; drop stale results.
      if (epoch !== this.loadEpoch || !this.visible) return;
      const order = res.order as unknown as IncomingOrderDetails;
      runInAction(() => {
        this.details = order;
        if (isActionableIncomingOrder(order)) {
          this.uiState = 'active';
        } else {
          this.uiState = 'resolved';
        }
      });
      if (this.uiState === 'active') {
        this.startReminderLoop();
        Vibration.vibrate([0, 400, 200, 400]);
      } else {
        stopOrderAlertSound('incomingOrder');
      }
    } catch {
      if (epoch !== this.loadEpoch || !this.visible) return;
      stopOrderAlertSound('incomingOrder');
      runInAction(() => {
        this.uiState = 'error';
        this.message = this.t(
          'incomingOrder.loadFailed',
          'Could not load the incoming order.'
        );
      });
    } finally {
      runInAction(() => {
        this.presentsInFlight -= 1;
      });
    }
  }

  openConfirm(): void {
    this.showCancelDialog = false;
    this.showConfirmDialog = true;
    this.stopReminderLoop();
  }

  closeConfirm(): void {
    this.showConfirmDialog = false;
    if (this.visible && this.uiState === 'active') {
      this.startReminderLoop();
    }
  }

  async confirm(opts?: {
    ready_in_minutes?: number;
  }): Promise<{ success: boolean; pay_after_merchant_confirm?: boolean; message?: string }> {
    if (!this.orderId || !this.details || this.uiState === 'confirming') {
      return { success: false };
    }
    if (isDeliverySlotPast(this.details)) return { success: false };
    const orderId = this.orderId;
    const windowId = this.details.delivery_time_windows?.[0]?.id;
    runInAction(() => {
      this.uiState = 'confirming';
      this.message = null;
    });
    this.stopReminderLoop();
    try {
      const res = await businessApi.orders.confirm(
        {
          orderId,
          ...(windowId ? { delivery_time_window_id: windowId } : {}),
          ...(opts?.ready_in_minutes != null
            ? { ready_in_minutes: opts.ready_in_minutes }
            : {}),
        },
        BUSINESS_PERSONA_HEADERS
      );
      // Keep overlay until the ready-in dialog finishes (pay-after wait step).
      if (this.showConfirmDialog) {
        runInAction(() => {
          this.uiState = 'resolved';
          this.message = res.message ?? null;
        });
        return {
          success: true,
          pay_after_merchant_confirm: res.pay_after_merchant_confirm,
          message: res.message,
        };
      }
      this.onConfirmed();
      return {
        success: true,
        pay_after_merchant_confirm: res.pay_after_merchant_confirm,
        message: res.message,
      };
    } catch (e: unknown) {
      runInAction(() => {
        this.uiState = 'active';
        this.message = this.t(
          'incomingOrder.confirmFailed',
          'Could not confirm the order.'
        );
      });
      this.startReminderLoop();
      throw e;
    }
  }

  onConfirmed(): void {
    this.showConfirmDialog = false;
    this.advanceQueue();
  }

  openCancel(): void {
    this.showConfirmDialog = false;
    this.showCancelDialog = true;
    this.stopReminderLoop();
  }

  closeCancel(): void {
    this.showCancelDialog = false;
    if (this.visible && this.uiState === 'active') {
      this.startReminderLoop();
    }
  }

  async markBusy(): Promise<void> {
    if (!this.orderId || isDeliverySlotPast(this.details)) return;
    const orderId = this.orderId;
    runInAction(() => {
      this.uiState = 'busy';
    });
    try {
      const res = await businessApi.orders.markBusy(
        orderId,
        BUSINESS_PERSONA_HEADERS
      );
      this.beginBusySnooze(orderId, Date.parse(res?.snoozeUntil ?? ''));
    } catch {
      // Ignore failures once the overlay was dismissed mid-request.
      if (!this.visible || this.orderId !== orderId) return;
      runInAction(() => {
        this.uiState = 'active';
        this.message = this.t(
          'incomingOrder.busyFailed',
          'Could not mark as busy.'
        );
      });
    }
  }

  private beginBusySnooze(orderId: string, snoozeUntilMs: number): void {
    const until = Number.isFinite(snoozeUntilMs)
      ? snoozeUntilMs
      : Date.now() + BUSY_SNOOZE_MS;
    this.snoozedUntilMs[orderId] = until;
    this.hideOverlay();
    this.scheduleBusyReminder(orderId, Math.max(1000, until - Date.now()));
    void this.checkPendingIncoming();
  }

  private scheduleBusyReminder(orderId: string, delayMs: number): void {
    this.clearBusyReminder(orderId);
    this.busyReminderTimers[orderId] = setTimeout(() => {
      delete this.busyReminderTimers[orderId];
      this.clearSnooze(orderId);
      if (!this.visible) {
        void this.present(orderId);
        return;
      }
      void this.refreshWaitingCount();
    }, delayMs);
  }

  private clearBusyReminder(orderId: string): void {
    const timer = this.busyReminderTimers[orderId];
    if (!timer) return;
    clearTimeout(timer);
    delete this.busyReminderTimers[orderId];
  }

  async decline(notes: string): Promise<void> {
    if (!this.orderId || !this.details) return;
    const snapshot = {
      id: this.orderId,
      business_id: this.details.business_id,
      created_at: this.details.created_at,
      current_status: 'cancelled' as const,
    };
    await businessApi.orders.cancel(
      {
        orderId: this.orderId,
        notes: notes.trim() || 'Declined from incoming order screen',
      },
      BUSINESS_PERSONA_HEADERS
    );
    await syncFirstOrderPinAfterOrderUpdate(snapshot, {
      convertNudge: (id) => this.root.ftue.convertNudge(id),
    });
    this.advanceQueue();
  }

  /** Confirm or decline: leave this order unsnoozed and open the next one. */
  private advanceQueue(): void {
    const orderId = this.orderId;
    if (orderId) {
      this.clearBusyReminder(orderId);
      this.clearSnooze(orderId);
    }
    const shouldCheck = !!orderId;
    this.hideOverlay();
    if (shouldCheck) void this.checkPendingIncoming();
  }

  dismiss(): void {
    const orderId = this.orderId;
    const advance = this.visible && !!orderId;
    if (advance && orderId) {
      this.snoozedUntilMs[orderId] = Date.now() + BUSY_SNOOZE_MS;
      this.scheduleBusyReminder(orderId, BUSY_SNOOZE_MS);
    } else if (orderId) {
      this.clearBusyReminder(orderId);
      this.clearSnooze(orderId);
    }
    this.hideOverlay();
    if (advance) void this.checkPendingIncoming();
  }

  private hideOverlay(): void {
    this.stopReminderLoop();
    runInAction(() => {
      this.loadEpoch += 1;
      this.visible = false;
      this.orderId = null;
      this.details = null;
      this.uiState = 'loading';
      this.message = null;
      this.showConfirmDialog = false;
      this.showCancelDialog = false;
      this.waitingCount = 0;
    });
  }

  private isHealthyOverlay(): boolean {
    return (
      this.presentsInFlight > 0 ||
      this.uiState === 'confirming' ||
      this.uiState === 'busy' ||
      (this.visible && this.uiState !== 'error')
    );
  }

  private isDifferentOrderHeld(orderId: string): boolean {
    if (!this.orderId || this.orderId === orderId) return false;
    return (
      this.presentsInFlight > 0 ||
      this.visible ||
      this.uiState === 'confirming' ||
      this.uiState === 'busy'
    );
  }

  private claimInterrupt(orderId: string): number {
    const epoch = this.loadEpoch + 1;
    runInAction(() => {
      this.loadEpoch = epoch;
      this.orderId = orderId;
      this.uiState = 'loading';
      this.message = null;
    });
    return epoch;
  }

  private async resolveQueuedOrderId(fallbackId: string): Promise<string | null> {
    try {
      const res = await businessApi.orders.getPendingAcceptance(
        BUSINESS_PERSONA_HEADERS
      );
      const nextId =
        nextQueuedId(res, (id) => this.isSnoozed(id)) ??
        (this.isSnoozed(fallbackId) ? null : fallbackId);
      runInAction(() => {
        this.waitingCount = waitingAfter(res, nextId, (id) => this.isSnoozed(id));
      });
      return nextId;
    } catch {
      return this.isSnoozed(fallbackId) ? null : fallbackId;
    }
  }

  private async refreshWaitingCount(): Promise<void> {
    try {
      const res = await businessApi.orders.getPendingAcceptance(
        BUSINESS_PERSONA_HEADERS
      );
      runInAction(() => {
        this.waitingCount = waitingAfter(res, this.orderId, (id) =>
          this.isSnoozed(id)
        );
      });
    } catch {
      // ignore
    }
  }

  private isSnoozed(orderId: string): boolean {
    const until = this.snoozedUntilMs[orderId];
    if (until == null) return false;
    if (Date.now() >= until) {
      this.clearSnooze(orderId);
      return false;
    }
    return true;
  }

  private clearSnooze(orderId: string): void {
    delete this.snoozedUntilMs[orderId];
  }

  private startReminderLoop(): void {
    this.stopReminderLoop();
    startOrderAlertSound('incomingOrder');
    this.reminderTimer = setInterval(() => {
      if (!this.visible || this.uiState !== 'active') return;
      Vibration.vibrate([0, 500, 150, 500, 150, 500]);
    }, 25_000);
  }

  private stopReminderLoop(): void {
    stopOrderAlertSound('incomingOrder');
    if (this.reminderTimer) {
      clearInterval(this.reminderTimer);
      this.reminderTimer = null;
    }
  }
}
