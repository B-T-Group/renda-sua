import { Logger } from '@nestjs/common';
import { comparableCountry } from '../orders/delivery-pricing.util';
import {
  buildDigestMessage,
  buildSingleMessage,
  lowStockQty,
  qtyBucket,
  type Links,
} from './restock-alerts.messages';
import {
  RESTOCK_FLAG_KEY,
  RESTOCK_RULES,
  RESTOCK_WA_TEMPLATE_FLAG_KEY,
  type AlertRow,
  type InventoryRow,
  type ItemStock,
  type NewSend,
  type QueuedSend,
  type RestockAnalytics,
  type RestockChannel,
  type RestockEvent,
  type RestockMessage,
  type RestockNotifier,
  type RestockRepository,
  type UserInfo,
} from './restock-alerts.types';
import { isQuietHour, nextQuietEnd, resolveTimeZone } from './restock-time.util';

export interface RunSummary {
  ran: boolean;
  eventsFannedOut: number;
  sendsQueued: number;
  messagesSent: number;
}

export type LinkBuilder = {
  item(itemId: string): Links;
  likesBackInStock(): Links;
};

const LIKE_PAGE = 500;

/** Same market = same country (ISO code or name). Unknown user country matches everywhere. */
export function sameMarket(userCountry: string | null, rowCountry: string | null): boolean {
  const u = comparableCountry(userCountry ?? '');
  if (!u) return true;
  const r = comparableCountry(rowCountry ?? '');
  return !!r && r === u;
}

export function marketRows(stock: ItemStock, country: string | null): InventoryRow[] {
  return stock.rows.filter((r) => r.locationActive && sameMarket(country, r.country));
}

/**
 * Restock alert processor (#343). No Nest decorators here so it is easy to test with a fake
 * repository and a fake clock; RestockAlertsCron wires it to @Cron.
 */
export class RestockAlertsProcessor {
  private readonly logger = new Logger('RestockAlertsProcessor');

  constructor(
    private readonly repo: RestockRepository,
    private readonly notifier: RestockNotifier,
    private readonly analytics: RestockAnalytics,
    private readonly links: LinkBuilder
  ) {}

  /** Country row first, then global row, then default false. */
  async flagEnabled(key: string, country: string | null): Promise<boolean> {
    return resolveFlag(await this.flagRows(key), country);
  }

  async anyEnabled(): Promise<boolean> {
    const rows = await this.flagRows(RESTOCK_FLAG_KEY, true);
    return rows.some((r) => r.value);
  }

  /** Flag rows are read once per run (a handful of rows), not once per candidate. */
  private flagCache = new Map<string, Array<{ country: string | null; value: boolean }>>();
  private async flagRows(key: string, fresh = false) {
    if (!fresh) {
      const hit = this.flagCache.get(key);
      if (hit) return hit;
    }
    const rows = await this.repo.flagRows(key);
    this.flagCache.set(key, rows);
    return rows;
  }

  /** One locked pass: fan out due events, then deliver queued sends. */
  async run(now: Date): Promise<RunSummary> {
    this.flagCache = new Map();
    const summary: RunSummary = { ran: false, eventsFannedOut: 0, sendsQueued: 0, messagesSent: 0 };
    if (!(await this.anyEnabled())) return summary;
    const expiry = new Date(now.getTime() + RESTOCK_RULES.lockTtlMs);
    if (!(await this.repo.acquireLock(now, expiry))) {
      this.logger.log('restock alerts: another instance holds the lock, skipping');
      return summary;
    }
    summary.ran = true;
    try {
      await this.repo.recoverStale(
        new Date(now.getTime() - RESTOCK_RULES.staleSendingMs),
        now
      );
      await this.fanOutDueEvents(now, summary);
      await this.deliverQueued(now, summary);
    } finally {
      await this.repo
        .releaseLock(expiry)
        .catch((e: any) => this.logger.warn(`restock lock release failed: ${e?.message}`));
    }
    return summary;
  }

  // ---------------------------------------------------------------- fan-out

