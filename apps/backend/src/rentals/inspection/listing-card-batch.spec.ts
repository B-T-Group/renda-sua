import { readFileSync } from 'fs';
import { join } from 'path';
import { RentalCardWindowService } from './rental-card-window.service';
import { RentalInspectionFlags } from './rental-inspection-flags.service';
import { attachListingCardWindows } from './listing-card-batch';
import { RentalsService } from '../rentals.service';
import { shownSecurityDeposit } from '../rental-deposit';

const NOW = new Date('2026-11-18T12:00:00.000Z');

function rows(count: number, country = 'Cameroon') {
  return Array.from({ length: count }, (_, index) => ({
    id: `listing-${index}`,
    rental_item: { id: `item-${index}`, currency: 'XAF' },
    business_location: { address: { country } },
  }));
}

function harness(optInOn: boolean) {
  const queries: string[] = [];
  const hasura = {
    executeQuery: jest.fn(async (_query: string, variables?: { key?: string }) => {
      queries.push(variables?.key ?? 'timezone');
      return {
        application_configurations: [{
          boolean_value: optInOn && variables?.key === 'rentals_inspection_optin_enabled',
          number_value: 72,
        }],
        country_delivery_configs: [{ config_value: 'Africa/Douala' }],
      };
    }),
  };
  const flags = new RentalInspectionFlags(hasura as never);
  const routing = { resolveRailForCountry: jest.fn(async () => 'mobile_money' as const) };
  const window = new RentalCardWindowService(routing as never, flags, hasura as never);
  const stamps = jest.fn(async (ids: string[]) => {
    queries.push('stamps');
    const map = new Map<string, boolean>();
    ids.forEach((id, index) => map.set(id, index % 2 === 0));
    return map;
  });
  return { queries, routing, stamps, window, flags };
}

describe('public catalog card windows', () => {
  it('keeps a 50-listing page to a handful of queries when the flag is off', async () => {
    const { queries, routing, stamps, window, flags } = harness(false);
    const attached = await attachListingCardWindows(rows(50), {
      optInEnabled: (country) => flags.optInEnabled(country),
      stampsForItems: stamps,
      forCountry: (country, inspected) => window.forCountry(country, NOW, inspected),
    });
    expect(stamps).not.toHaveBeenCalled();
    expect(routing.resolveRailForCountry).toHaveBeenCalledTimes(1);
    expect(routing.resolveRailForCountry).toHaveBeenCalledWith('CM');
    expect(queries).toEqual([
      'rentals_inspection_optin_enabled',
      'rental_inspection_enabled',
      'rental_inspection_stripe_review_hours',
      'timezone',
      'rentals_card_charge_at_pickup_enabled',
    ]);
    expect(attached).toHaveLength(50);
    expect(attached[0].payment_rail).toBe('mobile_money');
  });

  it('batches item stamps and caches the card window when the flag is on', async () => {
    const { queries, routing, stamps, window, flags } = harness(true);
    await attachListingCardWindows(rows(50), {
      optInEnabled: (country) => flags.optInEnabled(country),
      stampsForItems: stamps,
      forCountry: (country, inspected) => window.forCountry(country, NOW, inspected),
    });
    expect(stamps).toHaveBeenCalledTimes(1);
    expect(stamps.mock.calls[0][0]).toHaveLength(50);
    expect(routing.resolveRailForCountry).toHaveBeenCalledTimes(2);
    expect(queries.filter((key) => key === 'rentals_inspection_optin_enabled')).toHaveLength(1);
    expect(queries.filter((key) => key === 'stamps')).toHaveLength(1);
    expect(queries.length).toBeLessThanOrEqual(12);
  });

  it('attaches card windows to the page, not the whole catalog', async () => {
    const svc = Object.create(RentalsService.prototype) as RentalsService;
    const catalog = rows(200);
    const attach = jest.fn(async (page: typeof catalog) => page);
    (svc as unknown as { collectPublicRentalListings: jest.Mock }).collectPublicRentalListings = jest.fn(
      async () => catalog
    );
    (svc as unknown as { attachCardWindows: jest.Mock }).attachCardWindows = attach;
    const page = await svc.listPublicRentalListings({ page: 2, limit: 50 });
    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach.mock.calls[0][0]).toHaveLength(50);
    expect(attach.mock.calls[0][0][0].id).toBe('listing-50');
    expect(page.total).toBe(200);
    expect(page.items).toHaveLength(50);
    const source = readFileSync(join(__dirname, '../rentals.service.ts'), 'utf8');
    const collect = source.slice(
      source.indexOf('async collectPublicRentalListings'),
      source.indexOf('async getTopRentalLocations')
    );
    expect(collect).not.toContain('attachCardWindows');
  });
});

describe('shown security deposit', () => {
  it('hides a stored deposit on XAF and XOF and keeps a card deposit', () => {
    expect(shownSecurityDeposit('XAF', 80)).toBe(0);
    expect(shownSecurityDeposit('xof', '40')).toBe(0);
    expect(shownSecurityDeposit('CAD', 80)).toBe(80);
  });

  it('snapshots 0 for an XAF listing that still has an 8× deposit', () => {
    const svc = Object.create(RentalsService.prototype) as {
      computePricingSnapshotForRequest(req: unknown): { securityDeposit: number; total: number };
    };
    const snap = svc.computePricingSnapshotForRequest({
      units_requested: 1,
      rental_selection_windows: [{
        start_at: '2026-07-17T08:00:00.000Z',
        end_at: '2026-07-17T10:00:00.000Z',
        billing: 'hourly',
      }],
      rental_location_listing: {
        base_price_per_hour: 10,
        base_price_per_day: 80,
        security_deposit_amount: 80,
        rental_item: { currency: 'XAF' },
      },
    });
    expect(snap.securityDeposit).toBe(0);
    expect(snap.total).toBe(20);
  });
});
