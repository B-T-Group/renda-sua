import { describe, expect, it } from 'vitest';
import { formatLastUsed, formatLastUsedCount } from './formatLastUsed';

describe('formatLastUsed', () => {
  const now = new Date('2026-07-28T12:00:00Z').getTime();

  it('returns just_now under one minute', () => {
    expect(formatLastUsed(now - 30_000, now)).toBe('just_now');
  });

  it('returns today for same calendar day gap under 24h when days=0 path', () => {
    expect(formatLastUsed(now - 2 * 3_600_000, now)).toBe('hours');
  });

  it('returns yesterday for one day ago', () => {
    expect(formatLastUsed(now - 86_400_000, now)).toBe('yesterday');
  });
});

describe('formatLastUsedCount', () => {
  const now = new Date('2026-07-28T12:00:00Z').getTime();

  it('returns minute count', () => {
    expect(formatLastUsedCount(now - 5 * 60_000, now)).toBe(5);
  });
});
