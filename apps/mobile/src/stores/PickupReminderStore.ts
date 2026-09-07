import { makeAutoObservable } from 'mobx';
import type { PickupReminderPayload } from '../types/pickupReminder';

export class PickupReminderStore {
  visible = false;
  payload: PickupReminderPayload | null = null;
  private pending: PickupReminderPayload | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  show(payload: PickupReminderPayload): void {
    this.payload = payload;
    this.visible = true;
  }

  queuePending(payload: PickupReminderPayload): void {
    this.pending = payload;
  }

  flushPending(): boolean {
    if (!this.pending) return false;
    this.show(this.pending);
    this.pending = null;
    return true;
  }

  dismiss(): void {
    this.visible = false;
    this.payload = null;
  }

  reset(): void {
    this.dismiss();
    this.pending = null;
  }
}
