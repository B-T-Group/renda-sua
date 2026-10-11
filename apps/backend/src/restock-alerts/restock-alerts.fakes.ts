import { RestockAlertsProcessor, type LinkBuilder } from './restock-alerts.processor';
import {
  RESTOCK_FLAG_KEY,
  RESTOCK_WA_TEMPLATE_FLAG_KEY,
  type AlertRow,
  type FinishSend,
  type InventoryRow,
  type ItemInfo,
  type ItemStock,
  type LikeRow,
  type NewSend,
  type NotifierOutcome,
  type QueuedSend,
  type RestockAnalytics,
  type RestockChannel,
  type RestockEvent,
  type RestockEventStatus,
  type RestockNotifier,
  type RestockRepository,
  type SentRecord,
  type UserInfo,
} from './restock-alerts.types';

export interface FakeSend {
  id: string;
  userId: string;
  itemId: string;
  eventId: string;
  idempotencyKey: string;
  status: string;
  reason?: string;
  channel?: RestockChannel;
  isDigest: boolean;
  digestKey: string | null;
  attempts: number;
  notBefore: Date;
  sentAt?: Date;
  updatedAt: Date;
}

export const T0 = new Date('2026-10-12T15:00:00.000Z'); // 11:00 Toronto, 16:00 Douala
export const min = (n: number) => n * 60 * 1000;
export const hour = (n: number) => n * 60 * min(1);
export const at = (base: Date, ms: number) => new Date(base.getTime() + ms);

/** In-memory repository with the same atomic semantics as the Hasura one (lock, claim, unique keys). */
export class FakeRepo implements RestockRepository {
  flags: Array<{ key: string; country: string | null; value: boolean }> = [
    { key: RESTOCK_FLAG_KEY, country: null, value: true },
  ];
  lockExpiry = new Date(0);
  lockGrantAlways = false;
  items = new Map<string, ItemInfo>();
  rows = new Map<string, Array<InventoryRow & { itemId: string }>>();
  events: Array<RestockEvent & { status: string; note?: string }> = [];
  likes: LikeRow[] = [];
  alerts: AlertRow[] = [];
  users = new Map<string, UserInfo>();
  sends: FakeSend[] = [];
  fanouts: Array<{ eventId: string; itemId: string; at: Date; recipients: number }> = [];
  activeOrders = new Set<string>(); // `${userId}:${itemId}`
  seq = 0;

