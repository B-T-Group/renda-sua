export type AssistantRentalDetails = {
  listingId: string;
  businessName?: string;
  city?: string;
  availability?: string;
  startDate?: string;
  endDate?: string;
  dayCount?: number;
  quoteTotal?: number;
  perDay?: number;
  deposit?: number;
  currency?: string;
  nextAvailableDate?: string | null;
  cta?: string;
  shiftStart?: string;
  shiftEnd?: string;
  canRequest?: boolean;
};

export type AssistantRentalChip = {
  id: string;
  label: string;
  message?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  query?: string;
};

export type AssistantRentalMeta = {
  status?: string;
  dateIssue?: string;
  dates?: { startDate: string; endDate: string; dayCount: number };
  chips?: AssistantRentalChip[];
  footnote?: string;
  showAllHref?: string;
  showAllCount?: number;
  refs?: Record<string, string>;
  suggestionNote?: string;
};

export type AssistantResultCard = {
  kind: 'item' | 'order' | 'rental' | 'store' | 'sign_in';
  id: string;
  title?: string;
  imageUrl?: string | null;
  priceLabel?: string;
  href?: string;
  secondaryHref?: string;
  rental?: AssistantRentalDetails;
};

export function readAssistantRental(value: unknown): AssistantRentalMeta | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as AssistantRentalMeta;
}

const KINDS = new Set(['item', 'order', 'rental', 'store', 'sign_in']);

const LIST_LINE = /^\s*(?:[-*•+]|\d+[.)])\s+/;

export function readAssistantCards(value: unknown): AssistantResultCard[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isCard).slice(0, 6);
}

/** Drop markdown rows when the same items are already on cards. */
export function textBesideCards(content: string, cards?: AssistantResultCard[]): string {
  if (!cards?.length) return content;
  return content.split('\n').filter((line) => !LIST_LINE.test(line)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function isCard(value: unknown): value is AssistantResultCard {
  if (!value || typeof value !== 'object') return false;
  const card = value as AssistantResultCard;
  return typeof card.id === 'string' && KINDS.has(card.kind);
}
