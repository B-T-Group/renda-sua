export const RS_ANON_ID_STORAGE_KEY = 'rs_anon_id';

export function getOrCreateRsAnonymousId(): string {
  try {
    const existing = window.localStorage.getItem(RS_ANON_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const generated = crypto.randomUUID();
    window.localStorage.setItem(RS_ANON_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `anon-${Math.random().toString(36).slice(2)}`;
  }
}
