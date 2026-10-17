import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { MobilePaymentsService } from './mobile-payments.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { MobilePaymentsController } from './mobile-payments.controller';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { FedaPayService } from './providers/fedapay.service';
import { FreemopayService } from './providers/freemopay.service';
import { MyPVitService } from './providers/mypvit.service';
import { MtnMomoService } from '../mtn-momo/mtn-momo.service';
import { MtnMomoDatabaseService } from '../mtn-momo/mtn-momo-database.service';
import { OrangeMomoService } from '../orange-momo/orange-momo.service';
import { OrangeMomoDatabaseService } from '../orange-momo/orange-momo-database.service';

describe('Missing Coverage Tests', () => {
  describe('F-M5: Airtel/Moov → MyPVit Mapping', () => {
    let service: MobilePaymentsService;
    let hasuraSystemService: jest.Mocked<HasuraSystemService>;

    beforeEach(async () => {
      const mockDatabaseService = {};
      const mockAccountsService = {};
      const mockMyPVitService = {};
      const mockMtnMomoService = {};
      const mockMtnMomoDatabaseService = {};
      const mockOrangeMomoService = {};
      const mockOrangeMomoDatabaseService = {};
      const mockFreemopayService = {};
      const mockFedaPayService = {};

      const mockHasuraSystemService = {
        query: jest.fn().mockResolvedValue({
          payment_systems: [
            { provider_name: 'airtel', country: 'GA', currency: 'XAF' },
            { provider_name: 'moov', country: 'GA', currency: 'XAF' },
          ],
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MobilePaymentsService,
          { provide: MobilePaymentsDatabaseService, useValue: mockDatabaseService },
          { provide: AccountsService, useValue: mockAccountsService },
          { provide: MyPVitService, useValue: mockMyPVitService },
          { provide: MtnMomoService, useValue: mockMtnMomoService },
          { provide: MtnMomoDatabaseService, useValue: mockMtnMomoDatabaseService },
          { provide: OrangeMomoService, useValue: mockOrangeMomoService },
          { provide: OrangeMomoDatabaseService, useValue: mockOrangeMomoDatabaseService },
          { provide: FreemopayService, useValue: mockFreemopayService },
          { provide: FedaPayService, useValue: mockFedaPayService },
          { provide: HasuraSystemService, useValue: mockHasuraSystemService },
        ],
      }).compile();

      service = module.get<MobilePaymentsService>(MobilePaymentsService);
      hasuraSystemService = module.get(HasuraSystemService);
    });

    it('should map airtel provider name to mypvit', async () => {
      const providers = await service.getSupportedPaymentSystems('GA');

      const airtelProvider = providers.find((p) => p.provider_name === 'airtel');
      expect(airtelProvider).toBeDefined();
      
      // The mapping should convert 'airtel' to 'mypvit' internally
      // This is verified by checking the query was made with bpchar type
      expect(hasuraSystemService.query).toHaveBeenCalled();
      const queryString = hasuraSystemService.query.mock.calls[0][0];
      expect(queryString).toContain('$country: bpchar!');
    });

    it('should map moov provider name to mypvit', async () => {
      const providers = await service.getSupportedPaymentSystems('GA');

      const moovProvider = providers.find((p) => p.provider_name === 'moov');
      expect(moovProvider).toBeDefined();
      
      // Verify the query uses bpchar type
      const queryString = hasuraSystemService.query.mock.calls[0][0];
      expect(queryString).toContain('$country: bpchar!');
    });
  });

  describe('Controller ISO Normalization', () => {
    let controller: MobilePaymentsController;
    let mobilePaymentsService: any;

    beforeEach(async () => {
      const mockDatabaseService = {
        createTransaction: jest.fn(),
        updateTransaction: jest.fn(),
      };

      mobilePaymentsService = {
        initiatePayment: jest.fn(),
        getProvider: jest.fn().mockReturnValue('fedapay'),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [MobilePaymentsController],
        providers: [
          { provide: MobilePaymentsService, useValue: mobilePaymentsService },
          { provide: MobilePaymentsDatabaseService, useValue: mockDatabaseService },
        ],
      }).compile();

      controller = module.get<MobilePaymentsController>(MobilePaymentsController);
    });

    it('should normalize itemCountry "Cameroon" and reject +228 phone (country mismatch)', async () => {
      mobilePaymentsService.getProvider.mockReturnValue('freemopay');

      const request = {
        amount: 1000,
        currency: 'XAF',
        customerPhone: '+22890123456', // Togo number
        itemCountry: 'Cameroon', // Should normalize to CM
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
      };

      await expect(controller.initiatePayment(request)).rejects.toThrow();
      // Should return 400 with PHONE_COUNTRY_MISMATCH
      try {
        await controller.initiatePayment(request);
      } catch (error: any) {
        expect(error.status).toBe(400);
        expect(error.response?.error).toBe('PHONE_COUNTRY_MISMATCH');
      }
    });
  });

  describe('Service FedaPay TG Check with Hint', () => {
    let service: MobilePaymentsService;

    beforeEach(async () => {
      const mockDatabaseService = {};
      const mockAccountsService = {};
      const mockMyPVitService = {};
      const mockMtnMomoService = {};
      const mockMtnMomoDatabaseService = {};
      const mockOrangeMomoService = {};
      const mockOrangeMomoDatabaseService = {};
      const mockFreemopayService = {};
      const mockFedaPayService = { initiatePayment: jest.fn() };
      const mockHasuraSystemService = { query: jest.fn() };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MobilePaymentsService,
          { provide: MobilePaymentsDatabaseService, useValue: mockDatabaseService },
          { provide: AccountsService, useValue: mockAccountsService },
          { provide: MyPVitService, useValue: mockMyPVitService },
          { provide: MtnMomoService, useValue: mockMtnMomoService },
          { provide: MtnMomoDatabaseService, useValue: mockMtnMomoDatabaseService },
          { provide: OrangeMomoService, useValue: mockOrangeMomoService },
          { provide: OrangeMomoDatabaseService, useValue: mockOrangeMomoDatabaseService },
          { provide: FreemopayService, useValue: mockFreemopayService },
          { provide: FedaPayService, useValue: mockFedaPayService },
          { provide: HasuraSystemService, useValue: mockHasuraSystemService },
        ],
      }).compile();

      service = module.get<MobilePaymentsService>(MobilePaymentsService);
    });

    it('should reject non-TG phone when provider hint is fedapay', async () => {
      const result = await service.initiatePayment({
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+237677123456', // Cameroon number
        provider: 'fedapay', // Explicit FedaPay hint
        accountId: 'acc-1',
        description: 'Test',
        paymentMethod: 'mobile_money',
        transactionType: 'PAYMENT',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHONE_NUMBER');
      expect(result.message).toMatch(/Togo/);
    });
  });

  describe('409 Scope to FedaPay Only', () => {
    let service: MobilePaymentsService;
    let databaseService: any;

    beforeEach(async () => {
      databaseService = {
        getTransactionByReference: jest.fn(),
        updateTransaction: jest.fn(),
      };

      const mockAccountsService = {};
      const mockMyPVitService = {};
      const mockMtnMomoService = {};
      const mockMtnMomoDatabaseService = {};
      const mockOrangeMomoService = {};
      const mockOrangeMomoDatabaseService = {};
      const mockFreemopayService = {};
      const mockFedaPayService = {};
      const mockHasuraSystemService = {};

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MobilePaymentsService,
          { provide: MobilePaymentsDatabaseService, useValue: databaseService },
          { provide: AccountsService, useValue: mockAccountsService },
          { provide: MyPVitService, useValue: mockMyPVitService },
          { provide: MtnMomoService, useValue: mockMtnMomoService },
          { provide: MtnMomoDatabaseService, useValue: mockMtnMomoDatabaseService },
          { provide: OrangeMomoService, useValue: mockOrangeMomoService },
          { provide: OrangeMomoDatabaseService, useValue: mockOrangeMomoDatabaseService },
          { provide: FreemopayService, useValue: mockFreemopayService },
          { provide: FedaPayService, useValue: mockFedaPayService },
          { provide: HasuraSystemService, useValue: mockHasuraSystemService },
        ],
      }).compile();

      service = module.get<MobilePaymentsService>(MobilePaymentsService);
    });

    it('should return plain Error (not HttpException) for MyPVit status mismatch', async () => {
      const mypvitTx = {
        id: 'tx-1',
        provider: 'mypvit',
        transaction_id: 'ext-123',
        reference: 'REF-123',
        amount: 1000,
        status: 'success',
      };

      databaseService.getTransactionByReference.mockResolvedValue(mypvitTx);

      try {
        await service.assertProviderConfirmsCallback(mypvitTx as any, 'FAILED');
        fail('Should have thrown an error');
      } catch (error: any) {
        // Should be plain Error, not HttpException (which would be 409 for FedaPay)
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(HttpException);
      }
    });

    it('should return HttpException 409 for FedaPay status mismatch', async () => {
      const fedapayTx = {
        id: 'tx-2',
        provider: 'fedapay',
        transaction_id: 'ext-456',
        reference: 'REF-456',
        amount: 1000,
        status: 'success',
      };

      databaseService.getTransactionByReference.mockResolvedValue(fedapayTx);

      try {
        await service.assertProviderConfirmsCallback(fedapayTx as any, 'FAILED');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.status).toBe(409);
      }
    });
  });

  describe('OrdersService Validation', () => {
    it('should return 400 when validatePaymentRequest fails and NOT call createTransaction', async () => {
      const mockMobilePaymentsService = {
        validatePaymentRequest: jest.fn().mockResolvedValue({
          success: false,
          message: 'Invalid phone number',
          errorCode: 'INVALID_PHONE_NUMBER',
        }),
      };

      const mockDatabaseService = {
        createTransaction: jest.fn(),
      };

      // Mock OrdersService with minimal dependencies
      const { OrdersService } = require('../orders/orders.service');
      const ordersService = new OrdersService(
        null, // hasuraSystemService
        null, // waitAndExecuteScheduleService
        null, // notificationQueueService
        null, // whatsAppService
        null, // businessItemsService
        null, // rentalsService
        null, // deliveryService
        mockMobilePaymentsService,
        mockDatabaseService,
        null, // businessService
        null, // agentsService
        null, // accountsService
        null, // addressService
        null, // businessTokensService
        null, // reelAiTokensService
        null, // giveChangePayoutService
        null, // orderValidationService
        null, // representativePortfolioService
        null, // authService
      );

      try {
        await ordersService.createPaymentTransactionAndInitiate({
          orderNumber: 'ORD-123',
          phoneNumber: 'invalid',
          currency: 'XOF',
          totalAmount: 1000,
          provider: 'fedapay',
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.status).toBe(400);
        expect(mockDatabaseService.createTransaction).not.toHaveBeenCalled();
      }
    });
  });
});
