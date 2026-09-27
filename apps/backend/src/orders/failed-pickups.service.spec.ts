import { HttpStatus } from '@nestjs/common';
import { FailedPickupsService } from './failed-pickups.service';

function createService() {
  const getUser = jest.fn();
  const executeQuery = jest.fn();
  const failPickup = jest.fn();
  const service = new FailedPickupsService(
    { getUser } as never,
    { executeQuery } as never,
    { failPickup } as never
  );
  return { service, getUser, executeQuery, failPickup };
}

const businessUser = {
  id: 'user-1',
  active_persona: 'business',
  business: { id: 'biz-1' },
};

describe('FailedPickupsService', () => {
  it('returns the reason in the requested language', async () => {
    const { service, executeQuery } = createService();
    executeQuery.mockResolvedValue({
      pickup_failure_reasons: [
        {
          id: 'reason-1',
          reason_key: 'no_show',
          reason_en: 'Customer did not show',
          reason_fr: 'Client absent',
          is_active: true,
          sort_order: 1,
        },
      ],
    });

    const french = await service.getFailureReasons('fr');
    const english = await service.getFailureReasons('en');

    expect(french[0].reason).toBe('Client absent');
    expect(english[0].reason).toBe('Customer did not show');

    executeQuery.mockResolvedValue({});
    expect(await service.getFailureReasons()).toEqual([]);
  });

  it('rejects a list request from another business or persona', async () => {
    const { service, getUser, executeQuery } = createService();
    getUser.mockResolvedValue({
      ...businessUser,
      business: { id: 'other-biz' },
    });

    await expect(service.getFailedPickups('biz-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });

    getUser.mockResolvedValue({ ...businessUser, active_persona: 'client' });
    await expect(service.getFailedPickups('biz-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('filters by location and status, and skips auth for system callers', async () => {
    const { service, getUser, executeQuery } = createService();
    executeQuery.mockResolvedValue({ failed_pickups: [{ id: 'fp-1' }] });

    const rows = await service.getFailedPickups(
      'biz-1',
      { status: 'pending' },
      { skipAuth: true, locationId: 'loc-1' }
    );

    expect(getUser).not.toHaveBeenCalled();
    expect(rows).toEqual([{ id: 'fp-1' }]);
    const [query, variables] = executeQuery.mock.calls[0];
    expect(query).toContain('business_location_id: { _eq: $locationId }');
    expect(query).toContain('status: { _eq: $status }');
    expect(variables).toEqual({
      businessId: 'biz-1',
      locationId: 'loc-1',
      status: 'pending',
    });
  });

  it('hides a failed pickup that belongs to another business', async () => {
    const { service, getUser, executeQuery } = createService();
    getUser.mockResolvedValue(businessUser);
    executeQuery.mockResolvedValue({
      failed_pickups: [{ id: 'fp-1', business_id: 'other-biz' }],
    });

    await expect(service.getFailedPickup('order-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('returns 404 when the order has no failed pickup', async () => {
    const { service, getUser, executeQuery } = createService();
    getUser.mockResolvedValue(businessUser);
    executeQuery.mockResolvedValue({ failed_pickups: [] });

    await expect(service.getFailedPickup('order-1')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('delegates marking a pickup failed to orders', async () => {
    const { service, failPickup } = createService();
    failPickup.mockResolvedValue({ success: true });
    const params = {
      orderId: 'order-1',
      failure_reason_id: 'reason-1',
      notes: 'left',
    };

    await expect(service.failPickup(params)).resolves.toEqual({ success: true });
    expect(failPickup).toHaveBeenCalledWith(params);
  });
});
