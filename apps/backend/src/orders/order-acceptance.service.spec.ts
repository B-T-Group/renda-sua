import { OrderAcceptanceService } from './order-acceptance.service';

describe('OrderAcceptanceService helpers', () => {
  const svc = Object.create(OrderAcceptanceService.prototype) as OrderAcceptanceService;

  it('treats missing operating hours as open', () => {
    expect(svc.isWithinOperatingHours(null)).toBe(true);
    expect(svc.isWithinOperatingHours(undefined)).toBe(true);
  });

  it('respects closed day and open window', () => {
    const mondayNoon = new Date('2026-08-03T12:00:00'); // Monday
    expect(
      svc.isWithinOperatingHours(
        { mon: { open: '09:00', close: '17:00' } },
        mondayNoon
      )
    ).toBe(true);
    expect(
      svc.isWithinOperatingHours({ mon: { closed: true } }, mondayNoon)
    ).toBe(false);
    expect(
      svc.isWithinOperatingHours(
        { mon: { open: '13:00', close: '17:00' } },
        mondayNoon
      )
    ).toBe(false);
  });

  it('assertConfirmableAcceptance allows pending awaiting states', () => {
    expect(() =>
      svc.assertConfirmableAcceptance({
        current_status: 'pending',
        acceptance_state: 'grace',
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
});
