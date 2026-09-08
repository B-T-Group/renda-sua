/** Compare dotted app versions (e.g. 1.0.12). Returns <0 if a < b. */
export function compareAppVersions(a: string, b: string): number {
  const left = parseVersionParts(a);
  const right = parseVersionParts(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

function parseVersionParts(version: string): [number, number, number] {
  const cleaned = version.trim().replace(/^v/i, '');
  const parts = cleaned.split('.').map((part) => {
    const n = parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}
