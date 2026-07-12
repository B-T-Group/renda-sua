import { RentalsService } from './rentals.service';

describe('RentalsService payment callbacks', () => {
  let service: any;

  const activeBooking = {
    id: 'booking-1',
    booking_number: 'RB-1',
    rental_request_id: 'request-1',
    rental_location_listing_id: 'listing-1',
    client_id: 'client-1',
    total_amount: 100,
    currency: 'XAF',
    status: 'proposed',
    contract_expires_at: '2099-01-01T00:00:00.000Z',
    units_booked: 1,
    client: { user_id: 'client-user-1' },
    rental_location_listing: { units_available: 1 },
    rental_request: {
      units_requested: 1,
      rental_selection_windows: [
        {
          start_at: '2099-02-01T10:00:00.000Z',
          end_at: '2099-02-01T12:00:00.000Z',
          billing: 'hourly',
        },
      ],
    },
  };

  beforeEach(() => {
    service = Object.create(RentalsService.prototype);
    service.logger = { warn: jest.fn() };
    service.fetchBookingByBookingNumber = jest.fn();
    service.assertCapacityForRequestWindows = jest.fn();
    service.getHold = jest.fn().mockResolvedValue(null);
    service.placeHoldForBooking = jest.fn().mockResolvedValue(undefined);
    service.finalizeRentalBookingConfirmation = jest
      .fn()
      .mockResolvedValue(undefined);
  });

  it('does not confirm expired proposed bookings from payment callbacks', async () => {
    service.fetchBookingByBookingNumber.mockResolvedValue({
      ...activeBooking,
      contract_expires_at: '2020-01-01T00:00:00.000Z',
    });

    await service.processRentalBookingPayment({ entity_id: 'RB-1' });

    expect(service.assertCapacityForRequestWindows).not.toHaveBeenCalled();
    expect(service.placeHoldForBooking).not.toHaveBeenCalled();
    expect(service.finalizeRentalBookingConfirmation).not.toHaveBeenCalled();
  });

  it('excludes the current booking when rechecking callback capacity', async () => {
    service.fetchBookingByBookingNumber.mockResolvedValue(activeBooking);

    await service.processRentalBookingPayment({ entity_id: 'RB-1' });

    expect(service.assertCapacityForRequestWindows).toHaveBeenCalledWith(
      'listing-1',
      1,
      activeBooking.rental_request,
      1,
      'booking-1'
    );
    expect(service.placeHoldForBooking).toHaveBeenCalledWith(
      'booking-1',
      'client-1',
      100,
      'XAF'
    );
    expect(service.finalizeRentalBookingConfirmation).toHaveBeenCalledWith(
      'booking-1',
      'request-1',
      'client-user-1'
    );
  });
});
