/**
 * H1: FreemoPay authenticates with `Authorization: Basic base64(appKey:secretKey)`
 * set on the axios instance. A raw axios error carries that header in
 * error.config.headers, and Nest's ConsoleLogger prints non-string params with
 * util.inspect, so logging the error object leaks the credentials.
 *
 * These tests run the real FreemopayService with its real axios instance; only the
 * transport (axios adapter) is replaced, so the error is a genuine AxiosError with
 * the real request config and headers.
 */
import { Logger } from '@nestjs/common';
import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { inspect } from 'util';
import { sanitizeProviderError } from '../sanitize-provider-error.util';
import { FreemopayService } from './freemopay.service';

// appKey 'foo' + secretKey 'bar' => Authorization: Basic Zm9vOmJhcg==
const BASIC_B64 = 'Zm9vOmJhcg==';

let logged: unknown[][];

function service(): FreemopayService {
  const svc = new FreemopayService(
    {
      get: (key: string) =>
        key === 'freemopay'
          ? {
              baseUrl: 'https://freemopay.test',
              appKey: 'foo',
              secretKey: 'bar',
              callbackUrl: 'https://cb.test',
              amountMockEnabled: false,
            }
          : undefined,
    } as any,
    { get: jest.fn() } as any
  );
  const http = (svc as any).httpClient;
  // Sanity: the real instance really carries the Basic credentials.
  expect(String(http.defaults.headers.Authorization)).toBe(`Basic ${BASIC_B64}`);
  http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError(
      'Request failed with status code 401',
      'ERR_BAD_REQUEST',
      config,
      { _header: `GET ${config.url} HTTP/1.1\r\nAuthorization: Basic ${BASIC_B64}` },
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
        data: { message: 'Unauthorized' },
      } as any
    );
  };
  return svc;
}

const everything = (extra: unknown[] = []) =>
  [...logged, extra].map((args) => inspect(args, { depth: 10 })).join('\n');

function expectNoCredentials(text: string) {
  expect(text).not.toContain(BASIC_B64);
  expect(text).not.toMatch(/Authorization/i);
  expect(text).not.toMatch(/Basic/);
}

beforeEach(() => {
  logged = [];
  for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
    jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
  }
});
afterEach(() => jest.restoreAllMocks());

describe('H1: FreemoPay never logs or rethrows its Basic credentials', () => {
  it('checkTransactionStatus: no logged arg and no thrown error contains Authorization/Basic/base64', async () => {
    const svc = service();

    const err = await svc.checkTransactionStatus('FMP-REF-1').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('Request failed with status code 401');
    expect((err as any).status).toBe(401);
    expect(logged.length).toBeGreaterThan(0);
    expectNoCredentials(everything([err]));
  });

  it('initiatePayment: provider error is logged without credentials', async () => {
    const svc = service();

    const res = await svc.initiatePayment({
      payer: '237650123456',
      amount: 500,
      externalId: 'R1',
      callback: 'https://cb.test',
    } as any);

    expect(res.success).toBe(false);
    expectNoCredentials(everything([res]));
  });

  it('withdraw: provider error is logged without credentials', async () => {
    const svc = service();

    const res = await svc.withdraw({
      payee: '237650123456',
      amount: 500,
      externalId: 'R2',
      callback: 'https://cb.test',
    } as any);

    expect(res.success).toBe(false);
    expectNoCredentials(everything([res]));
  });
});

describe('sanitizeProviderError redacts Basic credentials', () => {
  it('redacts a Basic token embedded in an error message', () => {
    const sanitized = sanitizeProviderError(
      new Error(`upstream said: Authorization: Basic ${BASIC_B64} rejected`)
    );
    expect(sanitized.message).toBe('upstream said: Authorization: Basic REDACTED rejected');
  });

  it('keeps only message/status/code from an axios-style error', () => {
    const error: any = new Error('Request failed with status code 401');
    error.config = { headers: { Authorization: `Basic ${BASIC_B64}` } };
    error.request = { _header: `Authorization: Basic ${BASIC_B64}` };
    error.response = { status: 401, config: error.config };

    expect(sanitizeProviderError(error)).toEqual({
      message: 'Request failed with status code 401',
      status: 401,
    });
  });
});
