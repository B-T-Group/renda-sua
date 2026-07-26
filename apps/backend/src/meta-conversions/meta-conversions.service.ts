import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { metaPurchaseEventId } from './meta-conversions.constants';
import { MetaConversionsClientService } from './meta-conversions-client.service';
import {
  hashMetaEmail,
  hashMetaExternalId,
  hashMetaName,
  hashMetaPhone,
} from './meta-conversions-hash.util';
import type {
  MetaActionSource,
  MetaCustomDataInput,
  MetaInitiateCheckoutInput,
  MetaProductTrackInput,
  MetaSendStandardEventInput,
  MetaUserDataInput,
} from './meta-conversions.types';

const ORDER_FOR_PURCHASE_QUERY = `
  query OrderForMetaPurchase($id: uuid!) {
    orders_by_pk(id: $id) {
      id
      order_number
      total_amount
      currency
      order_items {
        business_inventory_id
        quantity
        unit_price
      }
      client {
        user_id
        user {
          email
          phone_number
          first_name
          last_name
        }
      }
    }
  }
`;

@Injectable()
export class MetaConversionsService {
  private readonly logger = new Logger(MetaConversionsService.name);

  constructor(
    private readonly client: MetaConversionsClientService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  async sendStandardEvent(input: MetaSendStandardEventInput): Promise<void> {
    if (!this.client.isConfigured()) return;
    const body = {
      data: [
        {
          event_name: input.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: input.eventId,
          action_source: input.actionSource,
          user_data: this.buildUserData(input.userData),
          custom_data: input.customData
            ? this.pruneEmpty(input.customData)
            : undefined,
          ...(input.eventSourceUrl
            ? { event_source_url: input.eventSourceUrl }
            : {}),
        },
      ],
      ...(this.client.getTestEventCode()
        ? { test_event_code: this.client.getTestEventCode() }
        : {}),
    };
    await this.client.sendEvents(body);
  }

  async trackViewContentSafe(input: MetaProductTrackInput): Promise<void> {
    await this.trackProductSafe('ViewContent', input);
  }

  async trackAddToCartSafe(input: MetaProductTrackInput): Promise<void> {
    await this.trackProductSafe('AddToCart', input);
  }

  async trackInitiateCheckoutSafe(
    input: MetaInitiateCheckoutInput
  ): Promise<void> {
    try {
      await this.sendStandardEvent({
        eventName: 'InitiateCheckout',
        eventId: input.eventId,
        actionSource: input.actionSource,
        userData: this.userFromTrack(input),
        customData: {
          content_type: 'product',
          content_ids: input.contentIds,
          contents: input.contents,
          value: input.value,
          currency: input.currency,
          num_items: input.numItems,
        },
        eventSourceUrl: input.eventSourceUrl,
      });
    } catch (error: any) {
      this.logger.warn(
        `Meta CAPI InitiateCheckout failed: ${error?.message ?? String(error)}`
      );
    }
  }

  async trackPurchaseSafe(orderId: string): Promise<void> {
    try {
      await this.trackPurchaseForOrderId(orderId);
    } catch (error: any) {
      this.logger.warn(
        `Meta CAPI Purchase failed for ${orderId}: ${
          error?.message ?? String(error)
        }`
      );
    }
  }

  async trackPurchaseForOrderId(
    orderId: string,
    actionSource: MetaActionSource = 'website'
  ): Promise<void> {
    if (!this.client.isConfigured()) return;
    const order = await this.loadOrder(orderId);
    if (!order) {
      this.logger.warn(`Meta CAPI Purchase: order not found ${orderId}`);
      return;
    }
    const user = order.client?.user;
    const items = order.order_items ?? [];
    await this.sendStandardEvent({
      eventName: 'Purchase',
      eventId: metaPurchaseEventId(order.id),
      actionSource,
      userData: {
        email: user?.email,
        phone: user?.phone_number,
        firstName: user?.first_name,
        lastName: user?.last_name,
        externalId: order.client?.user_id,
      },
      customData: {
        content_type: 'product',
        content_ids: items.map((i) => i.business_inventory_id).filter(Boolean),
        contents: items.map((i) => ({
          id: i.business_inventory_id,
          quantity: Number(i.quantity) || 1,
          item_price:
            i.unit_price != null ? Number(i.unit_price) : undefined,
        })),
        value: Number(order.total_amount) || 0,
        currency: order.currency || 'USD',
        order_id: order.order_number,
        num_items: items.reduce((s, i) => s + (Number(i.quantity) || 0), 0),
      },
    });
  }

  private async trackProductSafe(
    eventName: 'ViewContent' | 'AddToCart',
    input: MetaProductTrackInput
  ): Promise<void> {
    try {
      const qty = input.quantity ?? 1;
      await this.sendStandardEvent({
        eventName,
        eventId: input.eventId,
        actionSource: input.actionSource,
        userData: this.userFromTrack(input),
        customData: {
          content_type: 'product',
          content_ids: [input.inventoryItemId],
          contents: [
            {
              id: input.inventoryItemId,
              quantity: qty,
              item_price: input.value != null ? input.value / qty : undefined,
            },
          ],
          value: input.value,
          currency: input.currency,
          content_name: input.contentName,
          content_category: input.contentCategory,
        },
        eventSourceUrl: input.eventSourceUrl,
      });
    } catch (error: any) {
      this.logger.warn(
        `Meta CAPI ${eventName} failed: ${error?.message ?? String(error)}`
      );
    }
  }

  private userFromTrack(
    input: Pick<
      MetaProductTrackInput,
      | 'externalId'
      | 'email'
      | 'phone'
      | 'firstName'
      | 'lastName'
      | 'clientIpAddress'
      | 'clientUserAgent'
    >
  ): MetaUserDataInput {
    return {
      externalId: input.externalId,
      email: input.email,
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      clientIpAddress: input.clientIpAddress,
      clientUserAgent: input.clientUserAgent,
    };
  }

  private buildUserData(
    input: MetaUserDataInput
  ): Record<string, string | string[]> {
    const out: Record<string, string | string[]> = {};
    if (input.email?.trim()) out.em = [hashMetaEmail(input.email)];
    if (input.phone?.trim()) {
      const ph = hashMetaPhone(input.phone);
      if (ph) out.ph = [ph];
    }
    if (input.firstName?.trim()) out.fn = [hashMetaName(input.firstName)];
    if (input.lastName?.trim()) out.ln = [hashMetaName(input.lastName)];
    if (input.externalId?.trim()) {
      out.external_id = [hashMetaExternalId(input.externalId)];
    }
    if (input.clientIpAddress?.trim()) {
      out.client_ip_address = input.clientIpAddress.trim();
    }
    if (input.clientUserAgent?.trim()) {
      out.client_user_agent = input.clientUserAgent.trim();
    }
    return out;
  }

  private pruneEmpty(
    data: MetaCustomDataInput
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v) && v.length === 0) continue;
      out[k] = v;
    }
    return out;
  }

  private async loadOrder(orderId: string): Promise<{
    id: string;
    order_number: string;
    total_amount: number;
    currency: string;
    order_items: Array<{
      business_inventory_id: string;
      quantity: number;
      unit_price?: number | null;
    }>;
    client?: {
      user_id?: string;
      user?: {
        email?: string;
        phone_number?: string;
        first_name?: string;
        last_name?: string;
      };
    };
  } | null> {
    const res = await this.hasuraSystemService.executeQuery(
      ORDER_FOR_PURCHASE_QUERY,
      { id: orderId }
    );
    return res.orders_by_pk ?? null;
  }
}
