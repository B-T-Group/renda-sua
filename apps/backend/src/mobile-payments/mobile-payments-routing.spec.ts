import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MobilePaymentsService } from './mobile-payments.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { FreemopayService } from './providers/freemopay.service';
import { MyPVitService } from './providers/mypvit.service';
import { FedaPayService } from './providers/fedapay.service';
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
});
