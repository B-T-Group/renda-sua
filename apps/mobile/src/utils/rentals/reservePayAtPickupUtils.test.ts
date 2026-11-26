import { describe, expect, it } from 'vitest';
import { payBreakdown } from './payBreakdown';
import { cancelFeeResult } from './reservationFee';
import { buildReserveSummary, clockRange, dayBefore, dayEndDeadline, weekdayDay, windowLabel } from './reserveSummary';
import { formatPhotoStamp, photosTakenStamp } from './rentalStartWindow';

const t = (_key: string, fallback: string, vars?: Record<string, unknown>) =>
  fallback.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(vars?.[k] ?? ''));
const NB = '\u00a0';
const W = { start_at: '2026-11-28T14:00:00Z', end_at: '2026-11-28T18:00:00Z' };

describe('reserve summary (01a/01b)', () => {
  it('reads the listing clock with weekdays', () => {
    expect(windowLabel(W, 'en', 'Africa/Douala')).toBe('Sat 28 Nov · 14:00–18:00');
    expect(windowLabel(W, 'en', 'America/Toronto')).toBe('Sat 28 Nov · 2:00–6:00 PM');
    expect(windowLabel(W, 'fr', 'America/Toronto')).toBe(`sam.${NB}28${NB}nov. · 14:00–18:00`);
    expect(clockRange('2026-11-28T11:00:00Z', '2026-11-28T13:00:00Z', 'en', 'America/Toronto')).toBe('11:00 AM–1:00 PM');
    expect(weekdayDay(W.start_at, 'en')).toBe('Sat 28 Nov');
    expect(dayBefore(W.start_at, 'fr')).toBe(`ven.${NB}27${NB}nov.`);
  });

  it('MoMo with a fee: fee box, refund rules, free cancellation until the day before', () => {
    const s = buildReserveSummary({
      mode: 'fee',
      windows: [W],
      quote: { currency: 'XAF', total: 12000, lines: [] },
      booking: { reservation_fee_amount: 1200, inspection_policy_version: 1 },
      listingZone: 'Africa/Douala',
      placeName: 'Sono Akwa',
      language: 'en',
      t,
    });
    expect(s.rows.map((r) => r.key)).toEqual(expect.arrayContaining(['dates', 'rental', 'pickup']));
    expect(s.rows.find((r) => r.key === 'dates')?.value).toBe('Sat 28 Nov · 14:00–18:00');
    expect(s.rows.some((r) => /window/i.test(r.label))).toBe(false);
    expect(s.box.kind).toBe('fee');
    expect(s.box.lines.map((l) => l.text).join(' | ')).toMatch(/Refunded if you cancel before Sat 28 Nov/);
    expect(s.cancelLine).toBe('Free cancellation until Fri 27 Nov · 23:59');
    expect(s.button).toMatch(/^Pay 1.200.FCFA & reserve$/);
  });

  it('card pay at pickup: deposit row and nothing held today', () => {
    const s = buildReserveSummary({
      mode: 'free',
      windows: [W],
      quote: { currency: 'CAD', total: 60, securityDeposit: 180, lines: [] },
      booking: { reservation_fee_amount: 0 },
      listingZone: 'America/Toronto',
      isStripeRail: true,
      language: 'en',
      t,
    });
    expect(s.rows.find((r) => r.key === 'dates')?.value).toBe('Sat 28 Nov · 2:00–6:00 PM');
    expect(s.rows.find((r) => r.key === 'deposit')?.value).toBe('$180.00');
    expect(JSON.stringify(s)).toMatch(/Nothing is held on your card today/);
    expect(s.footer.amount).toBe('$60.00');
  });
});

