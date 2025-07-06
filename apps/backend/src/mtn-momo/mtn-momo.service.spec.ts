import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MtnMomoService } from './mtn-momo.service';

describe('MtnMomoService', () => {
  let service: MtnMomoService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MtnMomoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                MTN_MOMO_SUBSCRIPTION_KEY: 'test_subscription_key',
                MTN_MOMO_API_KEY: 'test_api_key',
                MTN_MOMO_API_USER_ID: 'test_user_id',
                MTN_MOMO_TARGET_ENVIRONMENT: 'sandbox',
                MTN_MOMO_COLLECTION_PRIMARY_KEY: 'test_collection_primary',
                MTN_MOMO_COLLECTION_SECONDARY_KEY: 'test_collection_secondary',
                MTN_MOMO_DISBURSEMENT_PRIMARY_KEY: 'test_disbursement_primary',
                MTN_MOMO_DISBURSEMENT_SECONDARY_KEY:
                  'test_disbursement_secondary',
                MTN_MOMO_REMITTANCE_PRIMARY_KEY: 'test_remittance_primary',
                MTN_MOMO_REMITTANCE_SECONDARY_KEY: 'test_remittance_secondary',
                MTN_MOMO_CALLBACK_URL: 'https://test.com/webhook',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MtnMomoService>(MtnMomoService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate reference ID', () => {
    const referenceId = (service as any).generateReferenceId();
    expect(referenceId).toBeDefined();
    expect(typeof referenceId).toBe('string');
    expect(referenceId.length).toBeGreaterThan(0);
  });

  it('should validate configuration', () => {
    expect(configService.get('MTN_MOMO_SUBSCRIPTION_KEY')).toBe(
      'test_subscription_key'
    );
    expect(configService.get('MTN_MOMO_TARGET_ENVIRONMENT')).toBe('sandbox');
  });
});
