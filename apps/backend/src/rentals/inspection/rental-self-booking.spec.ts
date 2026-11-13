import { readFileSync } from 'fs';
import { join } from 'path';
import { RentalsService } from '../rentals.service';
import { RentalInspectionEvidenceService } from './rental-inspection-evidence.service';
import { RentalInspectionFlags } from './rental-inspection-flags.service';
import { INSPECTION_POLICY_VERSION } from './rental-inspection.policy';
import { RentalInspectionService } from './rental-inspection.service';

const SAME = {
  id: 'same-user',
  business: { id: 'biz' },
  client: { id: 'client' },
};

describe('rentals_inspection_allow_self_booking', () => {
  const root = join(__dirname, '../../../..');
  const up = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261113140000_rentals_inspection_allow_self_booking/up.sql'),
    'utf8'
  );
  const down = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261113140000_rentals_inspection_allow_self_booking/down.sql'),
    'utf8'
  );
  const action = readFileSync(join(root, '../.github/actions/apply-hasura/action.yml'), 'utf8');

  it('inserts the global flag false and removes only that row', () => {
    expect(up).toContain("'rentals_inspection_allow_self_booking'");
    expect(up).toMatch(/'boolean', false/);
    expect(up).not.toMatch(/'boolean', true/);
    expect(up).toContain('country_code IS NULL');
    expect(up).not.toContain('NODE_ENV');
    expect(down).toContain("'rentals_inspection_allow_self_booking'");
    expect(down).toContain('country_code IS NULL');
  });

  it('does not turn the flag on from Hasura apply', () => {
    expect(action).not.toContain('rentals_inspection_allow_self_booking');
  });
});

describe('RentalInspectionFlags.allowSelfBooking', () => {
  function flags(rows: Array<{ boolean_value?: boolean | null }> | Error) {
    const executeQuery = jest.fn(async () => {
      if (rows instanceof Error) throw rows;
      return { application_configurations: rows };
    });
    const service = new RentalInspectionFlags({ executeQuery } as any);
    return { service, executeQuery };
  }

  it('reads the key with the country row ahead of the global row', async () => {
    const { service, executeQuery } = flags([{ boolean_value: true }]);
    await expect(service.allowSelfBooking('cm')).resolves.toBe(true);
    const [query, vars] = executeQuery.mock.calls[0];
    expect(query).toContain('config_key: { _eq: $key }');
    expect(query).toContain('country_code: desc_nulls_last');
    expect(query).toContain('country_code: { _eq: $country }');
    expect(vars).toEqual({ key: 'rentals_inspection_allow_self_booking', country: 'cm' });
  });

  it('stays false when the row is missing, false, or unreadable', async () => {
    await expect(flags([]).service.allowSelfBooking('CM')).resolves.toBe(false);
    await expect(flags([{ boolean_value: false }]).service.allowSelfBooking()).resolves.toBe(false);
    await expect(flags(new Error('down')).service.allowSelfBooking('CM')).resolves.toBe(false);
  });
});

describe('enrolment reads the self-booking flag', () => {
  const svc: any = Object.create(RentalsService.prototype);
  const end = new Date('2026-11-15T16:00:00.000Z');

  beforeEach(() => {
    svc.parseRentalSelectionWindows = () => [{ start: new Date('2026-11-14T16:00:00.000Z'), end }];
    svc.paymentRoutingService = { resolveRailForCountry: jest.fn().mockResolvedValue('mobile_money') };
    svc.inspectionFlags = {
      numberConfig: jest.fn().mockResolvedValue(72),
      allowSelfBooking: jest.fn().mockResolvedValue(false),
    };
  });

  const ownListing = {
    client: { user_id: 'same-user' },
    rental_location_listing: { rental_item: { business: { user_id: 'same-user' } } },
  };

  it('rejects with RENTAL_INSPECTION_SELF_RENTAL while the flag is off', async () => {
    await expect(svc.enrolOrReject(ownListing, 'CM')).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({ code: 'RENTAL_INSPECTION_SELF_RENTAL' }),
    });
    expect(svc.inspectionFlags.allowSelfBooking).toHaveBeenCalledWith('CM');
  });

  it('enrols the owner booking when the flag is on', async () => {
    svc.inspectionFlags.allowSelfBooking.mockResolvedValue(true);
    await expect(svc.enrolOrReject(ownListing, 'CM')).resolves.toBe(INSPECTION_POLICY_VERSION);
  });

  it('still rejects multiple windows when the flag is on', async () => {
    svc.inspectionFlags.allowSelfBooking.mockResolvedValue(true);
    svc.parseRentalSelectionWindows = () => [
      { start: new Date('2026-11-14T16:00:00.000Z'), end },
      { start: new Date('2026-11-16T16:00:00.000Z'), end: new Date('2026-11-17T16:00:00.000Z') },
    ];
    await expect(svc.enrolOrReject(ownListing, 'CM')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RENTAL_INSPECTION_MULTI_WINDOW' }),
    });
  });
});

describe('one user on both sides keeps the active persona', () => {
  const booking = {
    id: 'b1',
    business_id: 'biz',
    client_id: 'client',
    status: 'confirmed',
    inspection_policy_version: 1,
    client: { user_id: 'same-user' },
    business: { user_id: 'same-user' },
  };

  it('opens the business inspection only while the business persona is active', async () => {
    const svc: any = Object.create(RentalInspectionService.prototype);
    svc.users = { getUser: jest.fn() };
    svc.booking = jest.fn().mockResolvedValue(booking);
    svc.users.getUser.mockResolvedValue({ ...SAME, active_persona: 'business' });
    await expect(svc.requireBusiness('b1')).resolves.toMatchObject({ actorId: 'same-user' });
    await expect(svc.viewer('b1')).resolves.toEqual({ audience: 'business' });
    await expect(svc.requireClient('b1')).rejects.toMatchObject({ status: 403 });
  });

  it('accepts as the renter only while the client persona is active', async () => {
    const svc: any = Object.create(RentalInspectionService.prototype);
    svc.users = { getUser: jest.fn() };
    svc.booking = jest.fn().mockResolvedValue(booking);
    svc.users.getUser.mockResolvedValue({ ...SAME, active_persona: 'client' });
    await expect(svc.requireClient('b1')).resolves.toMatchObject({ actorId: 'same-user' });
    await expect(svc.viewer('b1')).resolves.toEqual({ audience: 'client' });
    await expect(svc.requireBusiness('b1')).rejects.toMatchObject({ status: 403 });
  });

  it('lets the business persona upload the report and the client persona the counter photo', async () => {
    const evidence: any = Object.create(RentalInspectionEvidenceService.prototype);
    evidence.users = { getUser: jest.fn() };
    evidence.bookingParty = jest.fn().mockResolvedValue(booking);
    evidence.users.getUser.mockResolvedValue({ ...SAME, active_persona: 'business' });
    await expect(evidence.actorForUpload('b1', 'overview')).resolves.toMatchObject({ userId: 'same-user' });
    evidence.users.getUser.mockResolvedValue({ ...SAME, active_persona: 'client' });
    await expect(evidence.actorForUpload('b1', 'counter')).resolves.toMatchObject({ userId: 'same-user' });
    await expect(evidence.actorForUpload('b1', 'overview')).rejects.toMatchObject({ status: 403 });
  });
});
