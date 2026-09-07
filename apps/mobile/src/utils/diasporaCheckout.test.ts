import { describe, it, expect } from 'vitest';
import {
  isCrossBorder,
  validateRecipientContact,
  formatPayerChargeEstimate,
  requiresRecipientContact,
  isRecipientDraftIncomplete,
  buildRecipientPayload,
  requiresStripePayNow,
  needsRecipientDeliveryAddress,
  addressesInCountry,
  dropOffAddressesForFulfillment,
  usableDeliveryAddressId,
} from './diasporaCheckout';
import type { CheckoutDiaspora } from '../types/checkout';
import type { RecipientContact } from '../types/clientOrder';

describe('diasporaCheckout', () => {
  describe('isCrossBorder', () => {
    it('returns false when diaspora is null or undefined', () => {
      expect(isCrossBorder(null)).toBe(false);
      expect(isCrossBorder(undefined)).toBe(false);
    });

    it('returns false when is_diaspora is false', () => {
      const diaspora: CheckoutDiaspora = {
        is_diaspora: false,
        payer_country: 'CA',
        fulfillment_country: 'GA',
      };
      expect(isCrossBorder(diaspora)).toBe(false);
    });

    it('returns true when payer and fulfillment countries differ', () => {
      const diaspora: CheckoutDiaspora = {
        is_diaspora: true,
        payer_country: 'CA',
        fulfillment_country: 'GA',
      };
      expect(isCrossBorder(diaspora)).toBe(true);
    });

    it('returns false when payer and fulfillment countries are the same', () => {
      const diaspora: CheckoutDiaspora = {
        is_diaspora: true,
        payer_country: 'GA',
        fulfillment_country: 'GA',
      };
      expect(isCrossBorder(diaspora)).toBe(false);
    });

    it('handles case-insensitive country codes', () => {
      const diaspora: CheckoutDiaspora = {
        is_diaspora: true,
        payer_country: 'ca',
        fulfillment_country: 'GA',
      };
      expect(isCrossBorder(diaspora)).toBe(true);
    });
  });

  describe('validateRecipientContact', () => {
    it('returns missing_name when recipient is null or undefined', () => {
      expect(validateRecipientContact(null)).toBe('missing_name');
      expect(validateRecipientContact(undefined)).toBe('missing_name');
    });

    it('returns missing_name when name is empty or whitespace', () => {
      expect(validateRecipientContact({ name: '', phone: '+237123456789' })).toBe('missing_name');
      expect(validateRecipientContact({ name: '   ', phone: '+237123456789' })).toBe('missing_name');
    });

    it('returns missing_phone when phone is empty or whitespace', () => {
      expect(validateRecipientContact({ name: 'John Doe', phone: '' })).toBe('missing_phone');
      expect(validateRecipientContact({ name: 'John Doe', phone: '   ' })).toBe('missing_phone');
    });

    it('returns null when both name and phone are valid', () => {
      const recipient: RecipientContact = {
        name: 'John Doe',
        phone: '+237123456789',
        notify_whatsapp: true,
      };
      expect(validateRecipientContact(recipient)).toBe(null);
    });
  });

  describe('formatPayerChargeEstimate', () => {
    it('returns null when diaspora is null or undefined', () => {
      expect(formatPayerChargeEstimate(null)).toBe(null);
      expect(formatPayerChargeEstimate(undefined)).toBe(null);
    });

    it('returns null when payer_charge_estimate is missing', () => {
      const diaspora: CheckoutDiaspora = {
        is_diaspora: true,
        payer_country: 'CA',
        fulfillment_country: 'GA',
      };
      expect(formatPayerChargeEstimate(diaspora)).toBe(null);
    });

    it('formats CAD estimate correctly', () => {
      const diaspora: CheckoutDiaspora = {
        is_diaspora: true,
        payer_country: 'CA',
        fulfillment_country: 'GA',
        payer_charge_estimate: {
          amount: 125.50,
          currency: 'CAD',
          exchange_rate: 0.0019,
        },
      };
      const formatted = formatPayerChargeEstimate(diaspora, 'en-CA');
      // Check that it formats the amount correctly (currency symbol placement varies by locale)
      expect(formatted).toContain('125.50');
      expect(formatted).toBeTruthy();
    });

    it('formats USD estimate correctly', () => {
      const diaspora: CheckoutDiaspora = {
        is_diaspora: true,
        payer_country: 'US',
        fulfillment_country: 'CM',
        payer_charge_estimate: {
          amount: 100.00,
          currency: 'USD',
          exchange_rate: 0.0017,
        },
      };
      const formatted = formatPayerChargeEstimate(diaspora, 'en-US');
      expect(formatted).toContain('100.00');
      expect(formatted).toContain('$');
    });
  });

  describe('requiresRecipientContact', () => {
    it('returns false when diaspora is null or undefined', () => {
      expect(requiresRecipientContact(null)).toBe(false);
      expect(requiresRecipientContact(undefined)).toBe(false);
    });

    it('returns true when requires_recipient_contact is true', () => {
      const diaspora: CheckoutDiaspora = {
        is_diaspora: true,
        payer_country: 'CA',
        fulfillment_country: 'GA',
        requires_recipient_contact: true,
      };
      expect(requiresRecipientContact(diaspora)).toBe(true);
    });

    it('returns false when requires_recipient_contact is false', () => {
      const diaspora: CheckoutDiaspora = {
        is_diaspora: true,
        payer_country: 'CA',
        fulfillment_country: 'GA',
        requires_recipient_contact: false,
      };
      expect(requiresRecipientContact(diaspora)).toBe(false);
    });
  });

  describe('isRecipientDraftIncomplete', () => {
    it('returns false when someone else is not receiving', () => {
      expect(isRecipientDraftIncomplete(false, { name: '', phone: '' })).toBe(false);
    });

    it('returns true when someone else is receiving and recipient is empty', () => {
      expect(isRecipientDraftIncomplete(true, { name: '', phone: '' })).toBe(true);
      expect(isRecipientDraftIncomplete(true, null)).toBe(true);
    });

    it('returns false when someone else is receiving and recipient is complete', () => {
      expect(
        isRecipientDraftIncomplete(true, {
          name: 'Amina',
          phone: '+241077123456',
        })
      ).toBe(false);
    });
  });

  describe('buildRecipientPayload', () => {
    it('returns undefined when someoneElse is false', () => {
      const recipient: RecipientContact = {
        name: 'John Doe',
        phone: '+237123456789',
        notify_whatsapp: true,
      };
      expect(buildRecipientPayload(false, recipient)).toBeUndefined();
    });

    it('returns undefined when recipient is null or invalid', () => {
      expect(buildRecipientPayload(true, null)).toBeUndefined();
      expect(buildRecipientPayload(true, { name: '', phone: '+237123456789' })).toBeUndefined();
      expect(buildRecipientPayload(true, { name: 'John Doe', phone: '' })).toBeUndefined();
    });

    it('returns a valid recipient payload when someoneElse is true and recipient is valid', () => {
      const recipient: RecipientContact = {
        name: 'John Doe',
        phone: '+237123456789',
        notify_whatsapp: true,
      };
      const payload = buildRecipientPayload(true, recipient);
      expect(payload).toEqual({
        name: 'John Doe',
        phone: '+237123456789',
        notify_whatsapp: true,
      });
    });

    it('defaults notify_whatsapp to false when not provided', () => {
      const recipient = {
        name: 'Jane Doe',
        phone: '+241123456789',
      };
      const payload = buildRecipientPayload(true, recipient);
      expect(payload).toEqual({
        name: 'Jane Doe',
        phone: '+241123456789',
        notify_whatsapp: false,
      });
    });
  });

  describe('requiresStripePayNow', () => {
    it('returns false when diaspora is null or undefined', () => {
      expect(requiresStripePayNow(null)).toBe(false);
      expect(requiresStripePayNow(undefined)).toBe(false);
    });

    it('returns true when is_diaspora is true', () => {
      const diaspora: CheckoutDiaspora = {
        is_diaspora: true,
        payer_country: 'CA',
        fulfillment_country: 'GA',
      };
      expect(requiresStripePayNow(diaspora)).toBe(true);
    });

    it('returns false when is_diaspora is false', () => {
      const diaspora: CheckoutDiaspora = {
        is_diaspora: false,
        payer_country: 'GA',
        fulfillment_country: 'GA',
      };
      expect(requiresStripePayNow(diaspora)).toBe(false);
    });
  });

  describe('needsRecipientDeliveryAddress', () => {
    it('is true only when someone else is receiving and drop-off is needed', () => {
      expect(needsRecipientDeliveryAddress(true, true)).toBe(true);
      expect(needsRecipientDeliveryAddress(true, false)).toBe(false);
      expect(needsRecipientDeliveryAddress(false, true)).toBe(false);
    });
  });

  describe('addressesInCountry', () => {
    const addresses = [
      { id: 'ca', country: 'CA' },
      { id: 'cm', country: 'cm' },
      { id: 'ga', country: 'GA' },
    ];

    it('filters to the fulfillment country, ignoring case', () => {
      expect(addressesInCountry(addresses, 'CM').map((a) => a.id)).toEqual(['cm']);
    });

    it('returns all addresses when no country is given', () => {
      expect(addressesInCountry(addresses, '')).toHaveLength(3);
      expect(addressesInCountry(addresses, undefined)).toHaveLength(3);
    });
  });

  describe('dropOffAddressesForFulfillment', () => {
    const addresses = [
      { id: 'ca', country: 'CA' },
      { id: 'cm', country: 'CM' },
    ];

    it('hides the payer country book when drop-off is in another country', () => {
      expect(dropOffAddressesForFulfillment(addresses, 'CM', true).map((a) => a.id)).toEqual([
        'cm',
      ]);
    });

    it('returns no addresses until the destination country is known', () => {
      expect(dropOffAddressesForFulfillment(addresses, '', true)).toEqual([]);
    });

    it('returns all addresses when drop-off is not needed', () => {
      expect(dropOffAddressesForFulfillment(addresses, 'CM', false)).toHaveLength(2);
    });
  });

  describe('usableDeliveryAddressId', () => {
    it('rejects an address that is not in the drop-off list', () => {
      expect(usableDeliveryAddressId('ca', [{ id: 'cm' }])).toBe('');
      expect(usableDeliveryAddressId('cm', [{ id: 'cm' }])).toBe('cm');
    });
  });
});
