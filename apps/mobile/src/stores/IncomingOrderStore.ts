import { makeAutoObservable, runInAction } from 'mobx';
import { InteractionManager, Vibration } from 'react-native';
import { BUSY_SNOOZE_MS } from '../constants/incomingOrder';
import i18n from '../i18n';
import { BUSINESS_PERSONA_HEADERS } from '../notifications/personaHeaders';
import { businessApi } from '../services/businessApi';
import type { IncomingOrderDetails } from '../types/incomingOrder';
import { isDeliverySlotPast } from '../utils/isDeliverySlotPast';
import type { RootStore } from './RootStore';
import { syncFirstOrderPinAfterOrderUpdate } from '../utils/firstOrderPinSync';

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

  private root: RootStore;
  private reminderTimer: ReturnType<typeof setInterval> | null = null;
  private busyReminderTimer: ReturnType<typeof setTimeout> | null = null;
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
    // Mid-window reminders re-fire the same event; do not reset a healthy overlay.
    // Still allow retry when the first present ended in error with the sheet open.
    if (
      this.orderId === orderId &&
      (this.presentsInFlight > 0 ||
        this.uiState === 'confirming' ||
        this.uiState === 'busy' ||
        (this.visible && this.uiState !== 'error'))
    ) {
      return;
    }
    if (!this.canPresent) {
      this.pendingOrderId = orderId;
      this.pendingCheck = true;
      return;
    }
    await this.present(orderId);
  }

  /** Vibrate + list refresh without presenting the owner acceptance overlay. */
  notifyDelegateForegroundOrder(): void {
    Vibration.vibrate([0, 600, 200, 600]);
    this.ordersRefreshEpoch += 1;
  }

  async checkPendingIncoming(): Promise<void> {
    if (!this.canPresent) {
      this.pendingCheck = true;
      return;
    }
    if (this.visible || this.presentsInFlight > 0) return;
    if (this.pendingOrderId) {
      const id = this.pendingOrderId;
      this.pendingOrderId = null;
      if (!this.isSnoozed(id)) {
        await this.present(id);
        return;
      }
    }
    try {
      const res = await businessApi.orders.getPendingAcceptance(
        BUSINESS_PERSONA_HEADERS
      );
      if (!res.active || !res.order || this.isSnoozed(res.order.id)) return;
      // Load full order (windows/address) via present — pending payload is slim.
      await this.present(res.order.id);
    } catch {
      // ignore
    }
  }

  flushPending(): void {
    if (!this.canPresent) return;
    if (this.pendingOrderId) {
      const id = this.pendingOrderId;
      this.pendingOrderId = null;
      this.pendingCheck = false;
      if (!this.isSnoozed(id)) void this.present(id);
      return;
    }
    if (this.pendingCheck) {
      this.pendingCheck = false;
      void this.checkPendingIncoming();
    }
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
      }
    } catch {
      if (epoch !== this.loadEpoch || !this.visible) return;
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

  async confirm(): Promise<void> {
    if (!this.orderId || !this.details || this.uiState === 'confirming') return;
    if (isDeliverySlotPast(this.details)) return;
    const orderId = this.orderId;
    const windowId = this.details.delivery_time_windows?.[0]?.id;
    runInAction(() => {
      this.uiState = 'confirming';
      this.message = null;
    });
    this.stopReminderLoop();
    try {
      await businessApi.orders.confirm(
        {
          orderId,
          ...(windowId ? { delivery_time_window_id: windowId } : {}),
        },
        BUSINESS_PERSONA_HEADERS
      );
      this.onConfirmed();
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
    this.dismiss();
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
  }

  private scheduleBusyReminder(orderId: string, delayMs: number): void {
    this.clearBusyReminderTimer();
    this.busyReminderTimer = setTimeout(() => {
      this.busyReminderTimer = null;
      this.clearSnooze(orderId);
      if (!this.visible) void this.present(orderId);
    }, delayMs);
  }

  private clearBusyReminderTimer(): void {
    if (this.busyReminderTimer) {
      clearTimeout(this.busyReminderTimer);
      this.busyReminderTimer = null;
    }
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
    this.dismiss();
  }

  dismiss(): void {
    const orderId = this.orderId;
    this.hideOverlay();
    this.clearBusyReminderTimer();
    if (orderId) this.clearSnooze(orderId);
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
    });
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
    this.reminderTimer = setInterval(() => {
      if (!this.visible || this.uiState !== 'active') return;
      Vibration.vibrate([0, 500, 150, 500, 150, 500]);
    }, 25_000);
  }

  private stopReminderLoop(): void {
    if (this.reminderTimer) {
      clearInterval(this.reminderTimer);
      this.reminderTimer = null;
    }
  }
}
