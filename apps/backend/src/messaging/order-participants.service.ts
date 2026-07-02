import { Injectable } from '@nestjs/common';
import type { PersonaId } from '../users/persona.types';
import type {
  MentionableParticipant,
  MessagingOrder,
  OrderParticipant,
} from './messaging.types';

/** Persona ? which personas that sender is allowed to mention */
const ALLOWED_MENTION_TARGETS: Record<PersonaId, PersonaId[]> = {
  client: ['agent', 'business'],
  business: ['client', 'agent'],
  agent: ['client', 'business'],
};

@Injectable()
export class OrderParticipantsService {
  /**
   * Returns all participants of the order as a typed list.
   * The list omits participants whose user_id is null (e.g. unassigned agent).
   */
  getParticipants(order: MessagingOrder): OrderParticipant[] {
    const participants: OrderParticipant[] = [];

    if (order.client?.user_id) {
      const user = order.client.user;
      participants.push({
        userId: order.client.user_id,
        persona: 'client',
        displayName: this.buildDisplayName(user),
      });
    }

    if (order.business?.user_id) {
      const user = order.business.user;
      participants.push({
        userId: order.business.user_id,
        persona: 'business',
        displayName: this.buildDisplayName(user),
      });
    }

    if (order.assigned_agent?.user_id) {
      const user = order.assigned_agent.user;
      participants.push({
        userId: order.assigned_agent.user_id,
        persona: 'agent',
        displayName: this.buildDisplayName(user),
        isAssigned: true,
      });
    }

    return participants;
  }

  /**
   * Returns the subset of participants that the requesting user is allowed to
   * @mention, excluding themselves and respecting the allowed-mention map.
   */
  getMentionableParticipants(
    order: MessagingOrder,
    requestingUserId: string,
    requestingPersona: PersonaId
  ): MentionableParticipant[] {
    const allowedPersonas = ALLOWED_MENTION_TARGETS[requestingPersona];
    return this.getParticipants(order).filter(
      (p) =>
        p.userId !== requestingUserId && allowedPersonas.includes(p.persona)
    );
  }

  /** Resolve the persona of a user relative to the given order */
  resolvePersona(order: MessagingOrder, userId: string): PersonaId | null {
    if (order.client?.user_id === userId) return 'client';
    if (order.business?.user_id === userId) return 'business';
    if (order.assigned_agent?.user_id === userId) return 'agent';
    return null;
  }

  private buildDisplayName(
    user?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null
  ): string {
    return `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  }
}
