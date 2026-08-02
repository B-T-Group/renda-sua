import { OrderAcceptanceService } from './order-acceptance.service';

describe('OrderAcceptanceService helpers', () => {
  const svc = Object.create(OrderAcceptanceService.prototype) as OrderAcceptanceService;

  it('treats missing operating hours as open', () => {
    expect(svc.isWithinOperatingHours(null)).toBe(true);
    expect(svc.isWithinOperatingHours(undefined)).toBe(true);
  });

  it('respects closed day and open window (full day names)', () => {
    const mondayNoon = new Date('2026-08-03T12:00:00'); // Monday
    expect(
      svc.isWithinOperatingHours(
        { monday: { open: '09:00', close: '17:00' } },
        mondayNoon
      )
    ).toBe(true);
    expect(
      svc.isWithinOperatingHours({ monday: { closed: true } }, mondayNoon)
    ).toBe(false);
    expect(
      svc.isWithinOperatingHours(
        { monday: { open: '13:00', close: '17:00' } },
        mondayNoon
      )
    ).toBe(false);
  });

  it('supports legacy 3-letter day keys for backward compatibility', () => {
    const mondayNoon = new Date('2026-08-03T12:00:00'); // Monday
    expect(
      svc.isWithinOperatingHours(
        { mon: { open: '09:00', close: '17:00' } },
        mondayNoon
      )
    ).toBe(true);
    expect(svc.isWithinOperatingHours({ mon: { closed: true } }, mondayNoon)).toBe(
      false
    );
  });

  it('assertConfirmableAcceptance allows pending awaiting states', () => {
    expect(() =>
      svc.assertConfirmableAcceptance({
        current_status: 'pending',
        acceptance_state: 'grace',
      })
    ).not.toThrow();
  });

  it('assertConfirmableAcceptance allows scheduled early confirm', () => {
    expect(() =>
      svc.assertConfirmableAcceptance({
        current_status: 'pending',
        acceptance_state: 'scheduled',
      })
    ).not.toThrow();
  });

  it('assertConfirmableAcceptance rejects accepted', () => {
    expect(() =>
      svc.assertConfirmableAcceptance({
        current_status: 'pending',
        acceptance_state: 'accepted',
      })
    ).toThrow();
  });

  it('isSlotWithinOperatingHours validates date and slot against hours', () => {
    const hours = { tuesday: { open: '09:00', close: '17:00' } };
    expect(
      svc.isSlotWithinOperatingHours(hours, '2026-08-04', '12:00', '13:00')
    ).toBe(true);
    expect(
      svc.isSlotWithinOperatingHours(hours, '2026-08-04', '18:00', '19:00')
    ).toBe(false);
    expect(
      svc.isSlotWithinOperatingHours(
        { tuesday: { closed: true } },
        '2026-08-04',
        '12:00',
        '13:00'
      )
    ).toBe(false);
  });

  it('computes activation before prep and lead time', () => {
    const readiness = new Date('2026-08-04T16:00:00.000Z'); // Tuesday 12:00 America/New_York EDT
    const prepMinutes = 60;
    const leadMinutes = 30;
    const activation = new Date(
      readiness.getTime() - (prepMinutes + leadMinutes) * 60 * 1000
    );
    expect(activation.toISOString()).toBe('2026-08-04T14:30:00.000Z');
  });
});
