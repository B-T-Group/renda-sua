import { Injectable } from '@nestjs/common';
import type { PersonaId } from '../users/persona.types';
import type { MessagingOrder, ResolvedRecipient } from './messaging.types';

@Injectable()
export class RecipientResolutionService {
  /**
   * Single implementation of recipient routing.
   * - mention present ? the mentioned user
   * - client sender ? assigned agent if present, else business
   * - business sender ? client
   * - agent sender ? client
   */
  resolve(
    order: MessagingOrder,
    senderPersona: PersonaId,
    mentionedUserId?: string
  ): ResolvedRecipient[] {
    if (mentionedUserId) {
      return [{ userId: mentionedUserId, type: 'mentioned' }];
    }

    const recipientUserId = this.resolveDefaultRecipient(order, senderPersona);
    if (!recipientUserId) return [];

    return [{ userId: recipientUserId, type: 'default_route' }];
  }

  private resolveDefaultRecipient(
    order: MessagingOrder,
    senderPersona: PersonaId
  ): string | null {
    switch (senderPersona) {
      case 'client':
        return (
          order.assigned_agent?.user_id ??
          order.business?.user_id ??
          null
        );
      case 'business':
        return order.client?.user_id ?? null;
      case 'agent':
        return order.client?.user_id ?? null;
    }
  }
}
