import { makeAutoObservable } from 'mobx';
import type { AdminBroadcastPayload } from '../types/adminBroadcast';

export class AdminBroadcastStore {
  visible = false;
  payload: AdminBroadcastPayload | null = null;
  private pending: AdminBroadcastPayload | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  show(payload: AdminBroadcastPayload): void {
    this.payload = payload;
    this.visible = true;
  }

  queuePending(payload: AdminBroadcastPayload): void {
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
