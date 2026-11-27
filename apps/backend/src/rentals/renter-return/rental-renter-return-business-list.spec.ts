import { RentalRenterReturnService } from './rental-renter-return.service';

function setup(user: Record<string, unknown>, rows: Array<Record<string, unknown>> | null) {
  const executeQuery = jest.fn(async () => ({ rental_bookings: rows }));
  const service = new RentalRenterReturnService(
    { getUser: async () => user } as never,
    { executeQuery, executeMutation: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );
  return { service, executeQuery };
}

describe('RentalRenterReturnService.listForBusiness', () => {
  it('lists reported returns for the active business only', async () => {
    const rows = [{ id: 'b1', renter_reported_returned_at: '2026-11-12T18:42:00.000Z' }];
    const { service, executeQuery } = setup({ id: 'u1', active_persona: 'business', business: { id: 'biz1' } }, rows);
    await expect(service.listForBusiness()).resolves.toEqual(rows);
    const [query, variables] = executeQuery.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(variables).toEqual({ businessId: 'biz1' });
    expect(query).toContain('renter_reported_returned_at: { _is_null: false }');
    expect(query).toContain('status: { _in: ["active", "awaiting_return"] }');
    expect(query).toContain('business_id: { _eq: $businessId }');
  });

  it('returns an empty list when Hasura has none', async () => {
    const { service } = setup({ id: 'u1', active_persona: 'business', business: { id: 'biz1' } }, null);
    await expect(service.listForBusiness()).resolves.toEqual([]);
  });

  it('refuses a renter or a user without a business profile', async () => {
    const renter = setup({ id: 'u2', active_persona: 'client', client: { id: 'c1' } }, []);
    await expect(renter.service.listForBusiness()).rejects.toMatchObject({ status: 403 });
    const noBusiness = setup({ id: 'u3', active_persona: 'business', business: null }, []);
    await expect(noBusiness.service.listForBusiness()).rejects.toMatchObject({ status: 403 });
    expect(renter.executeQuery).not.toHaveBeenCalled();
  });
});
