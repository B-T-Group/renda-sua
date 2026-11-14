import { HttpException, HttpStatus } from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { REQUEST_POLICY_NOT_FOUND, requestPolicyIdPipe } from './rental-request-policy';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const request = {
  client_id: 'client-1',
  rental_location_listing: {
    rental_item: { business_id: 'biz-1' },
    business_location: { address: { country: 'CA' } },
  },
};

function service(row: unknown = request) {
  const svc: any = Object.create(RentalsService.prototype);
  svc.hasuraUserService = { getUser: jest.fn() };
  svc.hasuraSystemService = {
    executeQuery: jest.fn().mockResolvedValue({ rental_requests_by_pk: row }),
  };
  svc.listingInspectionPolicy = jest.fn().mockResolvedValue(1);
  return svc;
}

async function thrown(run: Promise<unknown>) {
  try {
    await run;
  } catch (error: any) {
    return { status: error.getStatus(), body: error.getResponse() };
  }
  throw new Error('expected a 404');
}

describe('GET request inspection policy', () => {
  it('returns the policy to the requester and the listing business', async () => {
    const svc = service();
    svc.hasuraUserService.getUser.mockResolvedValue({
      active_persona: 'client',
      client: { id: 'client-1' },
    });
    await expect(svc.getRequestInspectionPolicy(REQUEST_ID)).resolves.toBe(1);
    svc.hasuraUserService.getUser.mockResolvedValue({
      active_persona: 'business',
      business: { id: 'biz-1' },
    });
    await expect(svc.getRequestInspectionPolicy(REQUEST_ID)).resolves.toBe(1);
  });

  it('returns one 404 body for a missing id, someone else, and a malformed id', async () => {
    const missing = service(null);
    missing.hasuraUserService.getUser.mockResolvedValue({
      active_persona: 'client',
      client: { id: 'client-1' },
    });
    const other = service();
    other.hasuraUserService.getUser.mockResolvedValue({
      active_persona: 'client',
      client: { id: 'someone-else' },
    });
    const malformed = service();
    const hidden = service();
    hidden.hasuraUserService.getUser.mockResolvedValue({
      active_persona: 'client',
      client: { id: 'client-1' },
    });
    hidden.hasuraSystemService.executeQuery.mockRejectedValue(
      new HttpException({ success: false, message: 'Invalid identifier' }, HttpStatus.BAD_REQUEST)
    );
    const expected = { status: 404, body: REQUEST_POLICY_NOT_FOUND };
    const bodies = await Promise.all([
      thrown(missing.getRequestInspectionPolicy(REQUEST_ID)),
      thrown(other.getRequestInspectionPolicy(REQUEST_ID)),
      thrown(malformed.getRequestInspectionPolicy('not-a-uuid')),
      thrown(hidden.getRequestInspectionPolicy(REQUEST_ID)),
    ]);
    expect(bodies).toEqual([expected, expected, expected, expected]);
    expect(malformed.hasuraSystemService.executeQuery).not.toHaveBeenCalled();
  });

  it('maps ParseUUIDPipe failures to that same 404', async () => {
    const failure = requestPolicyIdPipe.transform('not-a-uuid', { type: 'param', data: 'id' });
    await expect(failure).rejects.toBeInstanceOf(HttpException);
    await expect(failure).rejects.toMatchObject({ status: 404, response: REQUEST_POLICY_NOT_FOUND });
  });
});
