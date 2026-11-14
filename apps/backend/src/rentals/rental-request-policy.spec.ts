import { HttpException } from '@nestjs/common';
import { RentalsService } from './rentals.service';

const request = {
  client_id: 'client-1',
  rental_location_listing: {
    rental_item: { business_id: 'biz-1' },
    business_location: { address: { country: 'CA' } },
  },
};

function service() {
  const svc: any = Object.create(RentalsService.prototype);
  svc.hasuraUserService = { getUser: jest.fn() };
  svc.fetchRequest = jest.fn().mockResolvedValue(request);
  svc.listingInspectionPolicy = jest.fn().mockResolvedValue(1);
  return svc;
}

describe('GET request inspection policy', () => {
  it('returns the policy to the requester and the listing business', async () => {
    const svc = service();
    svc.hasuraUserService.getUser.mockResolvedValue({
      active_persona: 'client',
      client: { id: 'client-1' },
    });
    await expect(svc.getRequestInspectionPolicy('req-1')).resolves.toBe(1);
    svc.hasuraUserService.getUser.mockResolvedValue({
      active_persona: 'business',
      business: { id: 'biz-1' },
    });
    await expect(svc.getRequestInspectionPolicy('req-1')).resolves.toBe(1);
  });

  it('returns 404 for anyone else', async () => {
    const svc = service();
    svc.hasuraUserService.getUser.mockResolvedValue({
      active_persona: 'client',
      client: { id: 'someone-else' },
    });
    await expect(svc.getRequestInspectionPolicy('req-1')).rejects.toBeInstanceOf(HttpException);
    await expect(svc.getRequestInspectionPolicy('req-1')).rejects.toMatchObject({ status: 404 });
  });
});
