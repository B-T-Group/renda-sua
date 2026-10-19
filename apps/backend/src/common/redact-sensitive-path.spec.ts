/**
 * H1: the MyPVit secret-reception URL carries its auth token in the path
 * (/mobile-payments/secret-refresh/<token>). These tests pin that the token never reaches the
 * access log, the exception log, Sentry tags or Sentry events/transactions.
 */
const captured: { options?: any; tags: Record<string, string> } = { tags: {} };
jest.mock('@sentry/nestjs', () => ({
  requestDataIntegration: (o: unknown) => ({ name: 'RequestData', o }),
  getClient: jest.fn(() => (captured.options ? {} : undefined)),
  init: jest.fn((options: unknown) => {
    captured.options = options;
  }),
  withScope: jest.fn((cb: (scope: unknown) => void) =>
    cb({
      setTag: (k: string, v: string) => {
        captured.tags[k] = v;
      },
      setUser: jest.fn(),
    })
  ),
  captureException: jest.fn(),
}));
jest.mock('./request-context-log.util', () => ({
  getRequestLogContext: () => ({ requestId: 'req-1', userId: 'anonymous' }),
}));

import { ArgumentsHost, CallHandler, ExecutionContext, HttpException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { of, throwError } from 'rxjs';
import { inspect } from 'util';
import { initSentry, sentryBeforeSend, sentryBeforeSendTransaction } from '../instrument';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { redactSensitivePath, redactSensitivePathsDeep } from './redact-sensitive-path.util';

const TOKEN = 'tok_7f3e9a1c5b2d4e6f8a0b1c2d3e4f5a6b7c8d9e0f';
const URL_WITH_TOKEN = `/api/mobile-payments/secret-refresh/${TOKEN}`;

function http(request: object, response: object) {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  };
}

describe('redactSensitivePath', () => {
  it.each([
    [URL_WITH_TOKEN, '/api/mobile-payments/secret-refresh/[REDACTED]'],
    [`${URL_WITH_TOKEN}?x=1`, '/api/mobile-payments/secret-refresh/[REDACTED]?x=1'],
    [`https://api.rendasua.com${URL_WITH_TOKEN}/`, 'https://api.rendasua.com/api/mobile-payments/secret-refresh/[REDACTED]/'],
    [`POST ${URL_WITH_TOKEN} 500`, 'POST /api/mobile-payments/secret-refresh/[REDACTED] 500'],
  ])('redacts %s', (input, expected) => {
    expect(redactSensitivePath(input)).toBe(expected);
  });

  it('redacts every occurrence in one string (e.g. a span description with url and target)', () => {
    const out = redactSensitivePath(`POST ${URL_WITH_TOKEN} -> https://api.rendasua.com${URL_WITH_TOKEN}`);
    expect(out).not.toContain(TOKEN);
    expect(out.match(/\[REDACTED\]/g)).toHaveLength(2);
  });

  it('leaves other paths and the bare old route alone', () => {
    expect(redactSensitivePath('/api/mobile-payments/secret-refresh')).toBe('/api/mobile-payments/secret-refresh');
    expect(redactSensitivePath('/api/orders/123')).toBe('/api/orders/123');
  });

  it('deep-redacts nested strings, arrays and survives cycles', () => {
    const obj: any = { a: [URL_WITH_TOKEN, { b: URL_WITH_TOKEN }], n: 1 };
    obj.self = obj;
    redactSensitivePathsDeep(obj);
    expect(inspect(obj, { depth: 10 })).not.toContain(TOKEN);
    expect(obj.n).toBe(1);
  });
});

describe('access log and exception log never contain the path token', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
    captured.tags = {};
  });

  it('LoggingInterceptor logs the redacted path (success and error)', (done) => {
    process.env.NODE_ENV = 'development';
    const logger = { info: jest.fn() };
    const interceptor = new LoggingInterceptor(logger as never);
    const req = { method: 'POST', url: URL_WITH_TOKEN, originalUrl: URL_WITH_TOKEN };
    const res = { statusCode: 200, setHeader: jest.fn() };
    const ctx = http(req, res) as unknown as ExecutionContext;
    interceptor.intercept(ctx, { handle: () => of({}) } as CallHandler).subscribe({
      complete: () => {
        interceptor
          .intercept(ctx, { handle: () => throwError(() => new HttpException('x', 400)) } as CallHandler)
          .subscribe({
            error: () => {
              expect(logger.info).toHaveBeenCalledTimes(2);
              expect(logger.info.mock.calls[0][1].path).toBe('/api/mobile-payments/secret-refresh/[REDACTED]');
              expect(inspect(logger.info.mock.calls, { depth: 10 })).not.toContain(TOKEN);
              done();
            },
          });
      },
    });
  });

  it('AllExceptionsFilter: warn log (4xx/503), error log and Sentry path tag are redacted', () => {
    const logger = { warn: jest.fn(), error: jest.fn() };
    const filter = new AllExceptionsFilter(logger as never);
    const req = { method: 'POST', url: URL_WITH_TOKEN, originalUrl: URL_WITH_TOKEN };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = http(req, res) as unknown as ArgumentsHost;
    filter.catch(new HttpException('bad', 400), host);
    filter.catch(new HttpException('down', 503), host);
    captured.options = {}; // Sentry client present
    filter.catch(new Error('boom'), host);
    captured.options = undefined;
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][1].path).toBe('/api/mobile-payments/secret-refresh/[REDACTED]');
    expect(captured.tags.path).toBe('/api/mobile-payments/secret-refresh/[REDACTED]');
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(inspect([logger.warn.mock.calls, logger.error.mock.calls], { depth: 10 })).not.toContain(TOKEN);
  });
});

describe('Sentry events and transactions never contain the path token', () => {
  const event = () => ({
    request: { url: `https://api.rendasua.com${URL_WITH_TOKEN}`, method: 'POST' },
    transaction: `POST ${URL_WITH_TOKEN}`,
    breadcrumbs: [{ category: 'http', data: { url: URL_WITH_TOKEN } }],
    spans: [{ description: `POST ${URL_WITH_TOKEN}`, data: { 'url.full': URL_WITH_TOKEN, 'http.target': URL_WITH_TOKEN } }],
    contexts: { trace: { data: { 'http.route': URL_WITH_TOKEN } } },
  });

  it('beforeSend redacts and still drops expected-unavailable errors', () => {
    const out = sentryBeforeSend(event(), { originalException: new Error('real failure') });
    expect(out).not.toBeNull();
    expect(inspect(out, { depth: 10 })).not.toContain(TOKEN);
    expect((out as any).request.url).toBe('https://api.rendasua.com/api/mobile-payments/secret-refresh/[REDACTED]');
    expect(
      sentryBeforeSend(event(), { originalException: new Error('Temporarily unable to reach the data service') })
    ).toBeNull();
  });

  it('beforeSendTransaction redacts', () => {
    const out = sentryBeforeSendTransaction(event());
    expect(inspect(out, { depth: 10 })).not.toContain(TOKEN);
  });

  it('initSentry wires both hooks', () => {
    process.env.SENTRY_DSN = 'https://public@o0.ingest.sentry.io/0';
    try {
      initSentry();
      expect(captured.options.beforeSend).toBe(sentryBeforeSend);
      expect(captured.options.beforeSendTransaction).toBe(sentryBeforeSendTransaction);
    } finally {
      delete process.env.SENTRY_DSN;
      captured.options = undefined;
    }
  });
});
