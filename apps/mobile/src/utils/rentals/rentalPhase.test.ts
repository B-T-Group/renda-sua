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
    const steps = bookingDetailTimeline('active');
    const labels = steps.map(bookingDetailStatusLabelKey);
    expect(labels.filter((key) => key === 'rentals.phases.inProgress')).toEqual([
      'rentals.phases.inProgress',
    ]);
    expect(labels).toContain('rentals.bookingStatus.awaiting_return');
    expect(bookingDetailTimelineIndex(steps, 'active')).toBe(steps.indexOf('active'));
    expect(bookingDetailTimelineIndex(steps, 'cancelled')).toBe(-1);
    expect(bookingDetailTimeline('reserved')).toEqual([
      'proposed',
      'confirmed',
      'active',
      'awaiting_return',
      'completed',
    ]);
  });

  it('does not change the 6-phase grouping used by lists and hubs', () => {
    expect(resolveBookingPhase('active').phase).toBe('in_progress');
    expect(resolveBookingPhase('awaiting_return').phase).toBe('in_progress');
    expect(resolveBookingPhase('active').labelKey).toBe('rentals.phases.inProgress');
    expect(resolveBookingPhase('awaiting_return').labelKey).toBe('rentals.phases.inProgress');
  });

  it('uses In progress / En cours and Return due / Retour dû', () => {
    const en = readLocale('en');
    const fr = readLocale('fr');
    expect(en.rentals.phases.inProgress).toBe('In progress');
    expect(fr.rentals.phases.inProgress).toBe('En cours');
    expect(en.rentals.bookingStatus.active).toBe('In progress');
    expect(fr.rentals.bookingStatus.active).toBe('En cours');
    expect(en.rentals.bookingStatus.awaiting_return).toBe('Return due');
    expect(fr.rentals.bookingStatus.awaiting_return).toBe('Retour dû');
  });
});

function readLocale(language: 'en' | 'fr'): {
  rentals: {
    phases: { inProgress: string };
    bookingStatus: { active: string; awaiting_return: string };
  };
} {
  const file = path.resolve(__dirname, '../../i18n/locales', `${language}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
