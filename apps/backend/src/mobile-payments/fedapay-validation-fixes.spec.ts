import { Test, TestingModule } from '@nestjs/testing';
import { MobilePaymentsService } from './mobile-payments.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { FreemopayService } from './providers/freemopay.service';
import { FedaPayService } from './providers/fedapay.service';
import { MyPVitService } from './providers/mypvit.service';
import { MtnMomoService } from '../mtn-momo/mtn-momo.service';
import { MtnMomoDatabaseService } from '../mtn-momo/mtn-momo-database.service';
import { OrangeMomoService } from '../orange-momo/orange-momo.service';
import { OrangeMomoDatabaseService } from '../orange-momo/orange-momo-database.service';

/**
 * Tests for F-L2 (TG phone validation), F-M3 (country matching), F-M5 (providers by country)
 */
describe('FedaPay Validation Fixes', () => {
  let service: MobilePaymentsService;
  let hasuraSystemService: HasuraSystemService;

  const mockHasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };

  const mockDatabaseService = {
    getUserCountry: jest.fn().mockResolvedValue(null),
    getUserAddress: jest.fn().mockResolvedValue(null),
  };
  const mockFedaPayService = {
    testConnection: jest.fn().mockResolvedValue(true),
    getSupportedPaymentMethods: jest.fn().mockResolvedValue(['mobile_money']),
    initiatePayment: jest.fn(),
  };
  const mockFreemopayService = {
    testConnection: jest.fn().mockResolvedValue(true),
    getSupportedPaymentMethods: jest.fn().mockResolvedValue(['mobile_money']),
    initiatePayment: jest.fn(),
  };
  const mockMyPVitService = {
    testConnection: jest.fn().mockResolvedValue(true),
    getSupportedPaymentMethods: jest.fn().mockResolvedValue(['mobile_money']),
  };
  const mockMtnMomoService = {
    testConnection: jest.fn().mockResolvedValue(true),
  };
  const mockOrangeMomoService = {
    testConnection: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobilePaymentsService,
        { provide: HasuraSystemService, useValue: mockHasuraSystemService },
        { provide: MobilePaymentsDatabaseService, useValue: mockDatabaseService },
        { provide: FedaPayService, useValue: mockFedaPayService },
        { provide: FreemopayService, useValue: mockFreemopayService },
        { provide: MyPVitService, useValue: mockMyPVitService },
        { provide: MtnMomoService, useValue: mockMtnMomoService },
        { provide: MtnMomoDatabaseService, useValue: {} },
        { provide: OrangeMomoService, useValue: mockOrangeMomoService },
        { provide: OrangeMomoDatabaseService, useValue: {} },
      ],
    }).compile();

    service = module.get<MobilePaymentsService>(MobilePaymentsService);
    hasuraSystemService = module.get<HasuraSystemService>(HasuraSystemService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('F-L2: Invalid TG phone numbers return 400', () => {
    it('should reject non-TG phone for FedaPay before creating row', async () => {
      const request = {
        amount: 500,
        currency: 'XOF',
        customerPhone: '+237692168717', // Cameroon number
        provider: 'fedapay',
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        accountId: 'acc-1',
        callbackUrl: 'https://test.com/callback',
      };

      const result = await service.initiatePayment(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHONE_NUMBER');
      expect(result.message).toContain('Togo');
    });

    it('should reject invalid TG phone with wrong prefix', async () => {
      const request = {
        amount: 500,
        currency: 'XOF',
        customerPhone: '+22865123456', // Invalid prefix (65 is not Moov or Mixx)
        provider: 'fedapay',
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        accountId: 'acc-1',
        callbackUrl: 'https://test.com/callback',
      };

      const result = await service.initiatePayment(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHONE_NUMBER');
      expect(result.message).toContain('Moov or Mixx');
    });

    it('should reject TG phone with wrong length', async () => {
      const request = {
        amount: 500,
        currency: 'XOF',
        customerPhone: '+2289012345', // 7 digits instead of 8
        provider: 'fedapay',
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        accountId: 'acc-1',
        callbackUrl: 'https://test.com/callback',
      };

      const result = await service.initiatePayment(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHONE_NUMBER');
      expect(result.message).toContain('8 digits');
    });

    it('should accept valid TG Moov phone', async () => {
      // Mock the actual initiation to succeed
      mockFedaPayService.initiatePayment = jest.fn().mockResolvedValue({
        success: true,
        transactionId: '123',
        reference: 'REF-1',
        status: 'pending',
      });

      const request = {
        amount: 500,
        currency: 'XOF',
        customerPhone: '+22890123456', // Valid Moov prefix (90)
        provider: 'fedapay',
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        accountId: 'acc-1',
        callbackUrl: 'https://test.com/callback',
      };

      const result = await service.initiatePayment(request);

      // Should not reject on validation
      expect(result.errorCode).not.toBe('INVALID_PHONE_NUMBER');
    });

    it('should accept valid TG Mixx phone', async () => {
      mockFedaPayService.initiatePayment = jest.fn().mockResolvedValue({
        success: true,
        transactionId: '123',
        reference: 'REF-1',
        status: 'pending',
      });

      const request = {
        amount: 500,
        currency: 'XOF',
        customerPhone: '+22896000000', // Valid Mixx prefix (96)
        provider: 'fedapay',
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        accountId: 'acc-1',
        callbackUrl: 'https://test.com/callback',
      };

      const result = await service.initiatePayment(request);

      expect(result.errorCode).not.toBe('INVALID_PHONE_NUMBER');
    });
  });

  describe('F-M3: Payer phone country must match item country', () => {
    it('should reject +228 payer for CM listing', async () => {
      const request = {
        amount: 1000,
        currency: 'XAF',
        customerPhone: '+22890123456', // Togo number
        itemCountry: 'CM', // Cameroon listing
        provider: 'freemopay',
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        accountId: 'acc-1',
        callbackUrl: 'https://test.com/callback',
      };

      const result = await service.initiatePayment(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PHONE_COUNTRY_MISMATCH');
      expect(result.message).toContain('CM');
    });

    it('should reject +237 payer for TG listing', async () => {
      const request = {
        amount: 500,
        currency: 'XOF',
        customerPhone: '+237692168717', // Cameroon number
        itemCountry: 'TG', // Togo listing
        provider: 'fedapay',
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        accountId: 'acc-1',
        callbackUrl: 'https://test.com/callback',
      };

      const result = await service.initiatePayment(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PHONE_COUNTRY_MISMATCH');
      expect(result.message).toContain('TG');
    });

    it('should allow matching phone and item country', async () => {
      mockFreemopayService.initiatePayment = jest.fn().mockResolvedValue({
        success: true,
        transactionId: '123',
        reference: 'REF-1',
        status: 'pending',
      });

      const request = {
        amount: 1000,
        currency: 'XAF',
        customerPhone: '+237692168717', // Cameroon number
        itemCountry: 'CM', // Cameroon listing
        provider: 'freemopay',
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        accountId: 'acc-1',
        callbackUrl: 'https://test.com/callback',
      };

      const result = await service.initiatePayment(request);

      // Should not reject on country mismatch
      expect(result.errorCode).not.toBe('PHONE_COUNTRY_MISMATCH');
    });

    it('should allow wallet top-up without itemCountry', async () => {
      mockFedaPayService.initiatePayment = jest.fn().mockResolvedValue({
        success: true,
        transactionId: '123',
        reference: 'REF-1',
        status: 'pending',
      });

      const request = {
        amount: 500,
        currency: 'XOF',
        customerPhone: '+22890123456',
        // No itemCountry for wallet top-up
        provider: 'fedapay',
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        accountId: 'acc-1',
        callbackUrl: 'https://test.com/callback',
      };

      const result = await service.initiatePayment(request);

      // Should not reject when no itemCountry
      expect(result.errorCode).not.toBe('PHONE_COUNTRY_MISMATCH');
    });
  });

  describe('F-M5: Providers by country endpoint', () => {
    it('should return FedaPay for TG when active', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [
          { name: 'fedapay', country: 'TG', active: true },
        ],
      });

      const providers = await service.getProvidersForCountry('TG');

      expect(providers).toHaveLength(1);
      expect(providers[0].name).toBe('FedaPay');
      expect(providers[0].supportedCurrencies).toContain('XOF');
    });

    it('should return Freemopay for CM when active', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [
          { name: 'freemopay', country: 'CM', active: true },
        ],
      });

      const providers = await service.getProvidersForCountry('CM');

      expect(providers).toHaveLength(1);
      expect(providers[0].name).toBe('Freemopay');
    });

    it('should return MyPVit for GA when active', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [
          { name: 'mypvit', country: 'GA', active: true },
        ],
      });

      const providers = await service.getProvidersForCountry('GA');

      expect(providers).toHaveLength(1);
      expect(providers[0].name).toBe('MyPVit');
    });

    it('should return empty array when no providers active', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [],
      });

      const providers = await service.getProvidersForCountry('TG');

      expect(providers).toHaveLength(0);
    });

    it('should handle query errors gracefully', async () => {
      mockHasuraSystemService.executeQuery.mockRejectedValue(
        new Error('GraphQL error')
      );

      const providers = await service.getProvidersForCountry('TG');

      // Should return empty array on error, not throw
      expect(providers).toHaveLength(0);
    });

    it('should filter inactive providers', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [
          { name: 'fedapay', country: 'TG', active: false },
        ],
      });

      const providers = await service.getProvidersForCountry('TG');

      // Active filter in query should exclude it
      expect(providers).toHaveLength(0);
    });
  });
});
