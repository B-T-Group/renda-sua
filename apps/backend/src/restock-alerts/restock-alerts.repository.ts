import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { isMissingRestockGraphqlSchema } from '../hasura/hasura-request.util';
import { RestockSchemaUnavailableError } from './restock-alerts.errors';
import { RESTOCK_QUERIES as Q } from './restock-alerts.queries';
import {
  RESTOCK_LOCK_FREE,
  RESTOCK_LOCK_KEY,
  type AlertRow,
  type FinishSend,
  type InventoryRow,
  type ItemStock,
  type LikeRow,
  type NewSend,
  type QueuedSend,
  type RestockEvent,
  type RestockEventStatus,
  type RestockRepository,
  type SentRecord,
  type UserInfo,
} from './restock-alerts.types';

const d = (v: string | null | undefined): Date | null => (v ? new Date(v) : null);

function toAlert(r: any): AlertRow {
  return {
    userId: r.user_id,
    itemId: r.item_id,
    state: r.state,
    enabled: r.alert_enabled,
    armedAt: new Date(r.armed_at),
    expiresAt: d(r.expires_at),
    lastAlertAt: d(r.last_alert_at),
    lastEventId: r.last_event_id ?? null,
  };
}

/** Sellable units for a row: same rule as the SQL helper restock_available_quantity(). */
export function sellableUnits(row: {
  quantity: number | null;
  reserved_quantity: number | null;
  is_active: boolean | null;
  item_variant?: { quantity: number | null; is_active: boolean | null } | null;
}): number {
  if (row.is_active !== true) return 0;
  const avail = Math.max((row.quantity ?? 0) - (row.reserved_quantity ?? 0), 0);
  if (avail < 1) return 0;
  const v = row.item_variant;
  if (!v) return avail;
  if (v.is_active === false) return 0;
  return avail >= (v.quantity ?? 1) ? avail : 0;
}

@Injectable()
export class HasuraRestockRepository implements RestockRepository {
  constructor(private readonly hasura: HasuraSystemService) {}

  private async q<T = any>(query: string, variables?: any) {
    try {
      return await this.hasura.executeQuery<T>(query, variables);
    } catch (error: any) {
      this.rethrowIfSchemaMissing(error);
    }
  }
  private async m<T = any>(query: string, variables?: any) {
    try {
      return await this.hasura.executeMutation<T>(query, variables);
    } catch (error: any) {
      this.rethrowIfSchemaMissing(error);
    }
  }
  private rethrowIfSchemaMissing(error: unknown): never {
    if (isMissingRestockGraphqlSchema(error)) {
      throw new RestockSchemaUnavailableError(error);
    }
    throw error;
  }

  async flagRows(key: string) {
    const res = await this.q<{ application_configurations: any[] }>(Q.flagRows, { key });
    return (res.application_configurations ?? []).map((r) => ({
      country: (r.country_code as string | null) ?? null,
      value: r.boolean_value === true,
    }));
  }

  async acquireLock(now: Date, expiry: Date) {
    const res = await this.m<{ update_application_configurations: { affected_rows: number } }>(
      Q.acquireLock,
      { key: RESTOCK_LOCK_KEY, now: now.toISOString(), expiry: expiry.toISOString() }
    );
    return (res.update_application_configurations?.affected_rows ?? 0) > 0;
  }

  async releaseLock(expiry: Date) {
    await this.m(Q.releaseLock, {
      key: RESTOCK_LOCK_KEY,
      expiry: expiry.toISOString(),
      free: RESTOCK_LOCK_FREE,
    });
  }

  async dueEvents(cutoff: Date, limit: number): Promise<RestockEvent[]> {
    const res = await this.q<{ restock_events: any[] }>(Q.dueEvents, {
      cutoff: cutoff.toISOString(),
      limit,
    });
    return (res.restock_events ?? []).map((e) => ({
      id: e.id,
      itemId: e.item_id,
      inventoryId: e.inventory_id,
      businessLocationId: e.business_location_id,
      createdAt: new Date(e.created_at),
      outOfStockSince: d(e.out_of_stock_since),
    }));
  }

