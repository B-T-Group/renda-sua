/**
 * Maps backend request/booking statuses to a 6-phase user mental model.
 * Keep in sync with mobile-rendasua/src/utils/rentals/rentalPhase.ts
 */

export type RentalPhase =
  | 'requested'
  | 'offer_ready'
  | 'reserved'
  | 'ready_for_pickup'
  | 'in_progress'
  | 'done';

export type RentalPhaseRole = 'client' | 'business';

export type RentalHubGroup = 'action_needed' | 'upcoming' | 'past';

export type BusinessActionQueue =
  | 'respond'
  | 'collect_pay'
  | 'start'
  | 'return'
  | 'all';

export interface RentalPhaseInput {
  requestStatus?: string | null;
  bookingStatus?: string | null;
}

export interface RentalPhaseInfo {
  phase: RentalPhase;
  labelKey: string;
  nextStepKey: string | null;
  hubGroup: RentalHubGroup;
  businessQueue: BusinessActionQueue | null;
}

const PHASE_LABEL: Record<RentalPhase, string> = {
  requested: 'rentals.phases.requested',
  offer_ready: 'rentals.phases.offerReady',
  reserved: 'rentals.phases.reserved',
  ready_for_pickup: 'rentals.phases.readyForPickup',
  in_progress: 'rentals.phases.inProgress',
  done: 'rentals.phases.done',
};

function nextStepKeyFor(
  phase: RentalPhase,
  role: RentalPhaseRole,
  bookingStatus?: string | null
): string | null {
  if (phase === 'done') {
    if (bookingStatus === 'completed') return 'rentals.nextStep.completed';
    return null;
  }
  if (phase === 'requested') {
    return role === 'client'
      ? 'rentals.nextStep.requestedClient'
      : 'rentals.nextStep.requestedBusiness';
  }
  if (phase === 'offer_ready') {
    if (bookingStatus === 'proposed') {
      return role === 'client'
        ? 'rentals.nextStep.proposedClient'
        : 'rentals.nextStep.proposedBusiness';
    }
    return role === 'client'
      ? 'rentals.nextStep.offerReadyClient'
      : 'rentals.nextStep.offerReadyBusiness';
  }
  if (phase === 'reserved') {
    return role === 'client'
      ? 'rentals.nextStep.reservedClient'
      : 'rentals.nextStep.reservedBusiness';
  }
  if (phase === 'ready_for_pickup') {
    return role === 'client'
      ? 'rentals.nextStep.confirmedClient'
      : 'rentals.nextStep.confirmedBusiness';
  }
  if (phase === 'in_progress') {
    if (bookingStatus === 'awaiting_return') {
      return role === 'client'
        ? 'rentals.nextStep.awaitingReturnClient'
        : 'rentals.nextStep.awaitingReturnBusiness';
    }
    return role === 'client'
      ? 'rentals.nextStep.activeClient'
      : 'rentals.nextStep.activeBusiness';
  }
  return null;
}

function hubGroupFor(phase: RentalPhase, role: RentalPhaseRole): RentalHubGroup {
  if (phase === 'done') return 'past';
  if (role === 'client') {
    if (
      phase === 'offer_ready' ||
      phase === 'reserved' ||
      phase === 'ready_for_pickup' ||
      phase === 'in_progress'
    ) {
      return 'action_needed';
    }
    return 'upcoming';
  }
  if (
    phase === 'requested' ||
    phase === 'reserved' ||
    phase === 'ready_for_pickup' ||
    phase === 'in_progress'
  ) {
    return 'action_needed';
  }
  return 'upcoming';
}

function businessQueueFor(
  phase: RentalPhase,
  bookingStatus?: string | null
): BusinessActionQueue | null {
  if (phase === 'requested') return 'respond';
  if (phase === 'reserved') return 'collect_pay';
  if (phase === 'ready_for_pickup') return 'start';
  if (phase === 'in_progress') return 'return';
  if (bookingStatus === 'active' || bookingStatus === 'awaiting_return') {
    return 'return';
  }
  return null;
}

export function resolveRentalPhase(
  input: RentalPhaseInput,
  role: RentalPhaseRole = 'client'
): RentalPhaseInfo {
  const req = input.requestStatus ?? null;
  const book = input.bookingStatus ?? null;

  let phase: RentalPhase = 'done';

  if (
    book === 'cancelled' ||
    req === 'cancelled' ||
    req === 'unavailable' ||
    req === 'expired' ||
    book === 'completed'
  ) {
    phase = 'done';
  } else if (book === 'active' || book === 'awaiting_return') {
    phase = 'in_progress';
  } else if (book === 'confirmed') {
    phase = 'ready_for_pickup';
  } else if (book === 'reserved') {
    phase = 'reserved';
  } else if (book === 'proposed' || req === 'available') {
    phase = 'offer_ready';
  } else if (req === 'pending') {
    phase = 'requested';
  } else if (req === 'booked' && !book) {
    phase = 'done';
  } else {
    phase = 'requested';
  }

  if (req === 'pending' && !book) {
    phase = 'requested';
  }
  if (req === 'available' && (!book || book === 'proposed')) {
    phase = 'offer_ready';
  }

  return {
    phase,
    labelKey: PHASE_LABEL[phase],
    nextStepKey: nextStepKeyFor(phase, role, book),
    hubGroup: hubGroupFor(phase, role),
    businessQueue: businessQueueFor(phase, book),
  };
}

export function resolveBookingPhase(
  bookingStatus: string,
  role: RentalPhaseRole = 'client'
): RentalPhaseInfo {
  return resolveRentalPhase({ bookingStatus }, role);
}

export function rentalBookingNextStepKey(
  status: string,
  role: RentalPhaseRole
): string | null {
  return resolveBookingPhase(status, role).nextStepKey;
}

export function messagesDefaultExpanded(bookingStatus: string): boolean {
  return (
    bookingStatus === 'confirmed' ||
    bookingStatus === 'active' ||
    bookingStatus === 'awaiting_return' ||
    bookingStatus === 'reserved'
  );
}

export type ClientPrimaryAction =
  | 'book'
  | 'pay'
  | 'send_pin'
  | 'wait'
  | 'rate'
  | 'none';

export type BusinessPrimaryAction =
  | 'respond'
  | 'collect_pay'
  | 'verify_pin'
  | 'confirm_return'
  | 'wait'
  | 'none';

export function clientPrimaryAction(
  phase: RentalPhase,
  bookingStatus?: string | null
): ClientPrimaryAction {
  if (phase === 'offer_ready') return bookingStatus === 'proposed' ? 'pay' : 'book';
  if (phase === 'reserved') return 'wait';
  if (phase === 'ready_for_pickup') return 'send_pin';
  if (phase === 'done' && bookingStatus === 'completed') return 'rate';
  return 'none';
}

export function businessPrimaryAction(
  phase: RentalPhase
): BusinessPrimaryAction {
  if (phase === 'requested') return 'respond';
  if (phase === 'reserved') return 'collect_pay';
  if (phase === 'ready_for_pickup') return 'verify_pin';
  if (phase === 'in_progress') return 'confirm_return';
  if (phase === 'offer_ready') return 'wait';
  return 'none';
}

export const BUSINESS_QUEUE_FILTERS: BusinessActionQueue[] = [
  'respond',
  'collect_pay',
  'start',
  'return',
  'all',
];

export function matchesBusinessQueue(
  info: RentalPhaseInfo,
  filter: BusinessActionQueue
): boolean {
  if (filter === 'all') return true;
  return info.businessQueue === filter;
}
