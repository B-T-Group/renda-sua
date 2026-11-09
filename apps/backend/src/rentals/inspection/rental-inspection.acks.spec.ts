import { HttpException } from '@nestjs/common';
import { isInspectionAckConflict } from './rental-inspection.errors';
import { RentalInspectionService } from './rental-inspection.service';

const UNIQUE =
  'Uniqueness violation. duplicate key value violates unique constraint "rental_inspection_acks_version_id_persona_key"';

function uniqueError(shape: 'message' | 'response' = 'message'): Error {
  const error: Error & { response?: { errors: Array<{ message: string }> } } = new Error(UNIQUE);
  if (shape === 'response') {
    error.response = { errors: [{ message: UNIQUE }] };
  }
  return error;
}

function bookingRow() {
  return {
    id: 'b1',
    status: 'confirmed',
    business_id: 'biz',
    client_id: 'cli',
    units_booked: 1,
    allocation_version: 1,
    inspection_policy_version: 1,
    pickup_current_version_id: 'v1',
    return_current_version_id: 'v2',
    booking_number: 'RB-1',
    client: { user_id: 'client-user' },
    business: { user_id: 'biz-user' },
  };
}

function setup(state: { decision: string | null } = { decision: null }) {
  const hasura = {
    executeQuery: jest.fn(async (query: string) => {
      if (String(query).includes('InspectionBooking')) {
        return { rental_bookings_by_pk: bookingRow() };
      }
      if (String(query).includes('ClientAck')) {
        return { rental_inspection_acks: state.decision ? [{ decision: state.decision }] : [] };
      }
      return {};
    }),
    executeMutation: jest.fn(),
  };
  const notices = { sendRentalInspectionNotice: jest.fn().mockResolvedValue(undefined) };
  const rentals = { settleEnrolledRental: jest.fn().mockResolvedValue(undefined) };
  const service = new RentalInspectionService(
    hasura as never,
    {
      getUser: jest.fn().mockResolvedValue({
        id: 'client-user',
        active_persona: 'client',
        client: { id: 'cli' },
      }),
    } as never,
    { numberConfig: jest.fn().mockResolvedValue(48) } as never,
    notices as never,
    rentals as never
  );
  return { service, hasura, notices, rentals, state };
}

describe('inspection ack uniqueness', () => {
  it('matches Hasura unique-constraint errors on the ack table', () => {
    expect(isInspectionAckConflict(uniqueError())).toBe(true);
    expect(isInspectionAckConflict(uniqueError('response'))).toBe(true);
    expect(isInspectionAckConflict(new Error('rental_inspection_correction_conflict'))).toBe(true);
    expect(isInspectionAckConflict(new Error('Foreign key violation'))).toBe(false);
  });

  it('treats a concurrent pickup accept as already accepted', async () => {
    const { service, hasura, notices, state } = setup({ decision: 'accept' });
    hasura.executeMutation.mockRejectedValue(uniqueError('response'));
    await expect(service.acknowledge('b1', 'pickup', 'v1', 'accept')).resolves.toEqual({
      accepted: true,
    });
    expect(notices.sendRentalInspectionNotice).not.toHaveBeenCalled();
  });

  it('returns 409 when a unique race already stored a different decision', async () => {
    const { service, hasura } = setup({ decision: 'correction' });
    hasura.executeMutation.mockRejectedValue(uniqueError());
    const error = await service.acknowledge('b1', 'pickup', 'v1', 'accept').catch((caught) => caught);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(409);
  });

  it('returns 409 when uniqueness fires and no ack row is found', async () => {
    const { service, hasura } = setup({ decision: null });
    hasura.executeMutation.mockRejectedValue(uniqueError());
    await expect(service.acknowledge('b1', 'pickup', 'v1', 'accept')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('notifies once when pickup accept wins the insert', async () => {
    const { service, hasura, notices } = setup();
    hasura.executeMutation.mockResolvedValue({ rental_accept_pickup_version: [{ id: 'b1' }] });
    await expect(service.acknowledge('b1', 'pickup', 'v1', 'accept')).resolves.toEqual({
      accepted: true,
    });
    expect(notices.sendRentalInspectionNotice).toHaveBeenCalledTimes(1);
  });

  it('replays an empty pickup accept when the client already accepted', async () => {
    const { service, hasura, notices } = setup({ decision: 'accept' });
    hasura.executeMutation.mockResolvedValue({ rental_accept_pickup_version: [] });
    await expect(service.acknowledge('b1', 'pickup', 'v1', 'accept')).resolves.toEqual({
      accepted: true,
    });
    expect(notices.sendRentalInspectionNotice).not.toHaveBeenCalled();
  });

  it('still settles a unique return-accept replay', async () => {
    const { service, hasura, rentals } = setup({ decision: 'accept' });
    hasura.executeMutation.mockRejectedValue(uniqueError());
    await expect(service.acknowledge('b1', 'return', 'v2', 'accept')).resolves.toEqual({
      accepted: true,
    });
    expect(rentals.settleEnrolledRental).toHaveBeenCalledWith('b1');
  });

  it('treats a concurrent return dispute as already disputed', async () => {
    const { service, hasura, notices } = setup({ decision: 'dispute' });
    hasura.executeMutation.mockRejectedValue(uniqueError());
    await expect(
      service.acknowledge('b1', 'return', 'v2', 'dispute', 'The item is damaged')
    ).resolves.toEqual({ disputed: true });
    expect(notices.sendRentalInspectionNotice).not.toHaveBeenCalled();
  });

  it('keeps a duplicate correction as HTTP 409', async () => {
    const { service, hasura } = setup({ decision: 'correction' });
    hasura.executeMutation.mockRejectedValue(
      new Error('rental_inspection_correction_conflict')
    );
    await expect(
      service.acknowledge('b1', 'pickup', 'v1', 'correction', 'Wrong photos')
    ).rejects.toMatchObject({ status: 409 });
  });

  it('does not swallow unrelated mutation failures', async () => {
    const { service, hasura } = setup();
    hasura.executeMutation.mockRejectedValue(new Error('connection reset'));
    await expect(service.acknowledge('b1', 'pickup', 'v1', 'accept')).rejects.toThrow(
      'connection reset'
    );
  });
});
