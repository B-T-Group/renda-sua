import { HttpException, HttpStatus } from '@nestjs/common';
import { RentalsService } from './rentals.service';

const WEEKLY = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  is_available: true,
  start_time: '08:00:00',
  end_time: '20:00:00',
}));

function listing(over: Record<string, unknown> = {}) {
  return {
    id: 'L1',
    min_rental_hours: 1,
    max_rental_hours: null,
    units_available: 1,
    base_price_per_day: 25000,
    weekly_availability: WEEKLY,
    ...over,
  };
}

function harness() {
  const svc = Object.create(RentalsService.prototype) as any;
  svc.assertCapacity = jest.fn().mockResolvedValue(undefined);
  return svc;
}

function futureDay(hoursAhead = 8 * 24) {
  const start = new Date(Date.now() + hoursAhead * 3600 * 1000);
  start.setUTCHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setUTCHours(18, 0, 0, 0);
  return { start, end, date: start.toISOString().slice(0, 10) };
}

describe('all-day rental request windows', () => {
  it('holds the whole calendar day when the clock window stays on that date', async () => {
    const svc = harness();
    const { start, end, date } = futureDay();
    const plan = svc.buildCreateRentalRequestPlan({
      rentalLocationListingId: 'L1',
      windows: [
        {
          requestedStartAt: start.toISOString(),
          requestedEndAt: end.toISOString(),
          billing: 'all_day',
          calendarDate: date,
        },
      ],
    });
    await svc.validateRentalRequestWindowsPlan(plan, listing(), 1);
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    expect(svc.assertCapacity).toHaveBeenCalledWith('L1', dayStart, dayEnd, 1, 1);
  });

  it('rejects an all-day window that continues into the next UTC day', async () => {
    const svc = harness();
    const { start, date } = futureDay();
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCHours(18, 0, 0, 0);
    const plan = svc.buildCreateRentalRequestPlan({
      rentalLocationListingId: 'L1',
      windows: [
        {
          requestedStartAt: start.toISOString(),
          requestedEndAt: end.toISOString(),
          billing: 'all_day',
          calendarDate: date,
        },
      ],
    });
    await expect(svc.validateRentalRequestWindowsPlan(plan, listing(), 1)).rejects.toMatchObject({
      message: 'all_day window must stay on calendarDate',
      status: HttpStatus.BAD_REQUEST,
    });
    expect(svc.assertCapacity).not.toHaveBeenCalled();
  });

  it('rejects an all-day calendarDate that is not the window start day', async () => {
    const svc = harness();
    const { start, end } = futureDay();
    const other = futureDay(14 * 24).date;
    const plan = svc.buildCreateRentalRequestPlan({
      rentalLocationListingId: 'L1',
      windows: [
        {
          requestedStartAt: start.toISOString(),
          requestedEndAt: end.toISOString(),
          billing: 'all_day',
          calendarDate: other,
        },
      ],
    });
    await expect(svc.validateRentalRequestWindowsPlan(plan, listing(), 1)).rejects.toBeInstanceOf(
      HttpException
    );
    expect(svc.assertCapacity).not.toHaveBeenCalled();
  });

  it('rejects all-day billing when the listing has no daily price', async () => {
    const svc = harness();
    const { start, end, date } = futureDay();
    const plan = svc.buildCreateRentalRequestPlan({
      rentalLocationListingId: 'L1',
      windows: [
        {
          requestedStartAt: start.toISOString(),
          requestedEndAt: end.toISOString(),
          billing: 'all_day',
          calendarDate: date,
        },
      ],
    });
    await expect(
      svc.validateRentalRequestWindowsPlan(plan, listing({ base_price_per_day: 0 }), 1)
    ).rejects.toMatchObject({
      message: 'all_day billing requires a daily price',
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('does not roll an impossible calendar date onto another day', () => {
    const svc = harness();
    expect(() => svc.utcDayBoundsFromCalendarDate('2026-02-31')).toThrow(HttpException);
    expect(() => svc.utcDayBoundsFromCalendarDate('2026-13-01')).toThrow(HttpException);
  });

  it('prices an all-day request only after the window is confined to that day', () => {
    const svc = harness();
    const { start, end, date } = futureDay();
    const listingRow = {
      base_price_per_hour: 2000,
      base_price_per_day: 25000,
      security_deposit_amount: 0,
      rental_item: { currency: 'XAF' },
    };
    const snap = svc.computePricingSnapshotForRequest({
      units_requested: 1,
      rental_selection_windows: [
        {
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          billing: 'all_day',
          calendar_date: date,
        },
      ],
      rental_location_listing: listingRow,
    });
    expect(snap.total).toBe(25000);
    expect(snap.lines[0]).toMatchObject({ kind: 'all_day', calendarDate: date, subtotal: 25000 });

    expect(() =>
      svc.computePricingSnapshotForRequest({
        units_requested: 1,
        rental_selection_windows: [
          {
            start_at: start.toISOString(),
            end_at: new Date(end.getTime() + 24 * 3600 * 1000).toISOString(),
            billing: 'all_day',
            calendar_date: date,
          },
        ],
        rental_location_listing: listingRow,
      })
    ).toThrow(/all_day window must stay on calendarDate/);

    expect(() =>
      svc.computePricingSnapshotForRequest({
        units_requested: 1,
        rental_selection_windows: [
          {
            start_at: start.toISOString(),
            end_at: end.toISOString(),
            billing: 'all_day',
            calendar_date: date,
          },
        ],
        rental_location_listing: { ...listingRow, base_price_per_day: 0 },
      })
    ).toThrow(/all_day billing requires a daily price/);
  });
});
