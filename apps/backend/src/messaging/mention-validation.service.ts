import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { PersonaId } from '../users/persona.types';
import { OrderParticipantsService } from './order-participants.service';
import type { MessagingOrder } from './messaging.types';

@Injectable()
export class MentionValidationService {
  constructor(
    private readonly orderParticipantsService: OrderParticipantsService
  ) {}

  /**
   * Validates that a mention is legal for the given sender on the given order.
   * Throws HttpException(400) on any validation failure.
   */
  validateMention(
    order: MessagingOrder,
    senderUserId: string,
    senderPersona: PersonaId,
    mentionedUserId: string
  ): void {
    if (mentionedUserId === senderUserId) {
      throw new HttpException(
        'You cannot mention yourself',
        HttpStatus.BAD_REQUEST
      );
    }

    const participants = this.orderParticipantsService.getParticipants(order);
    const mentionedParticipant = participants.find(
      (p) => p.userId === mentionedUserId
    );

    if (!mentionedParticipant) {
      throw new HttpException(
        'Mentioned user is not a participant of this order',
        HttpStatus.BAD_REQUEST
      );
    }

    const allowedTargetPersonas = this.getAllowedTargetPersonas(senderPersona);
    if (!allowedTargetPersonas.includes(mentionedParticipant.persona)) {
      throw new HttpException(
        `${senderPersona} cannot mention a ${mentionedParticipant.persona}`,
        HttpStatus.BAD_REQUEST
      );
    }

    if (mentionedParticipant.persona === 'agent' && !order.assigned_agent_id) {
      throw new HttpException(
        'No agent is assigned to this order',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private getAllowedTargetPersonas(senderPersona: PersonaId): PersonaId[] {
    const map: Record<PersonaId, PersonaId[]> = {
      client: ['agent', 'business'],
      business: ['client', 'agent'],
      agent: ['client', 'business'],
    };
    return map[senderPersona];
  }
}