  async setEventStatus(id: string, status: RestockEventStatus, note: string, at: Date) {
    await this.m(Q.setEventStatus, { id, status, note, at: at.toISOString() });
  }

  async itemStock(itemId: string): Promise<ItemStock> {
    const res = await this.q<{ items_by_pk: any; business_inventory: any[] }>(Q.itemStock, {
      itemId,
    });
    const it = res.items_by_pk;
    const rows: InventoryRow[] = (res.business_inventory ?? []).map((r) => ({
      inventoryId: r.id,
      available: sellableUnits(r),
      locationActive: r.business_location?.is_active === true,
      country: r.business_location?.address?.country ?? null,
      lastRestockedAt: d(r.last_restocked_at),
    }));
    return {
      item: it
        ? {
            id: it.id,
            name: it.name ?? '',
            storeName: it.business?.name ?? '',
            visible:
              it.is_active === true &&
              it.status === 'active' &&
              it.moderation_status === 'approved',
          }
        : null,
      rows,
    };
  }

  async fanoutCountSince(itemId: string, since: Date) {
    const res = await this.q(Q.fanoutCount, { itemId, since: since.toISOString() });
    return res.restock_item_fanouts_aggregate?.aggregate?.count ?? 0;
  }

  async likesPage(itemId: string, limit: number, offset: number): Promise<LikeRow[]> {
    const res = await this.q<{ user_item_likes: any[] }>(Q.likesPage, { itemId, limit, offset });
    return (res.user_item_likes ?? []).map((l) => ({
      userId: l.user_id,
      itemId: l.item_id,
      createdAt: new Date(l.created_at),
      country: l.user?.country ?? null,
    }));
  }

  async alertsFor(userIds: string[], itemId: string): Promise<AlertRow[]> {
    if (userIds.length === 0) return [];
    const res = await this.q<{ restock_alerts: any[] }>(Q.alertsFor, { itemId, userIds });
    return (res.restock_alerts ?? []).map(toAlert);
  }

  async markExpired(userId: string, itemId: string) {
    await this.m(Q.markExpired, { userId, itemId });
  }

