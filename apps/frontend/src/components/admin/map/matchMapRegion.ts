export function matchRegionName(regions: string[], state: string): string | null {
  const wanted = regionKey(state);
  if (!wanted) return null;
  return regions.find((name) => regionKey(name) === wanted) ?? null;
}

function regionKey(value: string): string {
  let key = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const suffix of [' region province', ' province', ' region']) {
    if (key.endsWith(suffix)) return key.slice(0, -suffix.length).trim();
  }
  return key;
}