describe('Pay & start breakdown (05a/05b)', () => {
  const base = {
    status: 'reserved',
    start_at: W.start_at,
    end_at: W.end_at,
    payment_status: 'pending',
    payment_timing: 'pay_at_pickup',
    reservation_fee_status: 'paid',
  };
  it('card: rental, fee paid, charged now, deposit hold and the footer', () => {
    const b = payBreakdown({ ...base, currency: 'CAD', total_amount: 60, card_pay_at_pickup: true, reservation_fee_amount: 6, security_deposit_amount: 180 } as never, 'en', t);
    expect(b?.rail).toBe('card');
    expect(b?.rows.map((r) => [r.label, r.value])).toEqual([
      ['Rental · 4 h', '$60.00'],
      ['Reservation fee paid', '\u2212$6.00'],
      ['Charged now', '$54.00'],
      ['Deposit hold', '$180.00'],
    ]);
    expect(b?.footer).toBe('$234.00 on your card today · $180.00 of it is a hold');
  });
  it('MoMo: to pay now, no deposit row, no footer', () => {
    const b = payBreakdown({ ...base, currency: 'XAF', total_amount: 12000, reservation_fee_amount: 1200 } as never, 'en', t);
    expect(b?.rows.map((r) => r.key)).toEqual(['rental', 'fee', 'now']);
    expect(b?.rows[2].label).toBe('To pay now');
    expect(b?.footer).toBeNull();
  });
});

describe('cancel fee result', () => {
  const b = { status: 'reserved', currency: 'XAF', total_amount: 12000, reservation_fee_amount: 1200, reservation_fee_status: 'paid', start_at: W.start_at } as never;
  it('refunds before the start day and keeps it on the start day (listing clock)', () => {
    expect(cancelFeeResult(b, Date.parse('2026-11-27T22:30:00Z'), 'Africa/Douala')).toBe('refund');
    expect(cancelFeeResult(b, Date.parse('2026-11-27T23:30:00Z'), 'Africa/Douala')).toBe('keep');
  });
  it('refunds on the start day while the flag is open', () => {
    expect(cancelFeeResult(b, Date.parse('2026-11-28T15:00:00Z'), 'Africa/Douala', true)).toBe('refund');
  });
  it('has nothing to say without a paid fee', () => {
    expect(cancelFeeResult({ ...(b as object), reservation_fee_status: 'pending' } as never, Date.now(), 'Africa/Douala')).toBe('none');
  });
});

describe('v3: listing-clock deadlines and same-day photo stamps', () => {
  it('reads 11:59 PM for English in the Americas, 23:59 elsewhere', () => {
    expect(dayEndDeadline('en', 'America/Toronto')).toBe('11:59\u00a0PM');
    expect(dayEndDeadline('fr', 'America/Toronto')).toBe('23:59');
    expect(dayEndDeadline('en', 'Africa/Douala')).toBe('23:59');
  });
  it('free cancellation line on the Montréal listing', () => {
    const s = buildReserveSummary({
      mode: 'free',
      windows: [W],
      quote: { currency: 'CAD', total: 60, securityDeposit: 180, lines: [] },
      booking: { reservation_fee_amount: 0 },
      listingZone: 'America/Toronto',
      isStripeRail: true,
      language: 'en',
      t,
    });
    expect(s.cancelLine).toBe('Free cancellation until Fri 27 Nov · 11:59\u00a0PM');
  });
  it('shows only the time for a photo taken today, the date for an older one', () => {
    const now = Date.parse('2026-11-28T19:00:00Z');
    expect(formatPhotoStamp('2026-11-28T18:52:00Z', 'America/Toronto', 'en', now)).toBe('1:52 PM');
    expect(formatPhotoStamp('2026-11-28T12:52:00Z', 'Africa/Douala', 'fr', Date.parse('2026-11-28T13:00:00Z'))).toBe('13:52');
    expect(formatPhotoStamp('2026-11-26T18:52:00Z', 'America/Toronto', 'en', now)).toBe('26 Nov');
    expect(photosTakenStamp(['2026-11-28T18:40:00Z', '2026-11-28T18:52:00Z'], 'America/Toronto', 'en')).toBe('Sat 28 Nov · 1:52 PM');
    expect(photosTakenStamp(['2026-11-28T12:52:00Z'], 'Africa/Douala', 'fr')).toBe('sam.\u00a028\u00a0nov. · 13:52');
  });
});
