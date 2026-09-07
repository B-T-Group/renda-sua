import { makeAutoObservable, runInAction } from 'mobx';
import i18n from '../i18n';
import { agentApi } from '../services/agentApi';
import {
  navigateToAgentOpenOrders,
  navigateToOrderFromPush,
} from '../navigation/rootNavigationRef';
import type { OrderOfferDetails } from '../types/orderOffer';
import type { RootStore } from './RootStore';

export type OrderOfferUiState =
  | 'loading'
  | 'active'
  | 'accepting'
  | 'unavailable'
  | 'insufficientFunds'
  | 'error';

/**
 * Drives the cross-persona full-screen delivery offer. Lives in the root store
 * so it survives the navigator remount that happens when switching persona.
 * Never trusts the client to reserve the order: accept always calls the backend
 * atomic claim and reacts to its result.
 */
export class OrderOfferStore {
  visible = false;
  orderId: string | null = null;
  uiState: OrderOfferUiState = 'loading';
  details: OrderOfferDetails | null = null;
  message: string | null = null;

  private root: RootStore;
  private pendingOrderId: string | null = null;
  private pendingCheck = false;
  /** Suppresses re-showing an offer the user closed/declined this session. */
  private lastClosedOrderId: string | null = null;
  /** Ignore "already taken" pushes for an order this user just accepted. */
  private lastAcceptedOrderId: string | null = null;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  private t(key: string, fallback: string): string {
    return i18n.t(key, fallback);
  }

  private get canPresent(): boolean {
    return (
      this.root.auth.isAuthenticated && this.root.persona.loadState === 'ready'
    );
  }

  /**
   * Entry point from a push tap / foreground push. Shows the offer regardless
   * of the active persona (the persona switch happens only on accept).
   */
  async handleOfferPush(orderId: string): Promise<void> {
    if (!orderId) return;
    if (!this.canPresent) {
      this.pendingOrderId = orderId;
      return;
    }
    await this.present(orderId);
  }

  /**
   * Entry point from an explicit notification tap. Always shows the offer
   * even if previously dismissed by the user.
   */
  async handleOfferTap(orderId: string): Promise<void> {
    if (!orderId) return;
    this.lastClosedOrderId = null;
    if (!this.canPresent) {
      this.pendingOrderId = orderId;
      return;
    }
    await this.present(orderId);
  }

  /**
   * App-open / foreground entry point. Silently checks for a pending offer for
   * the current user and shows it if one is active, regardless of persona.
   */
  async checkPendingOffer(): Promise<void> {
    if (!this.canPresent) {
      this.pendingCheck = true;
      return;
    }
    if (this.visible) return;
    try {
      const res = await agentApi.orders.getPendingOffer();
      if (!res.active || !res.offer) return;
      if (res.offer.orderId === this.lastClosedOrderId) return;
      runInAction(() => {
        this.visible = true;
        this.orderId = res.offer!.orderId;
        this.details = res.offer;
        this.uiState = 'active';
        this.message = null;
      });
    } catch {
      // Silent: app-open check never surfaces an error UI.
    }
  }

  /** Re-run any offer that arrived before the session was ready. */
  flushPending(): void {
    if (!this.canPresent) return;
    const pending = this.pendingOrderId;
    if (pending) {
      this.pendingOrderId = null;
      // Prefer tap path so a queued offer always clears lastClosedOrderId.
      void this.handleOfferTap(pending);
      return;
    }
    if (this.pendingCheck) {
      this.pendingCheck = false;
      void this.checkPendingOffer();
    }
  }

  private async present(orderId: string): Promise<void> {
    runInAction(() => {
      this.visible = true;
      this.orderId = orderId;
      this.uiState = 'loading';
      this.details = null;
      this.message = null;
    });

    try {
      const res = await agentApi.orders.getOffer(orderId);
      runInAction(() => this.showFromResponse(res));
    } catch (error) {
      runInAction(() => {
        this.uiState = 'error';
        this.message =
          error instanceof Error
            ? error.message
            : this.t('agent.orderOffer.loadError', 'Could not load the offer.');
      });
    }
  }

  /** Apply a fetched offer response to the (already visible) overlay. */
  private showFromResponse(res: {
    active: boolean;
    offer: OrderOfferDetails | null;
  }): void {
    if (!res.active || !res.offer) {
      this.uiState = 'unavailable';
      this.message = this.t(
        'agent.orderOffer.unavailable',
        'This delivery is no longer available.'
      );
      return;
    }
    this.orderId = res.offer.orderId;
    this.details = res.offer;
    this.uiState = 'active';
    this.message = null;
  }

  /**
   * Accept the offer via the backend atomic claim. Switches to the agent
   * persona first when needed, since the claim runs persona-scoped logic.
   */
  async accept(): Promise<void> {
    const orderId = this.orderId;
    if (!orderId || this.uiState === 'accepting') return;
    runInAction(() => {
      this.uiState = 'accepting';
      this.message = null;
    });

    const { persona } = this.root;
    if (persona.activePersona !== 'agent' && persona.personas.includes('agent')) {
      try {
        await persona.selectPersona('agent');
      } catch {
        runInAction(() => {
          this.uiState = 'error';
          this.message = this.t(
            'agent.orderOffer.personaSwitchFailed',
            'Could not switch to delivery mode. Please try again.'
          );
        });
        return;
      }
    }

    try {
      const res = await agentApi.orders.acceptOffer(orderId);
      if (!res.success) {
        throw new Error(res.message ?? 'ACCEPT_FAILED');
      }
      this.root.ordersSignal.notifyStatusChanged();
      this.lastAcceptedOrderId = orderId;
      this.dismiss();
      navigateToOrderFromPush(orderId, 'agent');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      runInAction(() => {
        if (/insufficient|balance/i.test(msg)) {
          this.uiState = 'insufficientFunds';
          this.message =
            msg ||
            this.t(
              'agent.orderOffer.insufficientFunds',
              'Insufficient balance to claim this delivery.'
            );
        } else {
          this.uiState = 'unavailable';
          this.message =
            msg ||
            this.t(
              'agent.orderOffer.taken',
              'Another courier accepted this delivery first.'
            );
        }
      });
    }
  }

  /** Decline (or auto-decline on timeout). Optimistically dismisses. */
  async decline(): Promise<void> {
    const orderId = this.orderId;
    this.dismiss();
    if (!orderId) return;
    try {
      await agentApi.orders.declineOffer(orderId);
    } catch {
      // Best-effort: the offer expires server-side regardless.
    }
  }

  /** Called when a cancellation push arrives (another courier won). */
  cancelIfMatches(orderId: string): void {
    if (this.lastAcceptedOrderId === orderId) return;
    if (this.visible && this.orderId === orderId) {
      runInAction(() => {
        this.uiState = 'unavailable';
        this.message = this.t(
          'agent.orderOffer.taken',
          'Another courier accepted this delivery first.'
        );
        this.details = null;
      });
    }
  }

  /** Navigate to the open-orders list (top-up fallback lives there). */
  goToAvailableOrders(): void {
    this.dismiss();
    navigateToAgentOpenOrders();
  }

  dismiss(): void {
    // Remember the closed offer so app-open/foreground checks don't re-pop it.
    if (this.orderId) {
      this.lastClosedOrderId = this.orderId;
    }
    this.visible = false;
    this.orderId = null;
    this.details = null;
    this.uiState = 'loading';
    this.message = null;
  }
}
