import { useMemo } from 'react';

type Scene = 'review' | 'started' | 'waiting' | 'handed' | 'momo' | 'legacy' | 'conflict';

function scene(): Scene {
  return ((window as Window & { __scene?: Scene }).__scene ?? 'review') as Scene;
}

const pixel =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function bookingFor(current: Scene) {
  const active = current === 'started' || current === 'handed';
  const legacy = current === 'legacy';
  return {
    id: 'b1',
    booking_number: 'RB-104218',
    status: active ? 'active' : legacy ? 'confirmed' : 'reserved',
    start_at: '2026-11-12T09:00:00.000Z',
    end_at: '2026-11-12T21:00:00.000Z',
    total_amount: 760,
    currency: 'XAF',
    payment_timing: current === 'review' || current === 'momo' || current === 'conflict' ? 'pay_at_pickup' : 'pay_now',
    payment_status: active || legacy ? 'authorized' : 'pending',
    actual_start_at: startedAt(active),
    not_received_report: notReceivedReport(),
    units_booked: 2,
    inspection_policy_version: legacy ? null : 1,
    client_id: 'client',
    business_id: 'biz',
    client: { user: { first_name: 'Amina', last_name: 'N.' } },
    rental_location_listing: {
      rental_item: {
        name: 'Canon EOS R50',
        rental_item_images: [{ id: 'img', image_url: pixel, alt_text: 'Canon EOS R50' }],
      },
      business_location: { name: 'Studio K, Bonanjo' },
    },
    accept_start_preview:
      legacy || active ? null : { payment_rail: 'mobile_money' as const, amount_due_at_pickup: 760 },
    rental_request: {
      rental_selection_windows: [
        {
          billing: 'hourly',
          calendar_date: '2026-11-12',
          start_at: '2026-11-12T09:00:00.000Z',
          end_at: '2026-11-12T21:00:00.000Z',
        },
      ],
    },
    security_deposit_amount: 0,
    authorized_amount: active ? 760 : 0,
    overtime_amount: 0,
  };
}

const unit = (id: string, label: string) => ({
  unitId: id,
  slotIndex: id === 'u1' ? 1 : 2,
  displayLabel: label,
  physicalLabel: null,
  condition: 'good' as const,
  wear: 'none',
  accessories: id === 'u2' ? [{ name: 'Battery + charger', count: 2 }] : [],
  photos: [
    { id: `${id}-1`, role: 'overview' as const, url: pixel },
    { id: `${id}-2`, role: 'other_side' as const, url: pixel },
    { id: `${id}-3`, role: 'accessories' as const, url: pixel },
  ],
});

function inspectionFor() {
  const current = scene();
  const french = document.documentElement.lang === 'fr';
  const accepted = current === 'started' || current === 'handed';
  return {
    status: 'submitted' as const,
    submittedAt: '2026-11-12T15:12:00.000Z',
    yourDecision: accepted ? ('accept' as const) : null,
    versionId: 'ver-1',
    versionNo: 1,
    minPhotos: 3,
    units: [unit('u1', french ? 'Unité 1' : 'Unit 1'), unit('u2', french ? 'Unité 2' : 'Unit 2')],
  };
}

function applyReturn<T extends Record<string, unknown>>(row: T): T {
  const state = captureParams().get('return');
  if (!state) return row;
  const reported = state === 'waiting' || state === 'escalated' || state === 'business';
  return {
    ...row,
    booking_number: 'RB-27251416',
    status: 'awaiting_return',
    end_at: '2026-11-12T19:00:00.000Z',
    actual_start_at: '2026-11-12T12:00:00.000Z',
    security_deposit_amount: 45000,
    currency: 'XAF',
    renter_reported_returned_at: reported ? '2026-11-12T18:42:00.000Z' : null,
    renter_return_escalated_at: state === 'escalated' ? '2026-11-13T18:42:00.000Z' : null,
    return_place: {
      name: "Stripe Rail - L'Assomption",
      address: "Stripe Rail - L'Assomption",
      phone: '+237600000000',
    },
    inspection_policy_version: null,
    rental_location_listing: {
      rental_item: {
        name: 'JBL PartyBox 310',
        rental_item_images: [],
      },
      business_location: { name: "Stripe Rail - L'Assomption" },
    },
  };
}