  private async fanOutDueEvents(now: Date, summary: RunSummary): Promise<void> {
    const cutoff = new Date(now.getTime() - RESTOCK_RULES.debounceMs);
    const events = await this.repo.dueEvents(cutoff, RESTOCK_RULES.batchEvents);
    const latest = new Map<string, RestockEvent>();
    for (const ev of events) {
      const prev = latest.get(ev.itemId);
      if (!prev || ev.createdAt > prev.createdAt) latest.set(ev.itemId, ev);
    }
    for (const ev of events) {
      if (latest.get(ev.itemId)?.id !== ev.id) {
        await this.repo.setEventStatus(ev.id, 'superseded', 'newer_event_for_item', now);
      }
    }
    for (const ev of latest.values()) {
      try {
        const queued = await this.fanOutEvent(ev, now);
        if (queued >= 0) {
          summary.eventsFannedOut += 1;
          summary.sendsQueued += queued;
        }
      } catch (e: any) {
        // Leave the event pending: the next minute retries; sends are idempotent per (event, user).
        this.logger.error(`restock fan-out failed for event ${ev.id}: ${e?.message}`);
      }
    }
  }

  /** Returns the number of sends queued, or -1 when the event was cancelled/suppressed. */
  private async fanOutEvent(ev: RestockEvent, now: Date): Promise<number> {
    const stock = await this.repo.itemStock(ev.itemId);
    if (!stock.item || !stock.item.visible) {
      await this.repo.setEventStatus(ev.id, 'cancelled', 'item_not_visible', now);
      return -1;
    }
    const evRow = stock.rows.find((r) => r.inventoryId === ev.inventoryId);
    if (!evRow || !evRow.locationActive || evRow.available < 1) {
      // AC-2.2: flipped back to 0 inside the window; pairs stay armed.
      await this.repo.setEventStatus(ev.id, 'cancelled', 'debounce_cancelled', now);
      await this.analytics.track('restock.debounce_cancelled', null, { reason: 'sold_out_again' });
      return -1;
    }
    const recent = await this.repo.fanoutCountSince(
      ev.itemId,
      new Date(now.getTime() - RESTOCK_RULES.fanoutCapMs)
    );
    if (recent > 0) {
      await this.repo.setEventStatus(ev.id, 'suppressed', 'fanout_cap_6h', now);
      await this.analytics.track('restock.alert_suppressed', null, { reason: 'fanout_cap' });
      return -1;
    }

    const sends: NewSend[] = [];
    for (let offset = 0; ; offset += LIKE_PAGE) {
      const likes = await this.repo.likesPage(ev.itemId, LIKE_PAGE, offset);
      if (likes.length === 0) break;
      const alerts = await this.repo.alertsFor(
        likes.map((l) => l.userId),
        ev.itemId
      );
      const alertByUser = new Map(alerts.map((a) => [a.userId, a]));
      for (const like of likes) {
        const verdict = await this.qualify(ev, stock, like, alertByUser.get(like.userId) ?? null, now);
        if (verdict === 'send') {
          sends.push({
            userId: like.userId,
            itemId: ev.itemId,
            eventId: ev.id,
            idempotencyKey: `restock:${ev.id}:${like.userId}`,
            notBefore: now,
          });
        }
      }
      if (likes.length < LIKE_PAGE) break;
    }
    if (sends.length > 0) await this.repo.insertSends(sends);
    await this.repo.recordFanout(ev.id, ev.itemId, sends.length, now);
    await this.repo.setEventStatus(ev.id, 'fanned_out', `recipients=${sends.length}`, now);
    return sends.length;
  }

