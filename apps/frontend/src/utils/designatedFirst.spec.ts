import { apiErrorMessage, formatKmShort, formatWindow, isFreeRelease } from './designatedFirst';

const NOW = Date.parse('2026-11-04T12:00:00Z');

describe('designatedFirst utils (web)', () => {
  it('formats windows and distances', () => {
    expect(formatWindow('08:00:00', '12:00:00')).toBe('08:00–12:00');
    expect(formatWindow(null, null)).toBe('');
    expect(formatKmShort(2.345)).toBe('2.3 km');
    expect(formatKmShort(15.4)).toBe('15 km');
    expect(formatKmShort(null)).toBe('');
  });

  it('free release only before the cutoff', () => {
    expect(isFreeRelease({ releaseCutoffAt: '2026-11-04T14:00:00Z' }, NOW)).toBe(true);
    expect(isFreeRelease({ releaseCutoffAt: '2026-11-04T10:00:00Z' }, NOW)).toBe(false);
    expect(isFreeRelease({ releaseCutoffAt: null }, NOW)).toBe(false);
  });

  it('reads the server message', () => {
    expect(apiErrorMessage({ response: { data: { message: 'Not yours' } } })).toBe('Not yours');
    expect(apiErrorMessage(new Error('x'))).toBeNull();
    expect(apiErrorMessage(null)).toBeNull();
  });
});
