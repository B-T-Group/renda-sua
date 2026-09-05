import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DeliveryEstimateService } from './delivery-estimate.service';

describe('DeliveryEstimateService', () => {
  let service: DeliveryEstimateService;
  let hasuraService: jest.Mocked<HasuraSystemService>;
  let configService: jest.Mocked<DeliveryConfigService>;

  beforeEach(async () => {
    const mockHasuraService = {
      executeQuery: jest.fn(),
    };

    const mockConfigService = {
      getCurrency: jest.fn(),
      getNormalDeliveryBaseFee: jest.fn(),
      getMaxPerKmDeliveryFee: jest.fn(),
      getTimezone: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryEstimateService,
        { provide: HasuraSystemService, useValue: mockHasuraService },
        { provide: DeliveryConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DeliveryEstimateService>(DeliveryEstimateService);
    hasuraService = module.get(HasuraSystemService);
    configService = module.get(DeliveryConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEstimate', () => {
    it('should return estimate for country-wide area with needsFinerArea true', async () => {
      hasuraService.executeQuery
        .mockResolvedValueOnce({
          markets: [
            { country_code: 'CM', country_name: 'Cameroon' },
          ],
          areas: [],
        });

      configService.getCurrency.mockResolvedValue('XAF');
      configService.getNormalDeliveryBaseFee.mockResolvedValue(1000);
      configService.getMaxPerKmDeliveryFee.mockResolvedValue(1500);

      const result = await service.getEstimate({
        marketId: 'CM',
        areaId: undefined,
      });

      expect(result.areaLabel).toBe('Cameroon · All');
      expect(result.needsFinerArea).toBe(true);
      expect(result.fee.confidence).toBe('range');
      expect(result.fee.exact).toBeNull();
      expect(result.fee.min).toBe(1000);
      expect(result.fee.max).toBe(1500);
      expect(result.fee.currency).toBe('XAF');
      expect(result.window.band).toBe('24–48 hours');
    });

    it('should return estimate for specific area with needsFinerArea false', async () => {
      hasuraService.executeQuery
        .mockResolvedValueOnce({
          markets: [
            { country_code: 'CM', country_name: 'Cameroon' },
          ],
          areas: [
            { state_code: 'Littoral', state_name: 'Littoral' },
          ],
        });

      configService.getCurrency.mockResolvedValue('XAF');
      configService.getNormalDeliveryBaseFee.mockResolvedValue(1000);
      configService.getMaxPerKmDeliveryFee.mockResolvedValue(1500);

      const result = await service.getEstimate({
        marketId: 'CM',
        areaId: 'Littoral',
      });

      expect(result.areaLabel).toBe('Cameroon · Littoral');
      expect(result.needsFinerArea).toBe(false);
      expect(result.fee.confidence).toBe('range');
    });

    it('should return 45-75 minutes window for food category', async () => {
      hasuraService.executeQuery
        .mockResolvedValueOnce({
          markets: [
            { country_code: 'CM', country_name: 'Cameroon' },
          ],
          areas: [
            { state_code: 'Littoral', state_name: 'Littoral' },
          ],
        });

      configService.getCurrency.mockResolvedValue('XAF');
      configService.getNormalDeliveryBaseFee.mockResolvedValue(1000);
      configService.getMaxPerKmDeliveryFee.mockResolvedValue(1500);

      const result = await service.getEstimate({
        marketId: 'CM',
        areaId: 'Littoral',
        category: 'Food',
      });

      expect(result.window.band).toBe('45–75 minutes');
    });

    it('should include serving status for food items with sellerId', async () => {
      hasuraService.executeQuery
        .mockResolvedValueOnce({
          markets: [
            { country_code: 'CM', country_name: 'Cameroon' },
          ],
          areas: [
            { state_code: 'Littoral', state_name: 'Littoral' },
          ],
        })
        .mockResolvedValueOnce({
          business_locations: [
            {
              operating_hours: {
                monday: { open: '08:00', close: '20:00', is_open: true },
                tuesday: { open: '08:00', close: '20:00', is_open: true },
                wednesday: { open: '08:00', close: '20:00', is_open: true },
                thursday: { open: '08:00', close: '20:00', is_open: true },
                friday: { open: '08:00', close: '20:00', is_open: true },
                saturday: { open: '08:00', close: '20:00', is_open: true },
                sunday: { open: '10:00', close: '18:00', is_open: true },
              },
            },
          ],
        });

      configService.getCurrency.mockResolvedValue('XAF');
      configService.getNormalDeliveryBaseFee.mockResolvedValue(1000);
      configService.getMaxPerKmDeliveryFee.mockResolvedValue(1500);
      configService.getTimezone.mockResolvedValue('Africa/Douala');

      const result = await service.getEstimate({
        marketId: 'CM',
        areaId: 'Littoral',
        category: 'Food',
        sellerId: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.servingStatus).toBeTruthy();
    });

    it('should resolve item category from skuId when category not provided', async () => {
      hasuraService.executeQuery
        .mockResolvedValueOnce({
          markets: [
            { country_code: 'CM', country_name: 'Cameroon' },
          ],
          areas: [
            { state_code: 'Littoral', state_name: 'Littoral' },
          ],
        })
        .mockResolvedValueOnce({
          items_by_pk: {
            item_sub_category: {
              item_category: {
                category_name: 'Food',
              },
            },
          },
        });

      configService.getCurrency.mockResolvedValue('XAF');
      configService.getNormalDeliveryBaseFee.mockResolvedValue(1000);
      configService.getMaxPerKmDeliveryFee.mockResolvedValue(1500);

      const result = await service.getEstimate({
        marketId: 'CM',
        areaId: 'Littoral',
        skuId: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.window.band).toBe('45–75 minutes');
    });

    it('should throw error when market not found', async () => {
      hasuraService.executeQuery.mockResolvedValueOnce({
        markets: [],
        areas: [],
      });

      await expect(
        service.getEstimate({
          marketId: 'INVALID',
        })
      ).rejects.toThrow('Market not found: INVALID');
    });

    it('should handle CFA countries correctly', async () => {
      hasuraService.executeQuery.mockResolvedValueOnce({
        markets: [
          { country_code: 'GA', country_name: 'Gabon' },
        ],
        areas: [],
      });

      configService.getCurrency.mockResolvedValue('XAF');
      configService.getNormalDeliveryBaseFee.mockResolvedValue(1000);
      configService.getMaxPerKmDeliveryFee.mockResolvedValue(1500);

      const result = await service.getEstimate({
        marketId: 'GA',
      });

      expect(result.fee.currency).toBe('XAF');
      expect(result.fee.max).toBe(1500);
    });

    it('should return coverage and trustVariant', async () => {
      hasuraService.executeQuery.mockResolvedValueOnce({
        markets: [
          { country_code: 'CM', country_name: 'Cameroon' },
        ],
        areas: [
          { state_code: 'Littoral', state_name: 'Littoral' },
        ],
      });

      configService.getCurrency.mockResolvedValue('XAF');
      configService.getNormalDeliveryBaseFee.mockResolvedValue(1000);
      configService.getMaxPerKmDeliveryFee.mockResolvedValue(1500);

      const result = await service.getEstimate({
        marketId: 'CM',
        areaId: 'Littoral',
      });

      expect(result.coverage).toBe('in');
      expect(result.trustVariant).toBe('map_and_pin');
    });
  });
});
