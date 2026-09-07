import type { User } from '../stores/AuthStore';

type ProfileFields = Pick<User, 'firstName' | 'lastName' | 'email' | 'phoneNumber'>;

export function agentDisplayName(user: ProfileFields | null | undefined): string {
  if (!user) return '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || user.phoneNumber || '';
}

export function agentInitial(user: ProfileFields | null | undefined): string {
  if (!user) return '?';
  if (user.firstName?.[0]) return user.firstName[0].toUpperCase();
  if (user.lastName?.[0]) return user.lastName[0].toUpperCase();
  if (user.email?.[0]) return user.email[0].toUpperCase();
  const digits = user.phoneNumber?.replace(/\D/g, '') ?? '';
  if (digits[0]) return digits[0];
  return '?';
}

/** Masque le milieu du numéro pour l’affichage (ex. +3361••••78). */
export function maskPhoneE164(e164: string): string {
  const t = e164.trim();
  if (t.length <= 6) return t;
  const headLen = t.startsWith('+') ? Math.min(5, t.length - 3) : Math.min(3, t.length - 3);
  return `${t.slice(0, headLen)}••••${t.slice(-2)}`;
}

/** Masque l’adresse e-mail pour l’affichage (ex. jo••••@example.com). */
export function maskEmail(email: string): string {
  const t = email.trim();
  const at = t.indexOf('@');
  if (at <= 1) return t;
  const local = t.slice(0, at);
  const domain = t.slice(at + 1);
  if (!domain) return t;
  const vis = local.slice(0, Math.min(2, local.length));
  return `${vis}••••@${domain}`;
}
