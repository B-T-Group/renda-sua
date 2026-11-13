export type RentalQuestionTopic =
  | 'price'
  | 'deposit'
  | 'condition'
  | 'pickup'
  | 'return'
  | 'included'
  | 'hours'
  | 'other';

const TOPICS: Array<[RegExp, RentalQuestionTopic]> = [
  [/deposit|caution/, 'deposit'],
  [/pickup|pick up|retrait|where do i|où /, 'pickup'],
  [/return|retour|drop-?off/, 'return'],
  [/condition|damaged|abim|état/, 'condition'],
  [/included|inclus|batter/, 'included'],
  [/hour|horaire|opening/, 'hours'],
  [/price|how much|combien|prix/, 'price'],
];

export function rentalQuestionTopic(text: string): RentalQuestionTopic {
  const body = text.toLowerCase();
  const hit = TOPICS.find(([pattern]) => pattern.test(body));
  return hit ? hit[1] : 'other';
}

type ListingFacts = {
  security_deposit_amount?: number | string | null;
  base_price_per_day?: number | string | null;
  base_price_per_hour?: number | string | null;
  min_rental_hours?: number | null;
  max_rental_hours?: number | null;
  pickup_instructions?: string | null;
  dropoff_instructions?: string | null;
  rental_item?: { description?: string | null };
};

export function rentalAnswerGrounded(listing: ListingFacts, topic: RentalQuestionTopic): boolean {
  if (topic === 'deposit') return hasAmount(listing.security_deposit_amount);
  if (topic === 'price') return hasAmount(listing.base_price_per_day) || hasAmount(listing.base_price_per_hour);
  if (topic === 'pickup') return hasText(listing.pickup_instructions);
  if (topic === 'return') return hasText(listing.dropoff_instructions);
  if (topic === 'hours') return listing.min_rental_hours != null || listing.max_rental_hours != null;
  return hasText(listing.rental_item?.description);
}

function hasAmount(value: number | string | null | undefined): boolean {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}
