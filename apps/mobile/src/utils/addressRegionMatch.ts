import type { GeocodeApiResult } from '../types/googleMapsApi';
import { getCountryStateCity } from './countryStateCityLoader';

export function normalizeString(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function findBestOptionLabel(raw: string | undefined, options: string[]): string {
  if (!raw) return '';
  const normalizedRaw = normalizeString(raw);
  const exactMatch = options.find((option) => normalizeString(option) === normalizedRaw);
  if (exactMatch) return exactMatch;
  const partialMatch = options.find((option) => {
    const normalizedOption = normalizeString(option);
    return normalizedOption.includes(normalizedRaw) || normalizedRaw.includes(normalizedOption);
  });
  return partialMatch || raw;
}

const COMMON_COUNTRY_NAMES: Record<string, string> = {
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
  "cote d'ivoire (ivory coast)": 'CI',
  benin: 'BJ',
  togo: 'TG',
  cameroon: 'CM',
  'central african republic': 'CF',
  'equatorial guinea': 'GQ',
  gabon: 'GA',
  congo: 'CG',
  'congo-brazzaville': 'CG',
  'congo brazzaville': 'CG',
  'republic of the congo': 'CG',
  'republic of congo': 'CG',
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

export async function findCountryCode(countryName: string): Promise<string> {
  const trimmed = countryName.trim();
  if (!trimmed) return '';
  if (trimmed.length === 2 && trimmed === trimmed.toUpperCase()) {
    const { Country } = await getCountryStateCity();
    if (Country.getAllCountries().some((c) => c.isoCode === trimmed)) return trimmed;
  }
  const { Country } = await getCountryStateCity();
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
  return COMMON_COUNTRY_NAMES[countryName.toLowerCase().trim()] || '';
}

export async function findStateCode(stateName: string, countryCode: string): Promise<string> {
  if (!stateName || !countryCode) return '';
  const { State } = await getCountryStateCity();
  const stateList = State.getStatesOfCountry(countryCode);
  if (!stateList.length) return '';
  const exactMatch = stateList.find((state) => state.name.toLowerCase() === stateName.toLowerCase());
  if (exactMatch) return exactMatch.isoCode;
  const codeMatch = stateList.find((state) => state.isoCode.toLowerCase() === stateName.toLowerCase());
  if (codeMatch) return codeMatch.isoCode;
  const partialMatch = stateList.find(
    (state) =>
      state.name.toLowerCase().includes(stateName.toLowerCase()) ||
      stateName.toLowerCase().includes(state.name.toLowerCase())
  );
  return partialMatch?.isoCode || '';
}

/** Align Google geocode / place-details fields to CSC dropdown labels (ISO country, state name, city name). */
export async function alignGeocodeToCscFields(g: GeocodeApiResult): Promise<{ country: string; state: string; city: string }> {
  let iso = (g.country_code || '').trim().toUpperCase();
  if (!iso || iso.length !== 2) {
    iso = await findCountryCode((g.country || '').trim());
  }
  const { State, City } = await getCountryStateCity();
  const stateNames = iso ? State.getStatesOfCountry(iso).map((s) => s.name) : [];
  const matchedState = iso && g.state ? findBestOptionLabel(g.state.trim(), stateNames) : (g.state || '').trim();
  let matchedCity = (g.city || '').trim();
  const stateCode = await findStateCode(matchedState, iso);
  if (iso && stateCode) {
    const cityNames = City.getCitiesOfState(iso, stateCode).map((c) => c.name);
    matchedCity = findBestOptionLabel(matchedCity, cityNames);
  }
  return { country: iso, state: matchedState, city: matchedCity };
}

/** Map stored catalog / business address strings to CSC picker values (ISO country, state name, city name). */
export async function alignCatalogAddressToCscFields(addr: {
  city: string;
  state: string;
  country: string;
  postal_code?: string;
}): Promise<{ country: string; state: string; city: string }> {
  const rawCountry = (addr.country ?? '').trim();
  const isIso = rawCountry.length === 2 && /^[A-Za-z]{2}$/.test(rawCountry);
  return alignGeocodeToCscFields({
    formatted_address: '',
    city: (addr.city ?? '').trim(),
    state: (addr.state ?? '').trim(),
    country: isIso ? '' : rawCountry,
    postal_code: (addr.postal_code ?? '').trim(),
    address_line_1: '',
    country_code: isIso ? rawCountry.toUpperCase() : undefined,
  });
}