  async insertSends(rows: NewSend[]) {
    let n = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200).map((r) => ({
        user_id: r.userId,
        item_id: r.itemId,
        event_id: r.eventId,
        idempotency_key: r.idempotencyKey,
        not_before: r.notBefore.toISOString(),
      }));
      const res = await this.m(Q.insertSends, { objects: chunk });
      n += res.insert_restock_alert_sends?.affected_rows ?? 0;
    }
    return n;
  }

  async recordFanout(eventId: string, itemId: string, recipients: number, at: Date) {
    await this.m(Q.recordFanout, {
      object: { event_id: eventId, item_id: itemId, recipients, fanned_out_at: at.toISOString() },
    });
  }

  async recoverStale(before: Date, now: Date) {
    const res = await this.m(Q.recoverStale, {
      before: before.toISOString(),
      now: now.toISOString(),
    });
    return res.update_restock_alert_sends?.affected_rows ?? 0;
  }

  async queuedSends(now: Date, limit: number): Promise<QueuedSend[]> {
    const res = await this.q<{ restock_alert_sends: any[] }>(Q.queuedSends, {
      now: now.toISOString(),
      limit,
    });
    return (res.restock_alert_sends ?? []).map((s) => ({
      id: s.id,
      userId: s.user_id,
      itemId: s.item_id,
      eventId: s.event_id,
      eventCreatedAt: new Date(s.event.created_at),
      attempts: s.attempts,
      idempotencyKey: s.idempotency_key,
    }));
  }

  async user(userId: string): Promise<UserInfo | null> {
    const res = await this.q<{ users_by_pk: any; user_notification_preferences_by_pk: any }>(
      Q.user,
      { userId }
    );
    const u = res.users_by_pk;
    if (!u) return null;
    const p = res.user_notification_preferences_by_pk ?? {};
    return {
      id: u.id,
      country: u.country ?? null,
      timezone: u.timezone ?? null,
      language: u.preferred_language === 'fr' ? 'fr' : 'en',
      phone: u.phone_number?.trim() || null,
      phoneVerified: u.phone_number_verified === true,
      prefs: {
        pushEnabled: p.push_enabled ?? true,
        whatsappEnabled: p.whatsapp_enabled ?? false,
        smsEnabled: p.sms_enabled ?? true,
        restockPush: p.restock_alerts_push_enabled ?? true,
        restockWhatsapp: p.restock_alerts_whatsapp_enabled ?? false,
        restockSms: p.restock_alerts_sms_enabled ?? false,
      },
    };
  }

  async likesAndAlerts(userId: string, itemIds: string[]) {
    const res = await this.q<{ user_item_likes: any[]; restock_alerts: any[] }>(Q.likesAndAlerts, {
      userId,
      itemIds,
    });
    return {
      liked: new Set((res.user_item_likes ?? []).map((l) => l.item_id as string)),
      alerts: (res.restock_alerts ?? []).map(toAlert),
    };
  }

  async activeOrderItemIds(userId: string, itemIds: string[]) {
    const res = await this.q<{ order_items: any[] }>(Q.activeOrderItems, { userId, itemIds });
    return new Set((res.order_items ?? []).map((o) => o.item_id as string));
  }

  async sentSince(userId: string, since: Date): Promise<SentRecord[]> {
    const res = await this.q<{ restock_alert_sends: any[] }>(Q.sentSince, {
      userId,
      since: since.toISOString(),
    });
    return (res.restock_alert_sends ?? []).map((s) => ({
      id: s.id,
      digestKey: s.digest_key ?? null,
      isDigest: s.is_digest === true,
      sentAt: new Date(s.sent_at),
    }));
  }

  async claimSends(ids: string[], now: Date) {
    if (ids.length === 0) return [];
    const res = await this.m(Q.claimSends, { ids, now: now.toISOString() });
    return (res.update_restock_alert_sends?.returning ?? []).map((r: any) => r.id as string);
  }

  async finishSend(row: FinishSend) {
    await this.m(Q.finishSend, {
      id: row.id,
      set: {
        status: 'sent',
        channel: row.channel,
        is_digest: row.isDigest,
        digest_key: row.digestKey,
        digest_item_count: row.digestItemCount,
        quantity_shown: row.quantityShown,
        sent_at: row.sentAt.toISOString(),
        updated_at: row.sentAt.toISOString(),
      },
    });
  }

  async settleSends(
    ids: string[],
    status: 'suppressed' | 'dropped' | 'failed',
    reason: string,
    now: Date
  ) {
    if (ids.length === 0) return;
    await this.m(Q.settleSends, {
      ids,
      set: { status, suppress_reason: reason, last_error: status === 'failed' ? reason : null, updated_at: now.toISOString() },
    });
  }

  async retrySends(ids: string[], notBefore: Date, error: string, now: Date) {
    if (ids.length === 0) return;
    await this.m(Q.settleSends, {
      ids,
      set: {
        status: 'queued',
        not_before: notBefore.toISOString(),
        last_error: error,
        updated_at: now.toISOString(),
      },
    });
  }

  async deferSends(ids: string[], notBefore: Date) {
    if (ids.length === 0) return;
    await this.m(Q.settleSends, {
      ids,
      set: { status: 'queued', not_before: notBefore.toISOString() },
    });
  }

  async recordAlertSent(userId: string, itemId: string, eventId: string, at: Date) {
    await this.m(Q.ensureAlert, { userId, itemId });
    await this.m(Q.recordAlertSent, { userId, itemId, eventId, at: at.toISOString() });
  }
}
