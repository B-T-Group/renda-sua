/**
 * Normalizes state/region values returned by expo-location's reverseGeocodeAsync.
 *
 * The geocoder often returns ISO 3166-2 subdivision codes (e.g. "QC", "ON", "LT")
 * instead of the full names stored in the database (e.g. "Quebec", "Ontario",
 * "Littoral"). This utility resolves codes → full names using two layers:
 *
 *   1. Static lookup for every subdivision in the countries Rendasua operates in.
 *   2. Dynamic fuzzy match against a caller-supplied list of known state names
 *      (from the backend's GET /locations/market-states), used as a fallback for
 *      countries not yet in the static table.
 */

/** ISO 3166-2 subdivision code → full name, keyed by ISO 3166-1 country code. */
const SUBDIVISION_MAP: Record<string, Record<string, string>> = {
  // Canada
  CA: {
    AB: 'Alberta',
    BC: 'British Columbia',
    MB: 'Manitoba',
    NB: 'New Brunswick',
    NL: 'Newfoundland and Labrador',
    NS: 'Nova Scotia',
    NT: 'Northwest Territories',
    NU: 'Nunavut',
    ON: 'Ontario',
    PE: 'Prince Edward Island',
    QC: 'Quebec',
    SK: 'Saskatchewan',
    YT: 'Yukon',
  },
  // Cameroon
  CM: {
    AD: 'Adamawa',
    CE: 'Centre',
    ES: 'East',
    EN: 'Far North',
    LT: 'Littoral',
    NO: 'North',
    NW: 'North West',
    OU: 'West',
    SU: 'South',
    SW: 'South West',
  },
  // Gabon
  GA: {
    ES: 'Estuaire',
    HO: 'Haut-Ogooué',
    MO: 'Moyen-Ogooué',
    NG: 'Ngounié',
    NY: 'Nyanga',
    OI: 'Ogooué-Ivindo',
    OL: 'Ogooué-Lolo',
    OM: 'Ogooué-Maritime',
    WN: 'Woleu-Ntem',
  },
  // France
  FR: {
    ARA: 'Auvergne-Rhône-Alpes',
    BFC: 'Bourgogne-Franche-Comté',
    BRE: 'Bretagne',
    CVL: 'Centre-Val de Loire',
    COR: 'Corse',
    GES: 'Grand Est',
    HDF: 'Hauts-de-France',
    IDF: 'Île-de-France',
    NOR: 'Normandie',
    NAQ: 'Nouvelle-Aquitaine',
    OCC: 'Occitanie',
    PDL: 'Pays de la Loire',
    PAC: "Provence-Alpes-Côte d'Azur",
  },
  // United States
  US: {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
    CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
    FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
    IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
    KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
    MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
    NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
    NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
    OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
    VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
    WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
  },
  // United Kingdom
  GB: {
    ENG: 'England', NIR: 'Northern Ireland', SCT: 'Scotland', WLS: 'Wales',
  },
};

/**
 * Attempts to match a raw region value from the geocoder against a list of
 * known state names returned by the backend, using progressively looser rules.
 *
 * Handles: exact → case-insensitive → acronym initials → starts-with.
 */
function fuzzyMatch(raw: string, knownStates: string[]): string | null {
  const upper = raw.toUpperCase();

  const exact = knownStates.find((s) => s === raw);
  if (exact) return exact;

  const ci = knownStates.find((s) => s.toLowerCase() === raw.toLowerCase());
  if (ci) return ci;

  // Acronym match: "QC" matches "Quebec City" → false positive risk, but checked last
  const byInitials = knownStates.find((s) => {
    const initials = s
      .split(/[\s-]+/)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
    return initials === upper;
  });
  if (byInitials) return byInitials;

  const startsWith = knownStates.find((s) =>
    s.toLowerCase().startsWith(raw.toLowerCase())
  );
  if (startsWith) return startsWith;

  return null;
}

/**
 * Resolves a raw region string (possibly an ISO abbreviation) to the full
 * state/province name used by the backend.
 *
 * @param countryCode   ISO 3166-1 alpha-2 country code (e.g. "CA").
 * @param rawState      Region string from reverseGeocodeAsync (e.g. "QC").
 * @param knownStates   Optional list of canonical state names from the backend.
 *                      Provided as a dynamic fallback for unknown country codes.
 * @returns The resolved full name, or the original `rawState` if no match found.
 */
export function normalizeStateCode(
  countryCode: string,
  rawState: string,
  knownStates: string[] = []
): string {
  if (!rawState) return rawState;

  // 1. Static lookup (exact key match for the country's subdivision map).
  const countryMap = SUBDIVISION_MAP[countryCode.toUpperCase()];
  if (countryMap) {
    const resolved = countryMap[rawState.toUpperCase()];
    if (resolved) return resolved;
    // Code not in map but looks like a real name — fall through to dynamic.
  }

  // 2. Dynamic fuzzy match against the backend's known states list.
  if (knownStates.length > 0) {
    const match = fuzzyMatch(rawState, knownStates);
    if (match) return match;
  }

  // 3. No match — return the original value unchanged.
  return rawState;
}