  private async qualify(
    ev: RestockEvent,
    stock: ItemStock,
    like: { userId: string; createdAt: Date; country: string | null },
    alert: AlertRow | null,
    now: Date
  ): Promise<'send' | 'skip'> {
    if (alert && (alert.state === 'disarmed' || !alert.enabled)) return 'skip';
    // AC-2.3: after an alert, wait 24 h before the pair can fire again.
    // (state-independent: an unlike + re-like inside the window must not bypass it)
    if (alert?.lastAlertAt) {
      if (now.getTime() - alert.lastAlertAt.getTime() < RESTOCK_RULES.cooldownMs) {
        await this.analytics.track('restock.alert_suppressed', like.userId, { reason: 'cooldown' });
        return 'skip';
      }
    }
    // 90 days armed with no restock: expire silently (armed at like time, or when the item sold out).
    const armedSince = Math.max(
      (alert?.armedAt ?? like.createdAt).getTime(),
      ev.outOfStockSince?.getTime() ?? 0
    );
    if (ev.createdAt.getTime() - armedSince > RESTOCK_RULES.expiryMs) {
      await this.repo.markExpired(like.userId, ev.itemId);
      await this.analytics.track('restock.disarmed', like.userId, { reason: 'expired' });
      return 'skip';
    }
    if (!(await this.flagEnabled(RESTOCK_FLAG_KEY, like.country))) return 'skip';
    // One alert per 0 -> >=1 transition for the user's market: skip when stock was already there.
    const inMarket = marketRows(stock, like.country);
    if (!inMarket.some((r) => r.available >= 1)) return 'skip';
    const preexisting = inMarket.some(
      (r) =>
        r.available >= 1 &&
        r.inventoryId !== ev.inventoryId &&
        (r.lastRestockedAt === null ||
          r.lastRestockedAt.getTime() < ev.createdAt.getTime() - RESTOCK_RULES.debounceMs)
    );
    return preexisting ? 'skip' : 'send';
  }

  // --------------------------------------------------------------- delivery

  private async deliverQueued(now: Date, summary: RunSummary): Promise<void> {
    const queued = await this.repo.queuedSends(now, RESTOCK_RULES.batchSends);
    const byUser = new Map<string, QueuedSend[]>();
    for (const s of queued) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
    const stockCache = new Map<string, ItemStock>();
    for (const [userId, sends] of byUser) {
      try {
        summary.messagesSent += await this.deliverUser(userId, sends, now, stockCache);
      } catch (e: any) {
        // Never let one user break the batch. Sends stay queued (or stale-recover) and retry.
        this.logger.error(`restock delivery failed for a user: ${e?.message}`);
      }
    }
  }

  private async stockFor(itemId: string, cache: Map<string, ItemStock>): Promise<ItemStock> {
    const hit = cache.get(itemId);
    if (hit) return hit;
    const fresh = await this.repo.itemStock(itemId);
    cache.set(itemId, fresh);
    return fresh;
  }

  /** Channels the user allows for restock alerts, in priority order push > WhatsApp > SMS. */
  async allowedChannels(user: UserInfo): Promise<RestockChannel[]> {
    const out: RestockChannel[] = [];
    if (user.prefs.restockPush && user.prefs.pushEnabled) out.push('push');
    if (
      user.prefs.restockWhatsapp &&
      user.prefs.whatsappEnabled &&
      user.phone &&
      (await this.flagEnabled(RESTOCK_WA_TEMPLATE_FLAG_KEY, user.country))
    ) {
      out.push('whatsapp');
    }
    if (user.prefs.restockSms && user.prefs.smsEnabled && user.phone) out.push('sms');
    return out;
  }

