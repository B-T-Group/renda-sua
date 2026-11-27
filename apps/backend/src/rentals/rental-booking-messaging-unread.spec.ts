import { HttpException, HttpStatus } from '@nestjs/common';
import { RentalBookingMessagingService } from './rental-booking-messaging.service';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_ID = '33333333-3333-4333-8333-333333333333';
const BUSINESS_ID = '44444444-4444-4444-8444-444444444444';

function buildService(user: Record<string, unknown>, count: number | null) {
  const executeQuery = jest
    .fn()
    .mockResolvedValueOnce({
      rental_bookings_by_pk: {
        id: BOOKING_ID,
        client_id: CLIENT_ID,
        business_id: BUSINESS_ID,
      },
    })
    .mockResolvedValueOnce({
      user_messages_aggregate: {
        aggregate: count === null ? null : { count },
      },
    });
  const service = new RentalBookingMessagingService(
    { getUser: jest.fn().mockResolvedValue(user) } as never,
    { executeQuery } as never,
    {} as never,
    {} as never
  );
  return { service, executeQuery };
}

describe('RentalBookingMessagingService.getUnreadCount', () => {
  it('counts unread messages from the other party for the renter', async () => {
    const inputUser = {
      id: USER_ID,
      active_persona: 'client',
      client: { id: CLIENT_ID },
    };
    const { service, executeQuery } = buildService(inputUser, 3);

    const actualCount = await service.getUnreadCount(BOOKING_ID);

    expect(actualCount).toBe(3);
    expect(executeQuery.mock.calls[1][1]).toMatchObject({
      bookingId: BOOKING_ID,
      entityType: 'rental_booking',
      me: USER_ID,
    });
  });

  it('returns zero when the aggregate is empty', async () => {
    const inputUser = {
      id: USER_ID,
      active_persona: 'business',
      business: { id: BUSINESS_ID },
    };
    const { service } = buildService(inputUser, null);

    await expect(service.getUnreadCount(BOOKING_ID)).resolves.toBe(0);
  });

  it('rejects users who are not a party to the booking', async () => {
    const inputUser = {
      id: USER_ID,
      active_persona: 'client',
      client: { id: 'other-client' },
    };
    const { service } = buildService(inputUser, 1);

    await expect(service.getUnreadCount(BOOKING_ID)).rejects.toMatchObject({
      constructor: HttpException,
      status: HttpStatus.FORBIDDEN,
    });
  });
});
