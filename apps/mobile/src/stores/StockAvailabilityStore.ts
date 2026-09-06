import { makeAutoObservable, runInAction } from 'mobx';
import i18n from '../i18n';
import { BUSINESS_PERSONA_HEADERS } from '../notifications/personaHeaders';
import {
  fetchStockAvailabilityCheck,
  respondStockAvailabilityCheck,
  type StockAvailabilityCheckData,
} from '../services/inventoryItemsApi';
import type { RootStore } from './RootStore';

export type StockAvailabilityUiState =
  | 'loading'
  | 'active'
  | 'submitting'
  | 'done'
  | 'error';

/**
 * Root-level stock availability confirm (offer-style). Survives persona remount
 * and opens from foreground push or notification tap.
 */
export class StockAvailabilityStore {
  visible = false;
  messageId: string | null = null;
  uiState: StockAvailabilityUiState = 'loading';
  data: StockAvailabilityCheckData | null = null;
  qty = 0;
  error: string | null = null;

  private root: RootStore;
  /** FIFO queue when overlay is busy or session not ready. */
  private pendingMessageIds: string[] = [];
  private lastClosedMessageId: string | null = null;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  private t(key: string, fallback: string, params?: Record<string, unknown>): string {
    return i18n.t(key, { defaultValue: fallback, ...params });
  }

  private get canPresent(): boolean {
    const p = this.root.persona;
    return (
      this.root.auth.isAuthenticated &&
      p.loadState === 'ready' &&
      p.showMainApp &&
      !p.pickingPersona
    );
  }

  private maybeSwitchToBusiness(): void {
    const { persona } = this.root;
    if (
      persona.showMainApp &&
      !persona.isDelegationContext &&
      persona.activePersona !== 'business' &&
      persona.personas.includes('business') &&
      !persona.pickingPersona
    ) {
      void persona.selectPersona('business');
    }
  }

  private get isInProgress(): boolean {
    return (
      this.visible &&
      (this.uiState === 'loading' ||
        this.uiState === 'active' ||
        this.uiState === 'submitting')
    );
  }

  private enqueuePending(messageId: string): void {
    if (
      this.messageId === messageId ||
      this.pendingMessageIds.includes(messageId)
    ) {
      return;
    }
    this.pendingMessageIds.push(messageId);
  }

  /** Foreground push — open unless user already dismissed this check. */
  async handlePush(messageId: string): Promise<void> {
    if (!messageId || messageId === this.lastClosedMessageId) return;
    await this.enqueueOrPresent(messageId);
  }

  /** Explicit tap — always reopen even if previously dismissed. */
  async handleTap(messageId: string): Promise<void> {
    if (!messageId) return;
    this.lastClosedMessageId = null;
    await this.enqueueOrPresent(messageId);
  }

  flushPending(): void {
    if (!this.canPresent || this.isInProgress) return;
    const pending = this.pendingMessageIds.shift();
    if (!pending) return;
    void this.handleTap(pending);
  }

  async confirm(): Promise<void> {
    await this.submit('confirm');
  }

  async markUnavailable(): Promise<void> {
    await this.submit('unavailable');
  }

  setQty(next: number): void {
    this.qty = Math.max(0, Math.floor(next));
  }

  dismiss(): void {
    const closedId = this.messageId;
    if (closedId) {
      this.lastClosedMessageId = closedId;
    }
    this.visible = false;
    this.messageId = null;
    this.data = null;
    this.qty = 0;
    this.uiState = 'loading';
    this.error = null;
    if (this.pendingMessageIds.length > 0) {
      queueMicrotask(() => this.flushPending());
    }
  }

  /** Full clear on logout / session reset. */
  reset(): void {
    this.visible = false;
    this.messageId = null;
    this.data = null;
    this.qty = 0;
    this.uiState = 'loading';
    this.error = null;
    this.pendingMessageIds = [];
    this.lastClosedMessageId = null;
  }

  private stillShowing(messageId: string): boolean {
    return this.visible && this.messageId === messageId;
  }

  private applyIfShowing(messageId: string, apply: () => void): void {
    runInAction(() => {
      if (!this.stillShowing(messageId)) return;
      apply();
    });
  }

  private async enqueueOrPresent(messageId: string): Promise<void> {
    if (!this.canPresent) {
      this.enqueuePending(messageId);
      return;
    }
    if (this.isInProgress && this.messageId && this.messageId !== messageId) {
      this.enqueuePending(messageId);
      return;
    }
    await this.present(messageId);
  }

  private async present(messageId: string): Promise<void> {
    if (this.isInProgress && this.messageId && this.messageId !== messageId) {
      this.enqueuePending(messageId);
      return;
    }
    runInAction(() => {
      this.visible = true;
      this.messageId = messageId;
      this.uiState = 'loading';
      this.data = null;
      this.error = null;
    });
    this.maybeSwitchToBusiness();
    try {
      const res = await fetchStockAvailabilityCheck(
        messageId,
        BUSINESS_PERSONA_HEADERS
      );
      this.applyIfShowing(messageId, () => {
        this.data = res.data;
        this.qty = res.data.currentQuantity;
        this.uiState = res.data.status === 'pending' ? 'active' : 'done';
        this.error = null;
      });
    } catch (e: unknown) {
      this.applyIfShowing(messageId, () => {
        this.uiState = 'error';
        this.error =
          e instanceof Error
            ? e.message
            : this.t('business.availability.notFound', 'This availability check was not found.');
      });
    }
  }

  private async submit(action: 'confirm' | 'unavailable'): Promise<void> {
    const messageId = this.messageId;
    const data = this.data;
    if (!messageId || !data || this.uiState === 'submitting') return;
    runInAction(() => {
      this.uiState = 'submitting';
      this.error = null;
    });
    try {
      const body =
        action === 'confirm' && this.qty !== data.currentQuantity
          ? { action: 'adjust' as const, quantity: this.qty }
          : { action };
      const res = await respondStockAvailabilityCheck(
        messageId,
        body,
        BUSINESS_PERSONA_HEADERS
      );
      this.applyIfShowing(messageId, () => {
        this.data = res.data;
        this.uiState = 'done';
      });
    } catch (e: unknown) {
      this.applyIfShowing(messageId, () => {
        this.uiState = 'active';
        this.error =
          e instanceof Error
            ? e.message
            : this.t('common.error', 'Something went wrong');
      });
    }
  }
}
