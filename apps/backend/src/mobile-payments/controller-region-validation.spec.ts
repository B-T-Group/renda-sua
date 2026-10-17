import { Test, TestingModule } from '@nestjs/testing';
import { MobilePaymentsController } from './mobile-payments.controller';
import { MobilePaymentsService } from './mobile-payments.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';

describe('Controller Region Validation', () => {
  let controller: MobilePaymentsController;
  let mobilePaymentsService: jest.Mocked<MobilePaymentsService>;
  let databaseService: jest.Mocked<MobilePaymentsDatabaseService>;

  beforeEach(async () => {
    const mockDatabaseService = {
      createTransaction: jest.fn().mockResolvedValue({
        id: 'tx-1',
        reference: 'REF-123',
        status: 'pending',
      }),
      updateTransaction: jest.fn().mockResolvedValue(undefined),
      getTransactionByReference: jest.fn(),
    };

    const mockMobilePaymentsService = {
      initiatePayment: jest.fn().mockResolvedValue({
        success: true,
        transactionId: 'tx-123',
        message: 'Payment initiated',
      }),
      scheduleMockCallback: jest.fn().mockResolvedValue(undefined),
      getProvider: jest.fn((phone: string) => {
        if (phone.includes('+228') || phone.startsWith('90')) {
          return 'fedapay';
        }
        if (phone.includes('+237') || phone.startsWith('677')) {
          return 'freemopay';
        }
        return 'mypvit';
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MobilePaymentsController],
      providers: [
        { provide: MobilePaymentsService, useValue: mockMobilePaymentsService },
        { provide: MobilePaymentsDatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    controller = module.get<MobilePaymentsController>(MobilePaymentsController);
    mobilePaymentsService = module.get(MobilePaymentsService);
    databaseService = module.get(MobilePaymentsDatabaseService);
  });

  it('should accept FedaPay national format number (90123456)', async () => {
    // Mock getProvider to return fedapay for this number
    mobilePaymentsService.getProvider.mockReturnValue('fedapay');

    const request = {
      amount: 1000,
      currency: 'XOF',
      customerPhone: '90123456', // National format TG number
      paymentMethod: 'mobile_money' as const,
      transactionType: 'PAYMENT' as const,
    };

    const result = await controller.initiatePayment(request);

    expect(result.success).toBe(true);
    expect(mobilePaymentsService.initiatePayment).toHaveBeenCalled();
  });

  it('should accept FreemoPay national format number (677123456)', async () => {
    mobilePaymentsService.getProvider.mockReturnValue('freemopay');

    const request = {
      amount: 1000,
      currency: 'XAF',
      customerPhone: '677123456', // National format CM number
      paymentMethod: 'mobile_money' as const,
      transactionType: 'PAYMENT' as const,
    };

    const result = await controller.initiatePayment(request);

    expect(result.success).toBe(true);
    expect(mobilePaymentsService.initiatePayment).toHaveBeenCalled();
  });

  it('should parse FedaPay number with TG region (not GA)', async () => {
    mobilePaymentsService.getProvider.mockReturnValue('fedapay');

    const request = {
      amount: 1000,
      currency: 'XOF',
      customerPhone: '+22890123456',
      paymentMethod: 'mobile_money' as const,
      transactionType: 'PAYMENT' as const,
    };

    const result = await controller.initiatePayment(request);

    expect(result.success).toBe(true);
    // The phone should be parsed as TG, not GA
    const callArgs = mobilePaymentsService.initiatePayment.mock.calls[0][0];
    expect(callArgs.customerPhone).toBe('+22890123456');
  });

  it('should parse FreemoPay number with CM region', async () => {
    mobilePaymentsService.getProvider.mockReturnValue('freemopay');

    const request = {
      amount: 1000,
      currency: 'XAF',
      customerPhone: '+237677123456',
      paymentMethod: 'mobile_money' as const,
      transactionType: 'PAYMENT' as const,
    };

    const result = await controller.initiatePayment(request);

    expect(result.success).toBe(true);
    const callArgs = mobilePaymentsService.initiatePayment.mock.calls[0][0];
    expect(callArgs.customerPhone).toBe('+237677123456');
  });

  it('should parse MyPVit/Airtel/Moov numbers with GA region', async () => {
    mobilePaymentsService.getProvider.mockReturnValue('mypvit');

    const request = {
      amount: 1000,
      currency: 'XAF',
      customerPhone: '+24177123456',
      paymentMethod: 'mobile_money' as const,
      transactionType: 'PAYMENT' as const,
    };

    const result = await controller.initiatePayment(request);

    expect(result.success).toBe(true);
    const callArgs = mobilePaymentsService.initiatePayment.mock.calls[0][0];
    expect(callArgs.customerPhone).toBe('+24177123456');
  });

  it('should reject invalid number format even with correct provider region', async () => {
    mobilePaymentsService.getProvider.mockReturnValue('fedapay');

    const request = {
      amount: 1000,
      currency: 'XOF',
      customerPhone: '+228invalid',
      paymentMethod: 'mobile_money' as const,
      transactionType: 'PAYMENT' as const,
    };

    await expect(controller.initiatePayment(request)).rejects.toThrow();
    expect(mobilePaymentsService.initiatePayment).not.toHaveBeenCalled();
  });
});
