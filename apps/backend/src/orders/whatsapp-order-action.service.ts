import { HttpException, HttpStatus, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DELEGATION_PERMISSIONS } from '../delegations/delegation.constants';
import { phonesEqual } from '../notifications/merchant-order-notify.util';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthorizedBusinessActor } from './authorized-business-actor';
import { OrderAcceptanceService } from './order-acceptance.service';
import type { PendingAcceptanceOrder } from './order-acceptance.types';
import { OrdersService } from './orders.service';
import { whatsappOrderConfirmedMessage } from './whatsapp-order-confirmed.message';

export type MerchantWaAction =
  | 'CONFIRM'
  | 'BUSY'
  | 'DECLINE'
  | 'MARK_AS_READY'
  | 'NOT_READY';

const MARK_READY_NOTIFICATION_TYPES = new Set([
  'order.mark_ready.prompt',
  'order.ready.nudge',
]);

const ACTIONABLE_PROMPT_TYPES = [
  'order.created',
  'order.acceptance.reminder',
  'order.acceptance.escalation',
  'order.mark_ready.prompt',
  'order.ready.nudge',
] as const;

const READY_ACTIONABLE_STATUSES = new Set(['confirmed', 'preparing']);
const PROMPT_LOOKBACK_MS = 48 * 60 * 60 * 1000;

type WaActor =
  | {
      kind: 'owner';
      userId: string;
      businessId: string;
      preferredLanguage?: string | null;
    }
  | {
      kind: 'delegate';
      userId: string;
      businessId: string;
      locationIds: string[];
      preferredLanguage?: string | null;
    }
  | {
      kind: 'location_alert';
      businessId: string;
      locationIds: string[];
      ownerUserId: string;
      preferredLanguage?: string | null;
    }
  | { kind: 'ambiguous' };

type ResolvedWaActor = Exclude<WaActor, { kind: 'ambiguous' }>;

type PendingWaOrder = PendingAcceptanceOrder & {
  business_id?: string | null;
  business_location_id?: string | null;
  fulfillment_timing?: string | null;
  delivery_time_windows?: Array<{ id: string }>;
  business_location?: {
    id: string;
    business_id: string;
    order_alert_phone?: string | null;
    business?: {
      user_id?: string | null;
      user?: { preferred_language?: string | null } | null;
    } | null;
  } | null;
};

type WaUserRow = {
  id: string;
  preferred_language?: string | null;
  business?: { id: string } | null;
  location_delegations?: Array<{
    business_location_id: string;
    business_location?: { business_id: string } | null;
    role?: {
      role_permissions?: Array<{ permission?: { key?: string } | null }>;
    } | null;
  }>;
};

type WaManageDelegation = {
  business_location_id: string;
  business_id: string;
};

const CONFIRMABLE_ACCEPTANCE = [
  'awaiting_acceptance',
  'no_response',
  'grace',
] as const;

const ORDER_ACTION_FIELDS = `
  id order_number current_status acceptance_state
  acceptance_deadline_at grace_deadline_at
  busy_extra_prep_minutes estimated_prep_minutes
  created_at total_amount currency fulfillment_method
  fulfillment_timing business_id business_location_id
  delivery_time_windows(limit: 1) { id }
`;

const RECENT_ORDERS_BIZ = `query WaRecentOrdersBiz($bid: uuid!, $since: timestamptz!) {
  orders(
    where: {
      business_id: { _eq: $bid }
      created_at: { _gte: $since }
    }
    order_by: { created_at: desc }
    limit: 40
  ) { id }
}`;

const RECENT_ORDERS_LOCS = `query WaRecentOrdersLocs($bid: uuid!, $lids: [uuid!]!, $since: timestamptz!) {
  orders(
    where: {
      business_id: { _eq: $bid }
      business_location_id: { _in: $lids }
      created_at: { _gte: $since }
    }
    order_by: { created_at: desc }
    limit: 40
  ) { id }
}`;

const CONFIRMED_ORDERS_BIZ = `query WaConfirmedBiz($bid: uuid!) {
  orders(
    where: {
      business_id: { _eq: $bid }
      current_status: { _in: [confirmed, preparing] }
    }
    order_by: { created_at: asc }
    limit: 2
  ) {
    ${ORDER_ACTION_FIELDS}
  }
}`;

