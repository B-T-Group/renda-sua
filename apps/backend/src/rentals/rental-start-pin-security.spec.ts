import { HttpStatus } from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { PIN_RETIRED_MESSAGE } from './simple-start/simple-start.policy';

describe('retired rental start PIN', () => {
  const svc = Object.create(RentalsService.prototype) as RentalsService;

  it('tells every old PIN and overwrite caller to update the app', async () => {
    const retired = { status: HttpStatus.CONFLICT, message: PIN_RETIRED_MESSAGE };
    await expect(svc.getStartPinForClient('booking-1')).rejects.toMatchObject(retired);
    await expect(svc.verifyRentalStartPin('booking-1', { pin: '1234' })).rejects.toMatchObject(retired);
    await expect(svc.generateStartOverwriteCode('booking-1')).rejects.toMatchObject(retired);
    await expect(
      svc.issueStartOverwriteCodeForSupport('booking-1', 'support-user', '   ')
    ).rejects.toMatchObject(retired);
    await expect(
      svc.issueStartOverwriteCodeForSupport('booking-1', 'support-user', 'Client could not open the app')
    ).rejects.toMatchObject(retired);
    await expect(svc.initiateRentalPickupPayment('booking-1')).rejects.toMatchObject(retired);
  });
});
