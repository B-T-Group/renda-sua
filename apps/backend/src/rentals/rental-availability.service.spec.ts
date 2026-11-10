import { Logger } from '@nestjs/common';
import { RentalAvailabilityService } from './rental-availability.service';

describe('RentalAvailabilityService', () => {
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const users = { getUser: jest.fn() };
  const notifications = { sendRentalAvailabilityNotice: jest.fn() };
  const service = new RentalAvailabilityService(hasura as any, users as any, notifications as any);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-11-10T12:00:00.000Z'));
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

  afterEach(() => jest.useRealTimers());

  it('rejects a start date in the past', async () => {
    await expect(
      service.subscribe({ q: 'drone', start_date: '2026-11-09', end_date: '2026-11-12' })
    ).rejects.toMatchObject({ status: 400 });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('caps active subscriptions per user', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CountActiveRental')) {
        return { rental_availability_subscriptions_aggregate: { aggregate: { count: 10 } } };
      }
      return { rental_availability_subscriptions: [] };
    });
    await expect(
      service.subscribe({ q: 'tent', start_date: '2026-11-20', end_date: '2026-11-22' })
    ).rejects.toMatchObject({ status: 429 });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('expires the alert at the end of the start day when that is sooner than 30 days', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CountActiveRental')) {
        return { rental_availability_subscriptions_aggregate: { aggregate: { count: 0 } } };
      }
      return { rental_availability_subscriptions: [] };
    });
    hasura.executeMutation.mockResolvedValue({
      insert_rental_availability_subscriptions_one: {
        id: 'sub-2', status: 'active', expires_at: 'x', start_at: 'x', end_at: 'x',
      },
    });
    await service.subscribe({ q: 'tent', start_date: '2026-11-12', end_date: '2026-11-14' });
    const insert = hasura.executeMutation.mock.calls.find((call) => String(call[0]).includes('InsertRental'));
    expect(insert?.[1].object.expires_at).toBe('2026-11-13T00:00:00.000Z');
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

  it('refuses a non-client and a search that is empty after sanitizing', async () => {
    users.getUser.mockResolvedValue({ id: 'user-1', active_persona: 'business', business: { id: 'biz' } });
    await expect(
      service.subscribe({ q: 'tent', start_date: '2026-11-20', end_date: '2026-11-22' })
    ).rejects.toMatchObject({ status: 403 });
    users.getUser.mockResolvedValue({ id: 'user-1', client: { id: 'client-1' }, active_persona: 'client' });
    await expect(
      service.subscribe({ q: '  %_  ', start_date: '2026-11-20', end_date: '2026-11-22' })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.subscribe({ q: 'tent', start_date: '2026-02-31', end_date: '2026-03-02' })
    ).rejects.toMatchObject({ status: 400 });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('does not reuse an alert for a different category', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CountActiveRental')) {
        return { rental_availability_subscriptions_aggregate: { aggregate: { count: 0 } } };
      }
      return {
        rental_availability_subscriptions: [
          { id: 'sub-a', status: 'active', expires_at: 'x', start_at: 'x', end_at: 'x', category_id: 'cat-a' },
        ],
      };
    });
    hasura.executeMutation.mockResolvedValue({
      insert_rental_availability_subscriptions_one: {
        id: 'sub-b', status: 'active', expires_at: 'x', start_at: 'x', end_at: 'x', category_id: 'cat-b',
      },
    });
    const created = await service.subscribe({
      q: ' Tent% ',
      category_id: 'cat-b',
      country_code: ' CM ',
      state: '  ',
      start_date: '2026-11-20',
      end_date: '2026-11-22',
    });
    expect(created.id).toBe('sub-b');
    const insert = hasura.executeMutation.mock.calls[0][1].object;
    expect(insert).toMatchObject({
      query_norm: 'tent',
      query_text: 'Tent%',
      category_id: 'cat-b',
      country_code: 'CM',
      state: null,
    });
    hasura.executeMutation.mockClear();
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CountActiveRental')) {
        return { rental_availability_subscriptions_aggregate: { aggregate: { count: 0 } } };
      }
      return {
        rental_availability_subscriptions: [
          { id: 'sub-a', status: 'active', expires_at: 'x', start_at: 'x', end_at: 'x', category_id: 'cat-b' },
        ],
      };
    });
    await expect(
      service.subscribe({ q: 'tent', category_id: 'cat-b', start_date: '2026-11-20', end_date: '2026-11-22' })
    ).resolves.toMatchObject({ id: 'sub-a' });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('caps a far start at 30 days and returns the row a unique race already inserted', async () => {
    let finds = 0;
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CountActiveRental')) {
        return { rental_availability_subscriptions_aggregate: { aggregate: { count: 0 } } };
      }
      finds += 1;
      if (finds === 1) return { rental_availability_subscriptions: [] };
      return {
        rental_availability_subscriptions: [
          { id: 'sub-race', status: 'active', expires_at: 'x', start_at: 'x', end_at: 'x', category_id: null },
        ],
      };
    });
    hasura.executeMutation.mockRejectedValue(new Error('Uniqueness violation'));
    await expect(
      service.subscribe({ q: 'tent', start_date: '2026-12-20', end_date: '2026-12-22' })
    ).resolves.toMatchObject({ id: 'sub-race' });

    finds = 0;
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CountActiveRental')) {
        return { rental_availability_subscriptions_aggregate: { aggregate: { count: 0 } } };
      }
      return { rental_availability_subscriptions: [] };
    });
    hasura.executeMutation.mockResolvedValue({
      insert_rental_availability_subscriptions_one: {
        id: 'sub-far', status: 'active', expires_at: 'x', start_at: 'x', end_at: 'x',
      },
    });
    await service.subscribe({ q: 'tent', start_date: '2026-12-20', end_date: '2026-12-22' });
    expect(hasura.executeMutation.mock.calls.at(-1)?.[1].object.expires_at).toBe(
      '2026-12-10T12:00:00.000Z'
    );
  });

  it('rethrows a unique violation when the winning row cannot be read back', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CountActiveRental')) {
        return { rental_availability_subscriptions_aggregate: { aggregate: { count: 0 } } };
      }
      return { rental_availability_subscriptions: [] };
    });
    hasura.executeMutation.mockRejectedValue(new Error('Uniqueness violation'));
    await expect(
      service.subscribe({ q: 'tent', start_date: '2026-11-20', end_date: '2026-11-22' })
    ).rejects.toThrow('Uniqueness violation');
  });

  it('cancels only the signed-in user active row', async () => {
    users.getUser.mockResolvedValue({});
    await expect(service.cancel('sub-1')).rejects.toMatchObject({ status: 401 });
    users.getUser.mockResolvedValue({ id: 'user-1' });
    hasura.executeMutation.mockResolvedValue({
      update_rental_availability_subscriptions: { affected_rows: 0 },
    });
    await expect(service.cancel('sub-1')).rejects.toMatchObject({ status: 404 });
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('status: { _eq: "active" }'),
      { id: 'sub-1', userId: 'user-1' }
    );
    hasura.executeMutation.mockResolvedValue({
      update_rental_availability_subscriptions: { affected_rows: 1 },
    });
    await expect(service.cancel('sub-1')).resolves.toEqual({ success: true });
  });

  it('fails a notice on the fifth miss and requeues an earlier send error', async () => {
    hasura.executeMutation.mockImplementation(async (query: string) => {
      if (query.includes('ExpireRental') || query.includes('ScanRental')) return {};
      if (query.includes('ClaimRental')) {
        return {
          update_rental_availability_notices: {
            returning: [{ id: 'n1', attempts: 4, user_id: 'user-1', listing_id: 'free' }],
          },
        };
      }
      return { update_rental_availability_notices_by_pk: { id: 'n1' } };
    });
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('QueuedRental')) {
        return { rental_availability_notices: [{ id: 'n1', attempts: 4, user_id: 'user-1', listing_id: 'free' }] };
      }
      return { rental_availability_notices_by_pk: null };
    });
    await expect(service.deliverDue()).resolves.toBe(0);
    expect(hasura.executeMutation.mock.calls.find((call) => String(call[0]).includes('RetryRental'))?.[1]).toMatchObject({
      attempts: 5,
      status: 'failed',
      lastError: 'notice detail missing',
    });

    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('QueuedRental')) {
        return { rental_availability_notices: [{ id: 'n2', attempts: 0, user_id: 'user-1', listing_id: 'free' }] };
      }
      return {
        rental_availability_notices_by_pk: {
          user_id: 'user-1',
          listing_id: 'free',
          user: { preferred_language: 'en' },
          subscription: { start_at: '2026-11-12T00:00:00.000Z', end_at: '2026-11-15T00:00:00.000Z' },
          listing: { rental_item: { name: 'Canon' } },
        },
      };
    });
    hasura.executeMutation.mockImplementation(async (query: string) => {
      if (query.includes('ClaimRental')) {
        return {
          update_rental_availability_notices: {
            returning: [{ id: 'n2', attempts: 0, user_id: 'user-1', listing_id: 'free' }],
          },
        };
      }
      return {};
    });
    notifications.sendRentalAvailabilityNotice.mockRejectedValue(new Error('push down'));
    await expect(service.deliverDue()).resolves.toBe(0);
    const retries = hasura.executeMutation.mock.calls.filter((call) =>
      String(call[0]).includes('RetryRental')
    );
    expect(retries.at(-1)?.[1]).toMatchObject({
      id: 'n2',
      attempts: 1,
      status: 'queued',
      lastError: 'push down',
    });
  });

  it('does not claim when nothing is queued and logs a non-schema cron error', async () => {
    hasura.executeQuery.mockResolvedValue({ rental_availability_notices: [] });
    hasura.executeMutation.mockResolvedValue({});
    await expect(service.deliverDue()).resolves.toBe(0);
    expect(hasura.executeMutation.mock.calls.some((call) => String(call[0]).includes('ClaimRental'))).toBe(false);
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    hasura.executeMutation.mockRejectedValue(new Error('connection reset'));
    await expect(service.handleAvailabilityNotices()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith('connection reset');
    errorSpy.mockRestore();
  });
});
