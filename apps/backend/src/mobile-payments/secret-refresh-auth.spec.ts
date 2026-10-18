/**
 * H1: POST /mobile-payments/secret-refresh overwrites the live MyPVit secret. It used to be
 * @Public with no auth, fell back to account codes hard-coded in this public repo, and
 * echoed the Secrets Manager secret name. These tests run the real controller handler.
 */
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, timingSafeEqual: jest.fn(actual.timingSafeEqual) };
});

import { HttpException, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { inspect } from 'util';
import { MobilePaymentsController } from './mobile-payments.controller';
import {
  MYPVIT_DOCUMENTED_IPS,
  allowedSecretRefreshIps,
  mypvitSecretName,
  normalizeIp,
  secretRefreshTokenMatches,
} from './secret-refresh-auth';

const TOKEN = 'tok_9c1f0b7e4a2d48f1b6e3a5c7d9e1f2a3b4c5d6e7';
const NEW_SECRET = ['sk', 'live', 'NEWmypvitSECRETfromWEBHOOK42'].join('_');
const AIRTEL = 'ACC_AIRTEL_TEST_01';
const MOOV = 'ACC_MOOV_TEST_02';
const OLD_HARDCODED = 'ACC_68A722C33473B';
const MYPVIT_IP = MYPVIT_DOCUMENTED_IPS[0];

const ENV_KEYS = [
  'MYPVIT_SECRET_REFRESH_TOKEN',
  'MYPVIT_SECRET_REFRESH_ALLOWED_IPS',
  'MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE',
  'MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE',
  'MYPVIT_SECRET_NAME',
] as const;
const savedEnv: Record<string, string | undefined> = {};
let logged: unknown[][];
let update: jest.Mock;

function controller(): MobilePaymentsController {
  update = jest.fn().mockResolvedValue({ success: true });
  const any = {} as any;
  return new MobilePaymentsController(
    { updateSecretInSecretsManager: update } as any,
    any, any, any, any, any, any, any, any,
    { get: jest.fn() } as any
  );
}

const req = (ip: string = MYPVIT_IP) => ({ ip, headers: {} }) as any;
const body = (over: Record<string, unknown> = {}) => ({
  merchant_operation_account_code: AIRTEL,
  secret_key: NEW_SECRET,
  expires_in: 3600,
  ...over,
});

async function status(p: Promise<unknown> | (() => unknown)): Promise<number> {
  try {
    await (typeof p === 'function' ? p() : p);
    return 200;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    return (e as HttpException).getStatus();
  }
}

function expectNothingLeaked(extra: unknown[] = []) {
  const text = [...logged, extra].map((a) => inspect(a, { depth: 8 })).join('\n');
  expect(text).not.toContain(NEW_SECRET);
  expect(text).not.toContain(TOKEN);
}

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.MYPVIT_SECRET_REFRESH_TOKEN = TOKEN;
  delete process.env.MYPVIT_SECRET_REFRESH_ALLOWED_IPS;
  process.env.MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE = AIRTEL;
  process.env.MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE = MOOV;
  delete process.env.MYPVIT_SECRET_NAME;
  logged = [];
  for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
    jest.spyOn(Logger.prototype, level).mockImplementation((...a: unknown[]) => {
      logged.push(a);
    });
  }
  (timingSafeEqual as jest.Mock).mockClear();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  jest.restoreAllMocks();
});

