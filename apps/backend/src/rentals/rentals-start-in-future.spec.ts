import { RentalsService } from './rentals.service';

type Harness = {
  assertRentalRequestStartsInFuture: (start: Date, timeZone: string) => void;
  listingTimeZone: (listing: unknown) => string;
};

describe('RentalsService future-start check (listing wall clock)', () => {
  const service = Object.create(RentalsService.prototype) as Harness;

  afterEach(() => jest.useRealTimers());

  it('lets a Canada listing book 12:00-16:00 at 9:40 AM Toronto (the reported bug)', () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-11-26T14:40:00.000Z'));
    const zone = service.listingTimeZone({ business_location: { address: { country: 'CA' } } });
    expect(zone).toBe('America/Toronto');
    expect(() => service.assertRentalRequestStartsInFuture(new Date('2026-11-26T12:00:00.000Z'), zone)).not.toThrow();
  });

  it('still rejects a start that already passed on the listing clock', () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-11-26T14:40:00.000Z'));
    expect(() =>
      service.assertRentalRequestStartsInFuture(new Date('2026-11-26T09:00:00.000Z'), 'America/Toronto')
    ).toThrow('Start must be in the future');
  });

  it('uses the listing zone for Douala and Manila', () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-11-26T08:40:00.000Z'));
    // 09:40 in Douala, 16:40 in Manila.
    expect(() => service.assertRentalRequestStartsInFuture(new Date('2026-11-26T10:00:00.000Z'), 'Africa/Douala')).not.toThrow();
    expect(() => service.assertRentalRequestStartsInFuture(new Date('2026-11-26T09:00:00.000Z'), 'Africa/Douala')).toThrow();
    expect(() => service.assertRentalRequestStartsInFuture(new Date('2026-11-26T17:00:00.000Z'), 'Asia/Manila')).not.toThrow();
    expect(() => service.assertRentalRequestStartsInFuture(new Date('2026-11-26T12:00:00.000Z'), 'Asia/Manila')).toThrow();
  });
});
