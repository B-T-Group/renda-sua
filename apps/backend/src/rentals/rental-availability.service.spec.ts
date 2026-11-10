import { RentalAvailabilityService } from './rental-availability.service';

describe('RentalAvailabilityService', () => {
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const users = { getUser: jest.fn() };
  const notifications = { sendRentalAvailabilityNotice: jest.fn() };
  const service = new RentalAvailabilityService(hasura as any, users as any, notifications as any);

  beforeEach(() => {
    jest.clearAllMocks();
    users.getUser.mockResolvedValue({ id: 'user-1', client: { id: 'client-1' }, active_persona: 'client' });
  });

  it('returns the active subscription instead of inserting a second one', async () => {
    hasura.executeQuery.mockResolvedValue({
      rental_availability_subscriptions: [
        {
          id: 'sub-1',
          status: 'active',
          expires_at: '2026-12-12T00:00:00.000Z',
          start_at: '2026-11-12T00:00:00.000Z',
          end_at: '2026-11-15T00:00:00.000Z',
          category_id: null,
        },
      ],
    });
    const row = await service.subscribe({
      q: 'drone 4k',
      start_date: '2026-11-12',
      end_date: '2026-11-15',
      country_code: 'CM',
    });
    expect(row.id).toBe('sub-1');
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('sends push and the in-app notice once, then marks the row sent', async () => {
    hasura.executeMutation.mockImplementation(async (query: string) => {
      if (query.includes('ExpireRental')) return { update_rental_availability_subscriptions: { affected_rows: 0 } };
      if (query.includes('ClaimRental')) {
        return { update_rental_availability_notices: { returning: [{ id: 'n1', attempts: 0, user_id: 'user-1', listing_id: 'free' }] } };
      }
      return { update_rental_availability_notices_by_pk: { id: 'n1' } };
    });
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('QueuedRental')) {
        return { rental_availability_notices: [{ id: 'n1', attempts: 0, user_id: 'user-1', listing_id: 'free' }] };
      }
      return {
        rental_availability_notices_by_pk: {
          user_id: 'user-1',
          listing_id: 'free',
          user: { preferred_language: 'fr' },
          subscription: { start_at: '2026-11-12T00:00:00.000Z', end_at: '2026-11-15T00:00:00.000Z' },
          listing: { rental_item: { name: 'Canon EOS R50' } },
        },
      };
    });
    notifications.sendRentalAvailabilityNotice.mockResolvedValue(true);
    await expect(service.deliverDue()).resolves.toBe(1);
    expect(notifications.sendRentalAvailabilityNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        listingId: 'free',
        title: 'Une location est libre',
      })
    );
    const mark = hasura.executeMutation.mock.calls.find((call) => String(call[0]).includes('MarkRentalAvailabilitySent'));
    expect(mark).toBeTruthy();
  });

  it('skips the cron when the migration is not applied yet', async () => {
    hasura.executeMutation.mockRejectedValue(new Error("field 'rental_availability_subscriptions' not found in type: 'mutation_root'"));
    await expect(service.handleAvailabilityNotices()).resolves.toBeUndefined();
  });
});
