import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DELEGATION_PERMISSIONS } from '../delegations/delegation.constants';
import { phonesEqual } from '../notifications/merchant-order-notify.util';
import type { AuthorizedBusinessActor } from './authorized-business-actor';
import { OrderAcceptanceService } from './order-acceptance.service';
import type { PendingAcceptanceOrder } from './order-acceptance.types';
import { OrdersService } from './orders.service';

export type MerchantWaAction = 'CONFIRM' | 'BUSY' | 'DECLINE';

type WaActor =
  | { kind: 'owner'; userId: string; businessId: string }
  | {
      kind: 'delegate';
      userId: string;
      businessId: string;
      locationId: string;
    }
  | {
      kind: 'location_alert';
      businessId: string;
      locationId: string;
      ownerUserId: string;
    };

type PendingWaOrder = PendingAcceptanceOrder & {
  business_location_id?: string | null;
  fulfillment_timing?: string | null;
  delivery_time_windows?: Array<{ id: string }>;
};

/**
 * Resolves WhatsApp Confirm / Busy / Decline to acceptance APIs.
 * Button IDs are static; acts on the oldest confirmable pending order for the actor.
 * Session ack text is sent by WhatsAppReplyService.
 */
@Injectable()
export class WhatsAppOrderActionService {
  private readonly logger = new Logger(WhatsAppOrderActionService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly orders: OrdersService,
    private readonly acceptance: OrderAcceptanceService
  ) {}

  async handleAction(params: {
    fromPhone: string;
    action: MerchantWaAction;
    preferredLanguage?: string | null;
  }): Promise<{ handled: boolean; message: string }> {
    const actor = await this.resolveActor(params.fromPhone);
    if (!actor) {
      return { handled: false, message: this.msgUnknown(params.preferredLanguage) };
    }
    const order = await this.loadOldestPending(actor);
    if (!order) {
      return { handled: true, message: this.msgNone(params.preferredLanguage) };
    }
    return {
      handled: true,
      message: await this.runAction(
        params.action,
        order,
        actor,
        params.preferredLanguage
      ),
    };
  }

  private async runAction(
    action: MerchantWaAction,
    order: PendingWaOrder,
    actor: WaActor,
    lang?: string | null
  ): Promise<string> {
    try {
      if (action === 'CONFIRM') return await this.doConfirm(order, actor, lang);
      if (action === 'BUSY') return await this.doBusy(order, actor, lang);
      return await this.doDecline(order, actor, lang);
    } catch (error: any) {
      return this.mapError(error, order, lang);
    }
  }

  private async doConfirm(
    order: PendingWaOrder,
    actor: WaActor,
    lang?: string | null
  ): Promise<string> {
    if (!this.isAsapConfirmable(order)) {
      return this.msgNeedApp(order.order_number, lang);
    }
    await this.orders.confirmOrder(
      { orderId: order.id, notes: 'Confirmed from WhatsApp' },
      this.toActor(actor, order)
    );
    return this.msgConfirmed(order.order_number, lang);
  }

  private async doBusy(
    order: PendingWaOrder,
    actor: WaActor,
    lang?: string | null
  ): Promise<string> {
    await this.acceptance.markBusy(order.id, this.busyAuth(actor, order));
    return this.msgBusy(order.order_number, lang);
  }

