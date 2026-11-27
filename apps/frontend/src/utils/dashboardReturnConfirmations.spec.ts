import type { BusinessReturnConfirmationRow } from '../hooks/useRentalApi';
import { buildReturnCardModel, pendingReturnConfirmations } from './dashboardReturnConfirmations';

function row(overrides: Partial<BusinessReturnConfirmationRow> = {}): BusinessReturnConfirmationRow {
  return {
    id: 'b1',
    status: 'active',
    currency: 'XAF',
    renter_reported_returned_at: '2026-11-12T18:42:00.000Z',
    client: { user: { first_name: 'Marie', last_name: 'Dubois' } },
    rental_location_listing: {
      business_location: { name: 'Akwa shop', address: { country: 'CM' } },
      rental_item: { name: 'JBL PartyBox 310' },
    },
    ...overrides,
  };
}

describe('pendingReturnConfirmations', () => {
  it('keeps active and awaiting_return bookings with a renter report, oldest first', () => {
    const rows = pendingReturnConfirmations(
      [
        row({ id: 'late', renter_reported_returned_at: '2026-11-12T20:00:00.000Z' }),
        row({ id: 'early', status: 'awaiting_return', renter_reported_returned_at: '2026-11-12T10:00:00.000Z' }),
        row({ id: 'done', status: 'completed' }),
        row({ id: 'reserved', status: 'reserved' }),
      ],
      true
    );
    expect(rows.map((item) => item.id)).toEqual(['early', 'late']);
  });

  it('shows nothing when the return report flag is off', () => {
    expect(pendingReturnConfirmations([row()], false)).toEqual([]);
  });
});

describe('buildReturnCardModel', () => {
  it('carries the item, renter, place and the report time in the listing zone', () => {
    const model = buildReturnCardModel(row(), 'en');
    expect(model).toMatchObject({
      itemName: 'JBL PartyBox 310',
      renterName: 'Marie Dubois',
      place: 'Akwa shop',
      reportedStamp: '12 Nov · 19:42',
    });
  });

  it('tolerates a missing renter name and place', () => {
    const model = buildReturnCardModel(
      row({ client: null, rental_location_listing: { rental_item: { name: 'Drill' } } }),
      'en'
    );
    expect(model.renterName).toBe('');
    expect(model.place).toBe('');
  });
});
