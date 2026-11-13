const MONEY = /\d[\d\s\u00A0.,]*\s*(?:FCFA|XAF|XOF|CAD|USD|EUR|€)/gi;
const AVAILABILITY_CLAIM =
  /\b(available|unavailable|disponible|booked|réservé|reserve|free from|libre à partir|libre a partir)\b/gi;

/** Tools the model must never receive. Request creation stays a button in the app. */
export const FORBIDDEN_RENTAL_WRITE_TOOLS = [
  'create_rental_request',
  'cancel_rental_request',
  'update_rental_request',
  'confirm_rental_booking',
] as const;

export function listedToolNames(tools: Array<{ toolSpec?: { name?: string } } | undefined>): string[] {
  return tools.map((tool) => tool?.toolSpec?.name).filter((name): name is string => !!name);
}

export function assertModelCannotCreateRentalRequests(names: string[]): void {
  const blocked = names.filter(
    (name) =>
      (FORBIDDEN_RENTAL_WRITE_TOOLS as readonly string[]).includes(name) ||
      /create_.*rental_request/i.test(name)
  );
  if (blocked.length) {
    throw new Error(`Rental write tools are not model tools: ${blocked.join(', ')}`);
  }
}

const COUNT_WORDS: Record<string, number> = {
  none: 0,
  zero: 0,
  no: 0,
  nothing: 0,
  rien: 0,
  aucun: 0,
  aucune: 0,
  one: 1,
  un: 1,
  une: 1,
  two: 2,
  deux: 2,
  three: 3,
  trois: 3,
  four: 4,
  quatre: 4,
  five: 5,
  cinq: 5,
  six: 6,
};

const NONE_AVAILABLE = /\b(none|nothing|aucun|aucune|rien)\b[^.!?]{0,40}\b(available|disponible)\b/i;

/** The rental count the reply states, or null when it states none. */
export function claimedRentalCount(text: string): number | null {
  const folded = foldClaim(text);
  const claim = new RegExp(
    `\\b(${Object.keys(COUNT_WORDS).join('|')}|\\d+)\\b(?:\\s+\\w+){0,3}\\s+(options?|rentals?|listings?|results?|cars?|voitures?|locations?|vehicules?|annonces?|resultats?)\\b`,
    'gi'
  );
  let claimed: number | null = null;
  for (const match of folded.matchAll(claim)) claimed = countToken(match[1]);
  if (claimed != null) return claimed;
  return NONE_AVAILABLE.test(folded) ? 0 : null;
}

/** Rewrite a reply whose rental count is not the number of rental cards. */
export function alignRentalCountClaim(text: string, rentalCardCount: number, locale: 'en' | 'fr'): string {
  const claimed = claimedRentalCount(text);
  if (claimed == null || claimed === rentalCardCount) return text;
  return rentalCountSentence(rentalCardCount, locale);
}

function rentalCountSentence(count: number, locale: 'en' | 'fr'): string {
  if (count <= 0) {
    return locale === 'fr'
      ? 'Aucune location n’est disponible pour ces dates.'
      : 'No rentals are available for those dates.';
  }
  if (locale === 'fr') return count === 1 ? 'Il y a 1 location.' : `Il y a ${count} locations.`;
  return count === 1 ? 'There is 1 rental.' : `There are ${count} rentals.`;
}

function countToken(token: string): number {
  if (/^\d+$/.test(token)) return Number(token);
  return COUNT_WORDS[token] ?? 0;
}

function foldClaim(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export function sanitizeRentalModelText(
  text: string,
  options: { rentalCards: boolean; rentalGrounded: boolean; rentalIntent: boolean }
): string {
  if (!options.rentalCards && !options.rentalIntent) return text.trim();
  let out = text;
  if (options.rentalCards || !options.rentalGrounded) out = stripMoney(out);
  if (options.rentalIntent && !options.rentalGrounded) out = stripClaims(out);
  if (options.rentalCards) out = firstSentences(out, 2);
  return out.replace(/[ ]{2,}/g, ' ').trim();
}

function stripMoney(text: string): string {
  return text.replace(MONEY, '').replace(/\s+([,.])/g, '$1');
}

function stripClaims(text: string): string {
  return text.replace(AVAILABILITY_CLAIM, '');
}

function firstSentences(text: string, count: number): string {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.slice(0, count).join(' ');
}
