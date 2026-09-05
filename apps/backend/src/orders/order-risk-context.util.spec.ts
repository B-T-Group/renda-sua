import {
  amountLabel,
  clientFullName,
  mapOrderRiskContext,
  merchantPhone,
  minutesUntil,
  shopCountryCode,
} from './order-risk-context.util';

describe('shopCountryCode', () => {
  it('prefers the shop location country over the delivery address', () => {
    expect(
      shopCountryCode({
        business_location: { address: { country: 'cm' } },
        delivery_address: { country: 'GA' },
      })
    ).toBe('CM');
  });

  it('falls back to the delivery address when the shop country is missing', () => {
    expect(
      shopCountryCode({
        business_location: { address: { country: '' } },
        delivery_address: { country: ' ga ' },
      })
    ).toBe('GA');
    expect(
      shopCountryCode({
        business_location: { address: { country: null } },
        delivery_address: { country: null },
      })
    ).toBeNull();
  });
});

describe('merchantPhone', () => {
  it('uses the location line and falls back to the owner mobile', () => {
    expect(
      merchantPhone({
        business_location: { phone: '+237600000000' },
        business: { user: { phone_number: '+237611111111' } },
      })
    ).toBe('+237600000000');
    expect(
      merchantPhone({
        business_location: { phone: '' },
        business: { user: { phone_number: '+237611111111' } },
      })
    ).toBe('+237611111111');
  });
});

describe('amountLabel', () => {
  it('rounds the amount and keeps the currency', () => {
    expect(amountLabel(12500.7, 'XAF')).toBe('12501 XAF');
    expect(amountLabel(null, 'XAF')).toBeNull();
    expect(amountLabel(1000, null)).toBe('1000');
  });
});

describe('minutesUntil', () => {
  const nowMs = Date.parse('2026-08-31T12:00:00.000Z');

  it('returns null when the deadline is missing, invalid, or already past', () => {
    expect(minutesUntil(null, nowMs)).toBeNull();
    expect(minutesUntil('not-a-date', nowMs)).toBeNull();
    expect(minutesUntil('2026-08-31T11:59:00.000Z', nowMs)).toBeNull();
  });

  it('never reports zero minutes while any time remains', () => {
    expect(minutesUntil('2026-08-31T12:00:30.000Z', nowMs)).toBe(1);
    expect(minutesUntil('2026-08-31T12:45:00.000Z', nowMs)).toBe(45);
  });
});

describe('mapOrderRiskContext', () => {
  const nowMs = Date.parse('2026-08-31T12:00:00.000Z');

  it('maps operator action facts including country and referring agent', () => {
    expect(
      mapOrderRiskContext(
        {
          total_amount: 2500,
          currency: 'XAF',
          grace_deadline_at: '2026-08-31T12:15:00.000Z',
          client: { user: { first_name: 'Ada', last_name: 'Lovelace' } },
          business: {
            name: 'Ada Mart',
            user: { phone_number: '+237611111111' },
            referring_agent: { user_id: 'agent-1' },
          },
          business_location: {
            name: 'Bastos',
            phone: '+237600000000',
            address: { country: 'CM' },
          },
          delivery_address: { country: 'GA' },
        },
        nowMs
      )
    ).toEqual({
      businessName: 'Ada Mart',
      locationName: 'Bastos',
      merchantPhone: '+237600000000',
      clientName: 'Ada Lovelace',
      amountLabel: '2500 XAF',
      minutesUntilAutoDecline: 15,
      referringAgentUserId: 'agent-1',
      shopCountryCode: 'CM',
    });
  });

  it('returns null names when the client has no first or last name', () => {
    expect(clientFullName({ first_name: '  ', last_name: null })).toBeNull();
  });
});
