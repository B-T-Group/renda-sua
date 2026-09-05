import { Test, TestingModule } from '@nestjs/testing';
import { CatalogStopsController } from './catalog-stops.controller';
import { CatalogStopsService } from './catalog-stops.service';

describe('CatalogStopsController', () => {
  let controller: CatalogStopsController;
  let service: jest.Mocked<CatalogStopsService>;

  beforeEach(async () => {
    const mockService = {
      getTopInCategory: jest.fn(),
      getDeals: jest.fn(),
      getEssentials: jest.fn(),
      getFeaturedStore: jest.fn(),
      getBagComplements: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogStopsController],
      providers: [
        {
          provide: CatalogStopsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<CatalogStopsController>(CatalogStopsController);
    service = module.get(CatalogStopsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTopInCategory', () => {
    it('should return top items with category_name', async () => {
      const mockResponse = {
        category_name: 'Electronics',
        items: [
          {
            id: 'inv-1',
            item_id: 'item-1',
            selling_price: 100,
          },
        ],
      };

      service.getTopInCategory.mockResolvedValue(mockResponse as any);

      const result = await controller.getTopInCategory({
        category: 'Electronics',
      });

      expect(result.success).toBe(true);
      expect(result.data.category_name).toBe('Electronics');
      expect(result.data.items.length).toBeGreaterThan(0);
    });

    it('should return empty items array when none found', async () => {
      service.getTopInCategory.mockResolvedValue({
        category_name: 'Electronics',
        items: [],
      });

      const result = await controller.getTopInCategory({
        category: 'Electronics',
      });

      expect(result.success).toBe(true);
      expect(result.data.items).toEqual([]);
    });
  });

  describe('getDeals', () => {
    it('should return deal items', async () => {
      const mockResponse = {
        items: [
          {
            id: 'inv-1',
            hasActiveDeal: true,
            discounted_price: 80,
          },
        ],
      };

      service.getDeals.mockResolvedValue(mockResponse as any);

      const result = await controller.getDeals({});

      expect(result.success).toBe(true);
      expect(result.data.items.length).toBeGreaterThan(0);
    });

    it('should return empty items array when no deals', async () => {
      service.getDeals.mockResolvedValue({ items: [] });

      const result = await controller.getDeals({});

      expect(result.success).toBe(true);
      expect(result.data.items).toEqual([]);
    });
  });

  describe('getEssentials', () => {
    it('should return featured collections', async () => {
      const mockResponse = {
        collections: [
          {
            id: 'col-1',
            slug: 'essentials',
            name: 'Essentials',
          },
        ],
      };

      service.getEssentials.mockResolvedValue(mockResponse as any);

      const result = await controller.getEssentials({});

      expect(result.success).toBe(true);
      expect(result.data.collections.length).toBeGreaterThan(0);
    });

    it('should return empty collections array when none found', async () => {
      service.getEssentials.mockResolvedValue({ collections: [] });

      const result = await controller.getEssentials({});

      expect(result.success).toBe(true);
      expect(result.data.collections).toEqual([]);
    });
  });

  describe('getFeaturedStore', () => {
    it('should return featured stores', async () => {
      const mockResponse = {
        stores: [
          {
            business_id: 'biz-1',
            business_location_id: 'loc-1',
            name: 'Test Store',
          },
        ],
      };

      service.getFeaturedStore.mockResolvedValue(mockResponse as any);

      const result = await controller.getFeaturedStore({});

      expect(result.success).toBe(true);
      expect(result.data.stores.length).toBeGreaterThan(0);
    });

    it('should return empty stores array when none found', async () => {
      service.getFeaturedStore.mockResolvedValue({ stores: [] });

      const result = await controller.getFeaturedStore({});

      expect(result.success).toBe(true);
      expect(result.data.stores).toEqual([]);
    });
  });

  describe('getBagComplements', () => {
    it('should return empty items when no cart items provided', async () => {
      const result = await controller.getBagComplements({}, {});

      expect(result.success).toBe(true);
      expect(result.data.items).toEqual([]);
      expect(result.message).toBe('No cart items provided');
    });

    it('should return complement items with reason_label', async () => {
      const mockResponse = {
        items: [
          {
            id: 'inv-1',
            item_id: 'item-1',
            reason_label: 'Popular in same category',
          },
        ],
      };

      service.getBagComplements.mockResolvedValue(mockResponse as any);

      const result = await controller.getBagComplements(
        { inventory_item_ids: ['item-1'] },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.data.items.length).toBeGreaterThan(0);
      expect(result.data.items[0].reason_label).toBeDefined();
    });
  });

  describe('getBagComplementsGet', () => {
    it('should parse comma-separated IDs', async () => {
      service.getBagComplements.mockResolvedValue({ items: [] });

      await controller.getBagComplementsGet('item-1,item-2', undefined, {});

      expect(service.getBagComplements).toHaveBeenCalledWith(
        expect.objectContaining({
          inventory_item_ids: ['item-1', 'item-2'],
        })
      );
    });
  });
});
