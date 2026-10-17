import { MobilePaymentsService } from './mobile-payments.service';

describe('MobilePaymentsService.isWithdrawalDestinationCmOrGa', () => {
  const service = Object.create(
    MobilePaymentsService.prototype
  ) as MobilePaymentsService;
  
  (service as any).isFedaPayActiveForTogo = jest.fn().mockResolvedValue(false);

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
  
  it('rejects TG numbers when FedaPay not active', async () => {
    (service as any).isFedaPayActiveForTogo.mockResolvedValue(false);
    await expect(service.isWithdrawalDestinationCmOrGa('+22878123456')).resolves.toBe(false);
  });
  
  it('accepts TG numbers when FedaPay is active', async () => {
    (service as any).isFedaPayActiveForTogo.mockResolvedValue(true);
    await expect(service.isWithdrawalDestinationCmOrGa('+22878123456')).resolves.toBe(true);
  });
});
