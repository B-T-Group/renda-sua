/**
 * Masking and sanitizer at the production call sites. Each test runs the real
 * service method with only the HTTP client / SDK / external I/O faked, captures
 * every Logger call (all levels, deep-inspected so objects count too) and checks
 * that full phone numbers and secrets never appear.
 */
import { HttpException, Logger } from '@nestjs/common';
import { inspect } from 'util';
import { AccountRechargeService } from '../admin/account-recharge/account-recharge.service';
import { WhatsAppReplyService } from '../notifications/orchestration/whatsapp-reply.service';
import { MobilePaymentsController } from './mobile-payments.controller';
import { FedaPayService } from './providers/fedapay.service';
import { FreemopayService } from './providers/freemopay.service';
import { MyPVitService } from './providers/mypvit.service';
import { MobilePaymentsService } from './mobile-payments.service';
import { Payout, Transaction } from 'fedapay';

jest.mock('fedapay', () => ({
  FedaPay: { setApiKey: jest.fn(), setEnvironment: jest.fn() },
  Transaction: { create: jest.fn(), retrieve: jest.fn() },
  Payout: { create: jest.fn(), retrieve: jest.fn(), all: jest.fn() },
  Webhook: { constructEvent: jest.fn() },
}));

const SECRET = 'sk_live_LOGLEAK_987';

function providerError(): any {
  const err: any = new Error(`Request failed: Authorization: Bearer ${SECRET}`);
  err.config = { headers: { Authorization: `Bearer ${SECRET}` } };
  err.request = { _header: `POST /x\r\nAuthorization: Bearer ${SECRET}` };
  err.response = { status: 500, data: { message: 'upstream error' } };
  return err;
}

let logged: unknown[][];
beforeEach(() => {
  logged = [];
  for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
    jest
      .spyOn(Logger.prototype, level)
      .mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
  }
});
afterEach(() => jest.restoreAllMocks());
const allLogs = () => logged.map((args) => inspect(args, { depth: 10 })).join('\n');

function config(section: string, value: Record<string, unknown>) {
  return { get: (key: string) => (key === section ? value : undefined) } as any;
}

describe('FreemopayService call sites', () => {
  function freemopay() {
    const svc = new FreemopayService(
      config('freemopay', {
        baseUrl: 'https://freemopay.test',
        appKey: 'app',
        secretKey: 'secret',
        callbackUrl: 'https://cb.test',
        amountMockEnabled: false,
      }),
      { get: jest.fn() } as any
    );
    const post = jest.fn();
    (svc as any).httpClient = { post, get: jest.fn() };
    return { svc, post };
  }

  it('payment log masks the payer', async () => {
    const { svc, post } = freemopay();
    post.mockResolvedValue({ status: 200, data: { reference: 'FMP-1', status: 'PENDING' } });
    await svc.initiatePayment({ payer: '237650123456', amount: 500, externalId: 'R1', callback: 'cb' } as any);
    expect(allLogs()).not.toContain('650123456');
    expect(allLogs()).toContain('***456');
  });

  it('withdrawal log masks the payee', async () => {
    const { svc, post } = freemopay();
    post.mockResolvedValue({ status: 200, data: { reference: 'FMP-2', status: 'PENDING' } });
    await svc.withdraw({ payee: '237650123456', amount: 500, externalId: 'R2', callback: 'cb' } as any);
    expect(allLogs()).not.toContain('650123456');
  });

  it.each(['initiatePayment', 'withdraw'] as const)(
    '%s provider error is sanitized before logging',
    async (method) => {
      const { svc, post } = freemopay();
      post.mockRejectedValue(providerError());
      await (svc as any)[method]({ payer: '237650123456', payee: '237650123456', amount: 500, externalId: 'R3', callback: 'cb' });
      expect(allLogs()).not.toContain(SECRET);
    }
  );
});