  flagRows(key: string) {
    return Promise.resolve(
      this.flags.filter((f) => f.key === key).map((f) => ({ country: f.country, value: f.value }))
    );
  }
  async acquireLock(now: Date, expiry: Date) {
    if (this.lockGrantAlways || this.lockExpiry < now) {
      this.lockExpiry = expiry;
      return true;
    }
    return false;
  }
  async releaseLock(expiry: Date) {
    if (this.lockExpiry.getTime() === expiry.getTime()) this.lockExpiry = new Date(0);
  }
  async dueEvents(cutoff: Date, limit: number) {
    return this.events
      .filter((e) => e.status === 'pending' && e.createdAt <= cutoff)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
  }
  async setEventStatus(id: string, status: RestockEventStatus, note: string) {
    const e = this.events.find((x) => x.id === id && x.status === 'pending');
    if (e) {
      e.status = status;
      e.note = note;
    }
  }
  async itemStock(itemId: string): Promise<ItemStock> {
    return { item: this.items.get(itemId) ?? null, rows: this.rows.get(itemId) ?? [] };
  }
  async fanoutCountSince(itemId: string, since: Date) {
    return this.fanouts.filter((f) => f.itemId === itemId && f.at >= since).length;
  }
  async likesPage(itemId: string, limit: number, offset: number) {
    return this.likes.filter((l) => l.itemId === itemId).slice(offset, offset + limit);
  }
  async alertsFor(userIds: string[], itemId: string) {
    return this.alerts.filter((a) => a.itemId === itemId && userIds.includes(a.userId));
  }
  async markExpired(userId: string, itemId: string) {
    const a = this.alerts.find((x) => x.userId === userId && x.itemId === itemId);
    if (a) a.state = 'disarmed';
    else
      this.alerts.push({
        userId,
        itemId,
        state: 'disarmed',
        enabled: true,
        armedAt: new Date(0),
        lastAlertAt: null,
        lastEventId: null,
      });
  }
  async insertSends(rows: NewSend[]) {
    let n = 0;
    for (const r of rows) {
      if (this.sends.some((s) => s.idempotencyKey === r.idempotencyKey)) continue;
      this.sends.push({
        id: `send-${++this.seq}`,
        userId: r.userId,
        itemId: r.itemId,
        eventId: r.eventId,
        idempotencyKey: r.idempotencyKey,
        status: 'queued',
        isDigest: false,
        digestKey: null,
        attempts: 0,
        notBefore: r.notBefore,
        updatedAt: r.notBefore,
      });
      n++;
    }
    return n;
  }
  async recordFanout(eventId: string, itemId: string, recipients: number, atTime: Date) {
    if (!this.fanouts.some((f) => f.eventId === eventId)) {
      this.fanouts.push({ eventId, itemId, recipients, at: atTime });
    }
  }
  async recoverStale(before: Date, now: Date) {
    let n = 0;
    for (const s of this.sends) {
      if (s.status === 'sending' && s.updatedAt < before) {
        s.status = 'failed';
        s.reason = 'stale_sending';
        s.updatedAt = now;
        n++;
      }
    }
    return n;
  }
  async queuedSends(now: Date, limit: number): Promise<QueuedSend[]> {
    return this.sends
      .filter((s) => s.status === 'queued' && s.notBefore <= now)
      .slice(0, limit)
      .map((s) => ({
        id: s.id,
        userId: s.userId,
        itemId: s.itemId,
        eventId: s.eventId,
        eventCreatedAt: this.events.find((e) => e.id === s.eventId)!.createdAt,
        attempts: s.attempts,
        idempotencyKey: s.idempotencyKey,
      }));
  }
  async user(userId: string) {
    return this.users.get(userId) ?? null;
  }
  async likesAndAlerts(userId: string, itemIds: string[]) {
    return {
      liked: new Set(
        this.likes.filter((l) => l.userId === userId && itemIds.includes(l.itemId)).map((l) => l.itemId)
      ),
      alerts: this.alerts.filter((a) => a.userId === userId && itemIds.includes(a.itemId)),
    };
  }
  async activeOrderItemIds(userId: string, itemIds: string[]) {
    return new Set(itemIds.filter((i) => this.activeOrders.has(`${userId}:${i}`)));
  }
  async sentSince(userId: string, since: Date): Promise<SentRecord[]> {
    return this.sends
      .filter((s) => s.userId === userId && s.status === 'sent' && s.sentAt! >= since)
      .map((s) => ({ id: s.id, digestKey: s.digestKey, isDigest: s.isDigest, sentAt: s.sentAt! }));
  }
  async claimSends(ids: string[], now: Date) {
    const out: string[] = [];
    for (const s of this.sends) {
      if (ids.includes(s.id) && s.status === 'queued') {
        s.status = 'sending';
        s.attempts += 1;
        s.updatedAt = now;
        out.push(s.id);
      }
    }
    return out;
  }
  async finishSend(row: FinishSend) {
    const s = this.sends.find((x) => x.id === row.id && x.status === 'sending');
    if (s) {
      s.status = 'sent';
      s.channel = row.channel;
      s.isDigest = row.isDigest;
      s.digestKey = row.digestKey;
      s.sentAt = row.sentAt;
    }
  }
  async settleSends(ids: string[], status: 'suppressed' | 'dropped' | 'failed', reason: string, now: Date) {
    for (const s of this.sends) {
      if (ids.includes(s.id) && (s.status === 'queued' || s.status === 'sending')) {
        s.status = status;
        s.reason = reason;
        s.updatedAt = now;
      }
    }
  }
  async retrySends(ids: string[], notBefore: Date, error: string, now: Date) {
    for (const s of this.sends) {
      if (ids.includes(s.id) && s.status === 'sending') {
        s.status = 'queued';
        s.notBefore = notBefore;
        s.reason = error;
        s.updatedAt = now;
      }
    }
  }
  async deferSends(ids: string[], notBefore: Date) {
    for (const s of this.sends) if (ids.includes(s.id) && s.status === 'queued') s.notBefore = notBefore;
  }
  async recordAlertSent(userId: string, itemId: string, eventId: string, atTime: Date) {
    let a = this.alerts.find((x) => x.userId === userId && x.itemId === itemId);
    if (!a) {
      a = { userId, itemId, state: 'armed', enabled: true, armedAt: atTime, lastAlertAt: null, lastEventId: null };
      this.alerts.push(a);
    }
    a.state = 'sent';
    a.lastAlertAt = atTime;
    a.lastEventId = eventId;
  }

