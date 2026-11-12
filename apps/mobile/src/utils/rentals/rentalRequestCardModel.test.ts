import {
  buildRequestCardModel,
  doualaDateKey,
  renterInitials,
  sentClock,
  shouldShowDepositLine,
  startsInCalendarDays,
  type RequestCardSource,
} from './rentalRequestCardModel';

const copy = (key: string, fallback: string, options?: Record<string, unknown>) => {
  const table: Record<string, string> = {
    'rentals.requestForm.dayCount': '{{count}} days',
    'rentals.requestForm.dailyBreakdown': '{{days}} × {{rate}} / day',
    'rentals.requestForm.hourlyBreakdown': '{{h}} h × {{rate}} / hour',
  };
  const template = table[key] ?? fallback;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name] ?? ''));
};

const fr = (key: string, fallback: string, options?: Record<string, unknown>) => {
  const table: Record<string, string> = {
    'rentals.requestForm.dayCount': '{{count}} jours',
    'rentals.requestForm.dailyBreakdown': '{{days}} × {{rate}} / jour',
    'rentals.requestForm.hourlyBreakdown': '{{h}} h × {{rate}} / heure',
    'rentals.requestCard.youReceive': 'Vous recevez {{amount}}',
    'rentals.requestCard.allDay': 'Toute la journée',
    'rentals.requestCard.seeTimes': '{{count}} jours · voir les horaires',
    'rentals.requestCard.deposit': 'Caution : {{amount}}',
    'rentals.requestCard.sent': 'Envoyée à {{time}}',
  };
  const template = table[key] ?? fallback;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name] ?? ''));
};

function request(over: Partial<RequestCardSource> = {}): RequestCardSource {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    created_at: '2026-11-11T18:19:00.000Z',
    units_requested: 1,
    quoted_total: 760,
    rental_selection_windows: [
      { billing: 'all_day', calendar_date: '2026-11-14', start_at: '2026-11-14T00:00:00.000Z', end_at: '2026-11-15T00:00:00.000Z' },
      { billing: 'all_day', calendar_date: '2026-11-15', start_at: '2026-11-15T00:00:00.000Z', end_at: '2026-11-16T00:00:00.000Z' },
    ],
    rental_pricing_snapshot: {
      version: 4,
      currency: 'XAF',
      total: 760,
      securityDeposit: 0,
      lines: [
        { kind: 'all_day', ratePerDay: 380, subtotal: 380 },
        { kind: 'all_day', ratePerDay: 380, subtotal: 380 },
      ],
    },
    payment_rail: 'mobile_money',
    dates_available: true,
    rental_location_listing: {
      base_price_per_day: 380,
      base_price_per_hour: 100,
      security_deposit_amount: 0,
      business_location: { name: 'Stripe Rail', address: { city: "L'Assomption" } },
      rental_item: { name: 'JBL PartyBox 310', currency: 'XAF' },
    },
    client: { user: { first_name: 'MM', last_name: 'Test' } },
    ...over,
  };
}

const now = new Date('2026-11-11T18:00:00.000Z');

