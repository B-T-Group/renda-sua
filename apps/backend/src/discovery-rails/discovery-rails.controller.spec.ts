import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryRailsController } from './discovery-rails.controller';
import { DiscoveryRailsService } from './discovery-rails.service';

describe('DiscoveryRailsController', () => {
  let controller: DiscoveryRailsController;
  let service: jest.Mocked<DiscoveryRailsService>;

  beforeEach(async () => {
    const mockService = {
      getTopInCategory: jest.fn(),
      getDealsNearYou: jest.fn(),
      getFeaturedStores: jest.fn(),
      getBagComplements: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscoveryRailsController],
      providers: [
        {
          provide: DiscoveryRailsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<DiscoveryRailsController>(DiscoveryRailsController);
    service = module.get(DiscoveryRailsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTopInCategory', () => {
    it('should return items from service', async () => {
      const mockItems = [
        {
          id: 'inv-1',
          item_id: 'item-1',
          item_name: 'Test Item',
          item_description: 'Test Description',
          selling_price: 100,
          currency: 'XAF',
          category_name: 'Electronics',
          subcategory_name: 'Phones',
          business_location_id: 'loc-1',
          location_name: 'Test Location',
          business_id: 'biz-1',
          business_name: 'Test Business',
          avg_rating: 4.5,
          rating_count: 10,
          recent_orders_30d: 5,
        },
      ];

      service.getTopInCategory.mockResolvedValue(mockItems);

      const result = await controller.getTopInCategory('Electronics', {});

      expect(result.success).toBe(true);
      expect(result.data.items).toEqual(mockItems);
      expect(service.getTopInCategory).toHaveBeenCalledWith(
        'Electronics',
        expect.any(Object),
        undefined
      );
    });
  });

  describe('getDealsNearYou', () => {
    it('should return deals from service', async () => {
      const mockDeals = [
        {
          id: 'inv-1',
          item_id: 'item-1',
          item_name: 'Deal Item',
          item_description: 'Deal Description',
          original_price: 100,
          discounted_price: 80,
          currency: 'XAF',
          discount_type: 'percentage' as const,
          discount_value: 20,
          deal_end_at: '2026-12-31T23:59:59Z',
          business_location_id: 'loc-1',
          location_name: 'Test Location',
          business_id: 'biz-1',
          business_name: 'Test Business',
          category_name: 'Electronics',
          subcategory_name: 'Phones',
        },
      ];

      service.getDealsNearYou.mockResolvedValue(mockDeals);

      const result = await controller.getDealsNearYou({});

      expect(result.success).toBe(true);
      expect(result.data.deals).toEqual(mockDeals);
    });
  });

  describe('getFeaturedStores', () => {
    it('should return stores from service', async () => {
      const mockStores = [
        {
          business_id: 'biz-1',
          business_location_id: 'loc-1',
          location_name: 'Test Location',
          business_name: 'Test Business',
          storefront_visible: true,
          country_code: 'GA',
          total_items: 50,
          avg_rating: 4.5,
          total_ratings: 20,
        },
      ];

      service.getFeaturedStores.mockResolvedValue(mockStores);

      const result = await controller.getFeaturedStores({});

      expect(result.success).toBe(true);
      expect(result.data.stores).toEqual(mockStores);
    });
  });

  describe('getBagComplements', () => {
    it('should return empty array when no cart items provided', async () => {
      const result = await controller.getBagComplements({});

      expect(result.success).toBe(true);
      expect(result.data.items).toEqual([]);
      expect(result.message).toBe('No cart items provided');
    });

    it('should return items from service when cart items provided', async () => {
      const mockItems = [
        {
          id: 'inv-1',
          item_id: 'item-1',
          item_name: 'Complement Item',
          item_description: 'Complement Description',
          selling_price: 50,
          currency: 'XAF',
          category_name: 'Electronics',
          subcategory_name: 'Accessories',
          business_location_id: 'loc-1',
        },
      ];

      service.getBagComplements.mockResolvedValue(mockItems);

      const result = await controller.getBagComplements({
        cart_item_ids: 'item-1,item-2',
      });

      expect(result.success).toBe(true);
      expect(result.data.items).toEqual(mockItems);
      expect(service.getBagComplements).toHaveBeenCalledWith(
        ['item-1', 'item-2'],
        expect.any(Object)
      );
    });
  });
});
