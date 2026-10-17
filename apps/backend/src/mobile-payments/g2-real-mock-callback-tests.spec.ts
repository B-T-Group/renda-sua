import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MobilePaymentsController } from './mobile-payments.controller';
import { MobilePaymentsService } from './mobile-payments.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { GiveChangePayoutService } from './give-change-payout.service';
import { FedaPayService } from './providers/fedapay.service';
import { OrdersService } from '../orders/orders.service';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { WithdrawalPinService } from '../admin/withdrawal-pin.service';
import { PendingWithdrawalResolveService } from './pending-withdrawal-resolve.service';
import { MobileTransactionAccessService } from './mobile-transaction-access.service';

jest.useFakeTimers();

describe('G2: Real Mock Callback Order Tests', () => {
  describe('MobilePaymentsService', () => {
    let service: MobilePaymentsService;
    let databaseService: any;
    let fedaPayService: any;

    beforeEach(async () => {
      databaseService = {
        createTransaction: jest.fn().mockResolvedValue({
          id: 'tx-1',
          reference: 'REF-123',
          status: 'pending',
        }),
        updateTransaction: jest.fn().mockResolvedValue(undefined),
        getTransactionByReference: jest.fn(),
      };

      fedaPayService = {
        initiatePayment: jest.fn().mockResolvedValue({
          success: true,
          transactionId: 'mock-abc-123',
        }),
        getCallbackUrl: jest.fn().mockReturnValue('http://test/callback'),
        scheduleMockCallback: jest.fn().mockResolvedValue(undefined),
        mockEnabled: true,
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MobilePaymentsService,
          { provide: FedaPayService, useValue: fedaPayService },
          { provide: MobilePaymentsDatabaseService, useValue: databaseService },
          { provide: 'HasuraSystemService', useValue: {} },
        ],
      }).compile();

      service = module.get<MobilePaymentsService>(MobilePaymentsService);
    });

    it('(a) scheduleMockCallback called AFTER updateTransaction in service payment', async () => {
      const request = {
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+22890123456',
        provider: 'fedapay',
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        description: 'Test',
        accountId: 'acct-1',
      };

      await service.initiatePayment(request);

      // Verify both were called
      expect(databaseService.updateTransaction).toHaveBeenCalled();
      expect(fedaPayService.scheduleMockCallback).toHaveBeenCalledWith(
        'mock-abc-123',
        expect.any(String)
      );

      // Verify order: updateTransaction was called before scheduleMockCallback
      const updateOrder = databaseService.updateTransaction.mock.invocationCallOrder[0];
      const scheduleOrder = fedaPayService.scheduleMockCallback.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(scheduleOrder);
    });
  });

  describe('GiveChangePayoutService', () => {
    let service: GiveChangePayoutService;
    let fedaPayService: any;
    let databaseService: any;
    let accountsService: any;

    beforeEach(async () => {
      databaseService = {
        createTransaction: jest.fn().mockResolvedValue({
          id: 'tx-gc-1',
          reference: 'GC-REF-123',
          status: 'pending',
        }),
        updateTransaction: jest.fn().mockResolvedValue(undefined),
        getTransactionById: jest.fn(),
      };

      fedaPayService = {
        withdraw: jest.fn().mockResolvedValue({
          success: true,
          transactionId: 'mock-payout-456',
        }),
        scheduleMockCallback: jest.fn(),
        mockEnabled: true,
      };

      accountsService = {
        registerHoldIfNotExists: jest.fn().mockResolvedValue({
          success: true,
          hold: { id: 'hold-1' },
        }),
        getAccountBalance: jest.fn().mockResolvedValue({
          availableBalance: '10000',
          currency: 'XOF',
        }),
      };

      const mockMobilePaymentsService = {
        initiatePayment: jest.fn().mockResolvedValue({
          success: true,
          transactionId: 'mock-payout-456',
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GiveChangePayoutService,
          { provide: FedaPayService, useValue: fedaPayService },
          { provide: MobilePaymentsDatabaseService, useValue: databaseService },
          { provide: AccountsService, useValue: accountsService },
          { provide: MobilePaymentsService, useValue: mockMobilePaymentsService },
        ],
      }).compile();

      service = module.get<GiveChangePayoutService>(GiveChangePayoutService);
    });

    it('(b) scheduleMockCallback called AFTER updateTransaction in give-change payout', async () => {
      const transaction = {
        id: 'tx-give-1',
        reference: 'GC-REF-456',
        amount: 500,
        currency: 'XOF',
        provider: 'fedapay',
        customer_phone: '+22890123456',
        account_id: 'acc-1',
      };

      await service.executeGiveChangePayout(transaction as any, {
        throwOnWithdrawalFailure: false,
      });

      // Verify both were called
      expect(databaseService.updateTransaction).toHaveBeenCalled();
      expect(fedaPayService.scheduleMockCallback).toHaveBeenCalledWith(
        'mock-payout-456',
        expect.stringMatching(/GC-/)
      );

      // Verify order: updateTransaction was called before scheduleMockCallback
      const updateOrder = databaseService.updateTransaction.mock.invocationCallOrder[0];
      const scheduleOrder = fedaPayService.scheduleMockCallback.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(scheduleOrder);
    });
  });

  describe('OrdersService', () => {
    let service: OrdersService;
    let mobilePaymentsService: any;
    let databaseService: any;

    beforeEach(async () => {
      databaseService = {
        updateTransaction: jest.fn().mockResolvedValue(undefined),
        createTransaction: jest.fn().mockResolvedValue({
          id: 'tx-order-1',
          reference: 'ORD-123',
          status: 'pending',
        }),
      };

      mobilePaymentsService = {
        initiatePayment: jest.fn().mockResolvedValue({
          success: true,
          transactionId: 'mock-order-789',
        }),
        scheduleMockCallback: jest.fn().mockResolvedValue(undefined),
        validatePaymentRequest: jest.fn().mockResolvedValue(null),
      };

      // Minimal OrdersService mock with required dependencies
      const mockHasuraSystemService = {
        getAccount: jest.fn().mockResolvedValue({ id: 'acc-1' }),
        query: jest.fn(),
        executeMutation: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OrdersService,
          { provide: MobilePaymentsService, useValue: mobilePaymentsService },
          { provide: MobilePaymentsDatabaseService, useValue: databaseService },
          { provide: 'HasuraSystemService', useValue: mockHasuraSystemService },
          // Add other required dependencies as minimal mocks
          { provide: 'WaitAndExecuteScheduleService', useValue: {} },
          { provide: 'NotificationQueueService', useValue: {} },
          { provide: 'WhatsAppService', useValue: {} },
          { provide: 'BusinessItemsService', useValue: {} },
          { provide: 'RentalsService', useValue: {} },
          { provide: 'DeliveryService', useValue: {} },
          { provide: 'BusinessService', useValue: {} },
          { provide: 'AgentsService', useValue: {} },
          { provide: 'AccountsService', useValue: {} },
          { provide: 'AddressService', useValue: {} },
          { provide: 'BusinessTokensService', useValue: {} },
          { provide: 'ReelAiTokensService', useValue: {} },
          { provide: 'GiveChangePayoutService', useValue: {} },
          { provide: 'OrderValidationService', useValue: {} },
          { provide: 'RepresentativePortfolioService', useValue: {} },
          { provide: 'AuthService', useValue: {} },
        ],
      }).compile();

      service = module.get<OrdersService>(OrdersService);
    });

    it('(c) scheduleMockCallback called AFTER updateTransaction in order payment', async () => {
      // This is a simplified test that verifies the pattern exists in OrdersService
      // In real code, this would test one of the order payment paths
      const params = {
        orderNumber: 'ORD-123',
        phoneNumber: '+22890123456',
        currency: 'XOF',
        totalAmount: 1000,
        provider: 'fedapay',
        itemCountry: 'TG',
        userId: 'user-1',
        accountId: 'acc-1',
      };

      // Call the helper method that creates and updates transaction
      await (service as any).createPaymentTransactionAndInitiate(params);

      // Verify the pattern: updateTransaction then scheduleMockCallback
      expect(databaseService.updateTransaction).toHaveBeenCalled();
      expect(mobilePaymentsService.scheduleMockCallback).toHaveBeenCalledWith(
        'mock-order-789',
        expect.any(String)
      );

      const updateOrder = databaseService.updateTransaction.mock.invocationCallOrder[0];
      const scheduleOrder = mobilePaymentsService.scheduleMockCallback.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(scheduleOrder);
    });
  });

  describe('FedaPayService', () => {
    let service: FedaPayService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FedaPayService,
          {
            provide: 'FEDAPAY_CONFIG',
            useValue: {
              apiKey: 'test-key',
              environment: 'sandbox',
              mockEnabled: true,
            },
          },
        ],
      }).compile();

      service = module.get<FedaPayService>(FedaPayService);
    });

    it('(d) mockInitiatePayment does NOT schedule auto-callback', async () => {
      const spy = jest.spyOn(service as any, 'scheduleAutoCallback');

      await service.mockInitiatePayment({
        amount: 1000,
        currency: 'XOF',
        description: 'Test',
        customer: { phone_number: { number: '+22890123456' } },
      });

      // scheduleAutoCallback should NOT be called from mockInitiatePayment
      expect(spy).not.toHaveBeenCalled();
    });

    it('(d) mockWithdraw does NOT schedule auto-callback', async () => {
      const spy = jest.spyOn(service as any, 'scheduleAutoCallback');

      await service.mockWithdraw({
        amount: 500,
        currency: 'XOF',
        description: 'Test withdrawal',
        recipient: { phone_number: { number: '+22890123456' } },
      });

      // scheduleAutoCallback should NOT be called from mockWithdraw
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
