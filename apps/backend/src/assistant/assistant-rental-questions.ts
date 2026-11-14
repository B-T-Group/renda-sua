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
  area?: string | null;
  business_location?: { address?: { city?: string | null; state?: string | null } | null } | null;
  rental_item?: { description?: string | null };
};

export function rentalArea(listing: ListingFacts): string | null {
  const named = listing.area?.trim();
  if (named) return named;
  const city = listing.business_location?.address?.city?.trim() || '';
  const state = listing.business_location?.address?.state?.trim() || '';
  if (city && state && city.toLowerCase() !== state.toLowerCase()) return `${city}, ${state}`;
  return city || state || null;
}

export function rentalAnswerGrounded(listing: ListingFacts, topic: RentalQuestionTopic): boolean {
  if (topic === 'deposit') return hasAmount(listing.security_deposit_amount);
  if (topic === 'price') return hasAmount(listing.base_price_per_day) || hasAmount(listing.base_price_per_hour);
  if (topic === 'pickup') return Boolean(rentalArea(listing)) || hasText(listing.pickup_instructions);
  if (topic === 'return') return hasText(listing.dropoff_instructions);
  if (topic === 'hours') return listing.min_rental_hours != null || listing.max_rental_hours != null;
  return hasText(listing.rental_item?.description);
}

/** Exact reply when the area answers pickup, or when the asked field is empty. */
export function rentalQuestionSay(listing: ListingFacts, topic: RentalQuestionTopic, locale: string): string | null {
  const fr = locale.toLowerCase().startsWith('fr');
  if (topic === 'pickup') return pickupSay(listing, fr);
  if (topic === 'other' || topic === 'price') return null;
  return rentalAnswerGrounded(listing, topic) ? null : emptyFieldReply(fr);
}

function pickupSay(listing: ListingFacts, fr: boolean): string | null {
  const area = rentalArea(listing);
  if (area) return fr ? pickupFr(area) : pickupEn(area);
  if (!hasText(listing.pickup_instructions)) return emptyFieldReply(fr);
  return null;
}

function pickupEn(area: string): string {
  return `Pickup is in ${area}. The exact address is shared once the business accepts.`;
}

function pickupFr(area: string): string {
  return `Le retrait est à ${area}. L'adresse exacte est communiquée une fois que l'entreprise accepte.`;
}

function emptyFieldReply(fr: boolean): string {
  return fr
    ? "L'annonce ne le précise pas. Vous pouvez le demander dans la note quand vous envoyez la demande."
    : "The listing doesn't say. You can ask the business in the note when you send your request.";
}

function hasAmount(value: number | string | null | undefined): boolean {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}
