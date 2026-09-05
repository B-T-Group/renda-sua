export type FulfillmentTiming = 'asap' | 'scheduled';

export type AsapDisabledReason =
  | 'merchant_closed'
  | 'too_close_to_close'
  | 'merchant_paused';

export interface AsapAvailability {
  available: boolean;
  reason?: AsapDisabledReason;
  opensAt?: string | null;
  estimatedPrepMinutes: number;
  estimatedReadyAt?: string;
  estimatedFulfillBy?: string;
  scheduleRequired: boolean;
}

export interface FulfillmentPromise {
  fulfillmentTiming: FulfillmentTiming;
  promisedReadyAt: Date;
  promisedFulfillBy: Date;
}

export interface PromiseOrderSnapshot {
  id: string;
  fulfillmentMethod?: string | null;
  requiresFastDelivery?: boolean | null;
  estimatedPrepMinutes?: number | null;
  fulfillmentTiming?: string | null;
  promisedReadyAt?: string | null;
  promisedFulfillBy?: string | null;
  currentStatus?: string | null;
  businessId: string;
  deliveryTimeWindows?: Array<{
    preferredDate?: string | null;
    slotStart?: string | null;
    slotEnd?: string | null;
  }> | null;
  businessLocation?: { address?: { country?: string | null } | null } | null;
  deliveryAddress?: { country?: string | null } | null;
}