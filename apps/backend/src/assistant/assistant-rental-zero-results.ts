const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const NAMED =
  /\b(?:my name is|je m'appelle|i am|je suis)\s+[A-Za-zÀ-ÿ'’-]{2,40}/gi;
const HONORIFIC =
  /\b(?:mr|mrs|ms|mme|mlle|monsieur|madame)\.?\s+[A-Za-zÀ-ÿ'’-]{2,40}/gi;

export type ZeroResultDraft = {
  normalizedQuery: string;
  categoryGuess: string | null;
  market: string;
  dayBucket: string;
  hasBudget: boolean;
  buyMatches: number;
  createdAt: string;
  expiresAt: string;
};

export function stripPersonalDetails(query: string): string {
  return query
    .replace(EMAIL, ' ')
    .replace(PHONE, ' ')
    .replace(NAMED, ' ')
    .replace(HONORIFIC, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeRentalQuery(query: string): string {
  return stripPersonalDetails(query)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function rentalDayBucket(dayCount: number | null | undefined): string {
  if (!dayCount) return 'none';
  if (dayCount <= 1) return '1';
  if (dayCount <= 3) return '2-3';
  if (dayCount <= 7) return '4-7';
  return '8-30';
}

export function buildZeroResultDraft(
  input: {
    query: string;
    categoryGuess?: string | null;
    market: string;
    dayCount?: number | null;
    hasBudget: boolean;
    buyMatches: number;
  },
  now: Date
): ZeroResultDraft | null {
  const normalizedQuery = normalizeRentalQuery(input.query);
  if (!normalizedQuery) return null;
  return {
    normalizedQuery,
    categoryGuess: input.categoryGuess?.trim() || null,
    market: input.market.trim().toUpperCase(),
    dayBucket: rentalDayBucket(input.dayCount),
    hasBudget: input.hasBudget,
    buyMatches: input.buyMatches,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + RETENTION_MS).toISOString(),
  };
}

export function retainedZeroResults<T extends { expiresAt: string }>(rows: T[], now: Date): T[] {
  return rows.filter((row) => Date.parse(row.expiresAt) > now.getTime());
}