describe('H1: /secret-refresh authentication', () => {
  it('no token in the URL (old route) -> 401, nothing stored', async () => {
    const ctrl = controller();
    expect(await status(() => ctrl.rejectUnauthenticatedSecretRefresh(req()))).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ['empty', ''],
    ['wrong', 'tok_wrong_wrong_wrong_wrong_wrong_wrong_wrong'],
    ['prefix of the real token', TOKEN.slice(0, -1)],
    ['real token plus a suffix', `${TOKEN}x`],
  ])('%s token -> 401, nothing stored', async (_label, token) => {
    const ctrl = controller();
    expect(await status(ctrl.handleSecretRefreshCallback(token, body(), req()))).toBe(401);
    expect(update).not.toHaveBeenCalled();
    expectNothingLeaked();
  });

  it('correct token from a non-MyPVit IP -> 401, nothing stored', async () => {
    const ctrl = controller();
    expect(await status(ctrl.handleSecretRefreshCallback(TOKEN, body(), req('203.0.113.9')))).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it('QA S4: bad IP, bad token, both, and an unconfigured token all get the identical response', async () => {
    const ctrl = controller();
    const outcome = async (token: string, ip: string) => {
      const e = (await ctrl.handleSecretRefreshCallback(token, body(), req(ip)).catch((x: unknown) => x)) as HttpException;
      expect(e).toBeInstanceOf(HttpException);
      return { status: e.getStatus(), body: e.getResponse() };
    };
    const badIp = await outcome(TOKEN, '203.0.113.9');
    const badToken = await outcome('tok_wrong_wrong_wrong_wrong_wrong_wrong', MYPVIT_IP);
    const both = await outcome('tok_wrong_wrong_wrong_wrong_wrong_wrong', '203.0.113.9');
    delete process.env.MYPVIT_SECRET_REFRESH_TOKEN;
    const unconfigured = await outcome(TOKEN, MYPVIT_IP);
    const expected = { status: 401, body: { success: false, message: 'Unauthorized' } };
    expect([badIp, badToken, both, unconfigured]).toEqual([expected, expected, expected, expected]);
    expect(update).not.toHaveBeenCalled();
  });

  it('unconfigured: even the internal dummy comparison value is refused (the configured flag gates)', async () => {
    delete process.env.MYPVIT_SECRET_REFRESH_TOKEN;
    const ctrl = controller();
    expect(await status(ctrl.handleSecretRefreshCallback('x'.repeat(32), body(), req()))).toBe(401);
    process.env.MYPVIT_SECRET_REFRESH_TOKEN = 'short-token';
    expect(await status(ctrl.handleSecretRefreshCallback('x'.repeat(32), body(), req()))).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it('QA S4: the token compare runs even when the IP is already rejected (no short-circuit)', async () => {
    const ctrl = controller();
    await status(ctrl.handleSecretRefreshCallback(TOKEN, body(), req('203.0.113.9')));
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
    (timingSafeEqual as jest.Mock).mockClear();
    delete process.env.MYPVIT_SECRET_REFRESH_TOKEN;
    await status(ctrl.handleSecretRefreshCallback(TOKEN, body(), req()));
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unset', undefined],
    ['blank', '   '],
    ['too short', 'short-token'],
  ])('token %s in config -> fails closed (401), even for a "matching" request', async (_label, value) => {
    if (value === undefined) delete process.env.MYPVIT_SECRET_REFRESH_TOKEN;
    else process.env.MYPVIT_SECRET_REFRESH_TOKEN = value;
    const ctrl = controller();
    expect(await status(ctrl.handleSecretRefreshCallback(value ?? '', body(), req()))).toBe(401);
    expect(update).not.toHaveBeenCalled();
    // The operator still learns why, from the log only.
    expect(JSON.stringify(logged)).toContain('MYPVIT_SECRET_REFRESH_TOKEN is not configured');
  });

  it('correct token from a documented MyPVit IP stores the Airtel secret; response echoes nothing', async () => {
    const ctrl = controller();
    const res = await ctrl.handleSecretRefreshCallback(TOKEN, body(), req(`::ffff:${MYPVIT_IP}`));

    expect(update).toHaveBeenCalledWith(mypvitSecretName(), 'AIRTEL_MYPVIT_SECRET_KEY', NEW_SECRET);
    expect(Object.keys(res)).toEqual(['success', 'data']);
    expect(Object.keys(res.data)).toEqual(['updated_at']);
    const text = JSON.stringify(res);
    for (const s of ['rendasua-backend-secrets', 'secretName', NEW_SECRET, AIRTEL, 'AIRTEL_MYPVIT_SECRET_KEY', 'expires_in']) {
      expect(text).not.toContain(s);
    }
    expectNothingLeaked([res]);
  });

  it('accepts the documented field names (operation_account_code + secret) for Moov', async () => {
    const ctrl = controller();
    await ctrl.handleSecretRefreshCallback(
      TOKEN,
      { operation_account_code: MOOV, secret: NEW_SECRET, expires_in: 3600 },
      req()
    );
    expect(update).toHaveBeenCalledWith(mypvitSecretName(), 'MOOV_MYPVIT_SECRET_KEY', NEW_SECRET);
  });

  it('documented `secret` wins over a blank legacy `secret_key`; legacy-only still works', async () => {
    const ctrl = controller();
    await ctrl.handleSecretRefreshCallback(TOKEN, body({ secret_key: '', secret: NEW_SECRET }), req());
    expect(update).toHaveBeenLastCalledWith(mypvitSecretName(), 'AIRTEL_MYPVIT_SECRET_KEY', NEW_SECRET);
    await ctrl.handleSecretRefreshCallback(TOKEN, body({ merchant_operation_account_code: '  ', operation_account_code: MOOV }), req());
    expect(update).toHaveBeenLastCalledWith(mypvitSecretName(), 'MOOV_MYPVIT_SECRET_KEY', NEW_SECRET);
    await ctrl.handleSecretRefreshCallback(TOKEN, body({ secret_key: `  ${NEW_SECRET} ` }), req());
    expect(update).toHaveBeenLastCalledWith(mypvitSecretName(), 'AIRTEL_MYPVIT_SECRET_KEY', NEW_SECRET);
    expect(update).toHaveBeenCalledTimes(3);
  });

  it('a blank documented field falls through to the legacy one (secret and account code)', async () => {
    const ctrl = controller();
    await ctrl.handleSecretRefreshCallback(
      TOKEN,
      { secret: '', secret_key: NEW_SECRET, operation_account_code: '  ', merchant_operation_account_code: MOOV },
      req()
    );
    expect(update).toHaveBeenCalledWith(mypvitSecretName(), 'MOOV_MYPVIT_SECRET_KEY', NEW_SECRET);
  });

  it('compares the token with crypto.timingSafeEqual', async () => {
    const ctrl = controller();
    await ctrl.handleSecretRefreshCallback(TOKEN, body(), req());
    expect(timingSafeEqual).toHaveBeenCalled();
    (timingSafeEqual as jest.Mock).mockClear();
    await status(ctrl.handleSecretRefreshCallback('tok_wrong', body(), req()));
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
  });
});

describe('H1: no hard-coded account-code fallback', () => {
  it.each([
    ['both unset', undefined, undefined],
    ['airtel unset', undefined, MOOV],
    ['moov unset', AIRTEL, undefined],
    ['identical codes', AIRTEL, AIRTEL],
  ])('%s -> 503 and nothing stored, even with the old repo default code', async (_l, airtel, moov) => {
    if (airtel === undefined) delete process.env.MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE;
    else process.env.MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE = airtel;
    if (moov === undefined) delete process.env.MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE;
    else process.env.MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE = moov;
    const ctrl = controller();
    expect(
      await status(ctrl.handleSecretRefreshCallback(TOKEN, body({ merchant_operation_account_code: OLD_HARDCODED }), req()))
    ).toBe(503);
    expect(update).not.toHaveBeenCalled();
  });

  it('the old hard-coded code is just an unknown account when real codes are configured -> 400', async () => {
    const ctrl = controller();
    expect(
      await status(ctrl.handleSecretRefreshCallback(TOKEN, body({ merchant_operation_account_code: OLD_HARDCODED }), req()))
    ).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('H1: validation and failures', () => {
  it.each([
    ['missing secret', { secret_key: undefined }],
    ['non-string secret', { secret_key: { a: 1 } }],
    ['missing account code', { merchant_operation_account_code: undefined }],
    ['blank secret in both fields', { secret_key: ' ', secret: '' }],
    ['oversized secret', { secret_key: 'x'.repeat(513) }],
  ])('%s -> 400', async (_l, over) => {
    const ctrl = controller();
    expect(await status(ctrl.handleSecretRefreshCallback(TOKEN, body(over), req()))).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('a store failure -> 500 with a generic body; error details never logged or returned', async () => {
    const ctrl = controller();
    update.mockRejectedValue(new SyntaxError(`Unexpected token in "${NEW_SECRET}"`));
    const err = await ctrl.handleSecretRefreshCallback(TOKEN, body(), req()).catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(500);
    expect((err as HttpException).getResponse()).toEqual({ success: false, message: 'Failed to handle secret refresh webhook' });
    expectNothingLeaked();
  });
});

describe('secret-refresh-auth helpers', () => {
  it('token match is exact', () => {
    expect(secretRefreshTokenMatches(TOKEN, TOKEN)).toBe(true);
    expect(secretRefreshTokenMatches(TOKEN.toUpperCase(), TOKEN)).toBe(false);
    expect(secretRefreshTokenMatches(undefined, TOKEN)).toBe(false);
    expect(secretRefreshTokenMatches(123 as any, TOKEN)).toBe(false);
  });

  it('IP allowlist: documented list by default, env override, ::ffff: normalized', () => {
    expect(allowedSecretRefreshIps(undefined)).toEqual(['176.31.65.18', '176.31.65.20', '176.31.65.21', '13.59.249.167']);
    expect(allowedSecretRefreshIps(' 198.51.100.7 , ::ffff:198.51.100.8 ')).toEqual(['198.51.100.7', '198.51.100.8']);
    expect(normalizeIp('::ffff:1.2.3.4')).toBe('1.2.3.4');
  });

  it('env override of the allowlist is honoured by the handler', async () => {
    process.env.MYPVIT_SECRET_REFRESH_ALLOWED_IPS = '198.51.100.7';
    const ctrl = controller();
    expect(await status(ctrl.handleSecretRefreshCallback(TOKEN, body(), req(MYPVIT_IP)))).toBe(401);
    expect(await status(ctrl.handleSecretRefreshCallback(TOKEN, body(), req('198.51.100.7')))).toBe(200);
  });

  it('secret name: explicit MYPVIT_SECRET_NAME wins, else the name MyPVitService reads', () => {
    expect(mypvitSecretName({ NODE_ENV: 'production' } as any)).toBe('production-rendasua-backend-secrets');
    expect(mypvitSecretName({ NODE_ENV: 'production', MYPVIT_SECRET_NAME: 'custom' } as any)).toBe('custom');
    // Same rule as main.ts: DEPLOYMENT_ENV wins over NODE_ENV, and only production/development exist.
    expect(mypvitSecretName({ NODE_ENV: 'development', DEPLOYMENT_ENV: 'production' } as any)).toBe('production-rendasua-backend-secrets');
    expect(mypvitSecretName({ NODE_ENV: 'staging' } as any)).toBe('development-rendasua-backend-secrets');
    expect(mypvitSecretName({} as any)).toBe('development-rendasua-backend-secrets');
  });
});

describe('H1: writer and reader use the same secret', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('MyPVitService.getCurrentSecretKey reads the secret name the webhook writes', async () => {
    process.env.MYPVIT_SECRET_NAME = 'prod-rendasua-backend-secrets';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MyPVitService } = require('./providers/mypvit.service');
    const svc = new MyPVitService({
      get: () => ({ airtelMerchantOperationAccountCode: AIRTEL, moovMerchantOperationAccountCode: MOOV }),
    } as never);
    const send = jest.fn().mockResolvedValue({
      SecretString: JSON.stringify({ AIRTEL_MYPVIT_SECRET_KEY: 'airtel-from-store' }),
    });
    (svc as unknown as { secretsManager: { send: jest.Mock } }).secretsManager = { send };
    const key = await (
      svc as unknown as { getCurrentSecretKey: (p?: string) => Promise<string> }
    ).getCurrentSecretKey();
    expect(key).toBe('airtel-from-store');
    expect(send.mock.calls[0][0].input.SecretId).toBe(mypvitSecretName());
    expect(send.mock.calls[0][0].input.SecretId).toBe('prod-rendasua-backend-secrets');
  });
});

describe('QA #593 S3: no account-code fallback anywhere; the app fails at boot', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    jest.resetModules();
  });

  it('configuration() has no hard-coded codes: unset env gives empty strings', () => {
    delete process.env.MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE;
    delete process.env.MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const configuration = require('../config/configuration').default;
    const cfg = configuration();
    expect(cfg.mypvit.airtelMerchantOperationAccountCode).toBe('');
    expect(cfg.mypvit.moovMerchantOperationAccountCode).toBe('');
    expect(JSON.stringify(cfg)).not.toContain(OLD_HARDCODED);
  });

  it('configuration() passes configured codes through (trimmed)', () => {
    process.env.MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE = ` ${AIRTEL} `;
    process.env.MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE = MOOV;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const configuration = require('../config/configuration').default;
    const cfg = configuration();
    expect(cfg.mypvit.airtelMerchantOperationAccountCode).toBe(AIRTEL);
    expect(cfg.mypvit.moovMerchantOperationAccountCode).toBe(MOOV);
  });

  it.each([
    ['both missing', {}],
    ['airtel missing', { moovMerchantOperationAccountCode: MOOV }],
    ['moov missing', { airtelMerchantOperationAccountCode: AIRTEL }],
    ['blank', { airtelMerchantOperationAccountCode: ' ', moovMerchantOperationAccountCode: MOOV }],
  ])('MyPVitService refuses to construct (boot fails) when codes are %s', (_l, mypvit) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MyPVitService, requireOperationAccountCodes } = require('./providers/mypvit.service');
    expect(() => requireOperationAccountCodes(mypvit)).toThrow(/MyPVit misconfigured/);
    expect(() => new MyPVitService({ get: () => mypvit } as never)).toThrow(/MyPVit misconfigured/);
  });

  /** The module registry was reset, so spy on the Logger the freshly required service uses. */
  function freshWarnSpy(): jest.SpyInstance {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Logger: FreshLogger } = require('@nestjs/common');
    return jest.spyOn(FreshLogger.prototype, 'warn').mockImplementation(() => undefined);
  }

  it('valid distinct codes construct fine, with no warning', () => {
    const warn = freshWarnSpy();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MyPVitService, requireOperationAccountCodes } = require('./providers/mypvit.service');
    const cfg = { airtelMerchantOperationAccountCode: AIRTEL, moovMerchantOperationAccountCode: MOOV };
    expect(requireOperationAccountCodes(cfg)).toEqual({ airtel: AIRTEL, moov: MOOV, identical: false });
    new MyPVitService({ get: () => cfg } as never);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('identical');
  });

  it('identical codes (DEV sandbox) still boot, but warn that secret refresh will be refused', () => {
    const warn = freshWarnSpy();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MyPVitService, requireOperationAccountCodes } = require('./providers/mypvit.service');
    const cfg = { airtelMerchantOperationAccountCode: AIRTEL, moovMerchantOperationAccountCode: ` ${AIRTEL}` };
    expect(requireOperationAccountCodes(cfg)).toEqual({ airtel: AIRTEL, moov: AIRTEL, identical: true });
    expect(() => new MyPVitService({ get: () => cfg } as never)).not.toThrow();
    expect(JSON.stringify(warn.mock.calls)).toContain('operation account codes are identical');
  });
});
