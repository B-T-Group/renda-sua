/** Mask an E.164 (or similar) phone, keeping the last 4 digits visible. */
export function maskPhoneE164(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return '••••';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `••••••${digits.slice(-4)}`;
}
