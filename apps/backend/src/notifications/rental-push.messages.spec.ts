import {
  buildRentalBookingConfirmedPush,
  buildRentalBookingReservedPush,
  buildRentalInspectionNotice,
  buildRentalStartedBusinessNotice,
  buildRentalStartedClientPush,
  buildReportSentInApp,
  buildReturnAcceptedPush,
  formatRentalNoticeDue,
} from './rental-push.messages';

const item = 'JBL PartyBox 310';
const number = 'RB-25496259';

describe('rental push copy', () => {
  it('keeps the legacy booking-confirmed PIN sentence byte for byte', () => {
    expect(buildRentalBookingConfirmedPush({ rentalItemName: item, bookingNumber: number })).toEqual({
      title: 'Rental confirmed',
      body: `${item} (${number}) is confirmed. Your start PIN is ready.`,
    });
    expect(
      buildRentalBookingConfirmedPush({
        rentalItemName: item,
        bookingNumber: number,
        preferredLanguage: 'fr',
      })
    ).toEqual({
      title: 'Location confirmée',
      body: `${item} (${number}) est confirmée. Votre code PIN est prêt.`,
    });
  });

  it('uses the no-PIN sentence only for an inspected confirmation', () => {
    const en = buildRentalBookingConfirmedPush({
      rentalItemName: item,
      bookingNumber: number,
      inspected: true,
    });
    expect(en.body).toBe(
      `${item} (${number}) is confirmed. At pickup, the business will share a condition report for you to accept.`
    );
    const fr = buildRentalBookingConfirmedPush({
      rentalItemName: item,
      bookingNumber: number,
      inspected: true,
      preferredLanguage: 'fr-CA',
    });
    expect(fr.body).toBe(
      `${item} (${number}) est confirmée. Au retrait, l'entreprise partagera un état des lieux à accepter.`
    );
  });

  it('keeps the legacy reserved client sentence and the business sentence', () => {
    expect(
      buildRentalBookingReservedPush({ rentalItemName: item, bookingNumber: number, forBusiness: false }).body
    ).toBe(`${item} (${number}) is reserved. Pay at pickup to start.`);
    expect(
      buildRentalBookingReservedPush({
        rentalItemName: item,
        bookingNumber: number,
        forBusiness: false,
        preferredLanguage: 'fr',
      }).body
    ).toBe(`${item} (${number}) est réservé. Payez au retrait pour commencer.`);
    expect(
      buildRentalBookingReservedPush({
        rentalItemName: item,
        bookingNumber: number,
        forBusiness: true,
        inspected: true,
        preferredLanguage: 'fr',
      }).body
    ).toBe(`${item} (${number}) est réservé. Le client paiera au retrait.`);
  });

  it('uses the inspected reserved sentence for the client only', () => {
    expect(
      buildRentalBookingReservedPush({
        rentalItemName: item,
        bookingNumber: number,
        forBusiness: false,
        inspected: true,
      }).body
    ).toBe(`${item} (${number}) is reserved. Pay when you accept the condition report at pickup.`);
    expect(
      buildRentalBookingReservedPush({
        rentalItemName: item,
        bookingNumber: number,
        forBusiness: false,
        inspected: true,
        preferredLanguage: 'fr',
      }).body
    ).toBe(`${item} (${number}) est réservée. Payez lorsque vous acceptez l'état des lieux au retrait.`);
  });

  it('keeps pickup accepted neutral until the rental is active', () => {
    expect(
      buildRentalInspectionNotice({
        kind: 'pickup_accepted',
        rentalItemName: item,
        renterName: 'Amina',
        returnDue: '18 Nov · 20:00',
      })
    ).toEqual({
      title: 'Condition report accepted',
      body: `The renter accepted the condition report for ${item}.`,
    });
    expect(
      buildRentalInspectionNotice({
        kind: 'pickup_accepted',
        rentalItemName: item,
        preferredLanguage: 'fr',
      }).body
    ).toBe(`Le client a accepté l'état des lieux de ${item}.`);
    const started = buildRentalStartedBusinessNotice({
      rentalItemName: item,
      renterName: 'Amina',
      returnDue: '18 Nov · 20:00',
    });
    expect(started.title).toBe('Rental started');
    expect(started.body).toContain('is now in progress');
  });

  it('builds the flagged client, return, and report-sent notices', () => {
    expect(buildRentalStartedClientPush({ rentalItemName: item, returnDue: '18 Nov · 20:00' })).toEqual({
      title: 'Rental started',
      body: `Your rental of ${item} has started. Return is due by 18 Nov · 20:00.`,
    });
    expect(buildReturnAcceptedPush({ rentalItemName: item, renterName: 'Amina', preferredLanguage: 'fr' })).toEqual({
      title: 'Retour accepté',
      body: `Amina a accepté le rapport de retour pour ${item}.`,
    });
    expect(buildReportSentInApp({ rentalItemName: item, renterName: 'Amina' }).body).toBe(
      `We asked Amina to review the pickup report for ${item}.`
    );
  });

  it('formats the due clock in the listing time zone', () => {
    const iso = '2026-11-18T20:00:00.000Z';
    expect(formatRentalNoticeDue(iso, 'America/Toronto', 'en')).toBe('18 Nov · 15:00');
    expect(formatRentalNoticeDue('2026-11-19T01:00:00.000Z', 'America/Toronto', 'en')).toBe('18 Nov · 20:00');
    const fr = formatRentalNoticeDue('2026-11-19T01:00:00.000Z', 'America/Toronto', 'fr');
    expect(fr.startsWith('18 nov')).toBe(true);
    expect(fr.endsWith('20:00')).toBe(true);
    expect(fr).not.toContain('h');
  });
});
