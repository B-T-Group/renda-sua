export interface RegionRef {
  country?: string | null;
  state?: string | null;
}

/** Compare country and state across address rows and reverse-geocode labels. */
function normalizeRegionPart(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(region|province|state|county)\b/g, '')
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