describe('FedaPayService call sites (DEV mock mode, no SDK calls)', () => {
  const previous = process.env.DEPLOYMENT_ENV;
  beforeAll(() => {
    process.env.DEPLOYMENT_ENV = 'test';
  });
  afterAll(() => {
    process.env.DEPLOYMENT_ENV = previous;
  });
  function fedapay() {
    return new FedaPayService(
      config('fedapay', { secretKey: 'sk_sandbox_x', environment: 'sandbox', mockEnabled: true }),
      { get: jest.fn() } as any
    );
  }

  it('mock payment log masks the payer', async () => {
    await fedapay().initiatePayment({ payer: '90123456', amount: 100, channel: 'togocel', externalId: 'R' } as any, 'R');
    expect(allLogs()).not.toContain('90123456');
    expect(allLogs()).toContain('***456');
  });

  it('mock payout log masks the payee', async () => {
    await fedapay().withdraw({ payee: '90123456', amount: 100, channel: 'togocel', externalId: 'R' } as any, 'R');
    expect(allLogs()).not.toContain('90123456');
  });

  it('#616 QA L1: initiatePayment without a customer phone logs a wallet accountId UUID unchanged', async () => {
    const fedapay = new FedaPayService(
      config('fedapay', { secretKey: 'sk_sandbox_x', environment: 'sandbox', mockEnabled: false }),
      { get: jest.fn() } as any
    );
    jest.spyOn(fedapay, 'initiatePayment').mockRejectedValue(providerError());
    const hasura = {
      executeQuery: jest.fn(async (q: string) =>
        q.includes('CheckFedaPayActive') ? { supported_payment_systems: [{ active: true }] } : {}
      ),
    };
    const mps = new MobilePaymentsService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, fedapay, hasura as any);
    const accountId = '3f2b9c1e-7a4d-4e8b-9c0d-1234567890ab';
    await mps
      .initiatePayment({ amount: 1000, currency: 'XOF', description: 'x', accountId, provider: 'fedapay', reference: 'REF-3' } as any)
      .catch(() => undefined);
    expect(allLogs()).toContain(`Initiating mobile payment for account: ${accountId}`);
  });
});

describe('MyPVitService call sites', () => {
  function mypvit() {
    const svc = new MyPVitService(
      config('mypvit', { baseUrl: 'https://mypvit.test', airtelSecretKey: SECRET, moovSecretKey: SECRET, airtelMerchantOperationAccountCode: 'ACC_T1', moovMerchantOperationAccountCode: 'ACC_T2' })
    );
    const post = jest.fn();
    (svc as any).httpClient = { post, get: jest.fn() };
    return { svc, post };
  }

  it('never logs the raw config (it can hold the secret keys)', () => {
    mypvit();
    expect(allLogs()).not.toContain(SECRET);
  });

  it('KYC log masks the customer phone', async () => {
    const { svc, post } = mypvit();
    post.mockResolvedValue({ data: { success: true, kyc_status: 'ok' } });
    await svc.performKYC({ customerPhone: '+24177123456', customerName: 'A' });
    expect(allLogs()).not.toContain('77123456');
    expect(allLogs()).toContain('***456');
  });

  it('#616: payment log masks a raw 8-digit Togo account number', async () => {
    const { svc, post } = mypvit();
    post.mockResolvedValue({ data: { status: 'PENDING', reference_id: 'R1' } });
    await svc.initiatePayment({ amount: 100, customer_account_number: '90123456' } as any, 'REF1').catch(() => undefined);
    expect(allLogs()).toContain('Initiating payment for account: ***456');
    expect(allLogs()).not.toContain('90123456');
  });

  it('KYC provider error is sanitized', async () => {
    const { svc, post } = mypvit();
    post.mockRejectedValue(providerError());
    await svc.performKYC({ customerPhone: '+24177123456', customerName: 'A' });
    expect(allLogs()).not.toContain(SECRET);
  });
});

describe('MyPVitService response interceptor (L2, real axios instance)', () => {
  function realMypvit() {
    const svc = new MyPVitService(
      config('mypvit', { baseUrl: 'https://mypvit.test', airtelSecretKey: SECRET, moovSecretKey: SECRET, airtelMerchantOperationAccountCode: 'ACC_T1', moovMerchantOperationAccountCode: 'ACC_T2' })
    );
    const handlers = (svc as any).httpClient.interceptors.response.handlers;
    return { fulfilled: handlers[0].fulfilled, rejected: handlers[0].rejected };
  }

  it('success responses log status and path only, never the body (phones, renewed secret)', () => {
    const { fulfilled } = realMypvit();
    fulfilled({
      status: 200,
      config: { url: '/v2/kyc' },
      data: { msisdn: '24177123456', new_secret_key: 'NEWSECRET_abc123' },
    });
    expect(allLogs()).toContain('MyPVit API Response: 200 /v2/kyc');
    expect(allLogs()).not.toContain('77123456');
    expect(allLogs()).not.toContain('NEWSECRET_abc123');
  });

  it('expected 404 misses log the status only, never the body', async () => {
    const { rejected } = realMypvit();
    const err: any = new Error('Request failed with status code 404');
    err.response = { status: 404, data: { error: 'not found', msisdn: '24177123456' } };
    await expect(rejected(err)).rejects.toBe(err);
    expect(allLogs()).toContain('MyPVit resource not found (expected miss): 404');
    expect(allLogs()).not.toContain('77123456');
  });
});

