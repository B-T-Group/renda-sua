import { createListingPrices } from './createListingPrices';

const both = { offersDaily: true, offersHourly: true };

describe('createListingPrices (web create-listing switches)', () => {
  it('keeps the old behaviour with the flag off: 12 × hourly fallback, no switches sent', () => {
    expect(createListingPrices({ hourlyRaw: '40', dailyRaw: '', modesOn: false, modes: both })).toEqual({
      ok: true,
      base_price_per_hour: 40,
      base_price_per_day: 480,
    });
    expect(createListingPrices({ hourlyRaw: '', dailyRaw: '300', modesOn: false, modes: both })).toEqual({ ok: false, reason: 'hourly' });
    expect(createListingPrices({ hourlyRaw: '40', dailyRaw: 'x', modesOn: false, modes: both })).toEqual({ ok: false, reason: 'daily' });
  });

  it('sends both switches and requires both prices when both are on', () => {
    expect(createListingPrices({ hourlyRaw: '40', dailyRaw: '300', modesOn: true, modes: both })).toEqual({
      ok: true,
      base_price_per_hour: 40,
      base_price_per_day: 300,
      offers_daily: true,
      offers_hourly: true,
    });
    expect(createListingPrices({ hourlyRaw: '40', dailyRaw: '', modesOn: true, modes: both })).toEqual({ ok: false, reason: 'daily' });
    expect(createListingPrices({ hourlyRaw: '0', dailyRaw: '300', modesOn: true, modes: both })).toEqual({ ok: false, reason: 'hourly' });
  });

  it('makes a day-only listing: hourly sent as 0 and not required', () => {
    expect(
      createListingPrices({ hourlyRaw: '', dailyRaw: '27000', modesOn: true, modes: { offersDaily: true, offersHourly: false } })
    ).toEqual({ ok: true, base_price_per_hour: 0, base_price_per_day: 27000, offers_daily: true, offers_hourly: false });
  });

  it('makes an hour-only listing: day sent as 0 and not required', () => {
    expect(
      createListingPrices({ hourlyRaw: '3000', dailyRaw: '99', modesOn: true, modes: { offersDaily: false, offersHourly: true } })
    ).toEqual({ ok: true, base_price_per_hour: 3000, base_price_per_day: 0, offers_daily: false, offers_hourly: true });
  });

  it('refuses both switches off', () => {
    expect(
      createListingPrices({ hourlyRaw: '1', dailyRaw: '1', modesOn: true, modes: { offersDaily: false, offersHourly: false } })
    ).toEqual({ ok: false, reason: 'modes' });
  });
});
