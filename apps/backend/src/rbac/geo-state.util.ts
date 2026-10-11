const SUFFIXES = [' region province', ' province', ' region'];

/** Matches public.geo_state_key: lower, strip accents, drop one Region/Province suffix. */
export function geoStateKey(value: string | null | undefined): string {
  let key = (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const suffix of SUFFIXES) {
    if (key.endsWith(suffix)) {
      key = key.slice(0, -suffix.length).trim();
      break;
    }
  }
  return key;
}