const CONFIRMED_ORDERS_LOCS = `query WaConfirmedLocs($bid: uuid!, $lids: [uuid!]!) {
  orders(
    where: {
      business_id: { _eq: $bid }
      business_location_id: { _in: $lids }
      current_status: { _in: [confirmed, preparing] }
    }
    order_by: { created_at: asc }
    limit: 2
  ) {
    ${ORDER_ACTION_FIELDS}
  }
}`;

const LATEST_PROMPT_QUERY = `query WaLatestPrompt($ids: [uuid!]!, $types: [String!]!, $since: timestamptz!) {
  notification_events(
    where: {
      entity_id: { _in: $ids }
      notification_type: { _in: $types }
      created_at: { _gte: $since }
    }
    order_by: { created_at: desc }
    limit: 1
  ) { entity_id notification_type }
}`;

/**
 * Resolves WhatsApp Confirm / Busy / Decline to acceptance APIs.
 * Interactive replies bind to the outbound template via Meta context.id.
 * Text commands without context still act on the oldest pending order.
 */
@Injectable()
export class WhatsAppOrderActionService {
  private readonly logger = new Logger(WhatsAppOrderActionService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly orders: OrdersService,
    private readonly acceptance: OrderAcceptanceService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notifications: NotificationsService
  ) {}

  async handleAction(params: {
    fromPhone: string;
    action: MerchantWaAction;
    contextMessageId?: string | null;
    preferredLanguage?: string | null;
  }): Promise<{ handled: boolean; message: string }> {
    const bound = await this.handleBoundAction(params);
    if (bound) return bound;
    if (params.action === 'NOT_READY') {
      return {
        handled: true,
        message: this.msgNoneReady(params.preferredLanguage),
      };
    }
    const actor = await this.resolveActor(params.fromPhone);
    if (!actor) {
      return { handled: false, message: this.msgUnknown(params.preferredLanguage) };
    }
    if (actor.kind === 'ambiguous') {
      return { handled: true, message: this.msgAmbiguous(params.preferredLanguage) };
    }
    const remapped = await this.remapUnboundReadyReply(params, actor);
    if (remapped) return remapped;
    if (params.action === 'MARK_AS_READY') {
      return this.handleUnboundMarkReady(params, actor);
    }
    const order = await this.loadOldestPending(actor);
    if (!order) {
      return {
        handled: true,
        message: this.msgNone(this.actionLang(params.preferredLanguage, actor)),
      };
    }
    return {
      handled: true,
      message: await this.runAction(
        params.action,
        order,
        actor,
        this.actionLang(params.preferredLanguage, actor)
      ),
    };
  }

  /**
   * When Yes/No is tapped on a mark-ready / ready-nudge template, remap
   * CONFIRM/DECLINE so we never cancel an order from a "No, not ready" tap.
   */
  resolveActionForBoundTemplate(
    action: MerchantWaAction,
    notificationType?: string | null
  ): MerchantWaAction {
    if (!notificationType || !MARK_READY_NOTIFICATION_TYPES.has(notificationType)) {
      return action;
    }
    if (action === 'CONFIRM') return 'MARK_AS_READY';
    if (action === 'DECLINE') return 'NOT_READY';
    return action;
  }

  /**
   * Free-text Yes/No has no Meta context.id. If the latest merchant prompt
   * is a mark-ready / ready-nudge, remap so "No" cannot cancel a different
   * pending order.
   */
  private async remapUnboundReadyReply(
    params: {
      action: MerchantWaAction;
      preferredLanguage?: string | null;
    },
    actor: ResolvedWaActor
  ): Promise<{ handled: boolean; message: string } | null> {
    if (!this.isUnboundReadyAlias(params.action)) return null;
    const latest = await this.loadLatestActionablePrompt(actor);
    if (!latest) return null;
    if (!MARK_READY_NOTIFICATION_TYPES.has(latest.notificationType)) return null;
    return this.runLatestReadyPromptAction(params, actor, latest);
  }

  private isUnboundReadyAlias(action: MerchantWaAction): boolean {
    return (
      action === 'CONFIRM' ||
      action === 'DECLINE' ||
      action === 'MARK_AS_READY'
    );
  }

