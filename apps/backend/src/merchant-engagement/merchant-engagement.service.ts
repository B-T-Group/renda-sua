import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { isDefaultOperatingHours } from '../common/operating-hours.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isActivePersona } from '../users/persona.util';
import {
  approvedForInterest,
  CATALOG_TARGET,
  nextStepCopy,
  readinessPercent,
  resolveEngagementPushId,
} from './merchant-engagement-eligibility';
import {
  buildEngagementPushMessage,
  buildWeeklyDigestHtml,
} from './merchant-engagement.messages';
import type {
  MerchantEngagementCandidate,
  MerchantEngagementChannel,
  MerchantEngagementPushId,
} from './merchant-engagement.types';

@Injectable()
export class MerchantEngagementService {
  constructor(
    private readonly hasuraSystem: HasuraSystemService,
    private readonly hasuraUser: HasuraUserService,
    private readonly notifications: NotificationsService
  ) {}

  async getTipsRemindersPreference(): Promise<{ tips_reminders_enabled: boolean }> {
    const businessId = await this.requireBusinessId();
    const enabled = await this.fetchTipsRemindersEnabled(businessId);
    return { tips_reminders_enabled: enabled };
  }

  async setTipsRemindersPreference(
    enabled: boolean
  ): Promise<{ tips_reminders_enabled: boolean }> {
    const businessId = await this.requireBusinessId();
    const query = `
      mutation SetTipsReminders($businessId: uuid!, $enabled: Boolean!) {
        update_businesses_by_pk(
          pk_columns: { id: $businessId }
          _set: { tips_reminders_enabled: $enabled }
        ) { tips_reminders_enabled }
      }
    `;
    const res = await this.hasuraSystem.executeQuery<{
      update_businesses_by_pk: { tips_reminders_enabled: boolean } | null;
    }>(query, { businessId, enabled: !!enabled });
    return {
      tips_reminders_enabled:
        res.update_businesses_by_pk?.tips_reminders_enabled ?? !!enabled,
    };
  }

  async runDailyEngagementPushes(): Promise<number> {
    let sent = 0;
    const now = new Date();
    for await (const c of this.iterateLiveMerchantCandidates()) {
      if (!c.hasExpoPush) continue;
      const ok = await this.trySendPushForCandidate(c, now);
      if (ok) sent += 1;
    }
    return sent;
  }

  async runWeeklyDigests(): Promise<number> {
    let sent = 0;
    const now = new Date();
    for await (const c of this.iterateLiveMerchantCandidates()) {
      if (c.hasExpoPush || !c.email) continue;
      const ok = await this.trySendDigestForCandidate(c, now);
      if (ok) sent += 1;
    }
    return sent;
  }

  private async trySendPushForCandidate(
    c: MerchantEngagementCandidate,
    now: Date
  ): Promise<boolean> {
    if (await this.sentAnyToday(c.businessId, now)) return false;
    const lastSent = await this.loadLastSentMap(c.businessId);
    const pushId = resolveEngagementPushId(c, now, lastSent);
    if (!pushId || pushId === 'email_weekly_digest') return false;
    const msg = buildEngagementPushMessage(pushId, c.preferredLanguage);
    const result = await this.notifications.sendInternalPushByUserId(
      c.userId,
      msg.title,
      msg.body,
      msg.data
    );
    if (result.expoSent + result.webSent <= 0) return false;
    await this.logSend(c.businessId, pushId, 'push', {});
    return true;
  }

  private async trySendDigestForCandidate(
    c: MerchantEngagementCandidate,
    now: Date
  ): Promise<boolean> {
    if (!c.tipsRemindersEnabled || !c.email) return false;
    const lastSent = await this.loadLastSentMap(c.businessId);
    const prev = lastSent.get('email_weekly_digest');
    if (prev && (now.getTime() - prev.getTime()) / 86400000 < 6) return false;
    const approved = approvedForInterest(c);
    const digest = buildWeeklyDigestHtml({
      businessName: c.businessName,
      readinessPercent: readinessPercent(c),
      approvedCount: approved,
      catalogTarget: CATALOG_TARGET,
      totalProductViews: c.totalProductViews,
      nextStep: nextStepCopy(c, c.preferredLanguage),
      preferredLanguage: c.preferredLanguage,
    });
    const delivered = await this.notifications.sendMerchantEngagementHtmlEmail({
      to: c.email,
      subject: digest.subject,
      html: digest.html,
    });
    if (!delivered) return false;
    await this.logSend(c.businessId, 'email_weekly_digest', 'email', {});
    return true;
  }

