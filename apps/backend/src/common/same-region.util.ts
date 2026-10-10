export interface RegionRef {
  country?: string | null;
  state?: string | null;
  city?: string | null;
}

/** Compare country and state across address rows and reverse-geocode labels. */
function normalizeRegionPart(value: string | null | undefined): string {
  const stripped = (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(region|province|state|county)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return stripped.replace(/^(du|de|des|of|the)\s+/, '').trim();
}

function normalizeCity(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bcity\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function sameCountryAndState(a: RegionRef, b: RegionRef): boolean {
  const countryA = normalizeRegionPart(a.country);
  const countryB = normalizeRegionPart(b.country);
  const stateA = normalizeRegionPart(a.state);
  const stateB = normalizeRegionPart(b.state);
  return (
    countryA !== '' &&
    stateA !== '' &&
    countryA === countryB &&
    stateA === stateB
  );
}

/** Catalog distance is shown only inside the same city, state, and country. */
export function sameCityStateAndCountry(a: RegionRef, b: RegionRef): boolean {
  if (!sameCountryAndState(a, b)) return false;
  const cityA = normalizeCity(a.city);
  const cityB = normalizeCity(b.city);
  return cityA !== '' && cityA === cityB;
}
