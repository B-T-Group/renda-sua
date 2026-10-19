/**
 * B1: Sentry must never receive a request body, credentials or provider secrets.
 * The /secret-refresh body carries the new live MyPVit secret; a 5xx there is captured by
 * AllExceptionsFilter with the request attached by the HTTP instrumentation.
 */
const sentryInit = jest.fn();
jest.mock('@sentry/nestjs', () => {
  const actual = jest.requireActual('@sentry/nestjs');
  return { ...actual, init: (...a: unknown[]) => sentryInit(...a), getClient: () => undefined };
});

import { initSentry, sentryBeforeSend, sentryBeforeSendTransaction } from '../../instrument';
import { redactDeep, scrubSentryEvent } from './scrub-sentry-event';

const fakeKey = (env: string, body: string) => ['sk', env, body].join('_');
const LIVE = fakeKey('live', 'MYPVITnewSECRETvalue9f8e7d6c');
const MYPVIT_RAW = 'b7Qp2LxV9mN4rT8sK1wZ'; // MyPVit X-Secret values are not sk_ shaped
const BASIC = 'Zm9vOmJhcg==';

function secretRefreshEvent(): any {
  return {
    message: `failed with Bearer ab+cd/ef== and ${LIVE}`,
    request: {
      url: '/api/mobile-payments/secret-refresh?provider=mypvit&apiKey=qk123',
      method: 'POST',
      data: JSON.stringify({ merchant_operation_account_code: 'ACC_1', secret_key: MYPVIT_RAW, expires_in: 3600 }),
      cookies: { session: 'sess-cookie-value' },
      headers: {
        authorization: `Basic ${BASIC}`,
        cookie: 'session=sess-cookie-value',
        'x-secret': MYPVIT_RAW,
        'x-api-key': 'qk123',
        'content-type': 'application/json',
      },
      query_string: 'provider=mypvit&apiKey=qk123',
    },
    exception: {
      values: [{ type: 'Error', value: `Could not store {"secret_key":"${MYPVIT_RAW}"} ${LIVE}` }],
    },
    breadcrumbs: [
      {
        category: 'console',
        message: `Received secret refresh webhook: { secret_key: '${MYPVIT_RAW}' }`,
        data: { arguments: ['Received secret refresh webhook:', { secret_key: MYPVIT_RAW, provider: 'mypvit' }] },
      },
      { category: 'http', data: { url: 'https://api.test', Authorization: `Bearer ${LIVE}` } },
    ],
    extra: { body: { new_secret_key: MYPVIT_RAW } },
  };
}

function expectClean(event: unknown) {
  const text = JSON.stringify(event);
  for (const s of [LIVE, MYPVIT_RAW, BASIC, 'sess-cookie-value', 'qk123', '+cd/ef==']) {
    expect(text).not.toContain(s);
  }
}

describe('B1: Sentry beforeSend scrubs request bodies, credentials and secrets', () => {
  it('drops request.data and cookies, redacts sensitive headers, message, exception values and breadcrumbs', () => {
    const out = sentryBeforeSend(secretRefreshEvent(), { originalException: new Error('x') }) as any;

    expect(out.request.data).toBeUndefined();
    expect(out.request.cookies).toBeUndefined();
    expect(out.request.headers).toEqual({
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      'x-secret': '[REDACTED]',
      'x-api-key': '[REDACTED]',
      'content-type': 'application/json',
    });
    expect(out.message).toBe('failed with Bearer REDACTED and sk_live_REDACTED');
    expect(out.exception.values[0].value).toBe('Could not store {"secret_key":"[REDACTED]"} sk_live_REDACTED');
    expect(out.breadcrumbs[0].message).toBe("Received secret refresh webhook: { secret_key: '[REDACTED]' }");
    expect(out.breadcrumbs[0].data.arguments[1]).toEqual({ secret_key: '[REDACTED]', provider: 'mypvit' });
    expect(out.request.method).toBe('POST');
    expectClean(out);
  });

  it('beforeSendTransaction scrubs the same fields and span data', () => {
    const tx = { ...secretRefreshEvent(), type: 'transaction', spans: [{ description: `GET /x?token=abc123`, data: { 'http.request.header.authorization': `Bearer ${LIVE}` } }] };
    const out = sentryBeforeSendTransaction(tx) as any;
    expect(out.request.data).toBeUndefined();
    expect(out.spans[0].description).toBe('GET /x?token=[REDACTED]');
    expectClean(out);
  });

  it('still drops expected-unavailable noise', () => {
    expect(
      sentryBeforeSend(secretRefreshEvent(), { originalException: new Error('Temporarily unable to reach the data service') })
    ).toBeNull();
  });

  it('initSentry wires both hooks and turns off request body/cookie capture', () => {
    const prev = process.env.SENTRY_DSN;
    process.env.SENTRY_DSN = 'https://public@o0.ingest.sentry.io/1';
    try {
      initSentry();
    } finally {
      process.env.SENTRY_DSN = prev;
    }
    const opts = sentryInit.mock.calls[0][0];
    expect(opts.beforeSend).toBe(sentryBeforeSend);
    expect(opts.beforeSendTransaction).toBe(sentryBeforeSendTransaction);
    const rd = opts.integrations.find((i: any) => i.name === 'RequestData');
    expect(rd).toBeDefined();
    // The integration only attaches what `include` allows: body and cookies are off.
    const event: any = {};
    rd.processEvent(event, {}, { getOptions: () => ({}) } as any);
    // Behavioural check of the include config via a normalized request on the event.
    const withReq: any = {
      sdkProcessingMetadata: {
        normalizedRequest: { method: 'POST', url: 'http://x/y', data: '{"secret_key":"s"}', cookies: { a: 'b' }, headers: {} },
      },
    };
    const processed = rd.processEvent(withReq, {}, { getOptions: () => ({}) } as any);
    expect(processed.request?.data).toBeUndefined();
    expect(processed.request?.cookies).toBeUndefined();
    expect(processed.request?.method).toBe('POST');
  });

  it('redactDeep handles nesting, arrays and depth limits without throwing', () => {
    expect(redactDeep({ a: [{ password: 'p', ok: `x ${LIVE}` }] })).toEqual({ a: [{ password: '[REDACTED]', ok: 'x sk_live_REDACTED' }] });
    expect(scrubSentryEvent(null)).toBeNull();
  });
});