  private async runLatestReadyPromptAction(
    params: {
      action: MerchantWaAction;
      preferredLanguage?: string | null;
    },
    actor: ResolvedWaActor,
    latest: { orderId: string; notificationType: string }
  ): Promise<{ handled: boolean; message: string }> {
    const order = await this.loadOrderById(latest.orderId);
    const lang = this.actionLang(params.preferredLanguage, actor);
    if (!order || !this.actorOwnsOrder(actor, order)) {
      return { handled: true, message: this.msgNeedAppReady(lang) };
    }
    if (!READY_ACTIONABLE_STATUSES.has(order.current_status)) {
      return this.ackStaleReadyReply(order, lang);
    }
    const action =
      params.action === 'DECLINE' ? 'NOT_READY' : 'MARK_AS_READY';
    return {
      handled: true,
      message: await this.runAction(
        action,
        order,
        actor,
        lang,
        latest.notificationType
      ),
    };
  }

  private ackStaleReadyReply(
    order: PendingWaOrder,
    lang?: string | null
  ): { handled: boolean; message: string } {
    if (order.current_status === 'ready_for_pickup') {
      return { handled: true, message: this.msgAlreadyReady(order.order_number, lang) };
    }
    return {
      handled: true,
      message: this.msgReadyPromptStale(order.order_number, lang),
    };
  }

  private actorOwnsOrder(actor: ResolvedWaActor, order: PendingWaOrder): boolean {
    if (order.business_id && order.business_id !== actor.businessId) return false;
    if (actor.kind === 'owner') return true;
    const locationId = order.business_location_id;
    return !!locationId && actor.locationIds.includes(locationId);
  }

  private async handleUnboundMarkReady(
    params: {
      contextMessageId?: string | null;
      preferredLanguage?: string | null;
    },
    actor: ResolvedWaActor
  ): Promise<{ handled: boolean; message: string }> {
    const lang = this.actionLang(params.preferredLanguage, actor);
    if (params.contextMessageId?.trim()) {
      return { handled: true, message: this.msgNeedAppReady(lang) };
    }
    const confirmed = await this.loadConfirmedOrders(actor);
    if (!confirmed.length) {
      return { handled: true, message: this.msgNoneReady(lang) };
    }
    if (confirmed.length > 1) {
      return { handled: true, message: this.msgNeedAppReady(lang) };
    }
    return {
      handled: true,
      message: await this.runAction('MARK_AS_READY', confirmed[0], actor, lang),
    };
  }

  private async loadLatestActionablePrompt(
    actor: ResolvedWaActor
  ): Promise<{ orderId: string; notificationType: string } | null> {
    const orderIds = await this.loadRecentActorOrderIds(actor);
    if (!orderIds.length) return null;
    return this.loadLatestPromptForOrders(orderIds);
  }

  private async handleBoundAction(params: {
    fromPhone: string;
    action: MerchantWaAction;
    contextMessageId?: string | null;
    preferredLanguage?: string | null;
  }): Promise<{ handled: boolean; message: string } | null> {
    const wamid = params.contextMessageId?.trim();
    if (!wamid) return null;
    const bound = await this.lookupBoundOrder(wamid);
    if (!bound?.orderId) return null;
    const action = this.resolveActionForBoundTemplate(
      params.action,
      bound.notificationType
    );
    return this.runBoundOrderAction(
      { ...params, action },
      bound.orderId,
      bound.notificationType
    );
  }

  private async runBoundOrderAction(
    params: {
      fromPhone: string;
      action: MerchantWaAction;
      preferredLanguage?: string | null;
    },
    orderId: string,
    notificationType?: string | null
  ): Promise<{ handled: boolean; message: string }> {
    const order = await this.loadOrderById(orderId);
    if (!order) {
      return { handled: true, message: this.msgNone(params.preferredLanguage) };
    }
    if (
      params.action === 'CONFIRM' ||
      params.action === 'BUSY' ||
      params.action === 'DECLINE'
    ) {
      if (!this.isAwaitingAcceptance(order)) {
        return {
          handled: true,
          message: this.msgAlready(order.order_number, params.preferredLanguage),
        };
      }
    }
    if (params.action === 'MARK_AS_READY' || params.action === 'NOT_READY') {
      // Status gate handled in doMarkReady / doNotReady.
    }
    const actor = await this.resolveActorForOrder(params.fromPhone, order);
    if (!actor) {
      return { handled: false, message: this.msgUnknown(params.preferredLanguage) };
    }
    if (actor.kind === 'ambiguous') {
      return { handled: true, message: this.msgAmbiguous(params.preferredLanguage) };
    }
    return {
      handled: true,
      message: await this.runAction(
        params.action,
        order,
        actor,
        this.actionLang(params.preferredLanguage, actor),
        notificationType
      ),
    };
  }