describe('request card money', () => {
  it('shows You receive as the contract total and a day breakdown, with no fee', () => {
    const model = buildRequestCardModel(request(), 'en', now, copy);
    expect(model.receiveLine).toBe('You receive 760 FCFA');
    expect(model.receiveAmount).toBe('760 FCFA');
    expect(model.breakdown).toBe('2 days × 380 FCFA / day');
    expect(model.breakdown).not.toMatch(/fee|Renter pays/i);
    expect(model.quoteMissing).toBe(false);
  });

  it('groups thousands and multiplies the day rate when quantity is over 1', () => {
    const three = buildRequestCardModel(
      request({
        quoted_total: 1140,
        rental_pricing_snapshot: {
          total: 1140,
          currency: 'XAF',
          securityDeposit: 0,
          lines: [{ kind: 'all_day', ratePerDay: 380 }],
        },
        rental_selection_windows: [
          { billing: 'all_day', calendar_date: '2026-11-14', start_at: '2026-11-14T00:00:00.000Z', end_at: '2026-11-15T00:00:00.000Z' },
          { billing: 'all_day', calendar_date: '2026-11-15', start_at: '2026-11-15T00:00:00.000Z', end_at: '2026-11-16T00:00:00.000Z' },
          { billing: 'all_day', calendar_date: '2026-11-16', start_at: '2026-11-16T00:00:00.000Z', end_at: '2026-11-17T00:00:00.000Z' },
        ],
      }),
      'en',
      now,
      copy
    );
    expect(three.receiveAmount).toBe('1 140 FCFA');
    expect(three.breakdown).toBe('3 days × 380 FCFA / day');
    expect(three.quantity).toBeNull();

    const pair = buildRequestCardModel(
      request({ units_requested: 2, quoted_total: 1520 }),
      'en',
      now,
      copy
    );
    expect(pair.receiveAmount).toBe('1 520 FCFA');
    expect(pair.breakdown).toBe('2 days × 380 FCFA / day × 2');
    expect(pair.quantity).toBe(2);
  });

  it('uses an hourly breakdown and falls back when no quote was persisted', () => {
    const hourly = buildRequestCardModel(
      request({
        quoted_total: 800,
        rental_selection_windows: [
          { billing: 'hourly', start_at: '2026-11-11T09:00:00.000Z', end_at: '2026-11-11T13:00:00.000Z' },
          { billing: 'hourly', start_at: '2026-11-13T14:00:00.000Z', end_at: '2026-11-13T18:00:00.000Z' },
        ],
        rental_pricing_snapshot: {
          total: 800,
          currency: 'XAF',
          lines: [{ kind: 'hourly', ratePerHour: 100, billableHours: 4 }],
        },
      }),
      'en',
      now,
      copy
    );
    expect(hourly.receiveLine).toBe('You receive 800 FCFA');
    expect(hourly.breakdown).toBe('8 h × 100 FCFA / hour');

    const missing = buildRequestCardModel(
      request({ quoted_total: null, rental_pricing_snapshot: null }),
      'en',
      now,
      copy
    );
    expect(missing.quoteMissing).toBe(true);
    expect(missing.receiveLine).toBeNull();
    expect(missing.breakdown).toBeNull();
  });
});

describe('deposit line', () => {
  it('shows a deposit only for a card rail when the amount is over 0', () => {
    expect(shouldShowDepositLine(3040, 'stripe')).toBe(true);
    expect(shouldShowDepositLine(3040, 'card')).toBe(true);
    expect(shouldShowDepositLine(3040, 'mobile_money')).toBe(false);
    expect(shouldShowDepositLine(3040, 'momo')).toBe(false);
    expect(shouldShowDepositLine(3040, 'wallet')).toBe(false);
    expect(shouldShowDepositLine(0, 'stripe')).toBe(false);
    expect(shouldShowDepositLine(3040, null)).toBe(false);

    const card = buildRequestCardModel(
      request({
        payment_rail: 'stripe',
        rental_pricing_snapshot: { total: 760, currency: 'XAF', securityDeposit: 3040, lines: [{ kind: 'all_day', ratePerDay: 380 }] },
      }),
      'en',
      now,
      copy
    );
    expect(card.depositAmount).toBe('3 040 FCFA');

    const momo = buildRequestCardModel(request({ payment_rail: 'mobile_money' }), 'en', now, copy);
    const wallet = buildRequestCardModel(
      request({
        payment_rail: 'wallet',
        rental_pricing_snapshot: { total: 760, currency: 'XAF', securityDeposit: 3040 },
      }),
      'en',
      now,
      copy
    );
    expect(momo.depositAmount).toBeNull();
    expect(wallet.depositAmount).toBeNull();
  });
});

