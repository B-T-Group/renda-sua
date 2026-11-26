import { RentalRenterReturnService } from './rental-renter-return.service';
import { assertCanReportNotReceived } from '../inspection/rental-not-received.policy';
import { buildRenterReturnedNotice, formatRentalNoticeClock } from '../../notifications/rental-push.messages';

// Toronto booking 2:00 PM – 6:00 PM (wall clock), picked up 2:00 PM (19:00Z).
const TORONTO = {
  actual_start_at: '2026-11-26T19:00:00.000Z',
  end_at: '2026-11-26T18:00:00.000Z',
  country: 'CA',
};
// 3:40 PM Toronto.
const EARLY_NOW = new Date('2026-11-26T20:40:00.000Z');

function setup(overrides: Record<string, unknown> = {}, notReceived = false) {
  let row: Record<string, unknown> = {
    id: 'b1',
    booking_number: 'RB-1',
    client_id: 'c1',
    status: 'active',
    actual_start_at: TORONTO.actual_start_at,
    end_at: TORONTO.end_at,
    renter_reported_returned_at: null,
    renter_return_escalated_at: null,
    inspection_policy_version: null,
    business: { user_id: 'bu1' },
    client: { user: { first_name: 'Amina' } },
    rental_location_listing: {
      rental_item: { name: 'JBL PartyBox 310' },
      business_location: { address: { country: TORONTO.country } },
    },
    ...overrides,
  };
  const executeQuery = jest.fn(async () => ({
    rental_bookings_by_pk: row,
    rental_not_received_reports: notReceived ? [{ id: 'nr1' }] : [],
  }));
  const executeMutation = jest.fn(async (_q: string, vars: { at: string }) => {
    row = { ...row, renter_reported_returned_at: vars.at };
    return { update_rental_bookings: { returning: [{ id: 'b1' }] } };
  });
  const notifications = { sendBusinessRenterReturned: jest.fn(async () => undefined) };
  const service = new RentalRenterReturnService(
    { getUser: async () => ({ id: 'u1', active_persona: 'client', client: { id: 'c1' } }) } as never,
    { executeQuery, executeMutation } as never,
    notifications as never,
    { getClientFlags: async () => ({ rentals_renter_return_report_enabled: true }) } as never,
    {} as never,
    {} as never
  );
  return { service, executeMutation, notifications };
}

describe('Return early (renter report before the due)', () => {
  it('stamps the report, says early, and sends the early business notice', async () => {
    const { service, executeMutation, notifications } = setup();
    const result = await service.report('b1', EARLY_NOW);
    expect(result.early).toBe(true);
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(notifications.sendBusinessRenterReturned).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'b1',
        early: {
          renterName: 'Amina',
          returnedAt: EARLY_NOW.toISOString(),
          endAt: TORONTO.end_at,
          timeZone: 'America/Toronto',
        },
      })
    );
  });

  it('is not early after the due on the listing clock (6:10 PM Toronto)', async () => {
    const { service, notifications } = setup();
    const result = await service.report('b1', new Date('2026-11-26T23:10:00.000Z'));
    expect(result.early).toBe(false);
    expect(notifications.sendBusinessRenterReturned).toHaveBeenCalledWith(
      expect.objectContaining({ early: undefined })
    );
  });

  it('refuses while a “didn’t receive the item” report is open (409)', async () => {
    const { service, executeMutation } = setup({}, true);
    await expect(service.report('b1', EARLY_NOW)).rejects.toMatchObject({
      status: 409,
      response: { code: 'RENTAL_RETURN_NOT_RECEIVED_OPEN' },
    });
    expect(executeMutation).not.toHaveBeenCalled();
  });
});

describe('Didn’t receive the item after Return early', () => {
  it('refuses report-not-received once the renter reported the return (409)', () => {
    const now = new Date('2026-11-26T19:10:00.000Z');
    expect(() =>
      assertCanReportNotReceived(
        {
          inspection_policy_version: 1,
          actual_start_at: TORONTO.actual_start_at,
          renter_reported_returned_at: '2026-11-26T19:05:00.000Z',
        },
        now
      )
    ).toThrow(expect.objectContaining({ status: 409 }));
    expect(() =>
      assertCanReportNotReceived(
        { inspection_policy_version: 1, actual_start_at: TORONTO.actual_start_at, renter_reported_returned_at: null },
        now
      )
    ).not.toThrow();
  });
});

describe('Early return business notice', () => {
  const early = {
    renterName: 'Amina',
    returnedAt: EARLY_NOW.toISOString(),
    endAt: TORONTO.end_at,
    timeZone: 'America/Toronto',
  };

  it('EN uses the listing clock, 12 h for Americas', () => {
    expect(
      buildRenterReturnedNotice({ rentalItemName: 'JBL PartyBox 310', bookingNumber: 'RB-1', early, preferredLanguage: 'en' })
    ).toEqual({
      title: 'Early return · JBL PartyBox 310',
      body: 'Amina says they returned it at 3:40\u00a0PM, before 6:00\u00a0PM. Check it and confirm the return.',
    });
  });

  it('FR uses vous and 24 h', () => {
    expect(
      buildRenterReturnedNotice({ rentalItemName: 'JBL PartyBox 310', bookingNumber: 'RB-1', early, preferredLanguage: 'fr' })
    ).toEqual({
      title: 'Retour anticipé · JBL PartyBox 310',
      body: 'Amina indique l’avoir rendu à 15:40, avant 18:00. Vérifiez-le et confirmez le retour.',
    });
  });

  it('Douala stays 24 h in English', () => {
    expect(formatRentalNoticeClock('2026-11-26T14:40:00.000Z', 'Africa/Douala', 'en')).toBe('15:40');
    expect(formatRentalNoticeClock('2026-11-26T18:00:00.000Z', 'Africa/Douala', 'en', true)).toBe('18:00');
  });

  it('keeps the regular notice when the return is not early', () => {
    expect(buildRenterReturnedNotice({ rentalItemName: 'JBL', bookingNumber: 'RB-1' }).title).toBe(
      'Renter says the item is back'
    );
  });
});
