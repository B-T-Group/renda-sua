import { pickQuietHomeCatalogModules } from './pickQuietHomeCatalogModules';

const saleItems = { path: '/business/items' };
const locations = { path: '/business/locations' };
const rentalCatalog = { path: '/business/rentals/catalog' };
const rentalRequests = { path: '/business/rentals/requests' };

describe('pickQuietHomeCatalogModules', () => {
  it('adds rental catalog when a sale merchant already has rentals', () => {
    const actual = pickQuietHomeCatalogModules({
      primaryCatalogModules: [saleItems, locations],
      rentalModules: [rentalCatalog, rentalRequests],
      isRentalFocused: false,
      itemCount: 8,
      rentalItemCount: 2,
    });
    expect(actual.map((m) => m.path)).toEqual([
      '/business/items',
      '/business/rentals/catalog',
      '/business/locations',
    ]);
  });

  it('hides rental catalog until a sale merchant has rentals', () => {
    const actual = pickQuietHomeCatalogModules({
      primaryCatalogModules: [saleItems, locations],
      rentalModules: [rentalCatalog],
      isRentalFocused: false,
      itemCount: 8,
      rentalItemCount: 0,
    });
    expect(actual.map((m) => m.path)).toEqual([
      '/business/items',
      '/business/locations',
    ]);
  });

  it('adds sale items when a rental merchant already has sale stock', () => {
    const actual = pickQuietHomeCatalogModules({
      primaryCatalogModules: [saleItems, locations],
      rentalModules: [rentalCatalog],
      isRentalFocused: true,
      itemCount: 3,
      rentalItemCount: 5,
    });
    expect(actual.map((m) => m.path)).toEqual([
      '/business/rentals/catalog',
      '/business/items',
      '/business/locations',
    ]);
  });

  it('falls back to the first rental module when nothing matches', () => {
    const actual = pickQuietHomeCatalogModules({
      primaryCatalogModules: [],
      rentalModules: [rentalRequests],
      isRentalFocused: true,
      itemCount: 0,
      rentalItemCount: 0,
    });
    expect(actual.map((m) => m.path)).toEqual(['/business/rentals/requests']);
  });
});
