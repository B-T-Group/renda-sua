import fs from 'fs';
import path from 'path';
import {
  bookingDetailStatusLabelKey,
  bookingDetailTimeline,
  bookingDetailTimelineIndex,
  resolveBookingPhase,
  resolveRentalPhase,
} from './rentalPhase';

describe('booking detail status labels', () => {
  it('keeps active and awaiting return distinct on the stepper', () => {
    expect(bookingDetailStatusLabelKey('active')).toBe('rentals.phases.inProgress');
    expect(bookingDetailStatusLabelKey('awaiting_return')).toBe(
      'rentals.bookingStatus.awaiting_return'
    );
    const steps = bookingDetailTimeline('awaiting_return');
    expect(steps.map(bookingDetailStatusLabelKey)).toEqual([
      'rentals.phases.offerReady',
      'rentals.phases.readyForPickup',
      'rentals.phases.inProgress',
      'rentals.bookingStatus.awaiting_return',
      'rentals.phases.done',
    ]);
    expect(bookingDetailTimelineIndex(steps, 'awaiting_return')).toBe(3);
    expect(bookingDetailTimeline('reserved')).toEqual([
      'proposed',
      'confirmed',
      'active',
      'awaiting_return',
      'completed',
    ]);
    expect(bookingDetailTimeline('reserved')).not.toContain('reserved');
    expect(bookingDetailTimeline('reserved', { includeReview: true })).toContain('report_review');
    expect(
      bookingDetailTimelineIndex(
        bookingDetailTimeline('reserved', { includeReview: true }),
        'reserved',
        { reviewCurrent: true }
      )
    ).toBe(2);
    expect(bookingDetailTimelineIndex(steps, 'cancelled')).toBe(-1);
  });

  it('does not change the 6-phase grouping used by lists and hubs', () => {
    expect(resolveBookingPhase('active').phase).toBe('in_progress');
    expect(resolveBookingPhase('awaiting_return').phase).toBe('in_progress');
    expect(resolveBookingPhase('awaiting_return').labelKey).toBe('rentals.phases.inProgress');
  });

  it('labels a reported return "Awaiting confirmation" on client list and detail', () => {
    const reportedAt = '2026-11-26T20:40:00.000Z';
    const key = 'rentals.phases.awaitingConfirmation';
    for (const status of ['active', 'awaiting_return']) {
      const info = resolveRentalPhase({ bookingStatus: status, returnReportedAt: reportedAt }, 'client');
      expect(info.labelKey).toBe(key);
      expect(info.phase).toBe('in_progress');
      expect(info.hubGroup).toBe('action_needed');
      expect(info.nextStepKey).toBe('rentals.returnReport.waitingTitle');
      expect(bookingDetailStatusLabelKey(status, { returnReportedAt: reportedAt })).toBe(key);
    }
    const business = resolveRentalPhase(
      { bookingStatus: 'awaiting_return', returnReportedAt: reportedAt },
      'business'
    );
    expect(business.nextStepKey).toBe('rentals.nextStep.awaitingReturnBusiness');
  });

  it('keeps every other status label when no return is reported', () => {
    expect(resolveRentalPhase({ bookingStatus: 'active', returnReportedAt: null }).labelKey).toBe(
      'rentals.phases.inProgress'
    );
    expect(bookingDetailStatusLabelKey('awaiting_return', { returnReportedAt: null })).toBe(
      'rentals.bookingStatus.awaiting_return'
    );
    expect(
      resolveRentalPhase({ bookingStatus: 'completed', returnReportedAt: '2026-11-26T20:40:00.000Z' })
        .labelKey
    ).toBe('rentals.phases.done');
    expect(bookingDetailStatusLabelKey('confirmed', { returnReportedAt: '2026-11-26T20:40:00.000Z' })).toBe(
      'rentals.phases.readyForPickup'
    );
  });

  it('uses Awaiting confirmation / En attente de confirmation', () => {
    expect(readLocale('en').rentals.phases.awaitingConfirmation).toBe('Awaiting confirmation');
    expect(readLocale('fr').rentals.phases.awaitingConfirmation).toBe('En attente de confirmation');
  });

  it('uses In progress / En cours and Return due / Retour dû', () => {
    const en = readLocale('en');
    const fr = readLocale('fr');
    expect(en.rentals.phases.inProgress).toBe('In progress');
    expect(fr.rentals.phases.inProgress).toBe('En cours');
    expect(en.rentals.bookingStatus.awaiting_return).toBe('Return due');
    expect(fr.rentals.bookingStatus.awaiting_return).toBe('Retour dû');
  });
});

function readLocale(language: 'en' | 'fr'): {
  rentals: {
    phases: { inProgress: string; awaitingConfirmation: string };
    bookingStatus: { awaiting_return: string };
  };
} {
  const file = path.resolve(__dirname, '../../public/locales', `${language}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
