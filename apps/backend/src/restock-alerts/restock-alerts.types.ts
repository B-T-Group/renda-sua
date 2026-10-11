export const RESTOCK_FLAG_KEY = 'restock_alerts_v1';
export const RESTOCK_WA_TEMPLATE_FLAG_KEY =
  'restock_alerts_whatsapp_template_approved';
export const RESTOCK_LOCK_KEY = 'restock_alerts_cron_lock';
export const RESTOCK_LOCK_FREE = '1970-01-01T00:00:00.000Z';

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const RESTOCK_RULES = {
  debounceMs: 10 * MINUTE_MS,
  cooldownMs: 24 * HOUR_MS,
  fanoutCapMs: 6 * HOUR_MS,
  dailyCap: 3,
  digestWindowMs: 60 * MINUTE_MS,
  expiryMs: 90 * DAY_MS,
  quietStartHour: 21,
  quietEndHour: 8,
  lowStockMax: 5,
  lockTtlMs: 30 * MINUTE_MS,
  staleSendingMs: 30 * MINUTE_MS,
  maxAttempts: 3,
  retryBackoffMs: 5 * MINUTE_MS,
  batchEvents: 50,
  batchSends: 200,
} as const;

export type RestockChannel = 'push' | 'whatsapp' | 'sms';

export type RestockEventStatus =
  | 'fanned_out'
  | 'cancelled'
  | 'superseded'
  | 'suppressed';

export type RestockSendStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'suppressed'
  | 'dropped';

export interface RestockEvent {
  id: string;
  itemId: string;
  inventoryId: string;
  businessLocationId: string;
  createdAt: Date;
  outOfStockSince: Date | null;
}

export interface ItemInfo {
  id: string;
  name: string;
  storeName: string;
  /** items.is_active, status = active and moderation_status = approved */
  visible: boolean;
}

export interface InventoryRow {
  inventoryId: string;
  /** quantity - reserved, already 0 when the row is not sellable (inactive, variant not sellable). */
  available: number;
  locationActive: boolean;
  /** Country as stored on the location address (ISO code or name). */
  country: string | null;
  lastRestockedAt: Date | null;
}

export interface ItemStock {
  item: ItemInfo | null;
  rows: InventoryRow[];
}

export interface AlertRow {
  userId: string;
  itemId: string;
  state: 'armed' | 'sent' | 'disarmed';
  enabled: boolean;
  armedAt: Date;
  lastAlertAt: Date | null;
  lastEventId: string | null;
}

export interface LikeRow {
  userId: string;
  itemId: string;
  createdAt: Date;
  country: string | null;
}

export interface UserInfo {
  id: string;
  country: string | null;
  timezone: string | null;
  language: 'en' | 'fr';
  phone: string | null;
  phoneVerified: boolean;
  prefs: {
    pushEnabled: boolean;
    whatsappEnabled: boolean;
    smsEnabled: boolean;
    restockPush: boolean;
    restockWhatsapp: boolean;
    restockSms: boolean;
  };
}

export interface QueuedSend {
  id: string;
  userId: string;
  itemId: string;
  eventId: string;
  eventCreatedAt: Date;
  attempts: number;
  idempotencyKey: string;
}

export interface SentRecord {
  id: string;
  digestKey: string | null;
  isDigest: boolean;
  sentAt: Date;
}

export interface NewSend {
  userId: string;
  itemId: string;
  eventId: string;
  idempotencyKey: string;
  notBefore: Date;
}

export interface FinishSend {
  id: string;
  channel: RestockChannel;
  isDigest: boolean;
  digestKey: string | null;
  digestItemCount: number | null;
  quantityShown: number | null;
  sentAt: Date;
}

/** All persistence the processor needs. Hasura-backed in production, in-memory in tests. */
export interface RestockRepository {
  /** Active rows for restock_alerts_v1 (or another key): country_code null = global. */
  flagRows(key: string): Promise<Array<{ country: string | null; value: boolean }>>;
  acquireLock(now: Date, expiry: Date): Promise<boolean>;
  releaseLock(expiry: Date): Promise<void>;

  dueEvents(cutoff: Date, limit: number): Promise<RestockEvent[]>;
  setEventStatus(
    id: string,
    status: RestockEventStatus,
    note: string,
    at: Date
  ): Promise<void>;
  itemStock(itemId: string): Promise<ItemStock>;
  fanoutCountSince(itemId: string, since: Date): Promise<number>;
  likesPage(itemId: string, limit: number, offset: number): Promise<LikeRow[]>;
  alertsFor(userIds: string[], itemId: string): Promise<AlertRow[]>;
  markExpired(userId: string, itemId: string): Promise<void>;
  insertSends(rows: NewSend[]): Promise<number>;
  recordFanout(eventId: string, itemId: string, recipients: number, at: Date): Promise<void>;

  recoverStale(before: Date, now: Date): Promise<number>;
  queuedSends(now: Date, limit: number): Promise<QueuedSend[]>;
  user(userId: string): Promise<UserInfo | null>;
  likesAndAlerts(
    userId: string,
    itemIds: string[]
  ): Promise<{ liked: Set<string>; alerts: AlertRow[] }>;
  activeOrderItemIds(userId: string, itemIds: string[]): Promise<Set<string>>;
  sentSince(userId: string, since: Date): Promise<SentRecord[]>;
  claimSends(ids: string[], now: Date): Promise<string[]>;
  finishSend(row: FinishSend): Promise<void>;
  settleSends(
    ids: string[],
    status: 'suppressed' | 'dropped' | 'failed',
    reason: string,
    now: Date
  ): Promise<void>;
  retrySends(ids: string[], notBefore: Date, error: string, now: Date): Promise<void>;
  deferSends(ids: string[], notBefore: Date): Promise<void>;
  recordAlertSent(
    userId: string,
    itemId: string,
    eventId: string,
    at: Date
  ): Promise<void>;
}

export interface RestockMessage {
  kind: 'single' | 'digest';
  push: { title: string; body: string };
  sms: string;
  whatsapp: Record<string, string>;
  url: string;
  appLink: string;
  path: string;
}

export type NotifierOutcome = 'sent' | 'skipped' | 'failed';

export interface RestockNotifier {
  send(params: {
    userId: string;
    channel: RestockChannel;
    locale: 'en' | 'fr';
    message: RestockMessage;
    idempotencyKey: string;
    entityId: string;
    phone: string | null;
  }): Promise<NotifierOutcome>;
}

export interface RestockAnalytics {
  track(
    event: string,
    userId: string | null,
    meta: Record<string, string | number | boolean>
  ): Promise<void>;
}
