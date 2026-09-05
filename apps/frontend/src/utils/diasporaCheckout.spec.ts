import {
  EMPTY_RECIPIENT_DRAFT,
  buildRecipientPayload,
  displayCountry,
  formatPayerChargeEstimate,
  isCrossBorderCheckout,
  isRecipientDraftIncomplete,
  type CheckoutDiaspora,
} from './diasporaCheckout';

function diaspora(overrides: Partial<CheckoutDiaspora> = {}): CheckoutDiaspora {
  return {
    is_diaspora: false,
    payer_country: 'CA',
    fulfillment_country: 'GA',
    rail_source: 'seller',
    payer_charge_estimate: null,
    requires_recipient_contact: false,
    ...overrides,
  };
}

describe('isCrossBorderCheckout', () => {
  it('is true when the backend routed the order as diaspora', () => {
    expect(
      isCrossBorderCheckout(
        diaspora({ is_diaspora: true, rail_source: 'payer' })
      )
    ).toBe(true);
  });

  it('is true when the payer and delivery countries differ', () => {
    expect(isCrossBorderCheckout(diaspora())).toBe(true);
  });

  it('is false for a local order', () => {
    expect(
      isCrossBorderCheckout(
        diaspora({ payer_country: 'GA', fulfillment_country: 'GA' })
      )
    ).toBe(false);
  });

  it('is false when preflight returned no diaspora context', () => {
    expect(isCrossBorderCheckout(null)).toBe(false);
    expect(isCrossBorderCheckout(undefined)).toBe(false);
  });

  it('is false when either country is unknown', () => {
    expect(
      isCrossBorderCheckout(diaspora({ fulfillment_country: null }))
    ).toBe(false);
  });
});

describe('isRecipientDraftIncomplete', () => {
  it('is false when the shopper is buying for themselves', () => {
    expect(
      isRecipientDraftIncomplete({
        sendingToSomeoneElse: false,
        recipient: EMPTY_RECIPIENT_DRAFT,
      })
    ).toBe(false);
  });

  it('is true while the recipient name or phone is blank', () => {
    expect(
      isRecipientDraftIncomplete({
        sendingToSomeoneElse: true,
        recipient: { name: '  ', phone: '+24177123456', notifyWhatsapp: false },
      })
    ).toBe(true);
    expect(
      isRecipientDraftIncomplete({
        sendingToSomeoneElse: true,
        recipient: { name: 'Awa Ndong', phone: '', notifyWhatsapp: false },
      })
    ).toBe(true);
  });

  it('is false once both fields are filled', () => {
    expect(
      isRecipientDraftIncomplete({
        sendingToSomeoneElse: true,
        recipient: {
          name: 'Awa Ndong',
          phone: '+24177123456',
          notifyWhatsapp: false,
        },
      })
    ).toBe(false);
  });
});

describe('buildRecipientPayload', () => {
  it('returns undefined when self-ordering', () => {
    expect(
      buildRecipientPayload({
        sendingToSomeoneElse: false,
        recipient: {
          name: 'Awa Ndong',
          phone: '+24177123456',
          notifyWhatsapp: true,
        },
      })
    ).toBeUndefined();
  });

  it('returns undefined while the draft is incomplete', () => {
    expect(
      buildRecipientPayload({
        sendingToSomeoneElse: true,
        recipient: { name: 'Awa Ndong', phone: ' ', notifyWhatsapp: false },
      })
    ).toBeUndefined();
  });

  it('trims and maps the draft onto the API shape', () => {
    expect(
      buildRecipientPayload({
        sendingToSomeoneElse: true,
        recipient: {
          name: ' Awa Ndong ',
          phone: ' +24177123456 ',
          notifyWhatsapp: true,
        },
      })
    ).toEqual({
      name: 'Awa Ndong',
      phone: '+24177123456',
      notify_whatsapp: true,
    });
  });
});

describe('formatPayerChargeEstimate', () => {
  it('formats the payer amount in their currency', () => {
    const actual = formatPayerChargeEstimate(
      { currency: 'CAD', amount: 32.48, rate: 0.00224, source: 'x' },
      'en-CA'
    );

    expect(actual).toContain('32.48');
  });

  it('returns null when there is no estimate to show', () => {
    expect(formatPayerChargeEstimate(null)).toBeNull();
    expect(
      formatPayerChargeEstimate({
        currency: 'CAD',
        amount: 0,
        rate: 0,
        source: 'x',
      })
    ).toBeNull();
  });

  it('still renders an amount for an unrecognized currency code', () => {
    const actual = formatPayerChargeEstimate({
      currency: 'ZZZ',
      amount: 10,
      rate: 1,
      source: 'x',
    });

    expect(actual).toContain('10.00');
    expect(actual).toContain('ZZZ');
  });
});

describe('displayCountry', () => {
  it('uppercases a valid alpha-2 code', () => {
    expect(displayCountry('ga')).toBe('GA');
  });

  it('falls back to a dash for anything else', () => {
    expect(displayCountry('Canada')).toBe('—');
    expect(displayCountry(null)).toBe('—');
  });
});