  // ---- scenario helpers
  addItem(id: string, opts: Partial<ItemInfo> = {}) {
    this.items.set(id, { id, name: `Item ${id}`, storeName: 'Blue Store', visible: true, ...opts });
    if (!this.rows.has(id)) this.rows.set(id, []);
  }
  addRow(itemId: string, inventoryId: string, opts: Partial<InventoryRow> = {}) {
    this.rows.get(itemId)!.push({
      itemId,
      inventoryId,
      available: 3,
      locationActive: true,
      country: 'CM',
      lastRestockedAt: null,
      ...opts,
    });
  }
  setAvailable(itemId: string, inventoryId: string, available: number) {
    this.rows.get(itemId)!.find((r) => r.inventoryId === inventoryId)!.available = available;
  }
  addUser(id: string, opts: Partial<UserInfo> = {}) {
    this.users.set(id, {
      id,
      country: 'CM',
      timezone: 'Africa/Douala',
      language: 'en',
      phone: '+237600000001',
      phoneVerified: true,
      prefs: {
        pushEnabled: true,
        whatsappEnabled: false,
        smsEnabled: true,
        restockPush: true,
        restockWhatsapp: false,
        restockSms: false,
      },
      ...opts,
    });
  }
  like(userId: string, itemId: string, createdAt = at(T0, -hour(24 * 5))) {
    this.likes.push({ userId, itemId, createdAt, country: this.users.get(userId)?.country ?? null });
  }
  event(id: string, itemId: string, inventoryId: string, createdAt: Date, oos: Date | null = null) {
    this.events.push({
      id,
      itemId,
      inventoryId,
      businessLocationId: 'loc-1',
      createdAt,
      outOfStockSince: oos,
      status: 'pending',
    });
  }
  setFlag(key: string, country: string | null, value: boolean) {
    const f = this.flags.find((x) => x.key === key && x.country === country);
    if (f) f.value = value;
    else this.flags.push({ key, country, value });
  }
  sentTo(userId: string) {
    return this.sends.filter((s) => s.userId === userId && s.status === 'sent');
  }
}

export class FakeNotifier implements RestockNotifier {
  calls: Array<{ userId: string; channel: RestockChannel; title: string; sms: string; kind: string; key: string }> = [];
  outcomes: Partial<Record<RestockChannel, NotifierOutcome>> = {};
  throwFor = new Set<string>();
  async send(p: Parameters<RestockNotifier['send']>[0]): Promise<NotifierOutcome> {
    this.calls.push({
      userId: p.userId,
      channel: p.channel,
      title: p.message.push.title,
      sms: p.message.sms,
      kind: p.message.kind,
      key: p.idempotencyKey,
    });
    if (this.throwFor.has(p.userId)) throw new Error('provider down');
    return this.outcomes[p.channel] ?? 'sent';
  }
}

export class FakeAnalytics implements RestockAnalytics {
  events: Array<{ event: string; userId: string | null; meta: Record<string, unknown> }> = [];
  async track(event: string, userId: string | null, meta: Record<string, string | number | boolean>) {
    this.events.push({ event, userId, meta });
  }
}

export const LINKS: LinkBuilder = {
  item: (id) => ({
    url: `https://rendasua.com/app/items/${id}?src=restock_alert`,
    appLink: `rendasua://items/${id}?src=restock_alert`,
    path: `/items/${id}?src=restock_alert`,
  }),
  likesBackInStock: () => ({
    url: 'https://rendasua.com/app/likes?filter=back_in_stock&src=restock_alert',
    appLink: 'rendasua://likes?filter=back_in_stock&src=restock_alert',
    path: '/likes?filter=back_in_stock&src=restock_alert',
  }),
};

export function makeWorld() {
  const repo = new FakeRepo();
  const notifier = new FakeNotifier();
  const analytics = new FakeAnalytics();
  const processor = new RestockAlertsProcessor(repo, notifier, analytics, LINKS);
  return { repo, notifier, analytics, processor };
}

export { RESTOCK_FLAG_KEY, RESTOCK_WA_TEMPLATE_FLAG_KEY };
