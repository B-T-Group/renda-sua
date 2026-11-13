import { webcrypto } from 'crypto';
import { Test } from '@nestjs/testing';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { RentalsService } from '../rentals/rentals.service';
import { AppModule } from './app.module';

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
});

process.env.TWILIO_ACCOUNT_SID ||= 'test_sid';
process.env.TWILIO_ACCOUNT_TOKEN ||= 'test_token';
process.env.TWILIO_VERIFY_SERVICE_SID ||= 'test_verify_sid';
process.env.MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE ||= 'ACC_BOOT_AIRTEL';
process.env.MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE ||= 'ACC_BOOT_MOOV';
process.env.REDIS_HOST = '';
process.env.SESSION_ENCRYPTION_KEY ||= 'test-session-encryption-key-32bytes';
process.env.COMMERCE_TOKEN_ENCRYPTION_KEY ||=
  'test-commerce-token-encryption-key-32b';

const hasuraSystemMock = {
  request: jest.fn().mockResolvedValue({}),
  executeQuery: jest.fn().mockResolvedValue({}),
  executeMutation: jest.fn().mockResolvedValue({}),
};

const hasuraUserMock = {
  getActivePersonaHeader: jest.fn(),
  sessionPersonaContext: jest.fn().mockReturnValue({}),
  executeQuery: jest.fn().mockResolvedValue({}),
  executeMutation: jest.fn().mockResolvedValue({}),
  getUser: jest.fn(),
  getUserId: jest.fn().mockReturnValue('anonymous'),
  resolveContext: jest.fn(),
  isConfigured: jest.fn().mockReturnValue(false),
};

/**
 * Fails when a Nest imports entry is undefined, or when a circular import
 * hits a temporal dead zone while AppModule is evaluated.
 */
describe('App boot smoke', () => {
  it('compiles AppModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HasuraSystemService)
      .useValue(hasuraSystemMock)
      .overrideProvider(HasuraUserService)
      .useValue(hasuraUserMock)
      .compile();

    expect(moduleRef.get(RentalsService)).toBeInstanceOf(RentalsService);
    await moduleRef.close();
  }, 120_000);
});
