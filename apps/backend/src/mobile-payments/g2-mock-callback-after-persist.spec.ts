/**
 * G2: a DEV mock payment's auto-callback may only be scheduled AFTER its
 * provider transaction_id is stored, or the callback cannot find the row.
 * Each test runs the real production method that owns the call site. Only the
 * provider initiation (the external payment call) and the database writes are
 * faked; the assertion is on call order (persist before schedule).
 */
import { Logger } from '@nestjs/common';
import { AccountRechargeService } from '../admin/account-recharge/account-recharge.service';
import { BusinessTokensService } from '../business-tokens/business-tokens.service';
import { MobilePaymentPhonesService } from '../mobile-payment-phones/mobile-payment-phones.service';
import { OrdersService } from '../orders/orders.service';
import { ReelAiTokensService } from '../reel-ai-tokens/reel-ai-tokens.service';
import { RentalsService } from '../rentals/rentals.service';
import { GiveChangePayoutService } from './give-change-payout.service';
import { MobilePaymentsController } from './mobile-payments.controller';

const MOCK_ID = 'mock-g2abc123';
const REAL_ID = '424242';

function db(extra: Record<string, jest.Mock> = {}) {
  return {
    createTransaction: jest.fn().mockResolvedValue({ id: 'db-tx-1', reference: 'DB-REF' }),
    updateTransaction: jest.fn().mockResolvedValue(undefined),
    getTransactionById: jest.fn().mockResolvedValue({ id: 'db-tx-1', reference: 'DB-REF' }),
    ...extra,
  };
}

function payments(transactionId: string, extra: Record<string, jest.Mock> = {}) {
  return {
    initiatePayment: jest.fn().mockResolvedValue({
      success: true,
      transactionId,
      provider: 'fedapay',
      message: 'Payment initiated',
    }),
    scheduleMockCallback: jest.fn().mockResolvedValue(undefined),
    validatePaymentRequest: jest.fn().mockResolvedValue(null),
    resolveProviderFromRequest: jest.fn().mockResolvedValue('fedapay'),
    getProvider: jest.fn().mockReturnValue('freemopay'),
    getProviderForCountry: jest.fn().mockResolvedValue('fedapay'),
    ...extra,
  };
}

function expectScheduledAfterPersist(
  update: jest.Mock,
  schedule: jest.Mock,
  dbTxId: string,
  reference: string
) {
  const persistIdx = update.mock.calls.findIndex(
    (c) => c[0] === dbTxId && c[1]?.transaction_id === MOCK_ID
  );
  expect(persistIdx).toBeGreaterThanOrEqual(0);
  expect(schedule).toHaveBeenCalledTimes(1);
  expect(schedule).toHaveBeenCalledWith(MOCK_ID, reference);
  expect(schedule.mock.invocationCallOrder[0]).toBeGreaterThan(
    update.mock.invocationCallOrder[persistIdx]
  );
}

