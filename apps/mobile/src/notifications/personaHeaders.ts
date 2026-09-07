/** Per-request persona override so interrupt APIs work off the active UI persona. */
export const BUSINESS_PERSONA_HEADERS: Record<string, string> = {
  'X-Active-Persona': 'business',
};
