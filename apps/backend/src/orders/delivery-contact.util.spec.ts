import {
  resolveDeliveryContact,
  withDeliveryContact,
  withDeliveryContactForFulfiller,
} from './delivery-contact.util';

const payerOnlyOrder = {
  client: {
    user: {
      first_name: 'Marie',
      last_name: 'Obame',
      phone_number: '+15145550000',
      email: 'marie@example.com',
    },
  },
};

const thirdPartyOrder = {
  ...payerOnlyOrder,
  is_third_party_recipient: true,
  recipient_name: 'Awa Ndong',
  recipient_phone: '+24177123456',
};

describe('resolveDeliveryContact', () => {
  it('returns the paying client when they receive the order themselves', () => {
    expect(resolveDeliveryContact(payerOnlyOrder)).toEqual({
      name: 'Marie Obame',
      phone: '+15145550000',
      is_recipient: false,
    });
  });

  it('returns the local recipient for a third-party order', () => {
    expect(resolveDeliveryContact(thirdPartyOrder)).toEqual({
      name: 'Awa Ndong',
      phone: '+24177123456',
      is_recipient: true,
    });
  });

  it('falls back to the payer when the recipient flag has no contact behind it', () => {
    expect(
      resolveDeliveryContact({
        ...payerOnlyOrder,
        is_third_party_recipient: true,
        recipient_name: 'Awa Ndong',
        recipient_phone: null,
      })
    ).toEqual({
      name: 'Marie Obame',
      phone: '+15145550000',
      is_recipient: false,
    });
  });
});

describe('withDeliveryContactForFulfiller', () => {
  it('hides the payer phone and email from agents on a third-party order', () => {
    const actual = withDeliveryContactForFulfiller(thirdPartyOrder);

    expect(actual.delivery_contact).toEqual({
      name: 'Awa Ndong',
      phone: '+24177123456',
      is_recipient: true,
    });
    expect(actual.client?.user?.phone_number).toBeNull();
    expect(actual.client?.user?.email).toBeNull();
    expect(actual.client?.user?.first_name).toBe('Marie');
  });

  it('leaves a self-ordered client fully visible', () => {
    const actual = withDeliveryContactForFulfiller(payerOnlyOrder);

    expect(actual.client?.user?.phone_number).toBe('+15145550000');
    expect(actual.delivery_contact.is_recipient).toBe(false);
  });

  it('does not mutate the order it was given', () => {
    withDeliveryContactForFulfiller(thirdPartyOrder);

    expect(thirdPartyOrder.client.user.phone_number).toBe('+15145550000');
  });
});

describe('withDeliveryContact', () => {
  it('attaches the contact without redacting the payer', () => {
    const actual = withDeliveryContact(thirdPartyOrder);

    expect(actual.delivery_contact.is_recipient).toBe(true);
    expect(actual.client?.user?.phone_number).toBe('+15145550000');
  });
});
