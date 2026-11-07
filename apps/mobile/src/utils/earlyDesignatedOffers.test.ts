import { describe, expect, it } from 'vitest';
import { earlyDesignatedOffers } from './earlyDesignatedOffers';
import type { DesignatedOffer } from '../types/designated';

function offer(over: Partial<DesignatedOffer>): DesignatedOffer {
  return {
    orderId: 'o1',
    phase: 'early',
    expiresAt: '2026-11-10T07:30:00.000Z',
    offeredAt: '2026-11-08T10:00:00.000Z',
    estimatedEarnings: null,
    currency: null,
    details: null,
    ...over,
  };
}

describe('earlyDesignatedOffers', () => {
  it('keeps only early-phase offers that are not Home-ignored', () => {
    expect(
      earlyDesignatedOffers([
        offer({ orderId: 'a', phase: 'early' }),
        offer({ orderId: 'b', phase: 'gate' }),
        offer({ orderId: 'c', phase: 'early', dismissedFromHome: true }),
        offer({ orderId: 'd', phase: 'early', dismissedFromHome: false }),
      ]).map((o) => o.orderId)
    ).toEqual(['a', 'd']);
  });

  it('returns an empty list for missing input', () => {
    expect(earlyDesignatedOffers(undefined)).toEqual([]);
    expect(earlyDesignatedOffers(null)).toEqual([]);
  });
});
