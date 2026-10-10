import type { AssistantCard } from './assistant.types';

export const ASSISTANT_CARD_LIMIT = 6;

export function signInCard(): AssistantCard {
  return { kind: 'sign_in', id: 'sign_in', href: '/auth/login' };
}

export function collectCards(batches: Array<AssistantCard[] | undefined>): AssistantCard[] {
  const seen = new Set<string>();
  const cards: AssistantCard[] = [];
  for (const batch of batches) {
    for (const card of batch || []) {
      if (cards.length >= ASSISTANT_CARD_LIMIT) return cards;
      const key = `${card.kind}:${card.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(card);
    }
  }
  return cards;
}

export function formatPrice(
  amount: number | string | null | undefined,
  currency: string | null | undefined
): string {
  if (amount == null || amount === '' || !currency) return '';
  const value = Number(amount);
  if (Number.isNaN(value)) return '';
  return `${value} ${currency}`;
}

export function maskPhone(phone: string | null | undefined): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 4) return phone ? '••••' : null;
  return `••••${digits.slice(-2)}`;
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null;
  const [user, domain] = email.split('@');
  return `${(user || '•').slice(0, 1)}•••@${domain}`;
}

type ImageRow = { image_url?: string | null; display_url?: string | null };

export function firstImage(images: ImageRow[] | null | undefined): string | null {
  const image = images?.[0];
  return image?.display_url || image?.image_url || null;
}
