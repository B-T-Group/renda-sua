import {
  formatRequestAmount,
  formatRequestChipDay,
  formatRequestChipWeekday,
  formatRequestDay,
  requestChipDateKeys,
  requestChipSelected,
  requestDayCount,
  requestUsesDayWording,
  selectedRequestDateKeys,
} from './rentalRequestFormat';

const NARROW = '\u202f';

describe('formatRequestAmount', () => {
  it('puts the amount before FCFA in English and French', () => {
    expect(formatRequestAmount(760, 'XAF', 'en')).toBe('760 FCFA');
    expect(formatRequestAmount(380, 'FCFA', 'fr')).toBe('380 FCFA');
    expect(formatRequestAmount(1140, 'XAF', 'en')).toBe('1,140 FCFA');
    expect(formatRequestAmount(1140, 'XAF', 'fr')).toBe(`1${NARROW}140 FCFA`);
  });

  it('does not put the currency code in front', () => {
    expect(formatRequestAmount(760, 'XAF', 'en').startsWith('FCFA')).toBe(false);
    expect(formatRequestAmount(760, 'XAF', 'fr').startsWith('FCFA')).toBe(false);
  });
});

describe('formatRequestDay', () => {
  it('formats the scaffold dates as human weekdays, never ISO', () => {
    expect(formatRequestDay('2026-11-11', 'en')).toBe('Wed 11 Nov');
    expect(formatRequestDay('2026-11-12', 'en')).toBe('Thu 12 Nov');
    expect(formatRequestDay('2026-11-11', 'fr')).toBe('Mer. 11 nov.');
    expect(formatRequestDay('2026-11-12', 'fr')).toBe('Jeu. 12 nov.');
    expect(formatRequestDay('2026-11-11', 'en')).not.toContain('2026-11-11');
  });

  it('splits a chip into weekday and day number', () => {
    expect(formatRequestChipWeekday('2026-11-10', 'en')).toBe('Tue');
    expect(formatRequestChipDay('2026-11-10')).toBe('10');
    expect(formatRequestChipWeekday('2026-11-11', 'fr')).toBe('Mer.');
  });
});

describe('request day wording', () => {
  const days = [
    { billing: 'all_day' as const },
    { billing: 'all_day' as const },
  ];

  it('uses day wording for a daily-rate booking', () => {
    expect(requestUsesDayWording(days)).toBe(true);
    expect(requestDayCount(days)).toBe(2);
  });

  it('keeps hourly wording when any window is hourly', () => {
    expect(requestUsesDayWording([{ billing: 'hourly' }])).toBe(false);
    expect(requestUsesDayWording([...days, { billing: 'hourly' }])).toBe(false);
    expect(requestDayCount([])).toBe(0);
  });
});

describe('request chip selection', () => {
  const selected = selectedRequestDateKeys([
    { calendarDate: '2026-11-11', startMs: 0 },
    { calendarDate: '2026-11-12', startMs: 0 },
  ]);

  it('highlights the chosen dates and not today', () => {
    expect(selected).toEqual(['2026-11-11', '2026-11-12']);
    expect(requestChipSelected('2026-11-11', selected)).toBe(true);
    expect(requestChipSelected('2026-11-12', selected)).toBe(true);
    expect(requestChipSelected('2026-11-10', selected)).toBe(false);
  });

  it('highlights today only when today was chosen', () => {
    const today = ['2026-11-10'];
    expect(requestChipSelected('2026-11-10', today)).toBe(true);
    expect(requestChipSelected('2026-11-11', today)).toBe(false);
  });

  it('keeps chosen days in the chip window even when they are outside the next 14 days', () => {
    const keys = requestChipDateKeys('2026-12-01', ['2026-11-11', '2026-11-12']);
    expect(keys).toContain('2026-11-11');
    expect(keys).toContain('2026-11-12');
    expect(keys).toContain('2026-12-01');
    expect(keys.indexOf('2026-11-11')).toBeLessThan(keys.indexOf('2026-12-01'));
  });
});
