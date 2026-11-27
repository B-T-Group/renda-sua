import { buildReservedView, isReservedWithNothingDue } from './reserveSuccess';

describe('isReservedWithNothingDue', () => {
  it('is true for a free or already-paid reservation', () => {
    expect(isReservedWithNothingDue({ reserved: true })).toBe(true);
    expect(isReservedWithNothingDue({ reserved: true, reservation_fee: { amount: 1 } })).toBe(true);
  });

  it('is false while a payment is pending or a redirect is needed', () => {
    expect(isReservedWithNothingDue({ reserved: true, paymentPending: true })).toBe(false);
    expect(isReservedWithNothingDue({ reserved: true, checkout_url: 'https://pay' })).toBe(false);
  });

  it('is false for legacy card-upfront bookings that are not reserved', () => {
    expect(isReservedWithNothingDue({ reserved: false })).toBe(false);
    expect(isReservedWithNothingDue({}, 'success')).toBe(false);
  });

  it('follows the card sheet result for a paid fee', () => {
    const fee = { reservation_fee: { amount: 1 }, paymentPending: true };
    expect(isReservedWithNothingDue(fee, 'success')).toBe(true);
    expect(isReservedWithNothingDue(fee, 'cancelled')).toBe(false);
    expect(isReservedWithNothingDue(fee, 'failed')).toBe(false);
    expect(isReservedWithNothingDue(fee, 'pending')).toBe(false);
    expect(isReservedWithNothingDue(fee, 'browser')).toBe(false);
  });
});

describe('buildReservedView', () => {
  const t = (_key: string, fallback: string, vars?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(vars?.[k] ?? ''));
  const base = {
    start_at: '2026-11-28T14:00:00Z',
    end_at: '2026-11-28T18:00:00Z',
    currency: 'CAD',
    total_amount: 60,
    security_deposit_amount: 180,
    rental_location_listing: { rental_item: { name: 'JBL PartyBox' }, business_location: { name: 'Sono Akwa', address: { country: 'CA' } } },
  };

  it('tells the renter to collect the item and what they pay at pickup', () => {
    const v = buildReservedView({ ...base, inspection_policy_version: 1 }, 'en', t);
    expect(v.when).toBe('Sat 28 Nov · 2:00–6:00 PM');
    expect(v.steps.map((s) => s.key)).toEqual(['collect', 'check', 'pay', 'cancel']);
    expect(v.steps[0].body).toBe('At Sat 28 Nov · 2:00–6:00 PM, go to Sono Akwa to collect it.');
    expect(v.steps[2].body).toBe('At pickup, inspect the item. If everything looks good, pay $60.00 in the app and take it. A $180.00 deposit is also held on your card.');
    expect(v.steps[3].body).toBe('You can cancel for free before the rental starts.');
  });

  it('deducts a paid fee and explains the refund', () => {
    const v = buildReservedView({ ...base, currency: 'XAF', total_amount: 12000, reservation_fee_amount: 150, reservation_fee_status: 'paid' }, 'en', t);
    expect(v.steps.map((s) => s.key)).toEqual(['collect', 'pay', 'cancel']);
    expect(v.steps[1].body).toMatch(/^At pickup, inspect the item\. If everything looks good, pay 11.850.FCFA in the app and take it\.$/);
    expect(v.steps[2].body).toMatch(/^Cancel before Sat 28 Nov and your 150.FCFA reservation fee is refunded\.$/);
  });
});