  private async deliverUser(
    userId: string,
    sends: QueuedSend[],
    now: Date,
    stockCache: Map<string, ItemStock>
  ): Promise<number> {
    const ids = (list: QueuedSend[]) => list.map((s) => s.id);
    const user = await this.repo.user(userId);
    if (!user) {
      await this.repo.settleSends(ids(sends), 'dropped', 'user_missing', now);
      return 0;
    }
    if (!(await this.flagEnabled(RESTOCK_FLAG_KEY, user.country))) {
      await this.repo.settleSends(ids(sends), 'dropped', 'flag_off', now);
      return 0;
    }
    const channels = await this.allowedChannels(user);
    if (channels.length === 0) {
      await this.repo.settleSends(ids(sends), 'suppressed', 'no_channel', now);
      await this.analytics.track('restock.alert_suppressed', userId, { reason: 'user_off' });
      return 0;
    }

    const itemIds = [...new Set(sends.map((s) => s.itemId))];
    const { liked, alerts } = await this.repo.likesAndAlerts(userId, itemIds);
    const alertByItem = new Map(alerts.map((a) => [a.itemId, a]));
    const activeOrderItems = await this.repo.activeOrderItemIds(userId, itemIds);

    interface Ready {
      send: QueuedSend;
      available: number;
      itemName: string;
      storeName: string;
    }
    const ready: Ready[] = [];
    for (const s of sends) {
      const alert = alertByItem.get(s.itemId) ?? null;
      if (!liked.has(s.itemId)) {
        await this.repo.settleSends([s.id], 'dropped', 'unliked', now);
        continue;
      }
      if (alert && (alert.state === 'disarmed' || !alert.enabled)) {
        await this.repo.settleSends([s.id], 'dropped', 'disarmed', now);
        continue;
      }
      if (alert?.lastEventId === s.eventId) {
        await this.repo.settleSends([s.id], 'dropped', 'already_alerted', now);
        continue;
      }
      if (activeOrderItems.has(s.itemId)) {
        await this.repo.settleSends([s.id], 'suppressed', 'in_order', now);
        await this.analytics.track('restock.alert_suppressed', userId, { reason: 'in_cart' });
        continue;
      }
      // AC-2.8: re-check stock for this user's market right before sending.
      const stock = await this.stockFor(s.itemId, stockCache);
      const rows = stock.item?.visible ? marketRows(stock, user.country) : [];
      const available = rows.reduce((sum, r) => sum + Math.max(r.available, 0), 0);
      if (available < 1 || !stock.item) {
        await this.repo.settleSends([s.id], 'dropped', 'sold_out', now);
        await this.analytics.track('restock.alert_suppressed', userId, { reason: 'sold_out' });
        continue;
      }
      ready.push({ send: s, available, itemName: stock.item.name, storeName: stock.item.storeName });
    }
    if (ready.length === 0) return 0;

    // AC-2.7: quiet hours 21:00-08:00 local; queue to 08:00 (market timezone when unknown).
    const tz = resolveTimeZone(user.timezone, comparableCountry(user.country ?? ''));
    if (isQuietHour(now, tz)) {
      await this.repo.deferSends(ids(ready.map((r) => r.send)), nextQuietEnd(now, tz));
      await this.analytics.track('restock.alert_suppressed', userId, { reason: 'quiet_hours' });
      return 0;
    }

    const recent = await this.repo.sentSince(
      userId,
      new Date(now.getTime() - 24 * 60 * 60 * 1000)
    );
    const messageKeys = new Set(recent.map((r) => r.digestKey ?? r.id));
    let messagesToday = messageKeys.size;
    const digestSentToday = recent.some((r) => r.isDigest);

    // AC-2.6: items restocked within 60 minutes of each other share one message.
    ready.sort((a, b) => a.send.eventCreatedAt.getTime() - b.send.eventCreatedAt.getTime());
    const groups: Ready[][] = [];
    for (const r of ready) {
      const g = groups[groups.length - 1];
      if (
        g &&
        r.send.eventCreatedAt.getTime() - g[0].send.eventCreatedAt.getTime() <=
          RESTOCK_RULES.digestWindowMs
      ) {
        g.push(r);
      } else {
        groups.push([r]);
      }
    }

    let sentMessages = 0;
    let digestUsed = digestSentToday;
    for (const group of groups) {
      const isDigest = group.length >= 2;
      if (messagesToday >= RESTOCK_RULES.dailyCap) {
        // AC-2.5: past 3/day only a digest may go out (once per 24 h); a lone item is held back.
        if (!(isDigest && !digestUsed)) {
          await this.repo.settleSends(ids(group.map((g) => g.send)), 'suppressed', 'daily_cap', now);
          await this.analytics.track('restock.alert_suppressed', userId, { reason: 'cap' });
          continue;
        }
      }
      const ok = await this.sendGroup(user, group, isDigest, channels, now);
      if (ok) {
        sentMessages += 1;
        messagesToday += 1;
        if (isDigest) digestUsed = true;
      }
    }
    return sentMessages;
  }

