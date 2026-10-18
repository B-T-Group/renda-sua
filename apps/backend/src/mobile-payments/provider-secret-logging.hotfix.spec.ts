/**
 * Prod log audit hotfix: no provider secret may reach a log line, a rethrown error
 * or an HTTP error body.
 *
 *  1. MyPVit secret rotation (POST /mobile-payments/secret-refresh -> updateSecretInSecretsManager):
 *     the new sk_live value, and the other secrets in the stored blob, are never logged.
 *  2. FreemoPay Basic credentials: initiate / status / callback error paths.
 *  3. sk_live in "Failed to check transaction status" (MyPVit X-Secret header, FedaPay Bearer key).
 *
 * Real controller, MobilePaymentsService, MyPVitService, FreemopayService and FedaPayService
 * code runs. Only the transports are faked: the axios adapter (so errors are genuine AxiosErrors
 * carrying the real request config and headers), the AWS Secrets Manager client and the FedaPay SDK.
 */
import { HttpException, Logger } from '@nestjs/common';
import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { inspect } from 'util';

const awsSend = jest.fn();
jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({ send: awsSend })),
  GetSecretValueCommand: jest.fn().mockImplementation((input) => ({ kind: 'get', input })),
  UpdateSecretCommand: jest.fn().mockImplementation((input) => ({ kind: 'update', input })),
}));

const fedapayRetrieve = jest.fn();
const fedapayCreate = jest.fn();
jest.mock('fedapay', () => ({
  FedaPay: { setApiKey: jest.fn(), setEnvironment: jest.fn() },
  Transaction: {
    retrieve: (...a: unknown[]) => fedapayRetrieve(...a),
    create: (...a: unknown[]) => fedapayCreate(...a),
  },
  Payout: { retrieve: jest.fn(), create: jest.fn(), all: jest.fn() },
}));

import { MobilePaymentsController } from './mobile-payments.controller';
import { MobilePaymentsService } from './mobile-payments.service';
import { FedaPayService } from './providers/fedapay.service';
import { FreemopayService } from './providers/freemopay.service';
import { MyPVitService } from './providers/mypvit.service';
import { redactSecrets } from './sanitize-provider-error.util';

// Dummy keys are assembled at runtime so no key-shaped literal sits in the source
// (secret scanners flag sk_live_ literals, even fake ones).
const fakeKey = (env: string, body: string) => ['sk', env, body].join('_');
const NEW_SECRET = fakeKey('live', 'NEWROTATEDairtel9f8e7d6c5b4a');
const OLD_AIRTEL = fakeKey('live', 'OLDairtelSECRET0123456789');
const OLD_MOOV = fakeKey('live', 'OLDmoovSECRET0123456789');
const MYPVIT_HEADER_SECRET = fakeKey('live', 'HEADERmypvitXSECRET42');
const RENEWED_SECRET = fakeKey('live', 'RENEWEDviaApi777');
const BASIC_B64 = 'Zm9vOmJhcg=='; // base64('foo:bar')
const FEDA_KEY = fakeKey('live', 'FEDAPAYbearerKEY31337');
const SECRETS = [NEW_SECRET, OLD_AIRTEL, OLD_MOOV, MYPVIT_HEADER_SECRET, RENEWED_SECRET, FEDA_KEY];

let logged: unknown[][];

const everything = (extra: unknown[] = []) =>
  [...logged, extra].map((args) => inspect(args, { depth: 12 })).join('\n');

function expectNoSecrets(text: string) {
  for (const s of SECRETS) expect(text).not.toContain(s);
  expect(text).not.toMatch(/sk_(live|test|sandbox)_(?!REDACTED)[A-Za-z0-9]/);
  expect(text).not.toContain(BASIC_B64);
  expect(text).not.toMatch(/Authorization/i);
  expect(text).not.toMatch(/Basic/);
  expect(text).not.toMatch(/X-Secret/i);
}

beforeEach(() => {
  logged = [];
  awsSend.mockReset();
  fedapayRetrieve.mockReset();
  fedapayCreate.mockReset();
  for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
    jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
  }
  for (const level of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
  }
});
afterEach(() => jest.restoreAllMocks());

