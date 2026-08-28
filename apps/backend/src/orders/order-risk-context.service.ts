import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { OrderRiskActionContext } from './order-risk.types';

interface OrderContextRow {
  total_amount?: number | null;
  currency?: string | null;
  grace_deadline_at?: string | null;
  client?: {
    user?: { first_name?: string | null; last_name?: string | null } | null;
  } | null;
  business?: {
    name?: string | null;
    user?: { phone_number?: string | null } | null;
    referring_agent?: { user_id?: string | null } | null;
  } | null;
  business_location?: {
    name?: string | null;
    phone?: string | null;
    address?: { country?: string | null } | null;
  } | null;
  delivery_address?: { country?: string | null } | null;
}

/**
 * Loads the "who do I call" facts that ride along with an order risk alert.
 * Kept separate from the rules so a failed lookup can never suppress the alert.
 */
@Injectable()
export class OrderRiskContextService {
  private readonly logger = new Logger(OrderRiskContextService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  async load(orderId: string): Promise<OrderRiskActionContext | undefined> {
    try {
      const res = await this.hasura.executeQuery<{
        orders_by_pk: OrderContextRow | null;
      }>(
        `query OrderRiskContext($id: uuid!) {
          orders_by_pk(id: $id) {
            total_amount
            currency
            grace_deadline_at
            client { user { first_name last_name } }
            business {
              name
              user { phone_number }
              referring_agent { user_id }
            }
            business_location {
              name
              phone
              address { country }
            }
            delivery_address { country }
          }
        }`,
        { id: orderId }
      );
      const order = res?.orders_by_pk;
      return order ? this.mapContext(order) : undefined;
    } catch (error: any) {
      this.logger.warn(
        `Order risk context load failed for ${orderId}: ${error?.message}`
      );
      return undefined;
    }
  }

  private mapContext(order: OrderContextRow): OrderRiskActionContext {
    return {
      businessName: order.business?.name ?? null,
      locationName: order.business_location?.name ?? null,
      merchantPhone:
        order.business_location?.phone || order.business?.user?.phone_number || null,
      clientName: fullName(order.client?.user),
      amountLabel: amountLabel(order.total_amount, order.currency),
      minutesUntilAutoDecline: minutesUntil(order.grace_deadline_at),
      referringAgentUserId: order.business?.referring_agent?.user_id ?? null,
      shopCountryCode: shopCountryCode(order),
    };
  }
}

function shopCountryCode(order: OrderContextRow): string | null {
  const raw =
    order.business_location?.address?.country ||
    order.delivery_address?.country ||
    null;
  if (!raw) return null;
  const trimmed = String(raw).trim().toUpperCase();
  return trimmed || null;
}

function fullName(
  user?: { first_name?: string | null; last_name?: string | null } | null
): string | null {
  const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  return name || null;
}

function amountLabel(
  amount?: number | null,
  currency?: string | null
): string | null {
  if (amount === null || amount === undefined) return null;
  return `${Math.round(Number(amount))} ${currency ?? ''}`.trim();
}

function minutesUntil(deadline?: string | null): number | null {
  if (!deadline) return null;
  const remainingMs = new Date(deadline).getTime() - Date.now();
  if (Number.isNaN(remainingMs) || remainingMs <= 0) return null;
  return Math.max(1, Math.round(remainingMs / 60000));
}
