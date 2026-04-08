import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { OrangeMomoDatabaseService } from './orange-momo-database.service';
import { OrangeMomoService } from './orange-momo.service';

describe('OrangeMomoService', () => {
  let service: OrangeMomoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrangeMomoService,
        {
          provide: OrangeMomoDatabaseService,
          useValue: {
            logPaymentRequest: jest.fn(),
            updatePaymentRequestStatus: jest.fn(),
            getPaymentRequestByTransactionId: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'orangeMomo') {
                return {
                  baseUrl: 'https://api-s1.orange.cm/omcoreapis/1.0.2',
                  oauthTokenUrl: 'https://api-s1.orange.cm/token',
                  oauthGrantType: 'password' as const,
                  customerKey: 'test_ck',
                  customerSecret: 'test_cs',
                  apiUsername: 'test_u',
                  apiPassword: 'test_p',
                  channelMsisdn: '690000000',
                  callbackUrl: 'https://example.com/api/orange-momo/webhook',
                  channelPin: '2222',
                };
              }
              return undefined;
            }),
          },
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrangeMomoService>(OrangeMomoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
