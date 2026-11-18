import { RentalsService } from './rentals.service';

type CatalogWhere = { _and: Array<Record<string, unknown>> };

function publicCatalogWhere(base: Record<string, unknown>): CatalogWhere {
  const build = RentalsService.prototype as unknown as {
    whereExcludingActiveProposedContracts: (row: Record<string, unknown>) => CatalogWhere;
  };
  return build.whereExcludingActiveProposedContracts(base);
}

describe('public rental catalog where', () => {
  it('requires an active rental item as well as an active listing', () => {
    const where = publicCatalogWhere({ id: { _eq: 'listing-1' } });
    expect(where._and).toEqual([
      { id: { _eq: 'listing-1' } },
      { moderation_status: { _eq: 'approved' } },
      { is_active: { _eq: true } },
      { deleted_at: { _is_null: true } },
      { rental_item: { deleted_at: { _is_null: true }, is_active: { _eq: true } } },
      { rental_item: { business: { is_storefront_visible: { _eq: true } } } },
      { business_location: { is_active: { _eq: true } } },
    ]);
  });
});