export async function getBooking() {
  return applyReturn(bookingFor(scene()));
}

export async function getClientBookings() {
  if (captureParams().get('return') !== 'list') return [];
  const base = applyReturn(bookingFor('started'));
  return [
    { ...base, id: 'overdue', renter_reported_returned_at: null, renter_return_escalated_at: null },
    {
      ...base,
      id: 'waiting',
      renter_reported_returned_at: '2026-11-12T18:42:00.000Z',
      renter_return_escalated_at: null,
    },
  ];
}

export async function getClientRequests() {
  return [];
}

export async function cancelRequest() {
  return { success: true };
}

export async function createBooking() {
  return { success: true };
}

export async function reportReturned() {
  return {
    success: true as const,
    alreadyReported: false,
    wasOverdue: false,
    report: { rentalBookingId: 'b1', reportedAt: '2026-11-12T18:42:00.000Z' },
  };
}

export async function cancelBooking() {
  return { success: true };
}

export async function getStartPin() {
  return { pin: '1234' };
}

export async function retryPayment() {
  return { success: true };
}

export async function getPaymentStatus() {
  const calls = (window as Window & { __acceptCalls?: number }).__acceptCalls ?? 0;
  return {
    status: 'reserved',
    paymentPending: scene() === 'momo' && calls >= 2,
    payment_rail: 'mobile_money',
    checkout_url: null,
    contractExpiresAt: null,
    bookingNumber: 'RB-104218',
  };
}

export async function acceptAndStart() {
  const win = window as Window & { __acceptCalls?: number };
  win.__acceptCalls = (win.__acceptCalls ?? 0) + 1;
  if (scene() === 'conflict') {
    throw { response: { status: 409, data: { code: 'RENTAL_ACCEPT_START_CONFLICT' } } };
  }
  if (scene() === 'momo' && win.__acceptCalls === 1) {
    throw { response: { status: 400, data: { message: 'MoMo failed', error: 'PAYMENT_INITIATION_FAILED' } } };
  }
  if (scene() === 'momo') {
    return { paymentPending: true, started: false, payment_rail: 'mobile_money' as const };
  }
  return { paymentPending: false, started: true, payment_rail: 'card' as const };
}

export async function getInspection() {
  return inspectionFor();
}

export async function hydrateInspectionPhotos(_bookingId: string, units: unknown[]) {
  return units;
}

export async function acknowledgeInspection() {
  return { success: true };
}

export async function uploadInspectionPhoto() {
  return { url: pixel };
}

export function useIsStripeRail() {
  return useMemo(
    () => ({ isStripeRail: false, stripeReady: false, loading: false, status: null, refetch: async () => false }),
    []
  );
}

export function useRentalStripePayment() {
  return { pay: async () => ({ status: 'cancelled' as const }), loading: false };
}

export async function settleRentalStripePayment() {
  return undefined;
}

const asyncOk = async () => ({ success: true, messages: [], participants: [] });

export const rentalsApi = {
  getBooking,
  getPaymentStatus,
  acceptAndStart,
  getStartPin: async () => ({ pin: '1234' }),
  shareStartPin: async () => ({ success: true }),
  cancelBooking: async () => ({ success: true }),
  retryPayment: async () => ({ success: true }),
  initiatePickupPayment: async () => ({ success: true }),
  verifyStartPin: async () => ({ success: true }),
  confirmReturn: async () => ({ success: true }),
  reportReturned,
  getClientBookings,
  getClientRequests,
  cancelRequest,
  createBooking,
  getBookingMessages: asyncOk,
  getBookingMentionableParticipants: asyncOk,
  sendBookingMessage: async () => ({ success: true }),
  markBookingMessagesRead: async () => undefined,
  getActiveStartPin: async () => null,
  reportNotReceived,
};