describe('MobilePaymentsController callback catch blocks', () => {
  function controller(processor: Record<string, jest.Mock>) {
    return new MobilePaymentsController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      processor as never,
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn() } as never
    );
  }

  it('MyPVit callback: processing error is sanitized in logs and in the 500 body', async () => {
    const c = controller({ processMypvitCallback: jest.fn().mockRejectedValue(providerError()) });
    const err = await c
      .mypvitCallback({ transactionId: 't', merchantReferenceId: 'm', status: 'SUCCESS' } as any, {} as any)
      .catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(JSON.stringify((err as HttpException).getResponse())).not.toContain(SECRET);
    expect(allLogs()).not.toContain(SECRET);
  });

  it('Freemopay callback: processing error is sanitized in logs and in the 500 body', async () => {
    const c = controller({ processFreemopayCallback: jest.fn().mockRejectedValue(providerError()) });
    const err = await c
      .freemopayCallback({ reference: 'r', status: 'SUCCESS' } as any, {} as any)
      .catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(JSON.stringify((err as HttpException).getResponse())).not.toContain(SECRET);
    expect(allLogs()).not.toContain(SECRET);
  });
});

describe('AccountRechargeService call site', () => {
  it('recharge log masks the payer phone', async () => {
    const service = new AccountRechargeService(
      {
        getRendasuaHQUser: jest.fn().mockResolvedValue({ id: 'hq' }),
        getAccount: jest.fn().mockResolvedValue({ id: 'hq-acct' }),
      } as any,
      {
        getProvider: jest.fn().mockReturnValue('freemopay'),
        initiatePayment: jest.fn().mockResolvedValue({ success: true, transactionId: 'FMP-9' }),
        scheduleMockCallback: jest.fn(),
      } as any,
      {
        createTransaction: jest.fn().mockResolvedValue({ id: 'db-1' }),
        updateTransaction: jest.fn(),
      } as any,
      {} as any
    );
    await service.initiateRecharge({ countryCode: '237', phoneNumber: '650123456', amount: 1000 } as any);
    expect(allLogs()).not.toContain('650123456');
    expect(allLogs()).toContain('***456');
  });
});

describe('WhatsAppReplyService STOP call site', () => {
  it('STOP from an unknown phone logs it masked', async () => {
    const service = new WhatsAppReplyService(
      { findUserIdByPhoneE164: jest.fn().mockResolvedValue(null), disableWhatsApp: jest.fn() } as any,
      { track: jest.fn() } as any,
      { handleAction: jest.fn() } as any,
      { isConfigured: jest.fn().mockReturnValue(false), sendSessionText: jest.fn() } as any,
      {
        isEnabled: jest.fn().mockReturnValue(false),
        isWhatsAppRepliesEnabled: jest.fn().mockReturnValue(false),
        detectLocaleFromText: jest.fn().mockReturnValue('en'),
      } as any,
      { resolveFromPhone: jest.fn().mockResolvedValue(null) } as any,
      { listRecentMessages: jest.fn(), persistOutbound: jest.fn() } as any,
      { get: jest.fn() } as any,
      { handleComplete: jest.fn() } as any
    );
    const result = await service.handleInboundText({ fromPhone: '15551234567', text: 'STOP', messageId: 'w1' });
    expect(result.handled).toBe(false);
    expect(allLogs()).not.toContain('15551234567');
    expect(allLogs()).toContain('***567');
  });
});

