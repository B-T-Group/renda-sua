export type JourneyKey =
  | 'offer'
  | 'paid'
  | 'pickup'
  | 'progress'
  | 'return'
  | 'done';

export interface JourneyStep {
  key: JourneyKey;
  labelKey: string;
  label: string;
  state: 'done' | 'current' | 'upcoming';
  aside?: string;
}

export interface JourneyInput {
  status: string;
  payAtPickup: boolean;
  paid: boolean;
  pickupAside?: string;
  paidAside?: string;
}

const LABELS: Record<JourneyKey, [string, string]> = {
  offer: ['rentals.journey.offerReady', 'Offer ready'],
  paid: ['rentals.journey.paid', 'Paid'],
  pickup: ['rentals.journey.pickup', 'Pickup'],
  progress: ['rentals.journey.inProgress', 'In progress'],
  return: ['rentals.journey.returnDue', 'Return due'],
  done: ['rentals.journey.done', 'Done'],
};

const ORDER: JourneyKey[] = ['offer', 'paid', 'pickup', 'progress', 'return', 'done'];

export function rentalJourney(input: JourneyInput): JourneyStep[] {
  const current = currentKey(input.status);
  const paidKey = input.payAtPickup && !input.paid ? 'booked' : 'paid';
  return ORDER.map((key) => {
    const index = ORDER.indexOf(key);
    const at = ORDER.indexOf(current);
    const state = index < at ? 'done' : index === at ? 'current' : 'upcoming';
    const label = key === 'paid' && paidKey === 'booked'
      ? ['rentals.journey.bookedPay', 'Booked · pay at pickup']
      : LABELS[key];
    return {
      key,
      labelKey: label[0],
      label: label[1],
      state,
      aside: journeyAside(key, state, input),
    };
  });
}

function journeyAside(key: JourneyKey, state: JourneyStep['state'], input: JourneyInput): string | undefined {
  if (key === 'paid') return input.paidAside;
  if (key === 'pickup' && state !== 'upcoming') return input.pickupAside;
  return undefined;
}

function currentKey(status: string): JourneyKey {
  if (status === 'active') return 'progress';
  if (status === 'awaiting_return') return 'return';
  if (status === 'completed') return 'done';
  return 'pickup';
}
