import { Test, TestingModule } from '@nestjs/testing';
import { MobilePaymentsService } from './mobile-payments.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { AccountsService } from '../accounts/accounts.service';
import { MyPVitService } from './providers/mypvit.service';
import { MtnMomoService } from '../mtn-momo/mtn-momo.service';
import { MtnMomoDatabaseService } from '../mtn-momo/mtn-momo-database.service';
import { OrangeMomoService } from '../orange-momo/orange-momo.service';
import { OrangeMomoDatabaseService } from '../orange-momo/orange-momo-database.service';
import { FreemopayService } from './providers/freemopay.service';
import { FedaPayService } from './providers/fedapay.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

describe('B5: Resolved Provider Validation', () => {
  let service: MobilePaymentsService;
  let fedaPayService: jest.Mocked<FedaPayService>;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;

  beforeEach(async () => {
    const mockDatabaseService = {
      createTransaction: jest.fn(),
      updateTransaction: jest.fn(),
      getTransactionByReference: jest.fn(),
    };

    const mockAccountsService = {
      creditWallet: jest.fn(),
      registerDepositIfNotExists: jest.fn(),
    };

    const mockMyPVitService = {
      initiatePayment: jest.fn(),
    };

    const mockMtnMomoService = {
      initiatePayment: jest.fn(),
    };

    const mockMtnMomoDatabaseService = {};

    const mockOrangeMomoService = {
      initiatePayment: jest.fn(),
    };

    const mockOrangeMomoDatabaseService = {};

    const mockFreemopayService = {
      initiatePayment: jest.fn(),
    };

    const mockFedaPayService = {
      initiatePayment: jest.fn().mockResolvedValue({
        success: true,
        transactionId: 'tx-123',
      }),
      checkTransactionStatus: jest.fn(),
    };

    const mockHasuraSystemService = {
      query: jest.fn().mockResolvedValue({
        payment_systems: [
          { provider_name: 'fedapay', country: 'TG', currency: 'XOF' },
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
    fedaPayService = module.get(FedaPayService);
    hasuraSystemService = module.get(HasuraSystemService);
  });

  it('should reject XAF currency when resolved provider is fedapay (no provider hint)', async () => {
    // Mock selectProvider to resolve to fedapay based on phone number
    jest.spyOn(service as any, 'selectProvider').mockResolvedValue('fedapay');

    const result = await service.initiatePayment({
      customerPhone: '+22890123456', // TG number -> resolves to fedapay
      currency: 'XAF', // Invalid for FedaPay
      amount: 500,
      accountId: 'acc-test',
      description: 'Test',
      paymentMethod: 'mobile_money',
      transactionType: 'PAYMENT',
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/only supports XOF currency/i);
    expect(result.errorCode).toBe('UNSUPPORTED_CURRENCY');
    
    // Verify fedaPayService.initiatePayment was NOT called
    expect(fedaPayService.initiatePayment).not.toHaveBeenCalled();
  });

  it('should reject decimal amount when resolved provider is fedapay (no provider hint)', async () => {
    jest.spyOn(service as any, 'selectProvider').mockResolvedValue('fedapay');

    const result = await service.initiatePayment({
      customerPhone: '+22890123456',
      currency: 'XOF',
      amount: 500.5, // Decimal amount invalid for FedaPay
      accountId: 'acc-test',
      description: 'Test',
      paymentMethod: 'mobile_money',
      transactionType: 'PAYMENT',
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/amounts must be integers/i);
    expect(result.errorCode).toBe('INVALID_AMOUNT');
    
    // Verify fedaPayService.initiatePayment was NOT called
    expect(fedaPayService.initiatePayment).not.toHaveBeenCalled();
  });

  it('should reject invalid phone when resolved provider is fedapay (restored isValid check)', async () => {
    jest.spyOn(service as any, 'selectProvider').mockResolvedValue('fedapay');

    const result = await service.initiatePayment({
      customerPhone: '+228invalid', // Invalid phone
      currency: 'XOF',
      amount: 500,
      accountId: 'acc-test',
      description: 'Test',
      paymentMethod: 'mobile_money',
      transactionType: 'PAYMENT',
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/invalid phone number format/i);
    expect(result.errorCode).toBe('INVALID_PHONE_NUMBER');
    
    // Verify fedaPayService.initiatePayment was NOT called
    expect(fedaPayService.initiatePayment).not.toHaveBeenCalled();
  });

  it('should accept valid request when resolved provider is fedapay', async () => {
    jest.spyOn(service as any, 'selectProvider').mockResolvedValue('fedapay');

    const result = await service.initiatePayment({
      customerPhone: '+22890123456',
      currency: 'XOF',
      amount: 500,
      accountId: 'acc-test',
      description: 'Test',
      paymentMethod: 'mobile_money',
      transactionType: 'PAYMENT',
    });

    expect(result.success).toBe(true);
    expect(fedaPayService.initiatePayment).toHaveBeenCalled();
  });
});