  private async runAction(
    action: MerchantWaAction,
    order: PendingWaOrder,
    actor: ResolvedWaActor,
    lang?: string | null,
    notificationType?: string | null
  ): Promise<string> {
    try {
      if (action === 'CONFIRM') return await this.doConfirm(order, actor, lang);
      if (action === 'BUSY') return await this.doBusy(order, actor, lang);
      if (action === 'DECLINE') return await this.doDecline(order, actor, lang);
      if (action === 'MARK_AS_READY') {
        return await this.doMarkReady(order, actor, lang);
      }
      return await this.doNotReady(order, lang, notificationType);
    } catch (error: any) {
      return this.mapError(error, order, lang);
    }
  }

  private async doMarkReady(
    order: PendingWaOrder,
    actor: ResolvedWaActor,
    lang?: string | null
  ): Promise<string> {
    if (order.current_status === 'ready_for_pickup') {
      return this.msgAlreadyReady(order.order_number, lang);
    }
    if (!READY_ACTIONABLE_STATUSES.has(order.current_status)) {
      return this.msgNotConfirmed(order.order_number, lang);
    }
    await this.orders.completePreparation(
      { orderId: order.id, notes: 'Marked ready from WhatsApp' },
      this.toActor(actor, order)
    );
    return this.msgMarkedReady(order.order_number, lang);
  }

  private async doNotReady(
    order: PendingWaOrder,
    lang?: string | null,
    notificationType?: string | null
  ): Promise<string> {
    if (notificationType !== 'order.ready.nudge') {
      return this.msgNotReadyAck(order.order_number, lang);
    }
    const clientUserId = await this.loadClientUserId(order.id);
    if (clientUserId) {
      await this.notifications.notifyClientOrderNotReady({
        clientUserId,
        orderId: order.id,
        orderNumber: order.order_number,
        preferredLanguage: lang,
      });
    }
    return this.msgNotReadyAck(order.order_number, lang);
  }

  private async doConfirm(
    order: PendingWaOrder,
    actor: ResolvedWaActor,
    lang?: string | null
  ): Promise<string> {
    if (!this.isAsapConfirmable(order)) {
      return this.msgNeedApp(order.order_number, lang);
    }
    await this.orders.confirmOrder(
      { orderId: order.id, notes: 'Confirmed from WhatsApp' },
      this.toActor(actor, order)
    );
    return this.msgConfirmed(
      order.order_number,
      lang,
      order.fulfillment_method
    );
  }

  private async doBusy(
    order: PendingWaOrder,
    actor: ResolvedWaActor,
    lang?: string | null
  ): Promise<string> {
    await this.acceptance.markBusy(order.id, this.busyAuth(actor, order));
    return this.msgBusy(order.order_number, lang);
  }

  private async doDecline(
    order: PendingWaOrder,
    actor: ResolvedWaActor,
    lang?: string | null
  ): Promise<string> {
    await this.orders.cancelOrder(
      {
        orderId: order.id,
        cancellationReasonId: 13, // cannot_fulfill_order (business-specific)
        notes: 'Declined from WhatsApp',
      },
      this.toActor(actor, order)
    );
    return this.msgDeclined(order.order_number, lang);
  }

  private isAsapConfirmable(order: PendingWaOrder): boolean {
    if (order.fulfillment_timing === 'asap') return true;
    const windows = order.delivery_time_windows?.length ?? 0;
    return windows === 0 && order.fulfillment_method !== 'shipping';
  }

  private toActor(
    actor: ResolvedWaActor,
    order: PendingWaOrder
  ): AuthorizedBusinessActor {
    const locationId = this.actorLocationId(actor, order);
    if (!locationId) {
      throw new HttpException(
        'Order has no business location',
        HttpStatus.BAD_REQUEST
      );
    }
    if (actor.kind === 'owner') {
      return {
        userId: actor.userId,
        businessId: actor.businessId,
        locationId,
      };
    }
    if (actor.kind === 'delegate') {
      return {
        userId: actor.userId,
        businessId: actor.businessId,
        locationId,
      };
    }
    return {
      userId: actor.ownerUserId,
      businessId: actor.businessId,
      locationId,
    };
  }

  private actorLocationId(
    actor: ResolvedWaActor,
    order: PendingWaOrder
  ): string {
    if (order.business_location_id) return order.business_location_id;
    if (actor.kind === 'owner') return '';
    return actor.locationIds[0] || '';
  }

