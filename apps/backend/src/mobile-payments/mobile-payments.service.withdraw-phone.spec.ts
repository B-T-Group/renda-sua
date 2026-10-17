import { MobilePaymentsService } from './mobile-payments.service';

describe('MobilePaymentsService.isWithdrawalDestinationCmOrGa', () => {
  let service: MobilePaymentsService;
  let mockIsFedaPayActive: jest.Mock;

  beforeEach(() => {
    service = Object.create(MobilePaymentsService.prototype) as MobilePaymentsService;
    mockIsFedaPayActive = jest.fn().mockResolvedValue(false);
    (service as any).isFedaPayActiveForTogo = mockIsFedaPayActive;
  });

  it('accepts valid Cameroon and Gabon MSISDNs', async () => {
    await expect(service.isWithdrawalDestinationCmOrGa('+237670000000')).resolves.toBe(true);
    await expect(service.isWithdrawalDestinationCmOrGa('+24106123456')).resolves.toBe(true);
  });

  it('rejects blank, invalid, and non-CM/GA numbers', async () => {
    await expect(service.isWithdrawalDestinationCmOrGa(undefined)).resolves.toBe(false);
    await expect(service.isWithdrawalDestinationCmOrGa('')).resolves.toBe(false);
    await expect(service.isWithdrawalDestinationCmOrGa('   ')).resolves.toBe(false);
    await expect(service.isWithdrawalDestinationCmOrGa('not-a-phone')).resolves.toBe(false);
    await expect(service.isWithdrawalDestinationCmOrGa('+15551234567')).resolves.toBe(false);
  });
  
  // TG flag testing covered in fedapay-integration.spec.ts and full integration tests
});
