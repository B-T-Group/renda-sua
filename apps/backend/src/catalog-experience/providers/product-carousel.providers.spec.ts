import type { CatalogStopsService } from '../../catalog-stops/catalog-stops.service';
import type { InventoryItem } from '../../inventory-items/inventory-items.service';
import type { CatalogExperienceContext } from '../catalog-experience.types';
import {
  DealsCarouselProvider,
  PopularCarouselProvider,
} from './product-carousel.providers';

function context(
  overrides: Partial<CatalogExperienceContext> = {}
): CatalogExperienceContext {
  return {
    language: 'en',
    layout: 'discovery',
    isReturning: false,
    surface: 'all',
    country: 'CD',
    ...overrides,
  };
}

const listing = { id: 'inv-1', item_id: 'item-1', selling_price: 10 } as InventoryItem;

function createStops() {
  return {
    getTopInCategory: jest.fn().mockResolvedValue({ category_name: 'All', items: [listing] }),
    getDeals: jest.fn().mockResolvedValue({ items: [listing] }),
  };
}

describe('Popular near you / deals carousels respect the export surface', () => {
  it.each([
    ['export', true],
    ['all', false],
    ['food', false],
  ] as const)('popular on surface %s sends export_only=%s', async (surface, expected) => {
    const stops = createStops();
    const provider = new PopularCarouselProvider(stops as unknown as CatalogStopsService);
    const module = await provider.build(context({ surface }));
    expect(stops.getTopInCategory).toHaveBeenCalledWith(
      expect.objectContaining({ country_code: 'CD', export_only: expected })
    );
    expect(module?.id).toBe('popular-near-you');
  });

  it('deals on the export surface only request export items', async () => {
    const stops = createStops();
    const provider = new DealsCarouselProvider(stops as unknown as CatalogStopsService);
    await provider.build(context({ surface: 'export' }));
    expect(stops.getDeals).toHaveBeenCalledWith(
      expect.objectContaining({ export_only: true })
    );
  });
});
