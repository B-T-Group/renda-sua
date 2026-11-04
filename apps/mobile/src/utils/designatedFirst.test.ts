import { describe, expect, it } from 'vitest';
import {
  classifyDesignatedError,
  findDesignated,
  formatKmShort,
  formatWindow,
  isFreeRelease,
  isLongOffer,
} from './designatedFirst';

const NOW = Date.parse('2026-11-04T12:00:00Z');

describe('designatedFirst utils', () => {
  it('isLongOffer: only offers valid > 30 min', () => {
    expect(isLongOffer('2026-11-05T08:00:00Z', NOW)).toBe(true);
    expect(isLongOffer('2026-11-04T12:00:45Z', NOW)).toBe(false);
    expect(isLongOffer(null, NOW)).toBe(false);
    expect(isLongOffer('bad', NOW)).toBe(false);
  });

  it('formatWindow / formatKmShort', () => {
    expect(formatWindow('08:00:00', '12:00:00')).toBe('08:00–12:00');
    expect(formatWindow(null, null)).toBe('');
    expect(formatKmShort(1.234)).toBe('1.2 km');
    expect(formatKmShort(12.6)).toBe('13 km');
    expect(formatKmShort(null)).toBe('');
  });

  it('findDesignated prefers the assignment', () => {
    const list = {
      success: true,
      offers: [{ orderId: 'a', phase: 'early', expiresAt: '', offeredAt: '', estimatedEarnings: null, currency: null, details: null }],
      upcoming: [
        { orderId: 'a', orderNumber: '1', storeName: null, date: null, windowStart: null, windowEnd: null, pickupBy: null, gateAt: null, releaseCutoffAt: null, freeRelease: false, confirmedAt: null },
      ],
    };
    expect(findDesignated(list, 'a')?.kind).toBe('upcoming');
    expect(findDesignated({ ...list, upcoming: [] }, 'a')?.kind).toBe('offer');
    expect(findDesignated(list, 'b')).toBeNull();
    expect(findDesignated(null, 'a')).toBeNull();
  });

  it('isFreeRelease before the cutoff only', () => {
    expect(isFreeRelease({ releaseCutoffAt: '2026-11-04T13:00:00Z' }, NOW)).toBe(true);
    expect(isFreeRelease({ releaseCutoffAt: '2026-11-04T11:00:00Z' }, NOW)).toBe(false);
    expect(isFreeRelease({ releaseCutoffAt: null }, NOW)).toBe(false);
  });

  it('classifyDesignatedError', () => {
    expect(classifyDesignatedError({ status: 409, message: 'Not yours' })).toEqual({ kind: 'refresh', message: 'Not yours' });
    expect(classifyDesignatedError({ status: 500 }).kind).toBe('retry');
    expect(classifyDesignatedError(new Error('net')).kind).toBe('other');
  });
});
