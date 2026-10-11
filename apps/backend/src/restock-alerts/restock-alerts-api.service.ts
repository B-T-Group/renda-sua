import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { isMissingRestockAlertsSchema } from '../hasura/hasura-request.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { InventoryItemsService } from '../inventory-items/inventory-items.service';
import { NotificationActionTokenService } from '../notifications/orchestration/notification-action-token.service';
import { NotificationAnalyticsService } from '../notifications/orchestration/notification-analytics.service';
import { HasuraRestockRepository, sellableUnits } from './restock-alerts.repository';
import { RESTOCK_STOP_ACTION_PREFIX } from './restock-alerts.notifier';
import { marketRows, resolveFlag } from './restock-alerts.processor';
import {
  RESTOCK_FLAG_KEY,
  RESTOCK_RULES,
  type RestockChannel,
} from './restock-alerts.types';

const BACK_IN_STOCK_WINDOW_MS = 48 * 60 * 60 * 1000;

const Q_USER_COUNTRY = `
  query RestockUserCountry($userId: uuid!) {
    users_by_pk(id: $userId) {
      country
    }
  }
`;
const Q_PREFS = `
  query RestockPrefs($userId: uuid!) {
    user_notification_preferences_by_pk(user_id: $userId) {
      restock_alerts_push_enabled
      restock_alerts_whatsapp_enabled
      restock_alerts_sms_enabled
      whatsapp_enabled
      sms_enabled
    }
    users_by_pk(id: $userId) {
      phone_number
      phone_number_verified
    }
  }
`;
const M_ENSURE_PREFS = `
  mutation RestockEnsurePrefs($userId: uuid!) {
    insert_user_notification_preferences_one(
      object: { user_id: $userId }
      on_conflict: { constraint: user_notification_preferences_pkey, update_columns: [] }
    ) {
      user_id
    }
  }
`;
const M_SET_PREFS = `
  mutation RestockSetPrefs($userId: uuid!, $set: user_notification_preferences_set_input!) {
    update_user_notification_preferences_by_pk(pk_columns: { user_id: $userId }, _set: $set) {
      user_id
    }
  }
`;
const Q_LIKE = `
  query RestockLike($userId: uuid!, $itemId: uuid!) {
    user_item_likes(where: { user_id: { _eq: $userId }, item_id: { _eq: $itemId } }, limit: 1) {
      id
    }
  }
`;
const Q_ALERT = `
  query RestockAlert($userId: uuid!, $itemId: uuid!) {
    restock_alerts(where: { user_id: { _eq: $userId }, item_id: { _eq: $itemId } }, limit: 1) {
      id
      state
      alert_enabled
      expires_at
    }
  }
`;
const M_UPSERT_ALERT = `
  mutation RestockUpsertAlert($object: restock_alerts_insert_input!, $cols: [restock_alerts_update_column!]!) {
    insert_restock_alerts_one(
      object: $object
      on_conflict: { constraint: restock_alerts_user_item_key, update_columns: $cols }
    ) {
      id
      state
      alert_enabled
      expires_at
    }
  }
`;
const Q_USER_LIKES = `
  query RestockUserLikes($userId: uuid!, $limit: Int!) {
    user_item_likes(
      where: { user_id: { _eq: $userId }, item: { moderation_status: { _eq: "approved" } } }
      order_by: { created_at: desc }
      limit: $limit
    ) {
      item_id
      created_at
    }
  }
`;
const Q_USER_ALERTS = `
  query RestockUserAlerts($userId: uuid!) {
    restock_alerts(where: { user_id: { _eq: $userId } }) {
      item_id
      state
      disarm_reason
      alert_enabled
      expires_at
    }
  }
`;
const Q_STOCK_FOR_ITEMS = `
  query RestockStockForItems($itemIds: [uuid!]!) {
    business_inventory(where: { item_id: { _in: $itemIds } }) {
      item_id
      id
      quantity
      reserved_quantity
      is_active
      last_restocked_at
      item_variant {
        quantity
        is_active
      }
      business_location {
        is_active
        address {
          country
        }
      }
    }
  }
`;

