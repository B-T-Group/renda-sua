import { Test, TestingModule } from '@nestjs/testing';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { CountryOnboardingService } from './country-onboarding.service';
import { CountryOnboardingConfigDto } from './dto/country-onboarding.dto';

describe('CountryOnboardingService', () => {
  let service: CountryOnboardingService;
  let hasura: HasuraSystemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountryOnboardingService,
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery: jest.fn().mockResolvedValue({
              country_delivery_configs: [],
              delivery_time_slots: [],
              supported_country_states: [],
            }),
            executeMutation: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<CountryOnboardingService>(CountryOnboardingService);
    hasura = module.get<HasuraSystemService>(HasuraSystemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch onboarding config for a country', async () => {
    const result = await service.getCountryOnboardingConfig('GA');
    expect(result.countryCode).toBe('GA');
    expect(result.deliveryTimeSlots).toEqual([]);
    expect(result.supportedStates).toEqual([]);
    expect(result.countryDeliveryConfig).toBeNull();
    expect(hasura.executeQuery).toHaveBeenCalled();
  });

  it('should validate delivery time slots before apply', async () => {
    const config: CountryOnboardingConfigDto = {
      countryCode: 'GA',
      countryDeliveryConfig: null,
      deliveryTimeSlots: [
        {
          country_code: 'GA',
          slot_name: '',
          slot_type: 'standard',
          start_time: '08:00',
          end_time: '10:00',
        },
      ],
      supportedStates: [],
    };

    await expect(
      service.applyCountryOnboardingConfig(config)
    ).rejects.toThrowError(
      'Each delivery time slot must have a name and type'
    );
  });
});

