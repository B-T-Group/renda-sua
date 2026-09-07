import { makeAutoObservable } from 'mobx';
import type { StorePickupReminderPayload } from '../types/storePickupReminder';

export class StorePickupReminderStore {
  visible = false;
  payload: StorePickupReminderPayload | null = null;
  showCancel = false;
  private pending: StorePickupReminderPayload | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  show(payload: StorePickupReminderPayload): void {
    this.payload = payload;
    this.visible = true;
    this.showCancel = false;
  }

  queuePending(payload: StorePickupReminderPayload): void {
    this.pending = payload;
  }

  flushPending(): boolean {
    if (!this.pending) return false;
    this.show(this.pending);
    this.pending = null;
    return true;
  }

  openCancel(): void {
    this.showCancel = true;
  }

  closeCancel(): void {
    this.showCancel = false;
  }

  dismiss(): void {
    this.visible = false;
    this.payload = null;
    this.showCancel = false;
  }

  reset(): void {
    this.dismiss();
    this.pending = null;
  }
}
