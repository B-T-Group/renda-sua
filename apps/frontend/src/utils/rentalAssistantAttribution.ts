const WINDOW_MS = 30 * 60 * 1000;

type Tap = { listingId: string; threadId?: string; at: number };

let lastTap: Tap | null = null;

export function rememberRentalCardTap(listingId: string, threadId?: string): void {
  if (!listingId) return;
  lastTap = { listingId, threadId, at: Date.now() };
}

export function consumeRentalRequestAttribution(listingId: string): { threadId?: string; minutes: number } | null {
  if (!lastTap || lastTap.listingId !== listingId) return null;
  const saved = lastTap;
  lastTap = null;
  if (Date.now() - saved.at > WINDOW_MS) return null;
  return { threadId: saved.threadId, minutes: Math.floor((Date.now() - saved.at) / 60000) };
}

export function priceChangeMeta(previous: number, next: number): {
  price_direction: 'up' | 'down';
  pct_bucket: '<10' | '10-25' | '>25';
} {
  const base = previous === 0 ? 100 : (Math.abs(next - previous) / Math.abs(previous)) * 100;
  const pct_bucket = base < 10 ? '<10' : base <= 25 ? '10-25' : '>25';
  return { price_direction: next >= previous ? 'up' : 'down', pct_bucket };
}

export function rentalDayBucket(start?: string, end?: string): string {
  if (!start || !end) return 'none';
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
  if (!Number.isFinite(days) || days <= 0) return 'none';
  if (days <= 1) return '1';
  if (days <= 3) return '2-3';
  if (days <= 7) return '4-7';
  return '8-30';
}
