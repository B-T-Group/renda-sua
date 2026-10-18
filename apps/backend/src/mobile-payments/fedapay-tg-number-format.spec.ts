import { Test, TestingModule } from '@nestjs/testing';
import { MobilePaymentsService } from './mobile-payments.service';
import { FedaPayService } from './providers/fedapay.service';
import { FreemopayService } from './providers/freemopay.service';
import { MyPVitService } from './providers/mypvit.service';
import { MtnMomoService } from '../mtn-momo/mtn-momo.service';
import { OrangeMomoService } from '../orange-momo/orange-momo.service';
import { MtnMomoDatabaseService } from '../mtn-momo/mtn-momo-database.service';
import { OrangeMomoDatabaseService } from '../orange-momo/orange-momo-database.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { FedaPayPaymentRequest } from './providers/fedapay.service';

describe('FedaPay TG Number Format', () => {
  let service: MobilePaymentsService;
  let fedapayService: jest.Mocked<FedaPayService>;

  beforeEach(async () => {
    fedapayService = {
      initiatePayment: jest.fn().mockResolvedValue({
        success: true,
        transactionId: 'tx-123',
        status: 'pending',
      }),
      getCallbackUrl: jest.fn().mockReturnValue('http://test.com/callback'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobilePaymentsService,
        { provide: FedaPayService, useValue: fedapayService },
        { provide: FreemopayService, useValue: {} },
        { provide: MyPVitService, useValue: {} },
        { provide: MtnMomoService, useValue: {} },
        { provide: OrangeMomoService, useValue: {} },
        { provide: MtnMomoDatabaseService, useValue: {} },
        { provide: OrangeMomoDatabaseService, useValue: {} },
        { provide: HasuraSystemService, useValue: {} },
      ],
    }).compile();

    service = module.get<MobilePaymentsService>(MobilePaymentsService);
  });

  it('should send bare 8-digit national number for moov_tg (not 228+national)', async () => {
    const request = {
      customerPhone: '22890123456', // Full international format
      amount: 1000,
      currency: 'XOF',
      description: 'Test payment',
      paymentMethod: 'mobile_money' as const,
      transactionType: 'PAYMENT' as const,
      provider: 'fedapay',
      accountId: 'acc-test',
    };

    await service.initiatePayment(request, 'REF-TEST-MOOV');

    // Verify FedaPay was called with bare 8-digit national number
    expect(fedapayService.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining<FedaPayPaymentRequest>({
        payer: '90123456', // Bare 8 digits, not '22890123456'
        amount: 1000,
        channel: 'togocel', // 90 prefix is togocel
        externalId: 'REF-TEST-MOOV',
      }),
      'REF-TEST-MOOV'
    );

    // The service sends payer with country separately in the API call
    // FedaPay service will send: { number: '90123456', country: 'TG' }
  });

  it('should send bare 8-digit national number for togocel (not 228+national)', async () => {
    const request = {
      customerPhone: '22890123456', // Full international format
      amount: 1000,
      currency: 'XOF',
      description: 'Test payment',
      paymentMethod: 'mobile_money' as const,
      transactionType: 'PAYMENT' as const,
      provider: 'fedapay',
      accountId: 'acc-test',
    };

    await service.initiatePayment(request, 'REF-TEST-TOGOCEL');

    expect(fedapayService.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining<FedaPayPaymentRequest>({
        payer: '90123456', // Bare 8 digits
        channel: 'togocel', // 90 is togocel (Mixx)
      }),
      'REF-TEST-TOGOCEL'
    );
  });

  it('should handle moov_tg numbers (78, 79, 96-99 prefixes)', async () => {
    const moovPrefixes = ['78', '79', '96', '97', '98', '99'];

    for (const prefix of moovPrefixes) {
      fedapayService.initiatePayment.mockClear();

      const request = {
        customerPhone: `228${prefix}123456`,
        amount: 1000,
        currency: 'XOF',
        description: 'Test',
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        provider: 'fedapay',
        accountId: 'acc-test',
      };

      await service.initiatePayment(request, `REF-MOOV-${prefix}`);

      expect(fedapayService.initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining<FedaPayPaymentRequest>({
          payer: `${prefix}123456`, // Bare 8 digits
          channel: 'moov_tg', // Should be moov_tg for these prefixes
        }),
        `REF-MOOV-${prefix}`
      );
    }
  });

  it('should handle already-national-format numbers', async () => {
    const request = {
      customerPhone: '90123456', // Already national format (no 228)
      amount: 1000,
      currency: 'XOF',
      description: 'Test',
      paymentMethod: 'mobile_money' as const,
      transactionType: 'PAYMENT' as const,
      provider: 'fedapay',
      accountId: 'acc-test',
    };

    await service.initiatePayment(request, 'REF-NATIONAL');

    expect(fedapayService.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining<FedaPayPaymentRequest>({
        payer: '90123456', // Should remain as-is
        channel: 'togocel',
      }),
      'REF-NATIONAL'
    );
  });

  it('should handle withdrawals (GIVE_CHANGE) with national format', async () => {
    const request = {
      customerPhone: '22878123456', // Moov prefix
      amount: 5000,
      currency: 'XOF',
      description: 'Payout',
      paymentMethod: 'mobile_money' as const,
      transactionType: 'GIVE_CHANGE' as const,
      provider: 'fedapay',
      accountId: 'acc-test',
    };

    await service.initiatePayment(request, 'REF-PAYOUT');

    expect(fedapayService.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payee: '78123456', // Bare 8 digits for withdrawal too
        channel: 'moov_tg',
      }),
      'REF-PAYOUT'
    );
  });
});