  private async requireBusinessId(): Promise<string> {
    const user = await this.hasuraUser.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException('Business user required', HttpStatus.FORBIDDEN);
    }
    return user.business.id;
  }

  private async fetchTipsRemindersEnabled(businessId: string): Promise<boolean> {
    const query = `
      query TipsReminders($id: uuid!) {
        businesses_by_pk(id: $id) { tips_reminders_enabled }
      }
    `;
    const res = await this.hasuraSystem.executeQuery<{
      businesses_by_pk: { tips_reminders_enabled?: boolean } | null;
    }>(query, { id: businessId });
    return res.businesses_by_pk?.tips_reminders_enabled !== false;
  }

  private async sentAnyToday(businessId: string, now: Date): Promise<boolean> {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    const query = `
      query EngagementSentToday($businessId: uuid!, $since: timestamptz!) {
        merchant_engagement_sends_aggregate(
          where: {
            business_id: { _eq: $businessId }
            channel: { _eq: "push" }
            sent_at: { _gte: $since }
          }
        ) { aggregate { count } }
      }
    `;
    const res = await this.hasuraSystem.executeQuery(query, {
      businessId,
      since: start.toISOString(),
    });
    return Number(res?.merchant_engagement_sends_aggregate?.aggregate?.count ?? 0) > 0;
  }

  private async loadLastSentMap(
    businessId: string
  ): Promise<Map<string, Date>> {
    const onceIds = [
      'push_first_order_congrats',
      'push_catalog_10_congrats',
      'push_views_10',
      'push_share_store',
      'email_weekly_digest',
    ];
    const query = `
      query EngagementSends($businessId: uuid!, $onceIds: [String!]!) {
        recent: merchant_engagement_sends(
          where: { business_id: { _eq: $businessId } }
          order_by: { sent_at: desc }
          limit: 100
        ) { push_id sent_at }
        once: merchant_engagement_sends(
          where: {
            business_id: { _eq: $businessId }
            push_id: { _in: $onceIds }
          }
          order_by: { sent_at: desc }
        ) { push_id sent_at }
      }
    `;
    const res = await this.hasuraSystem.executeQuery<{
      recent: Array<{ push_id: string; sent_at: string }>;
      once: Array<{ push_id: string; sent_at: string }>;
    }>(query, { businessId, onceIds });
    const map = new Map<string, Date>();
    for (const row of [...(res.once ?? []), ...(res.recent ?? [])]) {
      if (!map.has(row.push_id)) map.set(row.push_id, new Date(row.sent_at));
    }
    return map;
  }

  private async logSend(
    businessId: string,
    pushId: MerchantEngagementPushId,
    channel: MerchantEngagementChannel,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const mutation = `
      mutation LogEngagementSend(
        $businessId: uuid!
        $pushId: String!
        $channel: String!
        $metadata: jsonb
      ) {
        insert_merchant_engagement_sends_one(
          object: {
            business_id: $businessId
            push_id: $pushId
            channel: $channel
            metadata: $metadata
          }
        ) { id }
      }
    `;
    await this.hasuraSystem.executeQuery(mutation, {
      businessId,
      pushId,
      channel,
      metadata,
    });
  }

  private async *iterateLiveMerchantCandidates(): AsyncGenerator<MerchantEngagementCandidate> {
    const pageSize = 100;
    let offset = 0;
    for (;;) {
      const page = await this.loadLiveMerchantPage(pageSize, offset);
      if (page.length === 0) return;
      for (const b of page) {
        yield await this.hydrateCandidate(b);
      }
      if (page.length < pageSize) return;
      offset += pageSize;
    }
  }

  private async loadLiveMerchantPage(
    limit: number,
    offset: number
  ): Promise<Array<Record<string, any>>> {
    const query = `
      query LiveMerchantsForEngagement($limit: Int!, $offset: Int!) {
        businesses(
          where: {
            can_accept_orders: { _eq: true }
            lifecycle_status: { _neq: "suspended" }
            tips_reminders_enabled: { _eq: true }
          }
          limit: $limit
          offset: $offset
          order_by: { id: asc }
        ) {
          id
          name
          main_interest
          ai_tokens
          tips_reminders_enabled
          can_accept_orders
          lifecycle_status
          created_at
          user_id
          user {
            email
            preferred_language
            mobile_push_tokens_aggregate { aggregate { count } }
          }
          business_locations(where: { is_active: { _eq: true } }) {
            logo_url
            operating_hours
          }
        }
      }
    `;
    const res = await this.hasuraSystem.executeQuery<{
      businesses: Array<Record<string, any>>;
    }>(query, { limit, offset });
    return res.businesses ?? [];
  }

  private async hydrateCandidate(
    b: Record<string, any>
  ): Promise<MerchantEngagementCandidate> {
    const signals = await this.loadCatalogSignals(b.id as string);
    const locs = (b.business_locations ?? []) as Array<{
      logo_url?: string | null;
      operating_hours?: unknown;
    }>;
    return {
      businessId: b.id,
      userId: b.user_id,
      email: b.user?.email ?? null,
      preferredLanguage: b.user?.preferred_language ?? null,
      businessName: b.name ?? 'Store',
      mainInterest: b.main_interest ?? 'sell_items',
      aiTokens: Number(b.ai_tokens ?? 0),
      tipsRemindersEnabled: b.tips_reminders_enabled !== false,
      canAcceptOrders: b.can_accept_orders === true,
      lifecycleStatus: b.lifecycle_status ?? null,
      hasExpoPush:
        Number(b.user?.mobile_push_tokens_aggregate?.aggregate?.count ?? 0) > 0,
      hasLogo: locs.some((l) => Boolean(l.logo_url?.trim())),
      hasOperatingHours: locs.some(
        (l) => !isDefaultOperatingHours(l.operating_hours)
      ),
      liveSince: signals.activatedAt ?? b.created_at ?? null,
      approvedItemCount: signals.approvedItemCount,
      approvedRentalCount: signals.approvedRentalCount,
      pendingItemCount: signals.pendingItemCount,
      rejectedItemCount: signals.rejectedItemCount,
      lastCatalogItemAt: signals.lastCatalogItemAt,
      itemsNeedingAiCleanupCount: signals.itemsNeedingAiCleanupCount,
      topViewedOutOfStockCount: signals.topViewedOutOfStockCount,
      totalProductViews: signals.totalProductViews,
      ordersTotal: signals.ordersTotal,
    };
  }

  private async loadCatalogSignals(businessId: string): Promise<{
    approvedItemCount: number;
    approvedRentalCount: number;
    pendingItemCount: number;
    rejectedItemCount: number;
    lastCatalogItemAt: string | null;
    itemsNeedingAiCleanupCount: number;
    topViewedOutOfStockCount: number;
    totalProductViews: number;
    ordersTotal: number;
    activatedAt: string | null;
  }> {
    const query = `
      query EngagementCatalogSignals($businessId: uuid!) {
        approved: items_aggregate(
          where: {
            business_id: { _eq: $businessId }
            is_active: { _eq: true }
            moderation_status: { _eq: approved }
          }
        ) { aggregate { count } }
        approved_rentals: rental_location_listings_aggregate(
          where: {
            is_active: { _eq: true }
            deleted_at: { _is_null: true }
            moderation_status: { _eq: approved }
            business_location: {
              business_id: { _eq: $businessId }
              is_active: { _eq: true }
            }
            rental_item: {
              is_active: { _eq: true }
              deleted_at: { _is_null: true }
            }
          }
        ) { aggregate { count } }
        pending: items_aggregate(
          where: {
            business_id: { _eq: $businessId }
            moderation_status: { _in: [pending, ai_reviewing, proposal_pending] }
          }
        ) { aggregate { count } }
        rejected: items_aggregate(
          where: {
            business_id: { _eq: $businessId }
            moderation_status: { _eq: rejected }
          }
        ) { aggregate { count } }
        pending_rentals: rental_location_listings_aggregate(
          where: {
            is_active: { _eq: true }
            deleted_at: { _is_null: true }
            moderation_status: { _in: [pending, ai_reviewing, proposal_pending] }
            business_location: { business_id: { _eq: $businessId } }
          }
        ) { aggregate { count } }
        rejected_rentals: rental_location_listings_aggregate(
          where: {
            deleted_at: { _is_null: true }
            moderation_status: { _eq: rejected }
            business_location: { business_id: { _eq: $businessId } }
          }
        ) { aggregate { count } }
        latest_item: items(
          where: { business_id: { _eq: $businessId } }
          order_by: { created_at: desc }
          limit: 1
        ) { created_at }
        latest_rental: rental_items(
          where: { business_id: { _eq: $businessId }, deleted_at: { _is_null: true } }
          order_by: { created_at: desc }
          limit: 1
        ) { created_at }
        cleanup: items_aggregate(
          where: {
            business_id: { _eq: $businessId }
            is_active: { _eq: true }
            item_images: { is_ai_cleaned: { _eq: false } }
          }
        ) { aggregate { count } }
        views: item_view_events_aggregate(
          where: {
            business_inventory: {
              is_active: { _eq: true }
              business_location: { business_id: { _eq: $businessId } }
            }
          }
        ) { aggregate { count } }
        orders: orders_aggregate(where: { business_id: { _eq: $businessId } }) {
          aggregate { count }
        }
        top_inventory: business_inventory(
          where: {
            is_active: { _eq: true }
            business_location: { business_id: { _eq: $businessId } }
          }
        ) {
          item_id
          computed_available_quantity
          item_view_events_aggregate { aggregate { count } }
        }
        activated: business_lifecycle_status_history(
          where: {
            business_id: { _eq: $businessId }
            to_status: { _eq: active }
          }
          order_by: { created_at: asc }
          limit: 1
        ) { created_at }
      }
    `;
    const res = await this.hasuraSystem.executeQuery(query, { businessId });
    return this.mapCatalogSignals(res);
  }

  private mapCatalogSignals(res: any): {
    approvedItemCount: number;
    approvedRentalCount: number;
    pendingItemCount: number;
    rejectedItemCount: number;
    lastCatalogItemAt: string | null;
    itemsNeedingAiCleanupCount: number;
    topViewedOutOfStockCount: number;
    totalProductViews: number;
    ordersTotal: number;
    activatedAt: string | null;
  } {
    const itemAt = res?.latest_item?.[0]?.created_at as string | undefined;
    const rentalAt = res?.latest_rental?.[0]?.created_at as string | undefined;
    let lastCatalogItemAt: string | null = null;
    if (itemAt && rentalAt) {
      lastCatalogItemAt = itemAt > rentalAt ? itemAt : rentalAt;
    } else {
      lastCatalogItemAt = itemAt ?? rentalAt ?? null;
    }
    return {
      approvedItemCount: Number(res?.approved?.aggregate?.count ?? 0),
      approvedRentalCount: Number(res?.approved_rentals?.aggregate?.count ?? 0),
      pendingItemCount:
        Number(res?.pending?.aggregate?.count ?? 0) +
        Number(res?.pending_rentals?.aggregate?.count ?? 0),
      rejectedItemCount:
        Number(res?.rejected?.aggregate?.count ?? 0) +
        Number(res?.rejected_rentals?.aggregate?.count ?? 0),
      lastCatalogItemAt,
      itemsNeedingAiCleanupCount: Number(res?.cleanup?.aggregate?.count ?? 0),
      topViewedOutOfStockCount: this.countTopViewedOos(res?.top_inventory ?? []),
      totalProductViews: Number(res?.views?.aggregate?.count ?? 0),
      ordersTotal: Number(res?.orders?.aggregate?.count ?? 0),
      activatedAt: (res?.activated?.[0]?.created_at as string | undefined) ?? null,
    };
  }

  private countTopViewedOos(
    rows: Array<{
      item_id: string;
      computed_available_quantity?: number | null;
      item_view_events_aggregate?: { aggregate?: { count?: number } };
    }>
  ): number {
    const byItem = new Map<string, { views: number; qty: number }>();
    for (const row of rows) {
      const views = Number(
        row.item_view_events_aggregate?.aggregate?.count ?? 0
      );
      const qty = Number(row.computed_available_quantity ?? 0);
      const prev = byItem.get(row.item_id) ?? { views: 0, qty: 0 };
      byItem.set(row.item_id, {
        views: prev.views + views,
        qty: prev.qty + qty,
      });
    }
    return Array.from(byItem.values())
      .filter((x) => x.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)
      .filter((x) => x.qty <= 0).length;
  }
}