/** Bare MobilePaymentsService running its real methods, with providers injected. */
function mps(providers: Record<string, unknown> = {}): MobilePaymentsService {
  const svc = Object.create(MobilePaymentsService.prototype);
  Object.assign(svc, { logger: new Logger(MobilePaymentsService.name), ...providers });
  svc.logStatusCheck = jest.fn();
  return svc;
}

function controller(
  service: MobilePaymentsService,
  callbackProcessor: Record<string, unknown> = {}
): MobilePaymentsController {
  const any = {} as any;
  return new MobilePaymentsController(
    service,
    any,
    any,
    any,
    any,
    callbackProcessor as any,
    any,
    any,
    any,
    { get: jest.fn() } as any
  );
}

function axiosFailure(status: number, data: unknown, extraHeader: string) {
  return async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError(
      `Request failed with status code ${status}`,
      'ERR_BAD_RESPONSE',
      config,
      { _header: `GET ${config.url} HTTP/1.1\r\n${extraHeader}` },
      { status, statusText: 'x', headers: {}, config, data } as any
    );
  };
}

function mypvit(): MyPVitService {
  const svc = new MyPVitService({
    get: (key: string) =>
      key === 'mypvit'
        ? {
            baseUrl: 'https://mypvit.test',
            airtelSecretKey: OLD_AIRTEL,
            moovSecretKey: OLD_MOOV,
            airtelMerchantOperationAccountCode: 'ACC_AIRTEL',
            moovMerchantOperationAccountCode: 'ACC_MOOV',
          }
        : key === 'NODE_ENV'
          ? 'production'
          : undefined,
  } as any);
  (svc as any).httpClient.defaults.adapter = axiosFailure(
    500,
    { message: 'upstream exploded' },
    `X-Secret: ${MYPVIT_HEADER_SECRET}`
  );
  return svc;
}

function freemopay(): FreemopayService {
  const svc = new FreemopayService(
    {
      get: (key: string) =>
        key === 'freemopay'
          ? { baseUrl: 'https://freemopay.test', appKey: 'foo', secretKey: 'bar', callbackUrl: 'https://cb.test' }
          : undefined,
    } as any,
    { get: jest.fn() } as any
  );
  expect(String((svc as any).httpClient.defaults.headers.Authorization)).toBe(`Basic ${BASIC_B64}`);
  (svc as any).httpClient.defaults.adapter = axiosFailure(
    401,
    { message: 'Unauthorized' },
    `Authorization: Basic ${BASIC_B64}`
  );
  return svc;
}

function fedapay(): FedaPayService {
  return new FedaPayService(
    {
      get: (key: string) =>
        key === 'fedapay'
          ? { environment: 'live', secretKey: FEDA_KEY, callbackUrl: 'https://cb.test', mockEnabled: false }
          : undefined,
    } as any,
    { get: jest.fn() } as any
  );
}

/** FedaPay SDK-style error: message echoes the bearer key, the request carries it too. */
function fedapaySdkError() {
  return Object.assign(new Error(`Invalid API key provided: Bearer ${FEDA_KEY}`), {
    httpStatus: 401,
    httpRequest: { headers: { Authorization: `Bearer ${FEDA_KEY}` } },
    errorMessage: `key ${FEDA_KEY} rejected`,
  });
}