  private async sendGroup(
    user: UserInfo,
    group: Array<{
      send: QueuedSend;
      available: number;
      itemName: string;
      storeName: string;
    }>,
    isDigest: boolean,
    channels: RestockChannel[],
    now: Date
  ): Promise<boolean> {
    // Atomic claim: only the instance that moves queued -> sending may send (belt and braces
    // on top of the cron lock; also guards a duplicate event row).
    const claimedIds = new Set(
      await this.repo.claimSends(
        group.map((g) => g.send.id),
        now
      )
    );
    const claimed = group.filter((g) => claimedIds.has(g.send.id));
    if (claimed.length === 0) return false;
    const digest = isDigest && claimed.length >= 2;
    const first = claimed[0];
    const digestKey = digest
      ? `restock-digest:${user.id}:${[...claimed.map((c) => c.send.id)].sort()[0]}`
      : null;
    const message: RestockMessage = digest
      ? buildDigestMessage({
          locale: user.language,
          count: claimed.length,
          links: this.links.likesBackInStock(),
        })
      : buildSingleMessage({
          locale: user.language,
          itemName: first.itemName,
          storeName: first.storeName,
          available: first.available,
          links: this.links.item(first.send.itemId),
        });
    const claimedSends = claimed.map((c) => c.send);
    const claimedIdList = claimedSends.map((s) => s.id);
    const idempotencyKey = digestKey ?? first.send.idempotencyKey;

    let delivered: RestockChannel | null = null;
    let failed = false;
    let failure = '';
    for (const channel of channels) {
      let outcome: 'sent' | 'skipped' | 'failed';
      try {
        outcome = await this.notifier.send({
          userId: user.id,
          channel,
          locale: user.language,
          message,
          idempotencyKey,
          entityId: first.send.itemId,
          phone: user.phone,
        });
      } catch (e: any) {
        outcome = 'failed';
        failure = String(e?.message ?? 'notifier_error').slice(0, 120);
      }
      if (outcome === 'sent') {
        delivered = channel;
        break;
      }
      if (outcome === 'failed') {
        // AC-2.9: never retry on a second channel unless the first one provably did not send.
        failed = true;
        failure = failure || `${channel}_failed`;
        break;
      }
    }

    if (delivered) {
      for (const c of claimed) {
        await this.repo.finishSend({
          id: c.send.id,
          channel: delivered,
          isDigest: digest,
          digestKey,
          digestItemCount: digest ? claimed.length : null,
          quantityShown: !digest && lowStockQty(c.available) != null ? c.available : null,
          sentAt: now,
        });
        await this.repo.recordAlertSent(user.id, c.send.itemId, c.send.eventId, now);
      }
      await this.analytics.track('restock.alert_sent', user.id, {
        channel: delivered,
        digest,
        qty_bucket: digest ? 'n/a' : qtyBucket(first.available),
      });
      return true;
    }
    if (failed) {
      // Retry only this failed send (not the whole event), with back-off; give up after 3 tries.
      const exhausted = claimedSends.filter((s) => s.attempts + 1 >= RESTOCK_RULES.maxAttempts);
      const retry = claimedSends.filter((s) => s.attempts + 1 < RESTOCK_RULES.maxAttempts);
      if (exhausted.length) {
        await this.repo.settleSends(exhausted.map((s) => s.id), 'failed', failure, now);
      }
      if (retry.length) {
        const wait = RESTOCK_RULES.retryBackoffMs * (retry[0].attempts + 1);
        await this.repo.retrySends(
          retry.map((s) => s.id),
          new Date(now.getTime() + wait),
          failure,
          now
        );
      }
      return false;
    }
    await this.repo.settleSends(claimedIdList, 'suppressed', 'no_channel', now);
    await this.analytics.track('restock.alert_suppressed', user.id, { reason: 'user_off' });
    return false;
  }
}

export function resolveFlag(
  rows: Array<{ country: string | null; value: boolean }>,
  country: string | null
): boolean {
  const iso = comparableCountry(country ?? '');
  if (iso) {
    const own = rows.find((r) => r.country && comparableCountry(r.country) === iso);
    if (own) return own.value;
  }
  const global = rows.find((r) => r.country === null);
  return global ? global.value : false;
}
