import { readFileSync } from 'fs';
import { join } from 'path';
import { HttpException } from '@nestjs/common';
import { listingDashboardFlag } from './rental-dashboard-flag';
import { computeRespondBy } from './rental-respond-by';
import { RentalsService } from './rentals.service';

const qaSql = readFileSync(
  join(__dirname, '../../../hasura/migrations/Rendasua/20261118160000_rental_request_qa_fixes/up.sql'),
  'utf8'
);

function slice(name: string, next: string): string {
  const start = qaSql.indexOf(`FUNCTION public.${name}`);
  const end = next ? qaSql.indexOf(next, start) : qaSql.length;
  return qaSql.slice(start, end);
}

describe('rental request QA sql', () => {
  it('H1 writes the v4 snapshot with the quoted total on edit', () => {
    const fn = slice('apply_rental_request_edit', 'FUNCTION public.cancel_client_rental_request');
    expect(fn).toContain('rental_pricing_snapshot = v_snapshot');
    expect(fn).toContain("'version', 4");
    expect(fn).toContain('quoted_total = v_total');
  });

  it('L5 backfills respond_by in batches without a generated column', () => {
    expect(qaSql).toContain('ADD COLUMN IF NOT EXISTS respond_by timestamptz');
    expect(qaSql).toContain('LIMIT 500');
    expect(qaSql).toContain("timezone('UTC', p_now)");
    expect(qaSql).not.toContain('IMMUTABLE');
    expect(qaSql).not.toContain('GENERATED ALWAYS');
  });

  it('L6 locks the item before inserting the proposed booking', () => {
    const fn = slice('reserve_proposed_rental_booking', 'CREATE TABLE');
    expect(fn.indexOf('FOR UPDATE')).toBeGreaterThan(-1);
    expect(fn.indexOf('FOR UPDATE')).toBeLessThan(fn.indexOf('INSERT INTO public.rental_bookings'));
    expect(fn).toContain('rental_peak_units_held');
  });

  it('L7 resets respond_by to the earlier of the edit plus 24 hours and the start', () => {
    const fn = slice('apply_rental_request_edit', 'FUNCTION public.cancel_client_rental_request');
    expect(fn).toContain("p_now + interval '24 hours'");
    expect(fn).toContain('respond_by = v_respond_by');
    const edited = '2026-11-18T12:00:00.000Z';
    const later = computeRespondBy({ createdAt: edited, startAt: '2026-12-01T00:00:00.000Z' });
    expect(later.respondBy).toBe('2026-11-19T12:00:00.000Z');
    const sooner = computeRespondBy({ createdAt: edited, startAt: '2026-11-18T18:00:00.000Z' });
    expect(sooner.respondBy).toBe('2026-11-18T18:00:00.000Z');
  });

  it('M2 cancels a proposed booking in the same function as the request', () => {
    const fn = slice('cancel_client_rental_request', 'FUNCTION public.reserve_proposed_rental_booking');
    expect(fn).toContain("status::text = 'proposed'");
    expect(fn).toContain("status = 'cancelled'");
    expect(fn).toContain('FOR UPDATE');
  });
});

describe('L1 per-country dashboard flag', () => {
  const rows = [
    { boolean_value: false, country_code: null },
    { boolean_value: true, country_code: 'CM' },
  ];

  it('L1 reads the country row after normalizing the address', () => {
    expect(listingDashboardFlag(rows, 'Cameroon')).toBe(true);
    expect(listingDashboardFlag(rows, 'Canada')).toBe(false);
  });
});

describe('list gates', () => {
  const service = Object.create(RentalsService.prototype) as any;

  it('M4 drops the id filter when the dashboard flag is off', async () => {
    const executeQuery = jest.fn().mockResolvedValue({
      rental_requests: [],
      rental_requests_aggregate: { aggregate: { count: 0 } },
    });
    service.hasuraSystemService = { executeQuery };
    await service.queryBusinessRequests('biz-1', { status: 'pending', id: 'req-1' }, 1, 50, false);
    expect(executeQuery.mock.calls[0][1].where.id).toBeUndefined();
    await service.queryBusinessRequests('biz-1', { status: 'pending', id: 'req-1' }, 1, 50, true);
    expect(executeQuery.mock.calls[1][1].where.id).toEqual({ _eq: 'req-1' });
  });

  it('L2 caps a pending dashboard list at 100', () => {
    expect(service.businessRequestLimit({ status: 'pending', limit: 1000 }, true)).toBe(100);
    expect(service.businessRequestLimit({ status: 'pending' }, true)).toBe(100);
    expect(service.businessRequestLimit({ status: 'pending', limit: 1000 }, false)).toBe(100);
  });

  it('M4 omits respond_by when that country is off', () => {
    const row = {
      created_at: '2026-11-18T00:00:00.000Z',
      rental_location_listing: { business_location: { address: { country: 'Canada' } } },
    };
    const flags = [
      { boolean_value: true, country_code: 'CM' },
      { boolean_value: false, country_code: null },
    ];
    expect(service.withRespondBy([row], flags)[0].respond_by).toBeUndefined();
  });

  it('L2 loads held windows once and one rail per country', async () => {
    service.hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({ rental_booking_windows: [] }),
    };
    service.paymentRoutingService = {
      resolveRailForCountry: jest.fn(async (code: string) => (code === 'CM' ? 'mobile_money' : 'stripe')),
    };
    const listing = (id: string, country: string) => ({
      status: 'pending',
      units_requested: 1,
      rental_selection_windows: [
        { billing: 'hourly', start_at: '2026-11-20T10:00:00.000Z', end_at: '2026-11-20T12:00:00.000Z' },
      ],
      rental_location_listing: { id, units_available: 2, business_location: { address: { country } } },
    });
    const flags = [
      { boolean_value: true, country_code: 'CM' },
      { boolean_value: true, country_code: 'CA' },
    ];
    await service.attachRequestCardFacts(
      [listing('list-a', 'Cameroon'), listing('list-a', 'Cameroun'), listing('list-b', 'Canada')],
      flags
    );
    expect(service.paymentRoutingService.resolveRailForCountry).toHaveBeenCalledTimes(2);
    const vars = service.hasuraSystemService.executeQuery.mock.calls[0][1];
    expect([...vars.listingIds].sort()).toEqual(['list-a', 'list-b']);
  });
});

describe('H1 price-change-seen', () => {
  it('H1 rejects marking a price change seen on a pending request', async () => {
    const service = Object.create(RentalsService.prototype) as RentalsService & {
      hasuraUserService: { getUser: jest.Mock };
      hasuraSystemService: { executeQuery: jest.Mock };
    };
    service.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({ client: { id: 'client-1' } }),
    };
    service.hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({
        rental_requests_by_pk: { id: 'req-1', client_id: 'client-1', status: 'pending' },
      }),
    };
    await expect(service.markRentalPriceChangeSeen('req-1')).rejects.toBeInstanceOf(HttpException);
    await expect(service.markRentalPriceChangeSeen('req-1')).rejects.toMatchObject({ status: 409 });
  });
});
