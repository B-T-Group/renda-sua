import { RentalPaymentCallbackHandler } from './rental-payment-callback.handler';

describe('RentalPaymentCallbackHandler late collect', () => {
  it('asks the rental service to queue the refund', async () => {
    const rentals = { recoverDeclinedLateCollect: jest.fn(async () => true) };
    const handler = new RentalPaymentCallbackHandler(rentals as never);
    const tx = { payment_entity: 'rental_booking', entity_id: 'RB-25496310' };
    await expect(handler.onLateSuccessAfterSupersede(tx as never)).resolves.toBe('applied');
    expect(rentals.recoverDeclinedLateCollect).toHaveBeenCalledWith(tx);
  });

  it('leaves the wallet credit when the booking was not declined', async () => {
    const rentals = { recoverDeclinedLateCollect: jest.fn(async () => false) };
    const handler = new RentalPaymentCallbackHandler(rentals as never);
    await expect(handler.onLateSuccessAfterSupersede({} as never)).resolves.toBe('duplicate');
  });
});
