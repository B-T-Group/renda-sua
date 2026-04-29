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

  it('should reject per_km_delivery_fee above 1500 for GA', async () => {
    const config: CountryOnboardingConfigDto = {
      countryCode: 'GA',
      countryDeliveryConfig: {
        country_code: 'GA',
        configs: [
          {
            config_key: 'per_km_delivery_fee',
            config_value: '1600',
            data_type: 'number',
          },
        ],
      },
      deliveryTimeSlots: [],
      supportedStates: [],
    };

    await expect(
      service.applyCountryOnboardingConfig(config)
    ).rejects.toThrowError(
      'per_km_delivery_fee cannot exceed 1500 XAF for GA'
    );
  });

  it('should allow per_km_delivery_fee of 1500 for CM', async () => {
    const config: CountryOnboardingConfigDto = {
      countryCode: 'CM',
      countryDeliveryConfig: {
        country_code: 'CM',
        configs: [
          {
            config_key: 'per_km_delivery_fee',
            config_value: '1500',
            data_type: 'number',
          },
        ],
      },
      deliveryTimeSlots: [],
      supportedStates: [],
    };

    await expect(service.applyCountryOnboardingConfig(config)).resolves.toBe(
      undefined
    );
  });
});

