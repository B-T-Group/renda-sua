const VEHICLE = new Set([
  'car',
  'cars',
  'voiture',
  'voitures',
  'auto',
  'vehicle',
  'vehicles',
  'vehicule',
  'vehicules',
]);

const STOP = new Set([
  'i',
  'want',
  'to',
  'rent',
  'rental',
  'rentals',
  'a',
  'an',
  'the',
  'in',
  'on',
  'from',
  'for',
  'of',
  'me',
  'please',
  'louer',
  'location',
  'une',
  'un',
  'des',
  'de',
  'la',
  'le',
  'les',
  'du',
  'au',
  'en',
  'pour',
  'veux',
  'voudrais',
  'nov',
  'november',
  'novembre',
  'today',
  'tomorrow',
  'weekend',
  'week',
  'demain',
  'aujourdhui',
  'hui',
  'yesterday',
  'hier',
  'this',
  'next',
  'coming',
  'libreville',
  'yaounde',
  'douala',
  'gabon',
  'cameroon',
  'cameroun',
]);

const CATEGORY_VEHICLE = /vehicle|vehicule|voiture|^cars?$/;

/** Search strings to try, most specific first. A bare "car" is not an ILIKE of the Tesla title. */
export function rentalSearchTerms(
  toolQuery: string,
  userText: string,
  categories: Array<{ name: string }> = []
): string[] {
  const tokens = tokensOf(`${userText} ${toolQuery}`);
  const specific = uniqueTerms(tokens.filter((token) => !STOP.has(token) && !VEHICLE.has(token)));
  const terms: string[] = [];
  if (specific.length) terms.push(specific.slice(0, 3).join(' '));
  const direct = toolQuery.trim();
  if (direct && direct.split(/\s+/).length <= 4) terms.push(direct);
  const category = vehicleCategory(categories, tokens);
  if (category) terms.push(category);
  return uniqueTerms(terms.length ? terms : [direct || userText.trim()]).slice(0, 4);
}

function vehicleCategory(categories: Array<{ name: string }>, tokens: string[]): string | null {
  if (!tokens.some((token) => VEHICLE.has(token))) return null;
  const named = categories.find((row) => CATEGORY_VEHICLE.test(fold(row.name)));
  return named?.name || 'vehicle';
}

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const key = fold(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out;
}

function tokensOf(value: string): string[] {
  return fold(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1 && !/^\d+$/.test(token));
}

function fold(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}
