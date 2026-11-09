import { readFileSync } from 'fs';
import { join } from 'path';
import { HttpException } from '@nestjs/common';
import { RentalInspectionService } from './rental-inspection.service';

const VERSION = '11111111-1111-4111-8111-111111111111';

function service() {
  const svc = Object.create(RentalInspectionService.prototype) as RentalInspectionService & {
    users: { getUser: jest.Mock };
    hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock };
    flags: { numberConfig: jest.Mock };
    rentals: { settleEnrolledRental: jest.Mock };
    notices: { sendRentalInspectionNotice: jest.Mock };
  };
  svc.users = {
    getUser: jest.fn().mockResolvedValue({
      id: 'user-1',
      active_persona: 'client',
      client: { id: 'client-1' },
    }),
  };
  svc.hasura = {
    executeQuery: jest.fn().mockResolvedValue({
      rental_bookings_by_pk: {
        id: 'b1',
        status: 'confirmed',
        business_id: 'biz',
        client_id: 'client-1',
        units_booked: 1,
        allocation_version: 1,
        inspection_policy_version: 1,
        pickup_current_version_id: VERSION,
        return_current_version_id: VERSION,
        booking_number: 'RB-1',
        client: { user_id: 'user-1' },
        business: { user_id: 'biz-user' },
      },
    }),
    executeMutation: jest.fn(),
  };
  svc.flags = { numberConfig: jest.fn().mockResolvedValue(48) };
  svc.rentals = { settleEnrolledRental: jest.fn() };
  svc.notices = { sendRentalInspectionNotice: jest.fn() };
  return svc;
}

const UNIQUE = new Error(
  'Uniqueness violation. duplicate key value violates unique constraint "rental_inspection_acks_version_id_persona_key"'
);

describe('inspection acknowledgement conflicts', () => {
  it.each([
    ['pickup', 'accept', undefined],
    ['return', 'accept', undefined],
    ['return', 'dispute', 'The item came back damaged'],
    ['pickup', 'correction', 'The label is wrong'],
  ] as const)(
    'returns 409 when %s %s hits the one-answer unique constraint',
    async (stage, decision, reason) => {
      const svc = service();
      svc.hasura.executeMutation.mockRejectedValue(UNIQUE);
      const error = await svc
        .acknowledge('b1', stage, VERSION, decision, reason)
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(409);
      expect(svc.rentals.settleEnrolledRental).not.toHaveBeenCalled();
      expect(svc.notices.sendRentalInspectionNotice).not.toHaveBeenCalled();
    }
  );

  it('returns 409 when the database reports the named ack conflict', async () => {
    const svc = service();
    svc.hasura.executeMutation.mockRejectedValue(new Error('rental_inspection_ack_conflict'));
    await expect(svc.acknowledge('b1', 'pickup', VERSION, 'accept')).rejects.toMatchObject({
      status: 409,
    });
    expect(svc.rentals.settleEnrolledRental).not.toHaveBeenCalled();
  });

  it('does not settle a return accept that lost the race', async () => {
    const svc = service();
    svc.hasura.executeMutation.mockResolvedValue({ rental_accept_return_version: [] });
    await expect(svc.acknowledge('b1', 'return', VERSION, 'accept')).rejects.toMatchObject({
      status: 409,
    });
    expect(svc.rentals.settleEnrolledRental).not.toHaveBeenCalled();
  });

  it('leaves an unrelated database error unchanged', async () => {
    const svc = service();
    svc.hasura.executeMutation.mockRejectedValue(new Error('database unavailable'));
    await expect(svc.acknowledge('b1', 'return', VERSION, 'accept')).rejects.toThrow(
      'database unavailable'
    );
    expect(svc.rentals.settleEnrolledRental).not.toHaveBeenCalled();
  });
});

describe('ack SQL checks the version and the existing answer together', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../../../hasura/migrations/Rendasua/20261109231500_rental_inspection_ack_conflict/up.sql'
    ),
    'utf8'
  );

  it.each([
    'rental_accept_pickup_version',
    'rental_accept_return_version',
    'rental_open_return_dispute',
    'rental_request_correction',
  ])('%s locks the booking, skips an existing answer, and names the conflict', (name) => {
    const start = sql.indexOf(`FUNCTION public.${name}`);
    const next = sql.indexOf('CREATE OR REPLACE FUNCTION', start + 1);
    const body = sql.slice(start, next === -1 ? undefined : next);
    expect(body).toContain('FOR UPDATE');
    expect(body).toContain('NOT EXISTS');
    expect(body).toContain("persona = 'client'");
    expect(body).toContain('WHEN unique_violation');
    expect(body).toContain('rental_inspection_ack_conflict');
  });
});
