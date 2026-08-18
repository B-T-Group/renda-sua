import { MobilePaymentsService } from './mobile-payments.service';

describe('MobilePaymentsService.isWithdrawalDestinationCmOrGa', () => {
  const service = Object.create(
    MobilePaymentsService.prototype
  ) as MobilePaymentsService;

  it('accepts valid Cameroon and Gabon MSISDNs', () => {
    expect(service.isWithdrawalDestinationCmOrGa('+237670000000')).toBe(true);
    expect(service.isWithdrawalDestinationCmOrGa('+24106123456')).toBe(true);
  });

  it('rejects blank, invalid, and non-CM/GA numbers', () => {
    expect(service.isWithdrawalDestinationCmOrGa(undefined)).toBe(false);
    expect(service.isWithdrawalDestinationCmOrGa('')).toBe(false);
    expect(service.isWithdrawalDestinationCmOrGa('   ')).toBe(false);
    expect(service.isWithdrawalDestinationCmOrGa('not-a-phone')).toBe(false);
    expect(service.isWithdrawalDestinationCmOrGa('+15551234567')).toBe(false);
  });
});
