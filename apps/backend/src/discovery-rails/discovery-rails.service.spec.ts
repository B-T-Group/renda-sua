import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryRailsService } from './discovery-rails.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

describe('DiscoveryRailsService', () => {
  let service: DiscoveryRailsService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let hasuraUserService: jest.Mocked<HasuraUserService>;

  beforeEach(async () => {
    const mockHasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };

    const mockHasuraUserService = {
      getUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryRailsService,
        {
          provide: HasuraSystemService,
          useValue: mockHasuraSystemService,
        },
        {
          provide: HasuraUserService,
          useValue: mockHasuraUserService,
        },
      ],
    }).compile();

    service = module.get<DiscoveryRailsService>(DiscoveryRailsService);
    hasuraSystemService = module.get(HasuraSystemService);
    hasuraUserService = module.get(HasuraUserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTopInCategory', () => {
    it('should return empty array when no items found', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_inventory: [],
      });

      const result = await service.getTopInCategory('Electronics', {
        country_code: 'GA',
      });

      expect(result).toEqual([]);
    });
  });

  describe('getDealsNearYou', () => {
    it('should return empty array when no deals found', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        item_deals: [],
      });

      const result = await service.getDealsNearYou({ country_code: 'GA' });

      expect(result).toEqual([]);
    });
  });

  describe('getFeaturedStores', () => {
    it('should return empty array when no stores found', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_locations: [],
      });

      const result = await service.getFeaturedStores({ country_code: 'GA' });

      expect(result).toEqual([]);
    });
  });

  describe('getBagComplements', () => {
    it('should return empty array when cart is empty', async () => {
      const result = await service.getBagComplements([], { country_code: 'GA' });

      expect(result).toEqual([]);
    });

    it('should return empty array when cart items have no categories', async () => {
      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({
          items: [],
        })
        .mockResolvedValueOnce({
          business_inventory: [],
        });

      const result = await service.getBagComplements(
        ['item-id-1'],
        { country_code: 'GA' }
      );

      expect(result).toEqual([]);
    });
  });
});
