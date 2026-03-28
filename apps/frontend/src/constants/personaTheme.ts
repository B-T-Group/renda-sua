export type PersonaSlug = 'client' | 'agent' | 'business';

/** Aligns with app header bar colors per active persona */
export const PERSONA_HEADER_COLORS: Record<
  PersonaSlug,
  { main: string; navUnderline: string }
> = {
  client: { main: '#1565c0', navUnderline: '#90caf9' },
  agent: { main: '#2e7d32', navUnderline: '#a5d6a7' },
  business: { main: '#bf360c', navUnderline: '#ffcc80' },
};