  private async doDecline(
    order: PendingWaOrder,
    actor: WaActor,
    lang?: string | null
  ): Promise<string> {
    await this.orders.cancelOrder(
      { orderId: order.id, notes: 'Declined from WhatsApp' },
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
    actor: WaActor,
    order: PendingWaOrder
  ): AuthorizedBusinessActor {
    const locationId =
      order.business_location_id ||
      (actor.kind === 'owner' ? '' : actor.locationId);
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
        locationId: actor.locationId,
      };
    }
    return {
      userId: actor.ownerUserId,
      businessId: actor.businessId,
      locationId,
    };
  }

  private busyAuth(
    actor: WaActor,
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
        asDelegateLocationId: actor.locationId,
      };
    }
    return {
      userId: actor.ownerUserId,
      locationAlertAuthorized: true,
      asDelegateLocationId: order.business_location_id ?? actor.locationId,
    };
  }

  private async resolveActor(fromPhone: string): Promise<WaActor | null> {
    const normalized = this.normalizePhone(fromPhone);
    const byUser = await this.resolveUserActor(normalized);
    if (byUser) return byUser;
    return this.resolveLocationAlertActor(normalized);
  }

  private async resolveUserActor(normalized: string): Promise<WaActor | null> {
    const withPlus = `+${normalized}`;
    const res = await this.hasura.executeQuery<{
      users: Array<{
        id: string;
        business?: { id: string } | null;
        location_delegations?: Array<{
          business_location_id: string;
          business_location?: { business_id: string } | null;
          role?: {
            role_permissions?: Array<{ permission?: { key?: string } | null }>;
          } | null;
        }>;
      }>;
    }>(
      `query WaActor($a: String!, $b: String!) {
        users(where: { _or: [
          { phone_number: { _eq: $a } },
          { phone_number: { _eq: $b } }
        ]}, limit: 1) {
          id
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
    const user = res.users?.[0];
    if (!user) return null;
    if (user.business?.id) {
      return { kind: 'owner', userId: user.id, businessId: user.business.id };
    }
    const manage = (user.location_delegations ?? []).find((d) =>
      (d.role?.role_permissions ?? []).some(
        (rp) => rp.permission?.key === DELEGATION_PERMISSIONS.ORDERS_MANAGE
      )
    );
    if (!manage?.business_location?.business_id) return null;
    return {
      kind: 'delegate',
      userId: user.id,
      businessId: manage.business_location.business_id,
      locationId: manage.business_location_id,
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
        business?: { user_id: string } | null;
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
          business { user_id }
        }
      }`
    );
    const loc = (res.business_locations ?? []).find((row) =>
      phonesEqual(row.order_alert_phone, normalized)
    );
    if (!loc?.business?.user_id) return null;
    return {
      kind: 'location_alert',
      businessId: loc.business_id,
      locationId: loc.id,
      ownerUserId: loc.business.user_id,
    };
  }

  private async loadOldestPending(actor: WaActor): Promise<PendingWaOrder | null> {
    const locationId = actor.kind === 'owner' ? null : actor.locationId;
    const res = await this.hasura.executeQuery<{ orders: PendingWaOrder[] }>(
      locationId
        ? `query WaPendingLoc($bid: uuid!, $lid: uuid!) {
            orders(
              where: {
                business_id: { _eq: $bid }
                business_location_id: { _eq: $lid }
                current_status: { _eq: pending }
                acceptance_state: { _in: [awaiting_acceptance, no_response, grace] }
              }
              order_by: { created_at: asc }
              limit: 1
            ) {
              id order_number current_status acceptance_state
              acceptance_deadline_at grace_deadline_at
              busy_extra_prep_minutes estimated_prep_minutes
              created_at total_amount currency fulfillment_method
              fulfillment_timing business_id business_location_id
              delivery_time_windows(limit: 1) { id }
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
              id order_number current_status acceptance_state
              acceptance_deadline_at grace_deadline_at
              busy_extra_prep_minutes estimated_prep_minutes
              created_at total_amount currency fulfillment_method
              fulfillment_timing business_id business_location_id
              delivery_time_windows(limit: 1) { id }
            }
          }`,
      locationId
        ? { bid: actor.businessId, lid: locationId }
        : { bid: actor.businessId }
    );
    return res.orders?.[0] ?? null;
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

  private msgUnknown(lang?: string | null): string {
    return lang === 'fr'
      ? 'Numéro non reconnu pour les commandes Rendasua.'
      : 'This number is not linked to Rendasua orders.';
  }

  private msgNone(lang?: string | null): string {
    return lang === 'fr'
      ? 'Aucune commande en attente de confirmation.'
      : 'No order waiting for confirmation.';
  }

  private msgConfirmed(n: string, lang?: string | null): string {
    return lang === 'fr'
      ? `Commande ${n} confirmée.`
      : `Order ${n} confirmed.`;
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
}
