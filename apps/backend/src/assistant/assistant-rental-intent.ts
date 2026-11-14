const RENT = /\b(rent|rental|rentals|hire|borrow|louer|location|loue|loué)\b/i;
const BUY = /\b(buy|purchase|acheter|achete|vendre|sell|commander|price of|prix de)\b/i;
const FOOD = /\b(hungry|faim|manger|repas|plat|restaurant|pizza|meal)\b/i;
const QUESTION =
  /\b(deposit|caution|included|inclus|batter|pickup|pick up|retrait|return|retour|condition|damaged|abim|how much|combien|where do i)\b/i;
const DATE_RANGE =
  /\b(\d{1,2}(?:st|nd|rd|th)?\s*(?:-|–|to|au)\s*\d{1,2}|tomorrow|demain|weekend|week-end|ce week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i;

export type RentalIntentKind = 'rent' | 'buy' | 'food' | 'question' | 'ambiguous' | 'other';

export function classifyRentalWords(text: string): RentalIntentKind {
  if (QUESTION.test(text) && !RENT.test(text) && !BUY.test(text)) return 'question';
  if (FOOD.test(text) && !RENT.test(text)) return 'food';
  if (DATE_RANGE.test(text) && !BUY.test(text)) return 'rent';
  if (RENT.test(text) && BUY.test(text)) return 'ambiguous';
  if (RENT.test(text)) return 'rent';
  if (BUY.test(text)) return 'buy';
  if (isBareObject(text)) return 'ambiguous';
  return 'other';
}

export function shouldAskBuyOrRent(input: {
  text: string;
  rentMatches: number;
  buyMatches: number;
  shoppingEnabled: boolean;
}): boolean {
  if (!input.shoppingEnabled) return false;
  if (classifyRentalWords(input.text) !== 'ambiguous') return false;
  return input.rentMatches > 0 && input.buyMatches > 0;
}

function isBareObject(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 8 && !/[?]/.test(text);
}
