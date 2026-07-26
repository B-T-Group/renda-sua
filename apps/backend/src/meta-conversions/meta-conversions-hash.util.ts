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