describe('1. MyPVit secret rotation never logs secret values', () => {
  const webhook = {
    merchant_operation_account_code: 'ACC_68A722C33473B',
    secret_key: NEW_SECRET,
    expires_in: 3600,
  };

  it('success: logs only key names; the new secret goes to AWS but to no log line', async () => {
    awsSend.mockImplementation(async (cmd: any) =>
      cmd.kind === 'get'
        ? { SecretString: JSON.stringify({ AIRTEL_MYPVIT_SECRET_KEY: OLD_AIRTEL, MOOV_MYPVIT_SECRET_KEY: OLD_MOOV }) }
        : {}
    );

    const res = await controller(mps()).handleSecretRefreshCallback(webhook, 'mypvit');

    expect(res.success).toBe(true);
    const update = awsSend.mock.calls.map(([c]) => c).find((c: any) => c.kind === 'update');
    expect(JSON.parse(update.input.SecretString).AIRTEL_MYPVIT_SECRET_KEY).toBe(NEW_SECRET);
    const text = everything([res]);
    expect(text).toContain('Updating secret production-rendasua-backend-secrets with key AIRTEL_MYPVIT_SECRET_KEY'.replace('production', process.env.NODE_ENV || 'development'));
    expect(text).toContain('secret_key=PRESENT');
    expectNoSecrets(text);
  });

  it('failure: a corrupt stored blob (JSON.parse quotes it) leaks into no log and no HTTP body', async () => {
    awsSend.mockImplementation(async (cmd: any) =>
      cmd.kind === 'get'
        ? { SecretString: OLD_AIRTEL } // a bare value instead of a JSON object
        : {}
    );
    // Sanity: the raw parse error really does quote the start of the stored secret.
    expect(() => JSON.parse(OLD_AIRTEL)).toThrow('"sk_live_OL"');

    const err = await controller(mps())
      .handleSecretRefreshCallback(webhook, 'mypvit')
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpException);
    const body = (err as HttpException).getResponse();
    expect(JSON.stringify(body)).toContain('SyntaxError');
    expectNoSecrets(everything([body, err]));
  });

  it('failure: an AWS error that echoes the request is not logged raw', async () => {
    awsSend.mockImplementation(async (cmd: any) => {
      if (cmd.kind === 'get') return { SecretString: '{}' };
      throw Object.assign(new Error(`Rejected SecretString {"AIRTEL_MYPVIT_SECRET_KEY":"${NEW_SECRET}"}`), {
        name: 'InvalidRequestException',
        $metadata: { httpStatusCode: 400 },
        input: cmd.input,
      });
    });

    const err = await mps()
      .updateSecretInSecretsManager('s', 'AIRTEL_MYPVIT_SECRET_KEY', NEW_SECRET)
      .catch((e: unknown) => e);

    expect((err as Error).message).toBe('Failed to update secret AIRTEL_MYPVIT_SECRET_KEY (InvalidRequestException)');
    expectNoSecrets(everything([err]));
  });

  it('controller: a raw error from the update step is neither logged nor returned raw', async () => {
    const raw = Object.assign(new Error(`could not store ${NEW_SECRET}`), {
      config: { headers: { Authorization: `Bearer ${FEDA_KEY}`, 'X-Secret': OLD_AIRTEL } },
    });
    const service = { updateSecretInSecretsManager: jest.fn().mockRejectedValue(raw) } as any;

    const err = await controller(service)
      .handleSecretRefreshCallback(webhook, 'mypvit')
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpException);
    const body = (err as HttpException).getResponse() as any;
    expect(body.error).toBe('could not store sk_live_REDACTED');
    expect(everything()).toContain('Error handling secret refresh webhook: could not store sk_live_REDACTED');
    expectNoSecrets(everything([body]));
  });

  it('validation failures are 4xx (Sentry only captures 5xx) and touch nothing', async () => {
    const service = { updateSecretInSecretsManager: jest.fn() } as any;
    const ctrl = controller(service);

    const missing = await ctrl
      .handleSecretRefreshCallback({ ...webhook, secret_key: '' }, 'mypvit')
      .catch((e: unknown) => e);
    const unknown = await ctrl
      .handleSecretRefreshCallback({ ...webhook, merchant_operation_account_code: 'ACC_ATTACKER' }, 'mypvit')
      .catch((e: unknown) => e);

    expect((missing as HttpException).getStatus()).toBe(400);
    expect((unknown as HttpException).getStatus()).toBe(400);
    expect(service.updateSecretInSecretsManager).not.toHaveBeenCalled();
    expectNoSecrets(everything([(unknown as HttpException).getResponse()]));
  });

  it('MyPVit getCurrentSecretKey: a corrupt blob is not quoted in the log', async () => {
    awsSend.mockResolvedValue({ SecretString: NEW_SECRET });
    const svc = mypvit();

    const key = await (svc as any).getCurrentSecretKey('+24177123456');

    expect(key).toBe(OLD_AIRTEL); // falls back to the cached key
    expect(everything()).toContain('Failed to fetch current secret key (SyntaxError)');
    expectNoSecrets(everything());
  });

  it('MyPVit renewSecretKey: the response interceptor does not log the new key', async () => {
    const svc = mypvit();
    (svc as any).httpClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: { success: true, new_secret_key: RENEWED_SECRET },
    });

    const res = await svc.renewSecretKey();

    expect(res.newSecretKey).toBe(RENEWED_SECRET);
    expect(everything()).toContain('MyPVit API Response: 200');
    expectNoSecrets(everything());
  });

  it('MyPVit constructor does not dump the raw config', () => {
    mypvit();
    expect(everything()).toContain('Airtel secret key: LOADED');
    expectNoSecrets(everything());
  });
});

