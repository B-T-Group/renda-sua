import { City, Country, State } from 'country-state-city';

/** Same normalization as AddressDialog for fuzzy matching. */
export function normalizeString(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Pick the best label from `options` for a raw geocoder string (exact, then partial, else raw).
 * Same behavior as AddressDialog.
 */
export function findBestOptionLabel(raw: string | undefined, options: string[]): string {
  if (!raw) return '';
  const normalizedRaw = normalizeString(raw);
  const exactMatch = options.find((option) => normalizeString(option) === normalizedRaw);
  if (exactMatch) return exactMatch;
  const partialMatch = options.find((option) => {
    const normalizedOption = normalizeString(option);
    return (
      normalizedOption.includes(normalizedRaw) || normalizedRaw.includes(normalizedOption)
    );
  });
  return partialMatch || raw;
}

/** Resolve geocoder country name to ISO code (same logic as AddressDialog, without console logs). */
export function findCountryCodeFromGeocodeName(countryName: string): string {
  if (!countryName) return '';

  const exactMatch = Country.getAllCountries().find(
    (country) => country.name.toLowerCase() === countryName.toLowerCase()
  );
  if (exactMatch) return exactMatch.isoCode;

  const partialMatch = Country.getAllCountries().find(
    (country) =>
      country.name.toLowerCase().includes(countryName.toLowerCase()) ||
      countryName.toLowerCase().includes(country.name.toLowerCase())
  );
  if (partialMatch) return partialMatch.isoCode;

  const commonNames: Record<string, string> = {
    'united states': 'US',
    usa: 'US',
    'united states of america': 'US',
    canada: 'CA',
    'united kingdom': 'GB',
    uk: 'GB',
    'great britain': 'GB',
    france: 'FR',
    germany: 'DE',
    spain: 'ES',
    italy: 'IT',
    japan: 'JP',
    china: 'CN',
    india: 'IN',
    brazil: 'BR',
    australia: 'AU',
    nigeria: 'NG',
    kenya: 'KE',
    uganda: 'UG',
    tanzania: 'TZ',
    ghana: 'GH',
    'south africa': 'ZA',
    ethiopia: 'ET',
    egypt: 'EG',
    morocco: 'MA',
    algeria: 'DZ',
    tunisia: 'TN',
    libya: 'LY',
    sudan: 'SD',
    'south sudan': 'SS',
    chad: 'TD',
    niger: 'NE',
    mali: 'ML',
    'burkina faso': 'BF',
    senegal: 'SN',
    guinea: 'GN',
    'sierra leone': 'SL',
    liberia: 'LR',
    'ivory coast': 'CI',
    "cote d'ivoire": 'CI',
    benin: 'BJ',
    togo: 'TG',
    cameroon: 'CM',
    'central african republic': 'CF',
    'equatorial guinea': 'GQ',
    gabon: 'GA',
    congo: 'CG',
    'democratic republic of the congo': 'CD',
    'democratic republic of congo': 'CD',
    drc: 'CD',
    angola: 'AO',
    zambia: 'ZM',
    zimbabwe: 'ZW',
    botswana: 'BW',
    namibia: 'NA',
    lesotho: 'LS',
    eswatini: 'SZ',
    swaziland: 'SZ',
    mozambique: 'MZ',
    madagascar: 'MG',
    mauritius: 'MU',
    seychelles: 'SC',
    comoros: 'KM',
    djibouti: 'DJ',
    somalia: 'SO',
    eritrea: 'ER',
    burundi: 'BI',
    rwanda: 'RW',
  };

  const normalizedName = countryName.toLowerCase().trim();
  const commonMatch = commonNames[normalizedName];
  if (commonMatch) return commonMatch;

  return '';
}

export function findStateIsoCodeFromGeocodeName(
  stateName: string,
  countryCode: string
): string {
  if (!stateName || !countryCode) return '';

  const states = State.getStatesOfCountry(countryCode);
  if (!states.length) return '';

  const exactMatch = states.find(
    (state) => state.name.toLowerCase() === stateName.toLowerCase()
  );
  if (exactMatch) return exactMatch.isoCode;

  const codeMatch = states.find(
    (state) => state.isoCode.toLowerCase() === stateName.toLowerCase()
  );
  if (codeMatch) return codeMatch.isoCode;

  const partialMatch = states.find(
    (state) =>
      state.name.toLowerCase().includes(stateName.toLowerCase()) ||
      stateName.toLowerCase().includes(state.name.toLowerCase())
  );
  if (partialMatch) return partialMatch.isoCode;

  if (countryCode === 'US') {
    const usStateNames: Record<string, string> = {
      california: 'CA',
      'new york': 'NY',
      texas: 'TX',
      florida: 'FL',
      illinois: 'IL',
      pennsylvania: 'PA',
      ohio: 'OH',
      georgia: 'GA',
      'north carolina': 'NC',
      michigan: 'MI',
      'new jersey': 'NJ',
      virginia: 'VA',
      washington: 'WA',
      arizona: 'AZ',
      massachusetts: 'MA',
      tennessee: 'TN',
      indiana: 'IN',
      missouri: 'MO',
      maryland: 'MD',
      colorado: 'CO',
      wisconsin: 'WI',
      minnesota: 'MN',
      'south carolina': 'SC',
      alabama: 'AL',
      louisiana: 'LA',
      kentucky: 'KY',
      oregon: 'OR',
      oklahoma: 'OK',
      connecticut: 'CT',
      utah: 'UT',
      nevada: 'NV',
      arkansas: 'AR',
      mississippi: 'MS',
      iowa: 'IA',
      kansas: 'KS',
      idaho: 'ID',
      nebraska: 'NE',
      'west virginia': 'WV',
      'new mexico': 'NM',
      maine: 'ME',
      'new hampshire': 'NH',
      hawaii: 'HI',
      'rhode island': 'RI',
      montana: 'MT',
      delaware: 'DE',
      'south dakota': 'SD',
      'north dakota': 'ND',
      alaska: 'AK',
      vermont: 'VT',
      wyoming: 'WY',
      'district of columbia': 'DC',
      dc: 'DC',
    };

    const normalizedName = stateName.toLowerCase().trim();
    const commonMatch = usStateNames[normalizedName];
    if (commonMatch) return commonMatch;
  }

  return '';
}

/** Restrict to allowed signup country codes; fuzzy-match name if ISO is outside allowed list. */
export function resolveSignupCountryCode(
  geolocationCountry: string | undefined,
  allowedCodes: readonly string[]
): string {
  const iso = findCountryCodeFromGeocodeName(geolocationCountry || '');
  if (iso && allowedCodes.includes(iso)) return iso;
  if (!geolocationCountry?.trim()) return '';
  const n = normalizeString(geolocationCountry);
  for (const code of allowedCodes) {
    const c = Country.getCountryByCode(code);
    if (!c) continue;
    const cn = normalizeString(c.name);
    if (cn === n || cn.includes(n) || n.includes(cn)) return code;
  }
  return '';
}

/** State name that exists in the dropdown for the given country (fuzzy match). */
export function findMatchedStateNameForCountry(
  rawState: string | undefined,
  countryCode: string
): string {
  if (!countryCode) return '';
  const states = State.getStatesOfCountry(countryCode);
  const stateNames = states.map((s) => s.name);
  const iso = findStateIsoCodeFromGeocodeName(rawState || '', countryCode);
  if (iso) {
    const byIso = states.find((s) => s.isoCode === iso);
    if (byIso) return byIso.name;
  }
  const fuzzy = findBestOptionLabel(rawState, stateNames);
  return stateNames.includes(fuzzy) ? fuzzy : '';
}

export function findMatchedCityName(
  rawCity: string | undefined,
  countryCode: string,
  stateIsoCode: string
): string {
  if (!countryCode || !stateIsoCode) return rawCity || '';
  const cities = City.getCitiesOfState(countryCode, stateIsoCode);
  return findBestOptionLabel(rawCity || '', cities.map((c) => c.name));
}
