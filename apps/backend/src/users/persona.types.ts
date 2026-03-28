export type PersonaId = 'client' | 'agent' | 'business';

export const PERSONA_IDS: PersonaId[] = ['client', 'agent', 'business'];

export function isPersonaId(value: string): value is PersonaId {
  return (PERSONA_IDS as string[]).includes(value);
}
