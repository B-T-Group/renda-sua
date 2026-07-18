import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { DeliveryPinService } from '../../../delivery-pin/delivery-pin.service';
import type { MessagingOrder } from '../../messaging.types';
import type {
  DeliveryPinPayloadV1,
  DeliveryPinStructuredContent,
  StructuredMessageCreateContext,
  StructuredMessageEnrichContext,
  StructuredMessageHandler,
} from '../structured-message.types';

function isPickupOrder(order: MessagingOrder): boolean {
  return order.fulfillment_method === 'pickup';
}

function displayName(
  user?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null
): string {
  return `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
}

@Injectable()
export class DeliveryPinMessageHandler implements StructuredMessageHandler {
  readonly type = 'DELIVERY_PIN' as const;
  readonly pushNotificationType = 'order_delivery_pin_shared';

  constructor(private readonly deliveryPinService: DeliveryPinService) {}

  validateCreate(ctx: StructuredMessageCreateContext): void {
    if (isPickupOrder(ctx.order)) {
      if (!ctx.order.business?.user_id) {
        throw new HttpException(
          'Business user is required before sharing the pickup PIN',
          HttpStatus.BAD_REQUEST
        );
      }
      return;
    }
    const agentUserId = ctx.order.assigned_agent?.user_id;
    if (!agentUserId) {
      throw new HttpException(
        'An assigned delivery agent is required before sharing the delivery PIN',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  buildDisplayMessage(ctx: StructuredMessageCreateContext): string {
    if (isPickupOrder(ctx.order)) {
      const businessName =
        displayName(ctx.order.business?.user) || 'the store';
      return JSON.stringify({
        i18nKey: 'orders.messaging.deliveryPin.sharedPickup',
        params: { businessName },
      });
    }
    const agentName =
      displayName(ctx.order.assigned_agent?.user) || 'delivery agent';
    return JSON.stringify({
      i18nKey: 'orders.messaging.deliveryPin.shared',
      params: { agentName },
    });
  }

  enrichForViewer(
    payload: Record<string, unknown>,
    ctx: StructuredMessageEnrichContext
  ): DeliveryPinStructuredContent | null {
    const p = payload as unknown as DeliveryPinPayloadV1;
    if (p.version !== 1) return null;

    const pickup = isPickupOrder(ctx.order);
    const sharedName = pickup
      ? displayName(ctx.order.business?.user) || undefined
      : displayName(ctx.order.assigned_agent?.user) || undefined;

    const base: DeliveryPinStructuredContent = {
      status: p.status,
      pinVersion: p.pinVersion,
      sharedToUserId: p.sharedToUserId,
      sharedToDisplayName: sharedName,
      maskedDisplay: p.maskedDisplay ?? '****',
      supersededByMessageId: p.supersededByMessageId,
      revokedAt: p.revokedAt,
      revokedReason: p.revokedReason,
    };

    const isIntendedRecipient =
      ctx.viewerUserId === p.sharedToUserId && p.status === 'active';

    if (pickup) {
      const isBusiness =
        ctx.viewerPersona === 'business' && isIntendedRecipient;
      if (isBusiness) {
        const pin = this.deliveryPinService.decryptPinFromMessage(
          p.pinCiphertext
        );
        if (pin) return { ...base, pin };
      }
    } else {
      const agentUserId = ctx.order.assigned_agent?.user_id;
      const isAssignedAgent =
        ctx.viewerPersona === 'agent' &&
        isIntendedRecipient &&
        ctx.viewerUserId === agentUserId;
      if (isAssignedAgent) {
        const pin = this.deliveryPinService.decryptPinFromMessage(
          p.pinCiphertext
        );
        if (pin) return { ...base, pin };
      }
    }

    if (
      ctx.viewerPersona === 'client' &&
      ctx.viewerUserId === ctx.order.client?.user_id
    ) {
      const pin = this.deliveryPinService.decryptPinFromMessage(
        p.pinCiphertext
      );
      if (pin && p.status === 'active') {
        return { ...base, pin };
      }
    }

    return base;
  }

  resolveRecipients(
    order: MessagingOrder,
    payload: Record<string, unknown>
  ): Array<{ userId: string; type: 'mentioned' | 'default_route' }> {
    const p = payload as unknown as DeliveryPinPayloadV1;
    return [{ userId: p.sharedToUserId, type: 'mentioned' }];
  }

  buildPayload(
    pin: string,
    sharedToUserId: string,
    pinVersion: number
  ): DeliveryPinPayloadV1 {
    return {
      version: 1,
      status: 'active',
      pinVersion,
      sharedToUserId,
      pinCiphertext: this.deliveryPinService.encryptPinForMessage(pin),
      maskedDisplay: '****',
    };
  }
}
