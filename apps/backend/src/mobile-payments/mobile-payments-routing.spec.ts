import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MobilePaymentsService } from './mobile-payments.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { FreemopayService } from './providers/freemopay.service';
import { MyPVitService } from './providers/mypvit.service';
import { FedaPayService } from './providers/fedapay.service';
import { MtnMomoService } from '../mtn-momo/mtn-momo.service';
import { MtnMomoDatabaseService } from '../mtn-momo/mtn-momo-database.service';
import { OrangeMomoService } from '../orange-momo/orange-momo.service';
import { OrangeMomoDatabaseService } from '../orange-momo/orange-momo-database.service';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';

describe('MobilePaymentsService - Routing', () => {
  let service: MobilePaymentsService;
  let hasuraSystemService: HasuraSystemService;

  const mockHasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'freemopay') {
        return {
          merchantId: 'test',
          merchantKey: 'test',
          amountMock: false,
        };
      }
      if (key === 'mypvit') {
        return {
          apiUrl: 'https://test.com',
          username: 'test',
          password: 'test',
        };
      }
      if (key === 'fedapay') {
        return {
          env: 'sandbox',
          secretKey: 'test',
          publicKey: 'test',
          webhookSecret: 'test',
          callbackUrl: 'https://test.com/callback',
          payoutCallbackUrl: 'https://test.com/payout',
          mock: false,
        };
      }
      return undefined;
    }),
  };

  const mockFreemopayService = {
    initiatePayment: jest.fn(),
    checkTransactionStatus: jest.fn(),
  };

  const mockMyPVitService = {
    initiatePayment: jest.fn(),
    checkTransactionStatus: jest.fn(),
  };

  const mockFedaPayService = {
    initiatePayment: jest.fn(),
    checkTransactionStatus: jest.fn(),
  };

  const mockMtnMomoService = {
    initiatePayment: jest.fn(),
    checkTransactionStatus: jest.fn(),
  };

  const mockMtnMomoDatabaseService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };

  const mockOrangeMomoService = {
    initiatePayment: jest.fn(),
    checkTransactionStatus: jest.fn(),
  };

  const mockOrangeMomoDatabaseService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };

  const mockCallbackProcessor = {
    processFreemopayCallback: jest.fn(),
    processMyPVitCallback: jest.fn(),
    processFedaPayCallback: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobilePaymentsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HasuraSystemService,
          useValue: mockHasuraSystemService,
        },
        {
          provide: FreemopayService,
          useValue: mockFreemopayService,
        },
        {
          provide: MyPVitService,
          useValue: mockMyPVitService,
        },
        {
          provide: FedaPayService,
          useValue: mockFedaPayService,
        },
        {
          provide: MtnMomoService,
          useValue: mockMtnMomoService,
        },
        {
          provide: MtnMomoDatabaseService,
          useValue: mockMtnMomoDatabaseService,
        },
        {
          provide: OrangeMomoService,
          useValue: mockOrangeMomoService,
        },
        {
          provide: OrangeMomoDatabaseService,
          useValue: mockOrangeMomoDatabaseService,
        },
        {
          provide: MobilePaymentCallbackProcessor,
          useValue: mockCallbackProcessor,
        },
      ],
    }).compile();

    service = module.get<MobilePaymentsService>(MobilePaymentsService);
    hasuraSystemService = module.get<HasuraSystemService>(HasuraSystemService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('FedaPay Routing with Active Flag', () => {
    it('should route TG to FedaPay when active', async () => {
      // Mock FedaPay as active
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: true }],
      });

      const provider = await service.getProviderForCountry('TG');
      
      expect(provider).toBe('fedapay');
      expect(mockHasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('supported_payment_systems'),
        expect.any(Object)
      );
    });

    it('should route TG to MyPVit when FedaPay is inactive', async () => {
      // Mock FedaPay as inactive
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: false }],
      });

      const provider = await service.getProviderForCountry('TG');
      
      expect(provider).toBe('mypvit');
      expect(mockHasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('supported_payment_systems'),
        expect.any(Object)
      );
    });

    it('should route TG to MyPVit when database query fails', async () => {
      // Mock database error
      mockHasuraSystemService.executeQuery.mockRejectedValue(
        new Error('Database error')
      );

      const provider = await service.getProviderForCountry('TG');
      
      expect(provider).toBe('mypvit');
    });

    it('should route TG to MyPVit when no row exists', async () => {
      // Mock no rows found
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [],
      });

      const provider = await service.getProviderForCountry('TG');
      
      expect(provider).toBe('mypvit');
    });

    it('should route CM to FreemoPay regardless of active flag', async () => {
      // Should not check database for CM
      const provider = await service.getProviderForCountry('CM');
      
      expect(provider).toBe('freemopay');
      expect(mockHasuraSystemService.executeQuery).not.toHaveBeenCalled();
    });

    it('should route GA to MyPVit regardless of active flag', async () => {
      // Should not check database for GA
      const provider = await service.getProviderForCountry('GA');
      
      expect(provider).toBe('mypvit');
      expect(mockHasuraSystemService.executeQuery).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive country codes', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: true }],
      });

      const provider1 = await service.getProviderForCountry('tg');
      const provider2 = await service.getProviderForCountry('TG');
      const provider3 = await service.getProviderForCountry('Tg');
      
      expect(provider1).toBe('fedapay');
      expect(provider2).toBe('fedapay');
      expect(provider3).toBe('fedapay');
    });
  });

  describe('Full Request Routing', () => {
    it('should route TG item to FedaPay when active', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: true }],
      });

      const provider = await service.resolveProviderFromRequest({
        customerPhone: '+22878123456',
        itemCountry: 'TG',
      });
      
      expect(provider).toBe('fedapay');
    });

    it('should route TG item to MyPVit when FedaPay inactive', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: false }],
      });

      const provider = await service.resolveProviderFromRequest({
        customerPhone: '+22878123456',
        itemCountry: 'TG',
      });
      
      expect(provider).toBe('mypvit');
    });

    it('should prioritize phone over itemCountry for CM', async () => {
      // CM phone should go to FreemoPay regardless of itemCountry
      const provider = await service.resolveProviderFromRequest({
        customerPhone: '+237670123456',
        itemCountry: 'TG', // Even with TG item
      });
      
      expect(provider).toBe('freemopay');
      // Should not check database since CM phone takes precedence
      expect(mockHasuraSystemService.executeQuery).not.toHaveBeenCalled();
    });

    it('should use itemCountry when phone is not CM', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: true }],
      });

      const provider = await service.resolveProviderFromRequest({
        customerPhone: '+22878123456',
        itemCountry: 'TG',
      });
      
      expect(provider).toBe('fedapay');
      expect(mockHasuraSystemService.executeQuery).toHaveBeenCalled();
    });
  });

  describe('Admin Provider Resolution', () => {
    it('should resolve admin provider with active check', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: true }],
      });

      const provider = await service.resolveAdminIntegrationProvider(
        '+22878123456',
        'fedapay'
      );
      
      expect(provider).toBe('fedapay');
    });

    it('B8: should route stored fedapay unconditionally even when TG flag is OFF', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: false }], // Flag OFF
      });

      // Stored provider='fedapay' should still route to fedapay (B4)
      const provider = await service.resolveAdminIntegrationProvider(
        '+22878123456',
        'fedapay' // stored provider
      );
      
      expect(provider).toBe('fedapay'); // Must route to fedapay regardless of flag
    });

    it('should fallback to MyPVit when fedapay inactive', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: false }],
      });

      const provider = await service.resolveAdminIntegrationProvider(
        '+22878123456',
        'mypvit'
      );
      
      expect(provider).toBe('mypvit');
    });
  });

  describe('Phone-based routing without itemCountry (payouts)', () => {
    it('routes a +228 payee to FedaPay when TG is active', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: true }],
      });
      const provider = await service.resolveProviderFromRequest({
        customerPhone: '+22890123456',
      });
      expect(provider).toBe('fedapay');
    });

    it('does not route a +228 payee to FedaPay when TG is inactive', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: false }],
      });
      const provider = await service.resolveProviderFromRequest({
        customerPhone: '+22890123456',
        provider: 'fedapay',
      });
      expect(provider).toBe('mypvit');
    });

    it('ignores a fedapay hint for a non-Togo phone even when TG is active', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: true }],
      });
      const provider = await service.resolveProviderFromRequest({
        customerPhone: '+24166123456',
        provider: 'fedapay',
      });
      expect(provider).toBe('mypvit');
    });

    it('keeps an explicit stored mypvit provider for a +228 phone', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: true }],
      });
      const provider = await service.resolveAdminIntegrationProvider(
        '+22890123456',
        'mypvit'
      );
      expect(provider).toBe('mypvit');
    });
  });

  describe('Cache Behavior', () => {
    it('should query database on each routing decision (no caching)', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: true }],
      });

      await service.getProviderForCountry('TG');
      await service.getProviderForCountry('TG');
      await service.getProviderForCountry('TG');
      
      // Should query database 3 times (no caching)
      expect(mockHasuraSystemService.executeQuery).toHaveBeenCalledTimes(3);
    });
  });

  describe('B8: B7 Country Name Normalization', () => {
    it('should normalize "Togo" to TG and check flag', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: true }],
      });

      const provider = await service.getProviderForCountry('Togo');

      expect(provider).toBe('fedapay');
      expect(mockHasuraSystemService.executeQuery).toHaveBeenCalled();
    });

    it('should normalize "TOGO" to TG', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: true }],
      });

      const provider = await service.getProviderForCountry('TOGO');

      expect(provider).toBe('fedapay');
    });
  });

  describe('B8: B7 +228 Withdrawal Routing', () => {
    it('should route +228 to fedapay when TG flag active', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: true }],
      });

      const provider = await (service as any).providerFromHintOrPhone({
        customerPhone: '+22878123456',
      });

      expect(provider).toBe('fedapay');
    });

    it('should route +228 to mypvit when TG flag inactive', async () => {
      mockHasuraSystemService.executeQuery.mockResolvedValue({
        supported_payment_systems: [{ active: false }],
      });

      const provider = await (service as any).providerFromHintOrPhone({
        customerPhone: '+22878123456',
      });

      expect(provider).toBe('mypvit');
    });
  });

  describe('B8: CM/GA Routing Unchanged', () => {
    it('should keep Cameroon routing to freemopay', async () => {
      const provider = await service['resolveProviderFromRequest']({
        customerPhone: '+237690123456',
      });

      expect(provider).toBe('freemopay');
    });

    it('should keep local Cameroon mobile to freemopay', () => {
      const provider = service.getProvider('692168717');
      expect(provider).toBe('freemopay');
    });

    it('should keep Gabon routing to mypvit', () => {
      const provider = service.getProvider('+24106123456');
      expect(provider).toBe('mypvit');
    });
  });
});
