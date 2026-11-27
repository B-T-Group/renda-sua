import { HttpException } from '@nestjs/common';
import { RentalsService } from '../rentals.service';

const WEEKLY = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  is_available: true,
  start_time: '08:00:00',
  end_time: '20:00:00',
}));

function listing(over: Record<string, unknown> = {}) {
  return {
    id: 'L1',
    min_rental_hours: 2,
    max_rental_hours: 8,
    units_available: 1,
    base_price_per_hour: 3000,
    base_price_per_day: 27000,
    weekly_availability: WEEKLY,
    business_location: { address: { country: 'GA' } },
    ...over,
  };
}

function harness() {
  const svc = Object.create(RentalsService.prototype) as any;
  svc.assertCapacity = jest.fn().mockResolvedValue(undefined);
  return svc;
}

function dayKey(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

function hourly(date: string, from: number, to: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return { requestedStartAt: `${date}T${pad(from)}:00:00.000Z`, requestedEndAt: `${date}T${pad(to)}:00:00.000Z` };
}

function fullDay(date: string) {
  return { ...hourly(date, 8, 20), billing: 'all_day' as const, calendarDate: date };
}

async function codeOf(svc: any, windows: unknown[], l = listing()): Promise<string | null> {
  const plan = svc.buildCreateRentalRequestPlan({ rentalLocationListingId: 'L1', windows });
  try {
    await svc.validateRentalRequestWindowsPlan(plan, l, 1);
    return null;
  } catch (e) {
    if (!(e instanceof HttpException)) throw e;
    const body = e.getResponse() as { code?: string } | string;
    return typeof body === 'string' ? body : body.code ?? 'no-code';
  }
}

describe('rental request validation (day-and-hours rules, always on)', () => {
  it('applies min/max per hour block and exempts full days', async () => {
    const svc = harness();
    expect(await codeOf(svc, [fullDay(dayKey(8)), fullDay(dayKey(9))])).toBeNull();
    expect(await codeOf(svc, [hourly(dayKey(8), 10, 11), hourly(dayKey(9), 10, 11)])).toBe(
      'RENTAL_BLOCK_BELOW_MIN_HOURS'
    );
  });

  it('rejects days that are not in a row', async () => {
    const svc = harness();
    expect(await codeOf(svc, [fullDay(dayKey(8)), fullDay(dayKey(10))])).toBe('RENTAL_DAYS_NOT_IN_A_ROW');
  });

  it('enforces the 2-hour lead time in listing time', async () => {
    const svc = harness();
    const now = new Date();
    const libreville = new Date(now.getTime() + 60 * 60 * 1000); // UTC+1 wall clock
    const soon = new Date(libreville.getTime() + 30 * 60 * 1000);
    soon.setUTCSeconds(0, 0);
    const end = new Date(soon.getTime() + 3 * 3600000);
    const l = listing({ weekly_availability: WEEKLY.map((r) => ({ ...r, start_time: '00:00:00', end_time: '23:59:00' })) });
    const code = await codeOf(
      svc,
      [{ requestedStartAt: soon.toISOString(), requestedEndAt: end.toISOString() }],
      l
    );
    expect(code).toBe('RENTAL_LEAD_TIME');
  });

  it('applies the rules without reading any flag row', async () => {
    const svc = harness();
    svc.hasuraSystemService = { executeQuery: jest.fn() };
    expect(await codeOf(svc, [fullDay(dayKey(8)), fullDay(dayKey(10))])).toBe('RENTAL_DAYS_NOT_IN_A_ROW');
    expect(svc.hasuraSystemService.executeQuery).not.toHaveBeenCalled();
  });

  it('always rejects a way of renting the listing switched off', async () => {
    const svc = harness();
    expect(await codeOf(svc, [fullDay(dayKey(8))], listing({ offers_daily: false, max_rental_hours: null }))).toBe(
      'RENTAL_DAILY_NOT_OFFERED'
    );
    expect(await codeOf(svc, [hourly(dayKey(8), 10, 12)], listing({ offers_hourly: false }))).toBe(
      'RENTAL_HOURLY_NOT_OFFERED'
    );
  });
});
