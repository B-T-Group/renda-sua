export type RentalPushTarget =
  | { kind: 'booking'; bookingId: string }
  | { kind: 'request'; requestId: string }
  | { kind: 'myRentals' };

export type PushPersona = 'client' | 'business' | null;

export type PendingRentalOpen = {
  target: RentalPushTarget;
  /** Persona named on the push. Null for legacy rental pushes. */
  persona: PushPersona;
  kind: string;
};

/** Queue the push's persona only. A legacy push has none, so replay uses whoever is signed in. */
export function pendingRentalOpen(
  target: RentalPushTarget,
  requested: PushPersona,
  kind: string
): PendingRentalOpen {
  return { target, persona: requested, kind };
}

/** Named push persona wins. Otherwise use the persona active when the queued tap opens. */
export function personaForPendingReplay(
  queued: PushPersona,
  activePersona: 'client' | 'business' | 'agent' | null
): 'client' | 'business' | 'agent' | null {
  return queued ?? activePersona;
}

function inspectionScreen(
  persona: 'client' | 'business' | null,
  kind: string,
  bookingId: string
): { name: string; params: { bookingId: string; stage?: 'pickup' | 'return' } } | null {
  if (persona === 'client' && (kind === 'review_pickup' || kind === 'correction')) {
    return { name: 'ClientInspection', params: { bookingId, stage: 'pickup' } };
  }
  if (persona === 'client' && (kind === 'review_return' || kind === 'return_reminder')) {
    return { name: 'ClientInspection', params: { bookingId, stage: 'return' } };
  }
  if (persona === 'business' && (kind === 'correction' || kind === 'pickup_accepted')) {
    return { name: 'BusinessInspection', params: { bookingId, stage: 'pickup' } };
  }
  if (persona === 'business' && (kind === 'disputed' || kind === 'review_return')) {
    return { name: 'BusinessInspection', params: { bookingId, stage: 'return' } };
  }
  return null;
}

export function rentalPushRoute(
  target: RentalPushTarget,
  persona: 'client' | 'business' | 'agent' | null,
  inspectionKind = ''
): { name: string; params: Record<string, unknown> } {
  if (target.kind === 'booking') {
    const screen = inspectionScreen(
      persona === 'client' || persona === 'business' ? persona : null,
      inspectionKind,
      target.bookingId
    );
    if (screen) return screen;
    if (persona === 'business') {
      return { name: 'BusinessRentalBookingDetail', params: { bookingId: target.bookingId } };
    }
    return { name: 'RentalBookingDetail', params: { bookingId: target.bookingId } };
  }
  if (persona === 'business') return { name: 'BusinessRentalsStudio', params: {} };
  return { name: 'ClientMyRentals', params: {} };
}
