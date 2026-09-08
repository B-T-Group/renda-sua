import { createHash } from 'node:crypto';

/** Normalize then SHA-256 hex for Meta CAPI user_data fields. */
export function hashMetaUserData(value: string): string {
  return createHash('sha256')
    .update(value.trim().toLowerCase(), 'utf8')
    .digest('hex');
}

export function normalizeMetaEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Digits only; keep leading country code if present. */
export function normalizeMetaPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function normalizeMetaName(name: string): string {
  return name.trim().toLowerCase();
}

export function hashMetaEmail(email: string): string {
  return hashMetaUserData(normalizeMetaEmail(email));
}

export function hashMetaPhone(phone: string): string {
  const digits = normalizeMetaPhone(phone);
  if (!digits) return '';
  return createHash('sha256').update(digits, 'utf8').digest('hex');
}

export function hashMetaName(name: string): string {
  return hashMetaUserData(normalizeMetaName(name));
}

export function hashMetaExternalId(externalId: string): string {
  return hashMetaUserData(externalId.trim());
}

/** City: lowercase, no punctuation or whitespace. */
export function normalizeMetaCity(city: string): string {
  return city.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** State: lowercase letters only (2-letter code when available). */
export function normalizeMetaState(state: string): string {
  return state.trim().toLowerCase().replace(/[^a-z]/g, '');
}

/** ZIP / postal: lowercase, no spaces. */
export function normalizeMetaZip(zip: string): string {
  return zip.trim().toLowerCase().replace(/\s+/g, '');
}

/** Country: ISO 3166-1 alpha-2 lowercase. Ignore full names. */
export function normalizeMetaCountry(country: string): string {
  const letters = country.trim().toLowerCase().replace(/[^a-z]/g, '');
  return letters.length === 2 ? letters : '';
}

function hashNormalized(normalized: string): string {
  if (!normalized) return '';
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function hashMetaCity(city: string): string {
  return hashNormalized(normalizeMetaCity(city));
}

export function hashMetaState(state: string): string {
  return hashNormalized(normalizeMetaState(state));
}

export function hashMetaZip(zip: string): string {
  return hashNormalized(normalizeMetaZip(zip));
}

export function hashMetaCountry(country: string): string {
  const iso = normalizeMetaCountry(country);
  if (iso.length !== 2) return '';
  return hashNormalized(iso);
}