describe('2. FreemoPay Basic credentials', () => {
  it("'Failed to initiate Freemopay payment' / 'withdrawal' log no credentials", async () => {
    const svc = freemopay();
    const pay = await svc.initiatePayment({ payer: '237650123456', amount: 500, externalId: 'R1', callback: 'https://cb.test' } as any);
    const wd = await svc.withdraw({ payee: '237650123456', amount: 500, externalId: 'R2', callback: 'https://cb.test' } as any);

    expect(pay.success).toBe(false);
    expect(wd.success).toBe(false);
    const text = everything([pay, wd]);
    expect(text).toContain('Failed to initiate Freemopay payment');
    expect(text).toContain('Failed to initiate Freemopay withdrawal');
    expectNoSecrets(text);
  });

  it("checkTransactionStatus (freemopay.service:490) logs and rethrows no credentials", async () => {
    const err = await freemopay().checkTransactionStatus('FMP-1').catch((e: unknown) => e);
    expect((err as any).status).toBe(401);
    expect(everything()).toContain('Failed to check Freemopay transaction status');
    expectNoSecrets(everything([err]));
  });

  it("'Freemopay callback processing error': the status re-check failure is logged without credentials", async () => {
    const svc = freemopay();
    const ctrl = controller(mps(), {
      processFreemopayCallback: () => svc.checkTransactionStatus('FMP-2'),
    });

    const err = await ctrl
      .freemopayCallback({ reference: 'FMP-2', status: 'SUCCESS' } as any, {} as any)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpException);
    expect(everything()).toContain('Freemopay callback processing error');
    expectNoSecrets(everything([(err as HttpException).getResponse()]));
  });

  it("'Freemopay callback processing error': even a raw axios error from the processor is sanitized", async () => {
    const svc = freemopay();
    const raw = await (svc as any).httpClient.get('/x').catch((e: unknown) => e);
    expect(inspect(raw, { depth: 8 })).toContain(BASIC_B64); // sanity: the raw error carries it
    logged = [];
    const ctrl = controller(mps(), { processFreemopayCallback: async () => { throw raw; } });

    const err = await ctrl
      .freemopayCallback({ reference: 'FMP-3', status: 'SUCCESS' } as any, {} as any)
      .catch((e: unknown) => e);

    expectNoSecrets(everything([(err as HttpException).getResponse()]));
  });

  it("'MyPVIT callback processing error' is sanitized too", async () => {
    const raw = await (mypvit() as any).httpClient.get('/x', { headers: { 'X-Secret': MYPVIT_HEADER_SECRET } }).catch((e: unknown) => e);
    logged = [];
    const ctrl = controller(mps(), { processMypvitCallback: async () => { throw raw; } });

    const err = await ctrl
      .mypvitCallback({ transactionId: 't', merchantReferenceId: 'm', status: 'SUCCESS' } as any, {} as any)
      .catch((e: unknown) => e);

    expect(everything()).toContain('MyPVIT callback processing error');
    expectNoSecrets(everything([(err as HttpException).getResponse()]));
  });
});

