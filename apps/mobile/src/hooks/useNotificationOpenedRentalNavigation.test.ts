import { describe, expect, it } from 'vitest';
import {
  pendingRentalOpen,
  personaForPendingReplay,
  rentalPushRoute,
} from '../utils/rentals/rentalPushNavigation';

describe('legacy rental push replay', () => {
  it('opens the business booking when a cold-start tap replays after the business persona is active', () => {
    const pending = pendingRentalOpen(
      { kind: 'booking', bookingId: 'booking-1' },
      null,
      ''
    );
    expect(pending.persona).toBeNull();
    expect(rentalPushRoute(pending.target, personaForPendingReplay(pending.persona, null), '')).toEqual({
      name: 'RentalBookingDetail',
      params: { bookingId: 'booking-1' },
    });
    const persona = personaForPendingReplay(pending.persona, 'business');
    expect(rentalPushRoute(pending.target, persona, pending.kind)).toEqual({
      name: 'BusinessRentalBookingDetail',
      params: { bookingId: 'booking-1' },
    });
  });

  it('keeps a named inspection persona instead of the shell that was active at tap time', () => {
    const pending = pendingRentalOpen(
      { kind: 'booking', bookingId: 'booking-1' },
      'business',
      'correction'
    );
    expect(personaForPendingReplay(pending.persona, 'client')).toBe('business');
    expect(rentalPushRoute(pending.target, pending.persona, pending.kind).name).toBe(
      'BusinessInspection'
    );
  });
});