export interface ItemAlertView {
  /** 'on' bell filled, 'off' bell muted, 'expired' outline, null when in stock (no bell). */
  state: 'on' | 'off' | 'expired' | null;
  enabled: boolean;
  expires_at: string | null;
}

@Injectable()
export class RestockAlertsApiService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly repo: HasuraRestockRepository,
    private readonly inventoryItems: InventoryItemsService,
    private readonly tokens: NotificationActionTokenService,
    private readonly analytics: NotificationAnalyticsService
  ) {}

  async isEnabledForUser(userId: string): Promise<boolean> {
    const res = await this.hasura.executeQuery<{ users_by_pk: { country: string | null } | null }>(
      Q_USER_COUNTRY,
      { userId }
    );
    const rows = await this.repo.flagRows(RESTOCK_FLAG_KEY);
    return resolveFlag(rows, res.users_by_pk?.country ?? null);
  }

  async assertEnabled(userId: string): Promise<void> {
    if (!(await this.isEnabledForUser(userId))) this.throwDisabled();
  }

  async getPreferences(userId: string) {
    const res = await this.queryPrefs(userId);
    const p = res.user_notification_preferences_by_pk ?? {};
    const u = res.users_by_pk ?? {};
    const hasPhone = !!u.phone_number?.trim();
    return {
      push: p.restock_alerts_push_enabled ?? true,
      whatsapp: p.restock_alerts_whatsapp_enabled ?? false,
      sms: p.restock_alerts_sms_enabled ?? false,
      whatsapp_available: hasPhone && (p.whatsapp_enabled ?? false),
      sms_available: hasPhone && (p.sms_enabled ?? true),
    };
  }

  async patchPreferences(
    userId: string,
    patch: { push?: boolean; whatsapp?: boolean; sms?: boolean }
  ) {
    const set: Record<string, unknown> = {};
    if (patch.push !== undefined) set.restock_alerts_push_enabled = patch.push;
    if (patch.whatsapp !== undefined) set.restock_alerts_whatsapp_enabled = patch.whatsapp;
    if (patch.sms !== undefined) set.restock_alerts_sms_enabled = patch.sms;
    if (Object.keys(set).length === 0) return this.getPreferences(userId);
    await this.mutateOrDisable(M_ENSURE_PREFS, { userId });
    set.updated_at = new Date().toISOString();
    await this.mutateOrDisable(M_SET_PREFS, { userId, set });
    for (const [key, value] of Object.entries(patch)) {
      if (value === false) {
        await this.analytics.track({
          notificationType: 'restock.opt_out',
          category: 'informational',
          userId,
          channel: key as RestockChannel,
          status: 'skipped',
          entityType: 'restock',
          meta: { surface: 'settings', channel: key },
        });
      }
    }
    return this.getPreferences(userId);
  }

  async setItemAlert(userId: string, itemId: string, enabled: boolean) {
    const likes = await this.hasura.executeQuery<any>(Q_LIKE, { userId, itemId });
    if (!likes.user_item_likes?.length) {
      throw new NotFoundException({
        success: false,
        code: 'not_liked',
        message: 'Like the item first',
      });
    }
    const existing = (await this.queryOrDisable<any>(Q_ALERT, { userId, itemId }))
      .restock_alerts?.[0] ?? null;
    const now = new Date();
    let object: Record<string, unknown>;
    let cols: string[];
    if (!enabled) {
      object = { user_id: userId, item_id: itemId, alert_enabled: false };
      cols = ['alert_enabled', 'updated_at'];
    } else if (existing && existing.state !== 'disarmed') {
      // Keep 'sent' (cooldown stays); just switch the bell back on.
      object = { user_id: userId, item_id: itemId, alert_enabled: true };
      cols = ['alert_enabled', 'updated_at'];
    } else {
      object = {
        user_id: userId,
        item_id: itemId,
        alert_enabled: true,
        state: 'armed',
        disarm_reason: null,
        armed_at: now.toISOString(),
        expires_at: new Date(now.getTime() + RESTOCK_RULES.expiryMs).toISOString(),
      };
      cols = ['alert_enabled', 'state', 'disarm_reason', 'armed_at', 'expires_at', 'updated_at'];
    }
    object.updated_at = now.toISOString();
    const out = await this.mutateOrDisable<any>(M_UPSERT_ALERT, { object, cols });
    const row = out.insert_restock_alerts_one;
    await this.analytics.track({
      notificationType: enabled ? 'restock.armed' : 'restock.disarmed',
      category: 'informational',
      userId,
      channel: 'push',
      status: 'skipped',
      entityType: 'restock',
      meta: enabled ? { surface: 'bell' } : { reason: 'user_off', surface: 'bell' },
    });
    return {
      item_id: itemId,
      enabled: row?.alert_enabled ?? enabled,
      state: row?.state ?? 'armed',
      expires_at: row?.expires_at ?? null,
    };
  }

  /** Likes with bell state and back_in_stock (restocked within 48 h), ordered per AC §5. */
  async listLikes(
    userId: string,
    filter: 'all' | 'back_in_stock',
    page: number,
    limit: number,
    now = new Date()
  ) {
    const [likesRes, userRes, alertsRes] = await Promise.all([
      this.hasura.executeQuery<any>(Q_USER_LIKES, { userId, limit: 500 }),
      this.hasura.executeQuery<any>(Q_USER_COUNTRY, { userId }),
      this.queryAlertsOrEmpty(userId),
    ]);
    const country: string | null = userRes.users_by_pk?.country ?? null;
    const likes: Array<{ item_id: string; created_at: string }> = likesRes.user_item_likes ?? [];
    const alertByItem = new Map<string, any>(
      (alertsRes.restock_alerts ?? []).map((a: any) => [a.item_id, a])
    );
    const itemIds = likes.map((l) => l.item_id);
    const stockRows: any[] = itemIds.length
      ? (await this.hasura.executeQuery<any>(Q_STOCK_FOR_ITEMS, { itemIds })).business_inventory ?? []
      : [];
    const byItem = new Map<string, any[]>();
    for (const r of stockRows) byItem.set(r.item_id, [...(byItem.get(r.item_id) ?? []), r]);

    interface Entry {
      itemId: string;
      inStock: boolean;
      restockedAt: Date | null;
      backInStock: boolean;
      alert: ItemAlertView;
    }
    const entries: Entry[] = likes.map((l) => {
      const rows = (byItem.get(l.item_id) ?? []).map((r) => ({
        inventoryId: r.id,
        available: sellableUnits(r),
        locationActive: r.business_location?.is_active === true,
        country: r.business_location?.address?.country ?? null,
        lastRestockedAt: r.last_restocked_at ? new Date(r.last_restocked_at) : null,
      }));
      const inMarket = marketRows({ item: null, rows }, country);
      const live = inMarket.filter((r) => r.available >= 1);
      const inStock = live.length > 0;
      const stamps = live.map((r) => r.lastRestockedAt?.getTime() ?? 0).filter((t) => t > 0);
      const restockedAt = stamps.length ? new Date(Math.max(...stamps)) : null;
      const backInStock =
        inStock && !!restockedAt && now.getTime() - restockedAt.getTime() <= BACK_IN_STOCK_WINDOW_MS;
      return {
        itemId: l.item_id,
        inStock,
        restockedAt,
        backInStock,
        alert: inStock ? { state: null, enabled: true, expires_at: null } : this.alertView(alertByItem.get(l.item_id), l.created_at, now),
      };
    });
    const rank = (e: Entry) => (e.backInStock ? 0 : e.inStock ? 1 : 2);
    const filtered = entries
      .filter((e) => (filter === 'back_in_stock' ? e.backInStock : true))
      .sort((a, b) => rank(a) - rank(b));
    const total = filtered.length;
    const start = (page - 1) * limit;
    const pageEntries = filtered.slice(start, start + limit);
    const listings = await this.inventoryItems.getBestListingsForCatalogItemIds(
      pageEntries.map((e) => e.itemId)
    );
    const listingByItem = new Map(listings.map((l: any) => [l.item_id, l]));
    const items = pageEntries
      .map((e) => {
        const listing = listingByItem.get(e.itemId);
        if (!listing) return null;
        return {
          ...listing,
          liked: true,
          restock_alert: e.alert,
          back_in_stock: e.backInStock,
          restocked_at: e.restockedAt ? e.restockedAt.toISOString() : null,
          in_stock: e.inStock,
        };
      })
      .filter(Boolean);
    return {
      items,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  private alertView(row: any | undefined, likedAt: string, now: Date): ItemAlertView {
    if (!row) {
      const expires = new Date(new Date(likedAt).getTime() + RESTOCK_RULES.expiryMs);
      return {
        state: expires < now ? 'expired' : 'on',
        enabled: true,
        expires_at: expires.toISOString(),
      };
    }
    const expired =
      row.disarm_reason === 'expired' || (row.expires_at && new Date(row.expires_at) < now);
    if (expired) return { state: 'expired', enabled: row.alert_enabled, expires_at: row.expires_at };
    if (!row.alert_enabled || row.state === 'disarmed') {
      return { state: 'off', enabled: false, expires_at: row.expires_at };
    }
    return { state: 'on', enabled: true, expires_at: row.expires_at };
  }

  /** "Stop restock alerts" from a message: signed single-use token, turns off that channel only. */
  async stopFromMessage(token: string) {
    const payload = await this.tokens.verify(token);
    if (!payload.action?.startsWith(RESTOCK_STOP_ACTION_PREFIX)) {
      throw new UnauthorizedException('Invalid action token');
    }
    const channel = payload.action.slice(RESTOCK_STOP_ACTION_PREFIX.length) as RestockChannel;
    if (!['push', 'whatsapp', 'sms'].includes(channel)) {
      throw new BadRequestException('Unknown channel');
    }
    const set: Record<string, unknown> = {
      [`restock_alerts_${channel}_enabled`]: false,
      updated_at: new Date().toISOString(),
    };
    await this.mutateOrDisable(M_ENSURE_PREFS, { userId: payload.userId });
    await this.mutateOrDisable(M_SET_PREFS, { userId: payload.userId, set });
    await this.analytics.track({
      notificationType: 'restock.opt_out',
      category: 'informational',
      userId: payload.userId,
      channel,
      status: 'skipped',
      entityType: 'restock',
      meta: { surface: 'message', channel },
    });
    return { channel, stopped: true };
  }

  private throwDisabled(): never {
    throw new NotFoundException({
      success: false,
      code: 'restock_alerts_disabled',
      message: 'Restock alerts are not available',
    });
  }

  private async queryOrDisable<T>(doc: string, vars: Record<string, unknown>): Promise<T> {
    try {
      return await this.hasura.executeQuery<T>(doc, vars);
    } catch (error: any) {
      if (isMissingRestockAlertsSchema(error)) this.throwDisabled();
      throw error;
    }
  }

  private async mutateOrDisable<T>(doc: string, vars: Record<string, unknown>): Promise<T> {
    try {
      return await this.hasura.executeMutation<T>(doc, vars);
    } catch (error: any) {
      if (isMissingRestockAlertsSchema(error)) this.throwDisabled();
      throw error;
    }
  }

  private async queryAlertsOrEmpty(userId: string) {
    try {
      return await this.hasura.executeQuery<any>(Q_USER_ALERTS, { userId });
    } catch (error: any) {
      if (isMissingRestockAlertsSchema(error)) return { restock_alerts: [] };
      throw error;
    }
  }

  private async queryPrefs(userId: string) {
    try {
      return await this.hasura.executeQuery<any>(Q_PREFS, { userId });
    } catch (error: any) {
      if (isMissingRestockAlertsSchema(error)) return {};
      throw error;
    }
  }
}