function captureParams() {
  return new URLSearchParams(window.location.search);
}

function startedAt(active: boolean): string | null {
  if (!active) return null;
  if (captureParams().get('window') === 'closed') {
    return new Date(Date.now() - 31 * 60 * 1000).toISOString();
  }
  return new Date(Date.now() - 5 * 60 * 1000).toISOString();
}

function notReceivedReport() {
  if (captureParams().get('reported') !== '1') return null;
  return { id: 'nr-1', reported_at: '2026-11-12T14:22:00.000Z' };
}

export async function reportNotReceived() {
  const params = captureParams();
  const result = params.get('reportResult');
  if (result === 'network') {
    throw { code: 'ERR_NETWORK', message: 'Network Error' };
  }
  if (result === 'error' || result === 'window') {
    throw {
      response: {
        status: 409,
        data: { code: params.get('reportCode') || 'RENTAL_NOT_RECEIVED_WINDOW_CLOSED' },
      },
    };
  }
  return {
    success: true,
    alreadyReported: false,
    report: { id: 'nr-1', rentalBookingId: 'b1', reportedAt: '2026-11-12T14:22:00.000Z' },
  };
}

function reportEnabled(): boolean {
  return captureParams().get('report') === '1';
}

export function useStore() {
  return {
    auth: { isAuthenticated: false },
    persona: { showMainApp: false, activePersona: 'client' },
  };
}

export function useClientFlags() {
  return useMemo(
    () => ({
      loaded: true,
      loading: false,
      flags: {
        rentals_not_received_report_enabled: reportEnabled(),
        rentals_renter_return_report_enabled: Boolean(captureParams().get('return')),
      },
    }),
    []
  );
}

const BUSINESS_BODY = {
  en: "The renter says they haven't received the item. Support will follow up.",
  fr: "Le client indique ne pas avoir reçu l'article. Le support va vous contacter.",
};

export const agentApi = {
  messages: {
    getMyMessages: async () => {
      const french = document.documentElement.lang === 'fr';
      return {
        messages: [
          {
            id: 'm1',
            user_id: 'biz-user',
            entity_type: 'rental_booking',
            entity_id: 'b1',
            message: french ? BUSINESS_BODY.fr : BUSINESS_BODY.en,
            message_type: 'RENTAL_NOT_RECEIVED',
            created_at: '2026-11-12T14:22:00.000Z',
            updated_at: '2026-11-12T14:22:00.000Z',
            entity_type_info: { id: 'rental_booking', comment: french ? 'Location' : 'Rental' },
          },
        ],
      };
    },
  },
};

export function useThreads() {
  return { threads: [], loading: false, refreshing: false, error: null, refresh() {} };
}

export function useProfileMe() {
  return { me: { id: 'biz-user' } };
}

export function useNotificationNavigation() {
  return () => ({ navigate() {}, label: 'rentalBookingDetail' });
}

export function launchImageLibraryAsync() {
  return Promise.resolve({ canceled: true, assets: [] });
}

export function requestMediaLibraryPermissionsAsync() {
  return Promise.resolve({ granted: true, status: 'granted' });
}

export const UIImagePickerPreferredAssetRepresentationMode = { Compatible: 'compatible' };

export const ImagePicker = { launchImageLibraryAsync };

export function addEventListener() {
  return () => undefined;
}

export default function Icon({
  name,
  color,
  size,
}: {
  name?: string;
  color?: string;
  size?: number;
}) {
  const filled = (name ?? '').includes('check') || name === 'circle';
  const px = size ?? 18;
  return (
    <span
      style={{
        color: color ?? 'currentColor',
        fontSize: px,
        lineHeight: 1,
        display: 'inline-block',
        width: px,
        textAlign: 'center',
      }}
    >
      {filled ? '●' : '○'}
    </span>
  );
}