  private busyAuth(
    actor: ResolvedWaActor,
    order: PendingWaOrder
  ): {
    userId: string;
    asDelegateLocationId?: string;
    locationAlertAuthorized?: boolean;
  } {
    if (actor.kind === 'owner') return { userId: actor.userId };
    if (actor.kind === 'delegate') {
      return {
        userId: actor.userId,
        asDelegateLocationId: this.actorLocationId(actor, order),
      };
    }
    return {
      userId: actor.ownerUserId,
      locationAlertAuthorized: true,
      asDelegateLocationId: this.actorLocationId(actor, order),
    };
  }

  private isAwaitingAcceptance(order: PendingWaOrder): boolean {
    const state = order.acceptance_state;
    if (order.current_status !== 'pending' || !state) return false;
    return (CONFIRMABLE_ACCEPTANCE as readonly string[]).includes(state);
  }

  private async lookupBoundOrder(
    wamid: string
  ): Promise<{ orderId: string; notificationType?: string | null } | null> {
    const fromEvents = await this.lookupOrderFromEvents(wamid);
    if (fromEvents) return fromEvents;
    const orderId = await this.lookupOrderIdFromInbox(wamid);
    if (!orderId) return null;
    return { orderId };
  }

  private async lookupOrderFromEvents(
    wamid: string
  ): Promise<{ orderId: string; notificationType?: string | null } | null> {
    const res = await this.hasura.executeQuery<{
      notification_events: Array<{
        entity_id?: string | null;
        notification_type?: string | null;
      }>;
    }>(
      `query WaOrderByWamid($wamid: String!) {
        notification_events(
          where: {
            provider_message_id: { _eq: $wamid }
            entity_type: { _eq: "order" }
            entity_id: { _is_null: false }
          }
          order_by: { created_at: desc }
          limit: 1
        ) { entity_id notification_type }
      }`,
      { wamid }
    );
    const row = res.notification_events?.[0];
    const orderId = row?.entity_id?.trim();
    if (!orderId) return null;
    return { orderId, notificationType: row?.notification_type };
  }

  private async lookupOrderIdFromInbox(wamid: string): Promise<string | null> {
    const res = await this.hasura.executeQuery<{
      whatsapp_messages: Array<{ raw_payload?: Record<string, unknown> | null }>;
    }>(
      `query WaInboxByWamid($wamid: String!) {
        whatsapp_messages(where: { wamid: { _eq: $wamid } }, limit: 1) {
          raw_payload
        }
      }`,
      { wamid }
    );
    return this.orderIdFromInboxPayload(res.whatsapp_messages?.[0]?.raw_payload);
  }

  private async orderIdFromInboxPayload(
    raw?: Record<string, unknown> | null
  ): Promise<string | null> {
    const direct = this.asUuid(raw?.orderId ?? raw?.entityId);
    if (direct) return direct;
    const variables = (raw?.variables ?? {}) as Record<string, unknown>;
    const orderNumber = this.asNonEmpty(
      variables.orderNumber ?? raw?.orderNumber
    );
    if (!orderNumber) return null;
    return this.lookupOrderIdByNumber(orderNumber);
  }

  private async lookupOrderIdByNumber(
    orderNumber: string
  ): Promise<string | null> {
    const res = await this.hasura.executeQuery<{
      orders: Array<{ id: string }>;
    }>(
      `query WaOrderByNumber($n: String!) {
        orders(where: { order_number: { _eq: $n } }, limit: 1) { id }
      }`,
      { n: orderNumber }
    );
    return res.orders?.[0]?.id ?? null;
  }

  private async loadOrderById(orderId: string): Promise<PendingWaOrder | null> {
    const res = await this.hasura.executeQuery<{
      orders_by_pk: PendingWaOrder | null;
    }>(
      `query WaOrderById($id: uuid!) {
        orders_by_pk(id: $id) {
          ${ORDER_ACTION_FIELDS}
          business_location {
            id business_id order_alert_phone
            business { user_id user { preferred_language } }
          }
        }
      }`,
      { id: orderId }
    );
    return res.orders_by_pk ?? null;
  }

  private async resolveActorForOrder(
    fromPhone: string,
    order: PendingWaOrder
  ): Promise<WaActor | null> {
    const normalized = this.normalizePhone(fromPhone);
    const user = await this.loadUserByPhone(normalized);
    const matched = user ? this.userActorForOrder(user, order) : null;
    if (matched) return matched;
    return this.locationAlertActorForOrder(normalized, order);
  }

