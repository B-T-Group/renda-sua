import { makeAutoObservable } from 'mobx';
import type { ReferralRejectionPayload } from '../types/referralRejection';

export class ReferralRejectionStore {
  visible = false;
  payload: ReferralRejectionPayload | null = null;
  private pending: ReferralRejectionPayload | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  show(payload: ReferralRejectionPayload): void {
    this.payload = payload;
    this.visible = true;
  }

  queuePending(payload: ReferralRejectionPayload): void {
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