describe('FedaPayService real-mode error sites (SDK faked)', () => {
  function fedapay() {
    return new FedaPayService(
      config('fedapay', { secretKey: 'sk_sandbox_x', environment: 'sandbox', mockEnabled: false }),
      { get: jest.fn() } as any
    );
  }

  it('payment SDK error: secret is redacted in the logs and in the returned message', async () => {
    (Transaction.create as jest.Mock).mockRejectedValue(providerError());
    const res = await fedapay().initiatePayment(
      { payer: '90123456', amount: 100, currency: 'XOF', channel: 'togocel', externalId: 'R' } as any,
      'R'
    );
    expect(res.success).toBe(false);
    expect(JSON.stringify(res)).not.toContain(SECRET);
    expect(allLogs()).not.toContain(SECRET);
    expect(allLogs()).toContain('Failed to initiate FedaPay payment');
  });

  it('payout SDK error: secret is redacted in the logs and in the returned message', async () => {
    (Payout.all as jest.Mock).mockResolvedValue({ payouts: [] });
    (Payout.create as jest.Mock).mockRejectedValue(providerError());
    const res = await fedapay().withdraw(
      { payee: '90123456', amount: 100, currency: 'XOF', channel: 'togocel', externalId: 'R' } as any,
      'R'
    );
    expect(res.success).toBe(false);
    expect(JSON.stringify(res)).not.toContain(SECRET);
    expect(allLogs()).not.toContain(SECRET);
  });

  it('status check SDK error: rethrown and logged redacted', async () => {
    (Transaction.retrieve as jest.Mock).mockRejectedValue(providerError());
    const err = await fedapay().checkTransactionStatus('123').catch((e: unknown) => e);
    expect(String((err as Error).message)).not.toContain(SECRET);
    expect(allLogs()).not.toContain(SECRET);
  });
});

describe('MobilePaymentsService error sites (real service, provider faked)', () => {
  it('initiatePayment: a throwing provider is logged redacted and the caller gets a generic message', async () => {
    const fedapay = new FedaPayService(
      config('fedapay', { secretKey: 'sk_sandbox_x', environment: 'sandbox', mockEnabled: false }),
      { get: jest.fn() } as any
    );
    jest.spyOn(fedapay, 'initiatePayment').mockRejectedValue(providerError());
    const hasura = {
      executeQuery: jest.fn(async (q: string) =>
        q.includes('CheckFedaPayActive') ? { supported_payment_systems: [{ active: true }] } : {}
      ),
    };
    const mps = new MobilePaymentsService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, fedapay, hasura as any);

    const res = await mps.initiatePayment({
      amount: 1000,
      currency: 'XOF',
      description: 'x',
      customerPhone: '+22890123456',
      provider: 'fedapay',
      reference: 'REF-1',
    } as any);

    expect(res).toEqual(expect.objectContaining({ success: false, message: 'Failed to initiate payment' }));
    expect(JSON.stringify(res)).not.toContain(SECRET);
    expect(allLogs()).not.toContain(SECRET);
    expect(allLogs()).toContain('Failed to initiate mobile payment');
  });

  it('#616: initiatePayment without a customer phone masks a phone-like accountId', async () => {
    const fedapay = new FedaPayService(
      config('fedapay', { secretKey: 'sk_sandbox_x', environment: 'sandbox', mockEnabled: false }),
      { get: jest.fn() } as any
    );
    jest.spyOn(fedapay, 'initiatePayment').mockRejectedValue(providerError());
    const hasura = {
      executeQuery: jest.fn(async (q: string) =>
        q.includes('CheckFedaPayActive') ? { supported_payment_systems: [{ active: true }] } : {}
      ),
    };
    const mps = new MobilePaymentsService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, fedapay, hasura as any);
    await mps
      .initiatePayment({ amount: 1000, currency: 'XOF', description: 'x', accountId: '90123456', provider: 'fedapay', reference: 'REF-2' } as any)
      .catch(() => undefined);
    expect(allLogs()).not.toContain('90123456');
  });

  it('isFedaPayActiveForTogo: a Hasura error is logged redacted', async () => {
    const hasura = { executeQuery: jest.fn().mockRejectedValue(providerError()) };
    const fedapay = { testConnection: jest.fn() };
    const mps = new MobilePaymentsService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, fedapay as any, hasura as any);
    await expect((mps as any).isFedaPayActiveForTogo()).resolves.toBe(false);
    expect(allLogs()).not.toContain(SECRET);
    expect(allLogs()).toContain('Failed to check FedaPay active status');
  });
});

describe('getProvidersForCountry logging (L8)', () => {
  it('logs provider names only, not the raw rows JSON', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        supported_payment_systems: [{ name: 'airtel', country: 'GA', active: true }],
      }),
    };
    const mypvit = { testConnection: jest.fn().mockResolvedValue(true) };
    const mps = new MobilePaymentsService(mypvit as any, {} as any, {} as any, {} as any, {} as any, { testConnection: jest.fn().mockResolvedValue(true) } as any, { testConnection: jest.fn().mockResolvedValue(true) } as any, hasura as any);
    await mps.getProvidersForCountry('GA');
    expect(allLogs()).toContain('active providers for GA: airtel');
    expect(allLogs()).not.toContain('"country":"GA"');
  });
});
