export type AssistantResultCard = {
  kind: 'item' | 'order' | 'rental' | 'store' | 'sign_in';
  id: string;
  title?: string;
  imageUrl?: string | null;
  priceLabel?: string;
  href?: string;
  secondaryHref?: string;
};

const KINDS = new Set(['item', 'order', 'rental', 'store', 'sign_in']);

export function readAssistantCards(value: unknown): AssistantResultCard[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isCard).slice(0, 6);
}

function isCard(value: unknown): value is AssistantResultCard {
  if (!value || typeof value !== 'object') return false;
  const card = value as AssistantResultCard;
  return typeof card.id === 'string' && KINDS.has(card.kind);
}