function bare<T>(cls: new (...args: any[]) => T, fields: Record<string, unknown>): T {
  const instance = Object.create(cls.prototype);
  Object.assign(instance, { logger: new Logger(cls.name) }, fields);
  return instance;
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('G2 schedule-after-persist at every site', () => {
  describe('MobilePaymentsController.initiatePayment', () => {
    function controllerWith(txId: string) {
      const database = db();
      const mps = payments(txId);
      const controller = new MobilePaymentsController(
        mps as never,
        database as never,
        {} as never,
        {} as never,
        { getUser: jest.fn().mockResolvedValue({ id: 'user-1' }) } as never,
        {} as never,
        {} as never,
        {} as never,
        { canView: jest.fn().mockResolvedValue(true) } as never,
        { get: jest.fn().mockReturnValue(false) } as never
      );
      return { controller, database, mps };
    }
    const request = {
      customerPhone: '+22890123456',
      amount: 1000,
      currency: 'XOF',
      provider: 'fedapay',
      transactionType: 'PAYMENT',
    } as any;

    it('mock id: persists transaction_id, then schedules', async () => {
      const { controller, database, mps } = controllerWith(MOCK_ID);
      await controller.initiatePayment({ user: { id: 'user-1' } } as never, request);
      const reference = database.createTransaction.mock.calls[0][0].reference;
      expectScheduledAfterPersist(database.updateTransaction, mps.scheduleMockCallback, 'db-tx-1', reference);
    });

    it('real id: never schedules', async () => {
      const { controller, mps } = controllerWith(REAL_ID);
      await controller.initiatePayment({ user: { id: 'user-1' } } as never, request);
      expect(mps.scheduleMockCallback).not.toHaveBeenCalled();
    });
  });

  describe('GiveChangePayoutService.executeGiveChangePayout', () => {
    function serviceWith(txId: string) {
      const database = db();
      const mps = payments(txId);
      const fedaPay = { scheduleMockCallback: jest.fn() };
      const accounts = {
        getAccountBalance: jest.fn().mockResolvedValue({ availableBalance: 100000, currency: 'XOF' }),
        registerHoldIfNotExists: jest.fn().mockResolvedValue({ success: true, transactionId: 'hold-1' }),
        registerReleaseIfNotExists: jest.fn().mockResolvedValue({ success: true }),
      };
      const service = new GiveChangePayoutService(database as any, mps as any, accounts as any, fedaPay as any);
      return { service, database, fedaPay };
    }
    const params = {
      amount: 1000,
      currency: 'XOF',
      description: 'Withdrawal',
      customerPhone: '+22890123456',
      accountId: 'acct-1',
      provider: 'fedapay' as const,
    };

    it('mock id: persists transaction_id (pending), then schedules the payout callback', async () => {
      const { service, database, fedaPay } = serviceWith(MOCK_ID);
      await service.executeGiveChangePayout(params, { throwOnWithdrawalFailure: false });
      const reference = database.createTransaction.mock.calls[0][0].reference;
      expectScheduledAfterPersist(database.updateTransaction, fedaPay.scheduleMockCallback, 'db-tx-1', reference);
    });

    it('real id: never schedules', async () => {
      const { service, fedaPay } = serviceWith(REAL_ID);
      await service.executeGiveChangePayout(params, { throwOnWithdrawalFailure: false });
      expect(fedaPay.scheduleMockCallback).not.toHaveBeenCalled();
    });
  });

  describe('OrdersService.initiateMomoForCreatedOrder', () => {
    const params = {
      orderNumber: 'ORD-G2',
      totalAmount: 5000,
      currency: 'XOF',
      accountId: 'acct-1',
      phoneNumber: '+22890123456',
      provider: 'fedapay',
      itemCountry: 'TG',
      userId: 'user-1',
    };

    it('mock id: persists transaction_id, then schedules with the order number', async () => {
      const database = db();
      const mps = payments(MOCK_ID);
      const orders = bare(OrdersService, {
        mobilePaymentsService: mps,
        mobilePaymentsDatabaseService: database,
      });
      await (orders as any).initiateMomoForCreatedOrder(params);
      expectScheduledAfterPersist(database.updateTransaction, mps.scheduleMockCallback, 'db-tx-1', 'ORD-G2');
    });

    it('real id: never schedules', async () => {
      const database = db();
      const mps = payments(REAL_ID);
      const orders = bare(OrdersService, {
        mobilePaymentsService: mps,
        mobilePaymentsDatabaseService: database,
      });
      await (orders as any).initiateMomoForCreatedOrder(params);
      expect(mps.scheduleMockCallback).not.toHaveBeenCalled();
    });
  });

  describe('AccountRechargeService.initiateRecharge', () => {
    it('mock id: persists transaction_id, then schedules with the recharge reference', async () => {
      const database = db();
      const mps = payments(MOCK_ID);
      const hasura = {
        getRendasuaHQUser: jest.fn().mockResolvedValue({ id: 'hq-user' }),
        getAccount: jest.fn().mockResolvedValue({ id: 'hq-acct' }),
      };
      const service = new AccountRechargeService(hasura as any, mps as any, database as any, {} as any);
      await service.initiateRecharge({ countryCode: '237', phoneNumber: '650123456', amount: 1000 } as any);
      const reference = database.createTransaction.mock.calls[0][0].reference;
      expectScheduledAfterPersist(database.updateTransaction, mps.scheduleMockCallback, 'db-tx-1', reference);
    });
  });

  describe.each([
    ['BusinessTokensService', BusinessTokensService],
    ['ReelAiTokensService', ReelAiTokensService],
  ])('%s.persistMobileProviderResponse', (_name, cls) => {
    it('mock id: persists transaction_id, then schedules with the stored reference', async () => {
      const database = db({
        getTransactionById: jest.fn().mockResolvedValue({ id: 'db-tx-1', reference: 'TOKENS-REF' }),
      });
      const mps = payments(MOCK_ID);
      const service = bare(cls as any, {
        mobilePaymentsService: mps,
        mobilePaymentsDatabaseService: database,
      });
      await (service as any).persistMobileProviderResponse('db-tx-1', {
        success: true,
        transactionId: MOCK_ID,
      });
      expectScheduledAfterPersist(database.updateTransaction, mps.scheduleMockCallback, 'db-tx-1', 'TOKENS-REF');
    });

    it('real id: never schedules', async () => {
      const database = db();
      const mps = payments(REAL_ID);
      const service = bare(cls as any, {
        mobilePaymentsService: mps,
        mobilePaymentsDatabaseService: database,
      });
      await (service as any).persistMobileProviderResponse('db-tx-1', {
        success: true,
        transactionId: REAL_ID,
      });
      expect(mps.scheduleMockCallback).not.toHaveBeenCalled();
    });
  });

  describe('RentalsService.initiateRentalBookingPayment', () => {
    it('mock id: persists transaction_id, then schedules with the provider reference', async () => {
      const database = db();
      const mps = payments(MOCK_ID);
      const rentals = bare(RentalsService, {
        mobilePaymentsService: mps,
        mobilePaymentsDatabaseService: database,
      });
      await (rentals as any).initiateRentalBookingPayment({
        bookingNumber: 'BK-1',
        amount: 1000,
        currency: 'XOF',
        clientAccountId: 'acct-1',
        userId: 'user-1',
        phoneNumber: '+22890123456',
        reference: 'RB-REF-1',
        paymentEntity: 'rental_booking',
        itemCountry: 'TG',
      });
      expectScheduledAfterPersist(database.updateTransaction, mps.scheduleMockCallback, 'db-tx-1', 'RB-REF-1');
    });
  });

  describe('MobilePaymentPhonesService.initiateVerification', () => {
    it('mock id: persists transaction_id, then schedules with the verification reference', async () => {
      const database = db();
      const mps = payments(MOCK_ID);
      const phones = bare(MobilePaymentPhonesService, {
        mobilePaymentsService: mps,
        mobilePaymentsDatabaseService: database,
        hasuraSystemService: { executeMutation: jest.fn().mockResolvedValue({}) },
        // DB/Hasura reads used before the call site:
        getVerificationMethod: jest.fn().mockResolvedValue('transaction'),
        getByIdForUser: jest.fn().mockResolvedValue({
          id: 'phone-1',
          phone_e164: '+237650123456',
          is_verified: false,
          last_verification_transaction_id: null,
        }),
        assertMobileMoneyRail: jest.fn().mockResolvedValue(undefined),
        resolveHqAccount: jest.fn().mockResolvedValue({ id: 'hq-acct' }),
        generateReference: jest.fn().mockReturnValue('PV-REF-1'),
      });
      await phones.initiateVerification('user-1', 'phone-1');
      expectScheduledAfterPersist(database.updateTransaction, mps.scheduleMockCallback, 'db-tx-1', 'PV-REF-1');
    });
  });
});
