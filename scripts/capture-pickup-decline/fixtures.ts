export const HERO = '/hero.png';
export const CAPTURED = '2026-11-14T16:00:00.000Z';
export const CAPTURED_DOUALA = '2026-11-14T10:00:00.000Z';

export const PHOTOS = [
  { slotKey: 'overview', url: HERO, capturedAt: CAPTURED },
  { slotKey: 'other_side', url: HERO, capturedAt: CAPTURED },
  { slotKey: 'accessories', url: HERO, capturedAt: CAPTURED },
];

export const CARD = {
  rail: 'card' as const,
  amount: 65,
  currency: 'CAD',
  timeZone: 'America/Toronto',
  place: 'Atelier Nord, Toronto',
  item: 'JBL PartyBox 310',
  bookingNumber: 'RB-25496259',
};

export const MOMO_UNPAID = {
  rail: 'momo_unpaid' as const,
  amount: 45000,
  currency: 'XAF',
  timeZone: 'Africa/Douala',
  place: 'Studio Akwa, Douala',
  item: 'JBL PartyBox 310',
  bookingNumber: 'RB-25496310',
};

export const MOMO_PAID = {
  ...MOMO_UNPAID,
  rail: 'momo_paid' as const,
  phoneMask: '····· 67 12',
};

export const ADMIN_ROWS = [
  { name: 'Marie', role: 'renter' as const, declineCount: 1, pickupsReached: null, lastDeclineAt: CAPTURED, flagged: false },
  { name: 'Atelier Nord', role: 'business' as const, declineCount: 5, pickupsReached: 12, lastDeclineAt: CAPTURED, flagged: true },
  { name: 'Studio Akwa', role: 'business' as const, declineCount: 2, pickupsReached: 8, lastDeclineAt: CAPTURED_DOUALA, flagged: false },
  { name: 'Jean', role: 'renter' as const, declineCount: 6, pickupsReached: null, lastDeclineAt: CAPTURED, flagged: true },
];

export function sceneName(): string {
  return new URLSearchParams(window.location.search).get('scene') ?? 'review';
}
