import { describe, expect, it } from 'vitest';
import type { BusinessLocation } from '../types/business/locations';
import { buildLocationExpectations } from './locationExpectations';

const t = (key: string, defaultValue: string) => defaultValue;

function location(
  overrides: Partial<BusinessLocation> = {}
): BusinessLocation {
  return {
    id: 'loc-1',
    name: 'Akwa',
    address: {
      id: 'addr-1',
      address_line_1: 'Rue Joss',
      city: 'Douala',
      state: 'Littoral',
      postal_code: '',
      country: 'CM',
    },
    is_active: true,
    is_primary: false,
    location_type: 'store',
    operating_hours: {
      monday: { open: '08:00', close: '20:00' },
      tuesday: { open: '08:00', close: '20:00' },
      wednesday: { open: '08:00', close: '20:00' },
      thursday: { open: '08:00', close: '20:00' },
      friday: { open: '08:00', close: '20:00' },
      saturday: { closed: true },
      sunday: { closed: true },
    },
    auto_withdraw_commissions: true,
    pay_at_confirm: false,
    ...overrides,
  };
}

const texts = (result: ReturnType<typeof buildLocationExpectations>) =>
  result.lines.map((line) => line.text);

describe('buildLocationExpectations', () => {
  const momo = { isStripeRail: false, hasVerifiedPhone: true };

  it('describes an active location', () => {
    const result = buildLocationExpectations(location(), momo, t);
    expect(texts(result)[0]).toBe(
      'Customers can see and order from this location.'
    );
  });

  it('warns when the location is hidden', () => {
    const result = buildLocationExpectations(
      location({ is_active: false }),
      momo,
      t
    );
    expect(result.lines[0]).toMatchObject({
      tone: 'warning',
      action: 'showLocation',
    });
  });

  it('summarizes hours and all-closed', () => {
    const open = buildLocationExpectations(location(), momo, t);
    expect(texts(open).some((line) => line.includes('Mon–Fri 08:00–20:00'))).toBe(
      true
    );
    const closed = buildLocationExpectations(
      location({
        operating_hours: {
          monday: { closed: true },
          tuesday: { closed: true },
          wednesday: { closed: true },
          thursday: { closed: true },
          friday: { closed: true },
          saturday: { closed: true },
          sunday: { closed: true },
        },
      }),
      momo,
      t
    );
    expect(texts(closed)).toContain(
      "You're closed every day, so customers can't order."
    );
  });

  it('covers verified, unverified, and missing Mobile Money numbers', () => {
    const verified = buildLocationExpectations(
      location({
        mobile_payment_phone_id: 'p1',
        mobile_payment_phone: {
          id: 'p1',
          phone_e164: '+237612345678',
          is_verified: true,
        },
      }),
      momo,
      t
    );
    expect(texts(verified).some((line) => line.includes('5678'))).toBe(true);
    expect(texts(verified).some((line) => line.includes('automatically'))).toBe(
      true
    );

    const unverified = buildLocationExpectations(
      location({
        mobile_payment_phone_id: 'p1',
        mobile_payment_phone: {
          id: 'p1',
          phone_e164: '+237612345678',
          is_verified: false,
        },
      }),
      { isStripeRail: false, hasVerifiedPhone: false },
      t
    );
    expect(texts(unverified).some((line) => line.includes('verify'))).toBe(true);

    const missing = buildLocationExpectations(
      location(),
      { isStripeRail: false, hasVerifiedPhone: false },
      t
    );
    expect(texts(missing).some((line) => line.includes('add'))).toBe(true);
  });

  it('describes pay-after on and off, with the rollout footnote only when on', () => {
    const off = buildLocationExpectations(location(), momo, t);
    expect(texts(off).some((line) => line.includes('each item'))).toBe(true);
    expect(off.footnote).toBeUndefined();

    const on = buildLocationExpectations(
      location({ pay_at_confirm: true }),
      momo,
      t
    );
    expect(texts(on).some((line) => line.includes('45 minutes'))).toBe(true);
    expect(on.footnote).toMatch(/rolling this out gradually/i);
  });

  it('omits Mobile Money and pay-after lines on the Stripe rail', () => {
    const result = buildLocationExpectations(
      location({
        pay_at_confirm: true,
        mobile_payment_phone_id: 'p1',
        mobile_payment_phone: {
          id: 'p1',
          phone_e164: '+237612345678',
          is_verified: true,
        },
      }),
      { isStripeRail: true, hasVerifiedPhone: true },
      t
    );
    const joined = texts(result).join(' ');
    expect(joined).not.toMatch(/Mobile Money|45 minutes|paid out/i);
    expect(result.footnote).toBeUndefined();
  });

  it('mentions the order alert phone when set, and the owner-only fallback', () => {
    const set = buildLocationExpectations(
      location({ order_alert_phone: '+237699998888' }),
      momo,
      t
    );
    expect(texts(set).some((line) => line.includes('8888'))).toBe(true);
    const unset = buildLocationExpectations(location(), momo, t);
    expect(texts(unset).some((line) => line.includes('alert you'))).toBe(true);
  });

  it('always includes the item-level pointer', () => {
    const result = buildLocationExpectations(location(), momo, t);
    expect(result.lines[result.lines.length - 1].text).toBe(
      'Pickup, delivery and shipping are chosen on each item.'
    );
    expect(result.lines[result.lines.length - 1].action).toBe('manageItems');
  });
});
