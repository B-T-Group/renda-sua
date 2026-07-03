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

@Injectable()
export class DeliveryPinMessageHandler implements StructuredMessageHandler {
  readonly type = 'DELIVERY_PIN' as const;
  readonly pushNotificationType = 'order_delivery_pin_shared';

  constructor(private readonly deliveryPinService: DeliveryPinService) {}

  validateCreate(ctx: StructuredMessageCreateContext): void {
    const agentUserId = ctx.order.assigned_agent?.user_id;
    if (!agentUserId) {
      throw new HttpException(
        'An assigned delivery agent is required before sharing the delivery PIN',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  buildDisplayMessage(ctx: StructuredMessageCreateContext): string {
    const agent = ctx.order.assigned_agent?.user;
    const agentName =
      `${agent?.first_name ?? ''} ${agent?.last_name ?? ''}`.trim() ||
      'delivery agent';
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

    const agentUserId = ctx.order.assigned_agent?.user_id;
    const agent = ctx.order.assigned_agent?.user;
    const agentName =
      `${agent?.first_name ?? ''} ${agent?.last_name ?? ''}`.trim() ||
      undefined;

    const base: DeliveryPinStructuredContent = {
      status: p.status,
      pinVersion: p.pinVersion,
      sharedToUserId: p.sharedToUserId,
      sharedToDisplayName: agentName,
      maskedDisplay: p.maskedDisplay ?? '****',
      supersededByMessageId: p.supersededByMessageId,
      revokedAt: p.revokedAt,
      revokedReason: p.revokedReason,
    };

    const isAssignedAgent =
      ctx.viewerPersona === 'agent' &&
      ctx.viewerUserId === p.sharedToUserId &&
      ctx.viewerUserId === agentUserId;

    if (isAssignedAgent && p.status === 'active') {
      const pin = this.deliveryPinService.decryptPinFromMessage(p.pinCiphertext);
      if (pin) {
        return { ...base, pin };
      }
    }

    if (ctx.viewerPersona === 'client' && ctx.viewerUserId === ctx.order.client?.user_id) {
      const pin = this.deliveryPinService.decryptPinFromMessage(p.pinCiphertext);
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
