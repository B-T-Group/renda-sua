import { HttpException } from '@nestjs/common';
import {
  DIASPORA_ERROR_CODES,
  assertDiasporaPaymentTiming,
  normalizeCountryCode,
  normalizeRecipientPhone,
  resolveOrderPayer,
  resolveOrderRecipient,
  trustedPayerCountry,
} from './diaspora-order.util';

describe('normalizeCountryCode', () => {
  it('uppercases two-letter codes', () => {
    expect(normalizeCountryCode('ca')).toBe('CA');
    expect(normalizeCountryCode(' ga ')).toBe('GA');
  });

  it('rejects anything that is not alpha-2', () => {
    expect(normalizeCountryCode('Canada')).toBeNull();
    expect(normalizeCountryCode('')).toBeNull();
    expect(normalizeCountryCode(undefined)).toBeNull();
    expect(normalizeCountryCode(null)).toBeNull();
  });
});

describe('normalizeRecipientPhone', () => {
  it('normalizes a local Gabonese number using the delivery country', () => {
    expect(normalizeRecipientPhone('077123456', 'GA')).toBe('+24177123456');
  });

  it('keeps an already international number', () => {
    expect(normalizeRecipientPhone('+237677123456', 'CM')).toBe(
      '+237677123456'
    );
  });

  it('returns null for a number that is invalid in the delivery country', () => {
    expect(normalizeRecipientPhone('12', 'GA')).toBeNull();
  });
});

describe('resolveOrderRecipient', () => {
  it('leaves recipient columns empty when the shopper buys for themselves', () => {
    const actual = resolveOrderRecipient({ fulfillmentCountry: 'GA' });

    expect(actual).toEqual({
      recipient_name: null,
      recipient_phone: null,
      recipient_email: null,
      recipient_notify_whatsapp: false,
      is_third_party_recipient: false,
    });
  });

  it('stores a normalized third-party recipient', () => {
    const actual = resolveOrderRecipient({
      sendingToSomeoneElse: true,
      fulfillmentCountry: 'GA',
      recipient: {
        name: '  Awa Ndong ',
        phone: '077123456',
        email: 'awa@example.com',
        notify_whatsapp: true,
      },
    });

    expect(actual).toEqual({
      recipient_name: 'Awa Ndong',
      recipient_phone: '+24177123456',
      recipient_email: 'awa@example.com',
      recipient_notify_whatsapp: true,
      is_third_party_recipient: true,
    });
  });

  it('treats partial recipient details as an intent to send to someone else', () => {
    expect(() =>
      resolveOrderRecipient({
        fulfillmentCountry: 'GA',
        recipient: { name: 'Awa Ndong' },
      })
    ).toThrow(HttpException);
  });

  it('rejects a missing recipient phone with a stable error code', () => {
    expect.assertions(1);
    try {
      resolveOrderRecipient({
        sendingToSomeoneElse: true,
        fulfillmentCountry: 'GA',
        recipient: { name: 'Awa Ndong', phone: '   ' },
      });
    } catch (error: any) {
      expect(error.getResponse().error).toBe(
        DIASPORA_ERROR_CODES.recipientContactRequired
      );
    }
  });

  it('rejects a recipient phone that is invalid for the delivery country', () => {
    expect.assertions(1);
    try {
      resolveOrderRecipient({
        sendingToSomeoneElse: true,
        fulfillmentCountry: 'GA',
        recipient: { name: 'Awa Ndong', phone: '123' },
      });
    } catch (error: any) {
      expect(error.getResponse().error).toBe(
        DIASPORA_ERROR_CODES.recipientPhoneInvalid
      );
    }
  });
});

describe('trustedPayerCountry', () => {
  it('refuses a local spoof when the profile is already diaspora', () => {
    expect(
      trustedPayerCountry({
        profileCountry: 'CA',
        requestedCountry: 'GA',
        profileIsDiaspora: true,
        requestedIsDiaspora: false,
      })
    ).toBe('CA');
  });

  it('lets a traveller upgrade from a local profile to a card-billing country', () => {
    expect(
      trustedPayerCountry({
        profileCountry: 'GA',
        requestedCountry: 'CA',
        profileIsDiaspora: false,
        requestedIsDiaspora: true,
      })
    ).toBe('CA');
  });

  it('keeps an honest diaspora request and falls back to the profile', () => {
    expect(
      trustedPayerCountry({
        profileCountry: 'CA',
        requestedCountry: 'CA',
        profileIsDiaspora: true,
        requestedIsDiaspora: true,
      })
    ).toBe('CA');
    expect(
      trustedPayerCountry({
        profileCountry: 'GA',
        requestedCountry: null,
        profileIsDiaspora: false,
        requestedIsDiaspora: false,
      })
    ).toBe('GA');
  });
});

describe('resolveOrderPayer', () => {
  const user = {
    first_name: 'Marie',
    last_name: 'Obame',
    email: 'marie@example.com',
    phone_number: '+15145550000',
    country: 'GA',
  };

  it('snapshots the payer identity', () => {
    expect(resolveOrderPayer({ user, requestedPayerCountry: 'CA' })).toEqual({
      payer_name: 'Marie Obame',
      payer_phone: '+15145550000',
      payer_email: 'marie@example.com',
      payer_country: 'CA',
    });
  });

  it('falls back to the profile country when no billing country is supplied', () => {
    expect(resolveOrderPayer({ user }).payer_country).toBe('GA');
  });

  it('tolerates a user with no name or contact details', () => {
    expect(resolveOrderPayer({ user: {} })).toEqual({
      payer_name: null,
      payer_phone: null,
      payer_email: null,
      payer_country: null,
    });
  });
});

describe('assertDiasporaPaymentTiming', () => {
  it('allows pay_now for a diaspora order', () => {
    expect(() =>
      assertDiasporaPaymentTiming({ isDiaspora: true, paymentTiming: 'pay_now' })
    ).not.toThrow();
  });

  it('leaves local deferred payments untouched', () => {
    expect(() =>
      assertDiasporaPaymentTiming({
        isDiaspora: false,
        paymentTiming: 'pay_at_delivery',
      })
    ).not.toThrow();
  });

  it.each(['pay_at_delivery', 'pay_at_pickup'])(
    'rejects %s for a payer abroad',
    (timing) => {
      expect.assertions(1);
      try {
        assertDiasporaPaymentTiming({
          isDiaspora: true,
          paymentTiming: timing,
        });
      } catch (error: any) {
        expect(error.getResponse().error).toBe(
          DIASPORA_ERROR_CODES.requiresPayNow
        );
      }
    }
  );
});
