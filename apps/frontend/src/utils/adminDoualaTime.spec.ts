import { formatAdminDoualaTime } from './adminDoualaTime';

describe('formatAdminDoualaTime', () => {
  it('shows a report instant on the Africa/Douala clock', () => {
    expect(formatAdminDoualaTime('2026-11-12T18:42:00.000Z', 'en')).toBe('12 Nov · 19:42');
    expect(formatAdminDoualaTime('2026-11-12T18:42:00.000Z', 'fr')).toBe('12 nov. · 19:42');
  });

  it('rolls a late UTC instant onto the next Douala morning', () => {
    expect(formatAdminDoualaTime('2026-11-12T23:30:00.000Z', 'en')).toBe('13 Nov · 00:30');
  });

  it('does not read the Z clock as if it were already Douala', () => {
    expect(formatAdminDoualaTime('2026-11-12T18:42:00.000Z', 'en')).not.toContain('18:42');
  });
});
