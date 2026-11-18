import { HttpException } from '@nestjs/common';
import { DeclineExclusionService } from './decline-exclusion.service';

describe('DeclineExclusionService', () => {
  const flags = { declineRankingEnabledAnywhere: jest.fn() };
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const ranking = { clearCache: jest.fn() };
  const service = new DeclineExclusionService(hasura as any, flags as any, ranking as any);

  beforeEach(() => {
    jest.clearAllMocks();
    flags.declineRankingEnabledAnywhere.mockResolvedValue(true);
  });

  it('is a no-op when the flag is off', async () => {
    flags.declineRankingEnabledAnywhere.mockResolvedValue(false);
    await expect(service.list()).rejects.toBeInstanceOf(HttpException);
    await expect(service.set('booking', 'user', true)).rejects.toBeInstanceOf(HttpException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects a caller who is not support or admin', async () => {
    hasura.executeQuery.mockResolvedValue({ user_roles: [{ role: { key: 'moderator' } }] });
    await expect(service.set('booking', 'user', true, 'note')).rejects.toMatchObject({ status: 403 });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('stores the exclusion, audits it, and drops only the business count', async () => {
    hasura.executeQuery.mockImplementation((query: string) => {
      if (query.includes('DeclineExclusionRoles')) return { user_roles: [{ role: { key: 'support' } }] };
      if (query.includes('DeclineForExclusion')) {
        return { rental_condition_declines: [{ id: 'd1', rental_booking: { id: 'booking', status: 'cancelled' } }] };
      }
      return {
        rental_condition_declines: [
          {
            id: 'd1',
            reason: 'damaged',
            excluded_at: '2026-11-18T00:00:00.000Z',
            exclusion_note: 'Shipping damage',
            rental_booking: {
              id: 'booking',
              booking_number: 'RB-1',
              business_id: 'biz',
              client_id: 'client',
              business: { name: 'Atelier Nord' },
              client: { user: { first_name: 'Marie', last_name: 'Ngo' } },
            },
          },
        ],
        rental_condition_decline_counts_90d: [
          { role: 'business', party_id: 'biz', decline_count: 4 },
          { role: 'renter', party_id: 'client', decline_count: 6 },
        ],
        rental_business_pickup_reach_90d: [],
      };
    });
    hasura.executeMutation.mockResolvedValue({});
    const saved = await service.set('booking', 'support-user', true, 'Shipping damage');
    expect(saved).toEqual({ excluded: true });
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SetDeclineExclusion'),
      expect.objectContaining({
        set: expect.objectContaining({ excluded_by: 'support-user', exclusion_note: 'Shipping damage' }),
      })
    );
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertRentalStatusHistory'),
      expect.objectContaining({ object: expect.objectContaining({ changed_by_user_id: 'support-user' }) })
    );
    expect(ranking.clearCache).toHaveBeenCalled();
    const listed = await service.list();
    expect(listed.rows[0].businessDeclines).toBe(4);
    expect(listed.rows[0].renterDeclines).toBe(6);
    expect(listed.pageSize).toBe(20);
  });

  it('excludes an older decline row, not only the latest', async () => {
    hasura.executeQuery.mockImplementation((query: string) => {
      if (query.includes('DeclineExclusionRoles')) return { user_roles: [{ role: { key: 'support' } }] };
      if (query.includes('DeclineForExclusion')) {
        return {
          rental_condition_declines: [
            { id: 'older', rental_booking: { id: 'booking', status: 'cancelled' } },
            { id: 'latest', rental_booking: { id: 'booking', status: 'cancelled' } },
          ],
        };
      }
      return { rental_condition_declines: [] };
    });
    hasura.executeMutation.mockResolvedValue({});
    await expect(service.set('booking', 'support-user', true)).rejects.toMatchObject({ status: 409 });
    await service.set('booking', 'support-user', true, 'Transit', 'older');
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SetDeclineExclusion'),
      expect.objectContaining({ id: 'older' })
    );
  });
});
