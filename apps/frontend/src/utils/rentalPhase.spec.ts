import fs from 'fs';
import path from 'path';
import {
  bookingDetailStatusLabelKey,
  bookingDetailTimeline,
  bookingDetailTimelineIndex,
  resolveBookingPhase,
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
    expect(bookingDetailTimelineIndex(steps, 'cancelled')).toBe(-1);
  });

  it('does not change the 6-phase grouping used by lists and hubs', () => {
    expect(resolveBookingPhase('active').phase).toBe('in_progress');
    expect(resolveBookingPhase('awaiting_return').phase).toBe('in_progress');
    expect(resolveBookingPhase('awaiting_return').labelKey).toBe('rentals.phases.inProgress');
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
    phases: { inProgress: string };
    bookingStatus: { awaiting_return: string };
  };
} {
  const file = path.resolve(__dirname, '../../public/locales', `${language}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
