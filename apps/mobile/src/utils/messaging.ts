import type {
  MentionableParticipant,
  PersonaId,
} from '../services/agentApi';

type OrderForMessaging = {
  client?: { user_id?: string | null } | null;
  business?: { user_id?: string | null } | null;
  assigned_agent?: { user_id?: string | null } | null;
};

const ALLOWED_MENTION_TARGETS: Record<PersonaId, PersonaId[]> = {
  client: ['agent', 'business'],
  business: ['client', 'agent'],
  agent: ['client', 'business'],
};

/**
 * Client-side mirror of the backend's allowed-mention map for instant UI
 * filtering. The server remains authoritative and re-validates on send.
 */
export function getMentionableParticipants(
  participants: MentionableParticipant[],
  currentUserId: string,
  currentPersona: PersonaId
): MentionableParticipant[] {
  const allowedPersonas = ALLOWED_MENTION_TARGETS[currentPersona];
  return participants.filter(
    (p) => p.userId !== currentUserId && allowedPersonas.includes(p.persona)
  );
}

/** Resolve which persona a user has on an order (null if not a participant). */
export function resolvePersonaForOrder(
  order: OrderForMessaging,
  userId: string
): PersonaId | null {
  if (order.client?.user_id === userId) return 'client';
  if (order.business?.user_id === userId) return 'business';
  if (order.assigned_agent?.user_id === userId) return 'agent';
  return null;
}
