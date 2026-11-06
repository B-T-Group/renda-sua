export interface ReadableAddress {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

function tidy(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function fold(value: string): string {
  return value.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasPart(haystack: string, part: string): boolean {
  if (!part) return false;
  return fold(haystack).includes(fold(part));
}

function regionName(country: string, locale: string): string {
  if (!/^[a-z]{2}$/i.test(country)) return country;
  try {
    const name = new Intl.DisplayNames([locale], { type: 'region' }).of(country.toUpperCase());
    if (name && name.toUpperCase() !== country.toUpperCase()) return name;
  } catch {
    return country;
  }
  return country;
}

function splitFormattedLine(line: string, city: string, postal: string): [string, string] | null {
  const comma = line.indexOf(',');
  if (comma <= 0) return null;
  const street = line.slice(0, comma).trim();
  const rest = line.slice(comma + 1).trim();
  if (!street || !rest) return null;
  if (!hasPart(rest, city) && !hasPart(rest, postal)) return null;
  return [street, rest];
}

function uniqueLines(lines: string[]): string | null {
  const kept: string[] = [];
  for (const line of lines) {
    const text = line.trim();
    if (!text || kept.some((existing) => hasPart(existing, text))) continue;
    kept.push(text);
  }
  return kept.length ? kept.join('\n') : null;
}

function composedLines(
  line1: string,
  line2: string,
  city: string,
  state: string,
  postal: string,
  country: string
): string[] {
  const locality = [city, [state, postal].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const split = splitFormattedLine(line1, city, postal);
  const alreadyFull = hasPart(line1, city) || hasPart(line1, postal) || hasPart(line1, country);
  if (alreadyFull) return split ? [split[0], line2, split[1]] : [line1, line2];
  return [line1, line2, locality, country];
}

/** Street on the first line, city and region on the next. Skips fields already inside line 1. */
export function formatReadableAddress(
  address: ReadableAddress | null | undefined,
  locale = 'en'
): string | null {
  if (!address) return null;
  const countryRaw = tidy(address.country);
  return uniqueLines(
    composedLines(
      tidy(address.address_line_1),
      tidy(address.address_line_2),
      tidy(address.city),
      tidy(address.state),
      tidy(address.postal_code),
      countryRaw ? regionName(countryRaw, locale) : ''
    )
  );
}
