import {
  consumeRentalRequestAttribution,
  priceChangeMeta,
  rememberRentalCardTap,
  rentalDayBucket,
} from './rentalAssistantAttribution';

const START = new Date('2026-11-14T10:00:00.000Z');
const MINUTE = 60 * 1000;

describe('rental assistant attribution', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START);
  });

  afterEach(() => {
    rememberRentalCardTap('reset');
    consumeRentalRequestAttribution('reset');
    jest.useRealTimers();
  });

  it('keeps a tap for 30 minutes and clears it once, including a mismatch', () => {
    rememberRentalCardTap('', 'ignored');
    rememberRentalCardTap('listing-1', 'thread-1');
    expect(consumeRentalRequestAttribution('other')).toBeNull();
    jest.setSystemTime(new Date(START.getTime() + 30 * MINUTE));
    expect(consumeRentalRequestAttribution('listing-1')).toEqual({ threadId: 'thread-1', minutes: 30 });
    expect(consumeRentalRequestAttribution('listing-1')).toBeNull();
  });

  it('drops a tap one millisecond after 30 minutes and does not leave it for the next request', () => {
    rememberRentalCardTap('listing-1', 'thread-1');
    jest.setSystemTime(new Date(START.getTime() + 30 * MINUTE + 1));
    expect(consumeRentalRequestAttribution('listing-1')).toBeNull();
    jest.setSystemTime(START);
    expect(consumeRentalRequestAttribution('listing-1')).toBeNull();
  });

  it('buckets a price move at 10 and 25 percent and a zero base as a full change', () => {
    expect(priceChangeMeta(100, 109)).toEqual({ price_direction: 'up', pct_bucket: '<10' });
    expect(priceChangeMeta(100, 110)).toEqual({ price_direction: 'up', pct_bucket: '10-25' });
    expect(priceChangeMeta(100, 125)).toEqual({ price_direction: 'up', pct_bucket: '10-25' });
    expect(priceChangeMeta(100, 126)).toEqual({ price_direction: 'up', pct_bucket: '>25' });
    expect(priceChangeMeta(100, 100)).toEqual({ price_direction: 'up', pct_bucket: '<10' });
    expect(priceChangeMeta(100, 90)).toEqual({ price_direction: 'down', pct_bucket: '10-25' });
    expect(priceChangeMeta(0, 50)).toEqual({ price_direction: 'up', pct_bucket: '>25' });
  });

  it('buckets rental length and treats a missing or reversed range as none', () => {
    expect(rentalDayBucket()).toBe('none');
    expect(rentalDayBucket('2026-11-14', '2026-11-14')).toBe('none');
    expect(rentalDayBucket('2026-11-15', '2026-11-14')).toBe('none');
    expect(rentalDayBucket('bad', '2026-11-14')).toBe('none');
    expect(rentalDayBucket('2026-11-14', '2026-11-15')).toBe('1');
    expect(rentalDayBucket('2026-11-14', '2026-11-17')).toBe('2-3');
    expect(rentalDayBucket('2026-11-14', '2026-11-18')).toBe('4-7');
    expect(rentalDayBucket('2026-11-14', '2026-11-22')).toBe('8-30');
  });
});