  private userActorForOrder(
    user: WaUserRow,
    order: PendingWaOrder
  ): WaActor | null {
    if (user.business?.id && user.business.id === order.business_id) {
      return {
        kind: 'owner',
        userId: user.id,
        businessId: user.business.id,
        preferredLanguage: user.preferred_language,
      };
    }
    const match = this.manageDelegations(user).find(
      (row) => row.business_location_id === order.business_location_id
    );
    if (!match) return null;
    return {
      kind: 'delegate',
      userId: user.id,
      businessId: match.business_id,
      locationIds: [match.business_location_id],
      preferredLanguage: user.preferred_language,
    };
  }

  private locationAlertActorForOrder(
    normalized: string,
    order: PendingWaOrder
  ): WaActor | null {
    const loc = order.business_location;
    const ownerUserId = loc?.business?.user_id;
    if (!loc || !ownerUserId) return null;
    if (!phonesEqual(loc.order_alert_phone, normalized)) return null;
    if (loc.business_id !== order.business_id) return null;
    return {
      kind: 'location_alert',
      businessId: loc.business_id,
      locationIds: [loc.id],
      ownerUserId,
      preferredLanguage: loc.business?.user?.preferred_language,
    };
  }

  private asUuid(value: unknown): string | null {
    const text = this.asNonEmpty(value);
    return text && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      text
    )
      ? text
      : null;
  }

  private asNonEmpty(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    return text || null;
  }

  private async resolveActor(fromPhone: string): Promise<WaActor | null> {
    const normalized = this.normalizePhone(fromPhone);
    const byUser = await this.resolveUserActor(normalized);
    if (byUser) return byUser;
    return this.resolveLocationAlertActor(normalized);
  }

  private async resolveUserActor(normalized: string): Promise<WaActor | null> {
    const user = await this.loadUserByPhone(normalized);
    if (!user) return null;
    if (user.business?.id) {
      return {
        kind: 'owner',
        userId: user.id,
        businessId: user.business.id,
        preferredLanguage: user.preferred_language,
      };
    }
    return this.delegateActorFromDelegations(user);
  }

  private async loadUserByPhone(normalized: string): Promise<WaUserRow | null> {
    const withPlus = `+${normalized}`;
    const res = await this.hasura.executeQuery<{ users: WaUserRow[] }>(
      `query WaActor($a: String!, $b: String!) {
        users(where: { _or: [
          { phone_number: { _eq: $a } },
          { phone_number: { _eq: $b } }
        ]}, limit: 1) {
          id
          preferred_language
          business { id }
          location_delegations(where: { status: { _eq: "active" } }) {
            business_location_id
            business_location { business_id }
            role { role_permissions { permission { key } } }
          }
        }
      }`,
      { a: normalized, b: withPlus }
    );
    return res.users?.[0] ?? null;
  }

  private manageDelegations(user: WaUserRow): WaManageDelegation[] {
    const rows: WaManageDelegation[] = [];
    for (const delegation of user.location_delegations ?? []) {
      const businessId = delegation.business_location?.business_id;
      if (!businessId || !this.hasOrdersManage(delegation)) continue;
      rows.push({
        business_location_id: delegation.business_location_id,
        business_id: businessId,
      });
    }
    return rows;
  }

  private hasOrdersManage(
    delegation: NonNullable<WaUserRow['location_delegations']>[number]
  ): boolean {
    return (delegation.role?.role_permissions ?? []).some(
      (rp) => rp.permission?.key === DELEGATION_PERMISSIONS.ORDERS_MANAGE
    );
  }

  private delegateActorFromDelegations(user: WaUserRow): WaActor | null {
    const manage = this.manageDelegations(user);
    if (!manage.length) return null;
    const businessIds = [...new Set(manage.map((d) => d.business_id))];
    if (businessIds.length > 1) return { kind: 'ambiguous' };
    return {
      kind: 'delegate',
      userId: user.id,
      businessId: businessIds[0],
      locationIds: [...new Set(manage.map((d) => d.business_location_id))],
      preferredLanguage: user.preferred_language,
    };
  }

  private async resolveLocationAlertActor(
    normalized: string
  ): Promise<WaActor | null> {
    const res = await this.hasura.executeQuery<{
      business_locations: Array<{
        id: string;
        business_id: string;
        order_alert_phone?: string | null;
        business?: {
          user_id: string;
          user?: { preferred_language?: string | null } | null;
        } | null;
      }>;
    }>(
      `query LocAlertPhones {
        business_locations(
          where: {
            is_active: { _eq: true }
            order_alert_phone: { _is_null: false }
          }
        ) {
          id business_id order_alert_phone
          business { user_id user { preferred_language } }
        }
      }`
    );
    const matches = (res.business_locations ?? []).filter(
      (row) => !!row.business?.user_id && phonesEqual(row.order_alert_phone, normalized)
    );
    if (!matches.length) return null;
    const businessIds = [...new Set(matches.map((row) => row.business_id))];
    if (businessIds.length > 1) return { kind: 'ambiguous' };
    return {
      kind: 'location_alert',
      businessId: businessIds[0],
      locationIds: [...new Set(matches.map((row) => row.id))],
      ownerUserId: matches[0].business!.user_id,
      preferredLanguage: matches[0].business?.user?.preferred_language,
    };
  }

  private promptLookbackSince(): string {
    return new Date(Date.now() - PROMPT_LOOKBACK_MS).toISOString();
  }

  private async loadRecentActorOrderIds(
    actor: ResolvedWaActor
  ): Promise<string[]> {
    const locationIds = actor.kind === 'owner' ? null : actor.locationIds;
    if (locationIds && !locationIds.length) return [];
    const since = this.promptLookbackSince();
    const res = await this.hasura.executeQuery<{ orders: Array<{ id: string }> }>(
      locationIds ? RECENT_ORDERS_LOCS : RECENT_ORDERS_BIZ,
      locationIds
        ? { bid: actor.businessId, lids: locationIds, since }
        : { bid: actor.businessId, since }
    );
    return (res.orders ?? []).map((row) => row.id);
  }

  private async loadLatestPromptForOrders(
    orderIds: string[]
  ): Promise<{ orderId: string; notificationType: string } | null> {
    const res = await this.hasura.executeQuery<{
      notification_events: Array<{
        entity_id?: string | null;
        notification_type?: string | null;
      }>;
    }>(LATEST_PROMPT_QUERY, {
      ids: orderIds,
      types: [...ACTIONABLE_PROMPT_TYPES],
      since: this.promptLookbackSince(),
    });
    const row = res.notification_events?.[0];
    const orderId = row?.entity_id?.trim();
    const notificationType = row?.notification_type?.trim();
    if (!orderId || !notificationType) return null;
    return { orderId, notificationType };
  }

  private async loadOldestPending(
    actor: ResolvedWaActor
  ): Promise<PendingWaOrder | null> {
    const locationIds = actor.kind === 'owner' ? null : actor.locationIds;
    if (locationIds && !locationIds.length) return null;
    const res = await this.hasura.executeQuery<{ orders: PendingWaOrder[] }>(
      locationIds
        ? `query WaPendingLocs($bid: uuid!, $lids: [uuid!]!) {
            orders(
              where: {
                business_id: { _eq: $bid }
                business_location_id: { _in: $lids }
                current_status: { _eq: pending }
                acceptance_state: { _in: [awaiting_acceptance, no_response, grace] }
              }
              order_by: { created_at: asc }
              limit: 1
            ) {
              ${ORDER_ACTION_FIELDS}
            }
          }`
        : `query WaPendingBiz($bid: uuid!) {
            orders(
              where: {
                business_id: { _eq: $bid }
                current_status: { _eq: pending }
                acceptance_state: { _in: [awaiting_acceptance, no_response, grace] }
              }
              order_by: { created_at: asc }
              limit: 1
            ) {
              ${ORDER_ACTION_FIELDS}
            }
          }`,
      locationIds
        ? { bid: actor.businessId, lids: locationIds }
        : { bid: actor.businessId }
    );
    return res.orders?.[0] ?? null;
  }

  private async loadConfirmedOrders(
    actor: ResolvedWaActor
  ): Promise<PendingWaOrder[]> {
    const locationIds = actor.kind === 'owner' ? null : actor.locationIds;
    if (locationIds && !locationIds.length) return [];
    const res = await this.hasura.executeQuery<{ orders: PendingWaOrder[] }>(
      locationIds ? CONFIRMED_ORDERS_LOCS : CONFIRMED_ORDERS_BIZ,
      locationIds
        ? { bid: actor.businessId, lids: locationIds }
        : { bid: actor.businessId }
    );
    return res.orders ?? [];
  }

  private async loadClientUserId(orderId: string): Promise<string | null> {
    const res = await this.hasura.executeQuery<{
      orders_by_pk?: { client?: { user_id?: string | null } | null } | null;
    }>(
      `query WaOrderClient($id: uuid!) {
        orders_by_pk(id: $id) { client { user_id } }
      }`,
      { id: orderId }
    );
    return res.orders_by_pk?.client?.user_id ?? null;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/^\+/, '').replace(/\D/g, '');
  }

  private mapError(error: any, order: PendingWaOrder, lang?: string | null): string {
    const status = error?.status ?? error?.getStatus?.();
    const message = String(error?.message ?? error?.response ?? '');
    if (status === HttpStatus.CONFLICT || /no longer awaiting/i.test(message)) {
      return this.msgAlready(order.order_number, lang);
    }
    this.logger.warn(`WA action failed for ${order.order_number}: ${message}`);
    return lang === 'fr'
      ? `Impossible de traiter la commande ${order.order_number}. Ouvrez Rendasua.`
      : `Could not update order ${order.order_number}. Open Rendasua.`;
  }

  private actionLang(
    preferred?: string | null,
    actor?: WaActor | null
  ): string | null {
    if (preferred?.trim()) return preferred;
    if (!actor || actor.kind === 'ambiguous') return null;
    return actor.preferredLanguage ?? null;
  }

  private msgUnknown(lang?: string | null): string {
    return lang === 'fr'
      ? 'Numéro non reconnu pour les commandes Rendasua.'
      : 'This number is not linked to Rendasua orders.';
  }

  private msgAmbiguous(lang?: string | null): string {
    return lang === 'fr'
      ? 'Ce numéro est lié à plusieurs commerces. Ouvrez Rendasua pour confirmer.'
      : 'This number is linked to more than one business. Open Rendasua to confirm.';
  }

  private msgNone(lang?: string | null): string {
    return lang === 'fr'
      ? 'Aucune commande en attente de confirmation.'
      : 'No order waiting for confirmation.';
  }

  private msgNoneReady(lang?: string | null): string {
    return lang === 'fr'
      ? 'Aucune commande confirmée à marquer prête.'
      : 'No confirmed order to mark ready.';
  }

  private msgNeedAppReady(lang?: string | null): string {
    return lang === 'fr'
      ? 'Ouvrez Rendasua pour marquer la bonne commande prête.'
      : 'Open Rendasua to mark the right order ready.';
  }

  private msgConfirmed(
    n: string,
    lang?: string | null,
    fulfillmentMethod?: string | null
  ): string {
    return whatsappOrderConfirmedMessage({
      orderNumber: n,
      language: lang,
      fulfillmentMethod,
    });
  }

  private msgBusy(n: string, lang?: string | null): string {
    return lang === 'fr'
      ? `Commande ${n} : temps de préparation prolongé. Le client a été informé.`
      : `Order ${n}: extra prep time added. Customer notified.`;
  }

  private msgDeclined(n: string, lang?: string | null): string {
    return lang === 'fr'
      ? `Commande ${n} refusée.`
      : `Order ${n} declined.`;
  }

  private msgAlready(n: string, lang?: string | null): string {
    return lang === 'fr'
      ? `La commande ${n} n'attend plus de confirmation.`
      : `Order ${n} is no longer awaiting confirmation.`;
  }

  private msgNeedApp(n: string, lang?: string | null): string {
    return lang === 'fr'
      ? `Commande ${n} : ouvrez Rendasua pour confirmer le créneau.`
      : `Order ${n}: open Rendasua to confirm the time slot.`;
  }

  private msgMarkedReady(n: string, lang?: string | null): string {
    return lang === 'fr'
      ? `Commande ${n} marquée prête pour le retrait.`
      : `Order ${n} marked ready for pickup.`;
  }

  private msgAlreadyReady(n: string, lang?: string | null): string {
    return lang === 'fr'
      ? `La commande ${n} est déjà prête.`
      : `Order ${n} is already ready.`;
  }

  private msgNotConfirmed(n: string, lang?: string | null): string {
    return lang === 'fr'
      ? `La commande ${n} doit être confirmée avant d’être marquée prête.`
      : `Order ${n} must be confirmed before it can be marked ready.`;
  }

  private msgNotReadyAck(n: string, lang?: string | null): string {
    return lang === 'fr'
      ? `OK — le client a été informé que la commande ${n} n’est pas encore prête.`
      : `OK — the customer was told order ${n} is not ready yet.`;
  }

  private msgReadyPromptStale(n: string, lang?: string | null): string {
    return lang === 'fr'
      ? `La commande ${n} n’attend plus de réponse « prête ».`
      : `Order ${n} no longer needs a ready reply.`;
  }
}
