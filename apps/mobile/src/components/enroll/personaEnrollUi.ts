import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { PersonaSlug } from '@/types/persona';

export const ENROLL_PERSONA_ICONS: Record<
  PersonaSlug,
  ComponentProps<typeof MaterialCommunityIcons>['name']
> = {
  client: 'account-circle-outline',
  agent: 'bike-fast',
  business: 'store-outline',
};

export function enrollTitleKey(p: PersonaSlug): string {
  if (p === 'agent') return 'enrollPersona.agent.title';
  if (p === 'business') return 'enrollPersona.business.title';
  return 'enrollPersona.client.title';
}

export function enrollTitleDefault(p: PersonaSlug): string {
  if (p === 'agent') return 'Become an agent';
  if (p === 'business') return 'Open a business account';
  return 'Shop as a client';
}

export function enrollSubtitleKey(p: PersonaSlug): string {
  if (p === 'agent') return 'enrollPersona.agent.subtitle';
  if (p === 'business') return 'enrollPersona.business.subtitle';
  return 'enrollPersona.client.subtitle';
}

export function enrollSubtitleDefault(p: PersonaSlug): string {
  if (p === 'agent') return 'Earn on your schedule by completing local deliveries.';
  if (p === 'business') return 'List products, manage orders, and reach local buyers.';
  return 'Browse stores, place orders, and track deliveries.';
}

export function enrollPitchKey(p: PersonaSlug): string {
  if (p === 'agent') return 'enrollPersona.agent.pitch';
  if (p === 'business') return 'enrollPersona.business.pitch';
  return 'enrollPersona.client.pitch';
}

export function enrollPitchDefault(p: PersonaSlug): string {
  if (p === 'agent') return 'Add agent to your account';
  if (p === 'business') return 'Add business seller to your account';
  return 'Add client shopping to your account';
}

export function enrollCtaKey(p: PersonaSlug): string {
  if (p === 'agent') return 'enrollPersona.agent.cta';
  if (p === 'business') return 'enrollPersona.business.cta';
  return 'enrollPersona.client.cta';
}

export function enrollCtaDefault(p: PersonaSlug): string {
  if (p === 'agent') return 'Continue as agent';
  if (p === 'business') return 'Continue as business';
  return 'Become a client';
}

export function personaLabelKey(p: PersonaSlug): string {
  if (p === 'agent') return 'persona.agentTitle';
  if (p === 'business') return 'persona.businessTitle';
  return 'persona.clientTitle';
}

export function personaLabelDefault(p: PersonaSlug): string {
  if (p === 'agent') return 'Agent';
  if (p === 'business') return 'Business';
  return 'Client';
}