describe("3. sk_live in 'Failed to check transaction status'", () => {
  it('MyPVit: the X-Secret header is in no log and not in the rethrown error (provider and MPS level)', async () => {
    awsSend.mockResolvedValue({ SecretString: JSON.stringify({ AIRTEL_MYPVIT_SECRET_KEY: MYPVIT_HEADER_SECRET }) });
    const provider = mypvit();

    const err = await mps({ myPVitService: provider })
      .checkTransactionStatus('MP-1', 'mypvit', '+24177123456')
      .catch((e: unknown) => e);

    expect((err as Error).message).toBe('Request failed with status code 500');
    expect((err as any).status).toBe(500);
    const text = everything([err]);
    expect(text).toMatch(/MyPVitService|Failed to check transaction status/);
    expect(logged.filter((a) => String(a[0]).startsWith('Failed to check transaction status')).length).toBe(2);
    expectNoSecrets(text);
  });

  it('MyPVit provider itself rethrows a sanitized error (status kept, no X-Secret)', async () => {
    awsSend.mockResolvedValue({ SecretString: JSON.stringify({ AIRTEL_MYPVIT_SECRET_KEY: MYPVIT_HEADER_SECRET }) });

    const err = await mypvit().checkTransactionStatus('MP-2', '+24177123456').catch((e: unknown) => e);

    expect(err).toMatchObject({ message: 'Request failed with status code 500', status: 500, response: { status: 500 } });
    expect((err as any).config).toBeUndefined();
    expectNoSecrets(everything([err]));
  });

  it('MobilePaymentsService: a provider that throws a raw error is logged and rethrown sanitized', async () => {
    const raw = Object.assign(new Error(`denied for Bearer ${FEDA_KEY}`), {
      status: 403,
      config: { headers: { Authorization: `Basic ${BASIC_B64}`, 'X-Secret': MYPVIT_HEADER_SECRET } },
      request: { _header: `Authorization: Basic ${BASIC_B64}` },
    });
    const freemopayService = { checkTransactionStatus: jest.fn().mockRejectedValue(raw) };

    const err = await mps({ freemopayService })
      .checkTransactionStatus('FMP-9', 'freemopay')
      .catch((e: unknown) => e);

    expect(err).toMatchObject({ message: 'denied for Bearer REDACTED', status: 403 });
    expect((err as any).config).toBeUndefined();
    expect(everything()).toContain('Failed to check transaction status: denied for Bearer REDACTED');
    expectNoSecrets(everything([err]));
  });

  it('MyPVit: checkBalance / cancelTransaction / getTransactionHistory errors are sanitized', async () => {
    awsSend.mockResolvedValue({ SecretString: JSON.stringify({ AIRTEL_MYPVIT_SECRET_KEY: MYPVIT_HEADER_SECRET }) });
    const svc = mypvit();
    const bal = await svc.checkBalance('+24177123456').catch((e: unknown) => e);
    await svc.cancelTransaction('t', '+24177123456');
    await svc.getTransactionHistory();
    expect((bal as any).status).toBe(500);
    expectNoSecrets(everything([bal]));
  });

  it('FedaPay: Bearer sk_live is in no log and not in the rethrown error (provider and MPS level)', async () => {
    fedapayRetrieve.mockRejectedValue(fedapaySdkError());

    const err = await mps({ fedapayService: fedapay() })
      .checkTransactionStatus('12345', 'fedapay')
      .catch((e: unknown) => e);

    expect((err as Error).message).toBe('Invalid API key provided: Bearer REDACTED');
    expect((err as any).status).toBe(401);
    expect(everything()).toContain('Failed to check FedaPay transaction status');
    expectNoSecrets(everything([err]));
  });

  it('FedaPay provider itself rethrows a sanitized error', async () => {
    fedapayRetrieve.mockRejectedValue(fedapaySdkError());

    const err = await fedapay().checkTransactionStatus('777').catch((e: unknown) => e);

    expect(err).toMatchObject({ message: 'Invalid API key provided: Bearer REDACTED', status: 401 });
    expect((err as any).httpRequest).toBeUndefined();
    expectNoSecrets(everything([err]));
  });

  it('FedaPay: initiatePayment failure logs and returns only the redacted message', async () => {
    fedapayCreate.mockRejectedValue(fedapaySdkError());

    const res = await fedapay().initiatePayment({
      payer: '+22890123456',
      amount: 500,
      externalId: 'E1',
      description: 'd',
      callback: 'https://cb.test',
    } as any);

    expect(res.success).toBe(false);
    expect(everything()).toContain('Failed to initiate FedaPay payment');
    expectNoSecrets(everything([res]));
  });
});

describe('redactSecrets covers Basic, Bearer and sk_live/sk_test/sk_sandbox', () => {
  it.each([
    [`Basic ${BASIC_B64}`, 'Basic REDACTED'],
    ['Bearer abc.def-ghi', 'Bearer REDACTED'],
    ['sk_live_abc123', 'sk_live_REDACTED'],
    ['sk_test_abc123', 'sk_test_REDACTED'],
    ['sk_sandbox_abc123', 'sk_sandbox_REDACTED'],
  ])('%s', (input, out) => {
    expect(redactSecrets(`x ${input} y`)).toBe(`x ${out} y`);
  });
});
