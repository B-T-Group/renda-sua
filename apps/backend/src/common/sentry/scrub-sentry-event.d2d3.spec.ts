/**
 * QA #589 D2: contexts, tags, transaction and user were not scrubbed; transaction events
 * carry the server span's http.url / url.full (with the query) in contexts.trace.data.
 * QA #589 D3: a null entry or a throwing getter made the scrub throw; the hooks must fail
 * closed (drop the event) instead of letting the SDK send a pipeline-error event.
 */
import { scrubAll, sentryBeforeSend, sentryBeforeSendTransaction } from '../../instrument';
import { redactDeep, redactSentryString, scrubSentryEvent } from './scrub-sentry-event';
import { inspect } from 'util';

const FEED_TOKEN = 'feedtok9a8b7c6d5e4f';
const OAUTH_CODE = 'oauthcode1q2w3e4r';
const LIVE = ['sk', 'live', '0b9d2f3e-4c1a-4e6b-9f7a-1234567890ab'].join('_');

function transactionEvent(): any {
  return {
    type: 'transaction',
    transaction: `GET /api/facebook-catalog-feed?token=${FEED_TOKEN}`,
    contexts: {
      trace: {
        data: {
          'http.url': `https://api.rendasua.com/api/facebook-catalog-feed?token=${FEED_TOKEN}`,
          'url.full': `https://api.rendasua.com/api/commerce-integrations/callback?code=${OAUTH_CODE}&state=st1`,
          'http.target': `/api/facebook-catalog-feed?token=${FEED_TOKEN}`,
          'http.query': `token=${FEED_TOKEN}`,
        },
      },
      response: { body: `{"secret":"${LIVE}"}` },
    },
    tags: { path: `/x?token=${FEED_TOKEN}`, note: `key ${LIVE}` },
    user: { id: 'u1', ip_address: '1.2.3.4', email: 'a@b.c', token: FEED_TOKEN },
  };
}

describe('D2: contexts, tags, transaction and user are scrubbed', () => {
  it('beforeSendTransaction removes tokens from trace data, tags, transaction and user', () => {
    const out = sentryBeforeSendTransaction(transactionEvent());
    const dump = inspect(out, { depth: 10 });
    expect(dump).not.toContain(FEED_TOKEN);
    expect(dump).not.toContain(OAUTH_CODE);
    expect(dump).not.toContain(LIVE);
    expect((out as any).contexts.trace.data['http.url']).toBe(
      'https://api.rendasua.com/api/facebook-catalog-feed?token=[REDACTED]'
    );
    expect((out as any).transaction).toBe('GET /api/facebook-catalog-feed?token=[REDACTED]');
    expect((out as any).user.id).toBe('u1');
  });

  it('beforeSend scrubs the same fields on error events', () => {
    const out = sentryBeforeSend({ ...transactionEvent(), type: undefined }, { originalException: new Error('x') });
    expect(inspect(out, { depth: 10 })).not.toContain(FEED_TOKEN);
  });

  it('query redaction only touches ?/& parameters', () => {
    expect(redactSentryString('/cb?code=abc&state=def&page=2')).toBe('/cb?code=[REDACTED]&state=[REDACTED]&page=2');
    expect(redactSentryString('error code: 500')).toBe('error code: 500');
  });
});

describe('D3: null-safe scrub, fail-closed hooks', () => {
  it('null / primitive entries in exception values, spans and breadcrumbs do not throw', () => {
    const event: any = {
      exception: { values: [null, 'str', { value: `boom ${LIVE}` }] },
      spans: [null, 5, { description: `GET /x?token=${FEED_TOKEN}` }],
      breadcrumbs: [null, { message: `m ${LIVE}` }],
      request: null,
      logentry: null,
      contexts: null,
    };
    const out: any = scrubSentryEvent(event);
    expect(out.exception.values[2].value).not.toContain(LIVE);
    expect(out.spans).toHaveLength(1);
    expect(out.spans[0].description).not.toContain(FEED_TOKEN);
    expect(out.breadcrumbs).toHaveLength(1);
  });

  it('throwing getters on headers and nested data become placeholders', () => {
    const headers: any = { 'content-type': 'json' };
    Object.defineProperty(headers, 'x-weird', { enumerable: true, get: () => { throw new Error('nope'); } });
    const extra: any = {};
    Object.defineProperty(extra, 'bad', { enumerable: true, get: () => { throw new Error('nope'); } });
    const out: any = scrubSentryEvent({ request: { headers }, extra });
    expect(out.request.headers['content-type']).toBe('json');
    expect(out.request.headers['x-weird']).toBe('[Unreadable]');
    expect(out.extra.bad).toBe('[Unreadable]');
    expect(redactDeep(extra)).toEqual({ bad: '[Unreadable]' });
  });

  it('if scrubbing throws anyway, the hooks drop the event (return null)', () => {
    const poisoned: any = {};
    Object.defineProperty(poisoned, 'request', { enumerable: true, get: () => { throw new Error('hostile'); } });
    expect(scrubAll(poisoned)).toBeNull();
    expect(sentryBeforeSend(poisoned, { originalException: new Error('x') })).toBeNull();
    expect(sentryBeforeSendTransaction(poisoned)).toBeNull();
  });
});

describe('request headers with harmless names are still value-scrubbed', () => {
  it('a secret inside a non-sensitive header value is redacted; plain values kept', () => {
    const out: any = scrubSentryEvent({
      request: {
        headers: {
          referer: `https://app.rendasua.com/cb?token=${FEED_TOKEN}`,
          'x-debug': `Bearer ${LIVE}`,
          'user-agent': 'Python Requests 2.34',
        },
      },
    } as any);
    const dump = inspect(out, { depth: 10 });
    expect(dump).not.toContain(FEED_TOKEN);
    expect(dump).not.toContain(LIVE);
    expect(out.request.headers['user-agent']).toBe('Python Requests 2.34');
  });
});
