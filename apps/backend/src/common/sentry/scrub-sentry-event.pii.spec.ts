/**
 * #588 QA S1: the FedaPay 500 now carries a `cause`, and Sentry's LinkedErrors integration
 * sends every level of the cause chain as its own exception value. Phones and emails in any
 * level (Hasura unique-violation text, provider bodies) must not reach Sentry.
 */
import { HttpException, HttpStatus } from '@nestjs/common';
import { inspect } from 'util';
import { sentryBeforeSend } from '../../instrument';
import {
  REDACTED_EMAIL,
  REDACTED_PHONE,
  maskPersonalData,
  redactSentryString,
} from './scrub-sentry-event';
import { sanitizedFedaPayCause } from '../../mobile-payments/mobile-payments.controller';
import { sanitizeProviderError } from '../../mobile-payments/sanitize-provider-error.util';

const PHONE_E164 = '+22890123456';
const PHONE_E164_SPACED = '+228 90 12 34 56';
const PHONE_LOCAL = '690123456';
const EMAIL = 'kofi.mensah@example.tg';
const LIVE = ['sk', 'live', 'abc123DEF456'].join('_');
const UUID = '0b9d2f3e-4c1a-4e6b-9f7a-1234567890ab';

/** Mirrors what LinkedErrors produces: outermost last, one value per cause level. */
function eventFor(error: Error & { cause?: unknown }): any {
  const values: any[] = [];
  let current: any = error;
  while (current instanceof Error && values.length < 5) {
    values.unshift({ type: current.name, value: current.message });
    current = (current as any).cause;
  }
  return { exception: { values }, extra: { note: `retry for ${EMAIL} / ${PHONE_E164}` } };
}

describe('maskPersonalData / redactSentryString (#588 QA S1)', () => {
  it.each([
    [`Key (phone_number)=(${PHONE_E164}) already exists`, PHONE_E164],
    [`customer ${PHONE_E164_SPACED} declined`, PHONE_E164_SPACED],
    [`local ${PHONE_LOCAL} failed`, PHONE_LOCAL],
    [`{"email":"${EMAIL}"}`, EMAIL],
  ])('masks %p', (text, pii) => {
    const out = redactSentryString(text);
    expect(out).not.toContain(pii);
    expect(out).toMatch(new RegExp(`${REDACTED_PHONE.replace(/[[\]]/g, '\\$&')}|${REDACTED_EMAIL.replace(/[[\]]/g, '\\$&')}`));
  });

  it('keeps short numbers, ids and UUIDs readable', () => {
    const text = `tx 525277 status 500 order ORD-1234 id ${UUID}`;
    expect(maskPersonalData(text)).toBe(text);
  });

  it('still redacts secrets', () => {
    expect(redactSentryString(`key ${LIVE}`)).not.toContain('abc123DEF456');
  });
});

describe('2-level cause chain through sentryBeforeSend (#588 QA S1)', () => {
  it('scrubs phones, emails and secrets from every exception value even with a raw cause', () => {
    const provider = new Error(`FedaPay 422 {"customer":{"email":"${EMAIL}","phone":"${PHONE_E164}"},"key":"${LIVE}"}`);
    const hasura = Object.assign(
      new Error(`Uniqueness violation. Key (phone_number)=(${PHONE_E164_SPACED}) already exists`),
      { cause: provider }
    );
    const top = new HttpException(
      { success: false, message: 'Failed to process FedaPay callback' },
      HttpStatus.INTERNAL_SERVER_ERROR,
      { cause: hasura }
    );
    const event = eventFor(top);
    expect(event.exception.values).toHaveLength(3);

    const out: any = sentryBeforeSend(event);
    const dump = inspect(out, { depth: 10 });
    for (const pii of [EMAIL, PHONE_E164, PHONE_E164_SPACED, 'abc123DEF456']) {
      expect(dump).not.toContain(pii);
    }
    expect(out.exception.values[0].value).toContain(REDACTED_EMAIL);
    expect(out.exception.values[1].value).toContain(REDACTED_PHONE);
  });

  it('the controller attaches a sanitized, single-level cause (no raw provider text, no chain)', () => {
    const provider = new Error(`raw body {"phone":"${PHONE_E164}","email":"${EMAIL}","secret_key":"${LIVE}"}`);
    const raw = Object.assign(new Error(`Hasura: Key (phone_number)=(${PHONE_LOCAL}) exists`), {
      name: 'HasuraError',
      cause: provider,
    });
    const cause = sanitizedFedaPayCause(raw, sanitizeProviderError(raw).message);
    expect(cause).not.toBe(raw);
    expect(cause.name).toBe('HasuraError');
    expect((cause as any).cause).toBeUndefined();
    expect(cause.message).not.toContain(PHONE_LOCAL);
    expect(cause.message).toContain(REDACTED_PHONE);

    const top = new HttpException({ success: false }, 500, { cause });
    const dump = inspect(sentryBeforeSend(eventFor(top)), { depth: 10 });
    for (const pii of [EMAIL, PHONE_E164, PHONE_LOCAL, 'abc123DEF456', 'raw body']) {
      expect(dump).not.toContain(pii);
    }
  });

  it('caps the cause message and falls back to Error for an odd name', () => {
    const odd = Object.assign(new Error('x'.repeat(1000)), { name: 'bad name <script>' });
    const cause = sanitizedFedaPayCause(odd, sanitizeProviderError(odd).message);
    expect(cause.message.length).toBeLessThanOrEqual(300);
    expect(cause.name).toBe('Error');
  });
});