describe('conflict and windows', () => {
  it('disables Accept only when the server says the dates are taken', () => {
    expect(buildRequestCardModel(request({ dates_available: false }), 'en', now, copy).acceptDisabled).toBe(true);
    expect(buildRequestCardModel(request({ dates_available: true }), 'en', now, copy).acceptDisabled).toBe(false);
    expect(buildRequestCardModel(request({ dates_available: null }), 'en', now, copy).acceptDisabled).toBe(false);
  });

  it('collapses several windows and keeps one all-day window as a single day', () => {
    const many = buildRequestCardModel(
      request({
        rental_selection_windows: [
          { billing: 'hourly', start_at: '2026-11-11T09:00:00.000Z', end_at: '2026-11-11T13:00:00.000Z' },
          { billing: 'hourly', start_at: '2026-11-13T14:00:00.000Z', end_at: '2026-11-13T18:00:00.000Z' },
        ],
      }),
      'en',
      now,
      copy
    );
    expect(many.schedule.expandable).toBe(true);
    expect(many.schedule.summary).toBe('2 days · see times');
    expect(many.schedule.lines).toEqual([
      'Wed 11 Nov · 09:00\u201313:00 · 4 h',
      'Fri 13 Nov · 14:00\u201318:00 · 4 h',
    ]);

    const one = buildRequestCardModel(
      request({
        rental_selection_windows: [
          { billing: 'all_day', calendar_date: '2026-11-11', start_at: '2026-11-11T00:00:00.000Z', end_at: '2026-11-12T00:00:00.000Z' },
        ],
      }),
      'en',
      now,
      copy
    );
    expect(one.schedule.expandable).toBe(false);
    expect(one.schedule.summary).toBe('Wed 11 Nov · All day');
  });

  it('writes a contiguous daily range with the exclusive end day, in French', () => {
    const model = buildRequestCardModel(request(), 'fr', now, fr);
    expect(model.schedule.summary).toBe('Sam. 14 nov. – lun. 16 nov. · 2 jours');
    expect(model.receiveLine).toBe('Vous recevez 760 FCFA');
    expect(model.schedule.summary).not.toMatch(/2026|PM|AM/);
  });
});

describe('Douala starts-in boundary', () => {
  it('drops a day when now crosses midnight in Africa/Douala', () => {
    expect(doualaDateKey(new Date('2026-11-11T22:30:00.000Z'))).toBe('2026-11-11');
    expect(doualaDateKey(new Date('2026-11-11T23:30:00.000Z'))).toBe('2026-11-12');
    expect(startsInCalendarDays('2026-11-14', new Date('2026-11-11T22:30:00.000Z'))).toBe(3);
    expect(startsInCalendarDays('2026-11-14', new Date('2026-11-11T23:30:00.000Z'))).toBe(2);

    const before = buildRequestCardModel(request(), 'en', new Date('2026-11-11T22:30:00.000Z'), copy);
    const after = buildRequestCardModel(request(), 'en', new Date('2026-11-11T23:30:00.000Z'), copy);
    expect(before.startsIn).toEqual({ kind: 'days', count: 3 });
    expect(after.startsIn).toEqual({ kind: 'days', count: 2 });
  });

  it('says today on the start date and omits a start that already passed', () => {
    const today = buildRequestCardModel(request(), 'en', new Date('2026-11-14T10:00:00.000Z'), copy);
    const past = buildRequestCardModel(request(), 'en', new Date('2026-11-16T00:30:00.000Z'), copy);
    expect(today.startsIn).toEqual({ kind: 'today' });
    expect(past.startsIn).toBeNull();
  });
});

describe('renter and sent time', () => {
  it('uses a two-letter first name as initials and formats sent time in Douala', () => {
    expect(renterInitials('MM', 'Test')).toBe('MM');
    expect(renterInitials('Samuel', 'Oru')).toBe('SO');
    expect(sentClock('2026-11-11T18:19:00.000Z', 'en')).toMatch(/7:19\s?PM/);
    expect(sentClock('2026-11-11T18:19:00.000Z', 'fr')).toMatch(/19:19/);
    const model = buildRequestCardModel(request(), 'en', now, copy);
    expect(model.initials).toBe('MM');
    expect(model.place).toBe("Stripe Rail · L'Assomption");
    expect(model.quantity).toBeNull();
  });
});
