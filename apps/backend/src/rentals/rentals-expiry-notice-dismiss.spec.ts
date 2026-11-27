import { HttpException, HttpStatus } from '@nestjs/common';
import { RentalsService } from './rentals.service';

function harness() {
  const service = Object.create(RentalsService.prototype) as RentalsService & {
    requireBusinessId: jest.Mock;
    hasuraSystemService: { executeQuery: jest.Mock };
  };
  service.requireBusinessId = jest.fn().mockResolvedValue('biz-1');
  service.hasuraSystemService = { executeQuery: jest.fn() };
  return service;
}

describe('dashboard expiry notice dismissal', () => {
  it('only lists no-response requests of this business that were not dismissed', async () => {
    const service = harness();
    service.hasuraSystemService.executeQuery.mockResolvedValue({ rental_requests: [] });

    await (service as any).recentNoResponseNotices('biz-1');

    const where = service.hasuraSystemService.executeQuery.mock.calls[0][1].where;
    expect(where.unavailable_reason_code).toEqual({ _eq: 'no_response' });
    expect(where.expiry_notice_dismissed_at).toEqual({ _is_null: true });
    expect(where.rental_location_listing.rental_item.business_id).toEqual({ _eq: 'biz-1' });
  });

  it('stamps the dismissal on a no-response request owned by the business', async () => {
    const service = harness();
    service.hasuraSystemService.executeQuery.mockResolvedValue({
      update_rental_requests: { affected_rows: 1 },
    });

    await expect(service.dismissRentalExpiryNotice('req-1')).resolves.toEqual({ success: true });

    const vars = service.hasuraSystemService.executeQuery.mock.calls[0][1];
    expect(vars.where.id).toEqual({ _eq: 'req-1' });
    expect(vars.where.unavailable_reason_code).toEqual({ _eq: 'no_response' });
    expect(vars.where.rental_location_listing.rental_item.business_id).toEqual({ _eq: 'biz-1' });
    expect(Number.isNaN(Date.parse(vars.dismissedAt))).toBe(false);
  });

  it('answers 404 when the request is not an expired request of this business', async () => {
    const service = harness();
    service.hasuraSystemService.executeQuery.mockResolvedValue({
      update_rental_requests: { affected_rows: 0 },
    });

    await expect(service.dismissRentalExpiryNotice('req-2')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
    await expect(service.dismissRentalExpiryNotice('req-2')).rejects.toBeInstanceOf(HttpException);
  });

  it('rejects a caller without a business profile before touching the data', async () => {
    const service = harness();
    service.requireBusinessId.mockRejectedValue(
      new HttpException('Business profile required', HttpStatus.FORBIDDEN)
    );

    await expect(service.dismissRentalExpiryNotice('req-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
    expect(service.hasuraSystemService.executeQuery).not.toHaveBeenCalled();
  });
});
