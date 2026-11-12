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
    actual_start_at: active ? new Date(Date.now() - 5 * 60 * 1000).toISOString() : null,
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

export async function getBooking() {
  return bookingFor(scene());
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
  getBookingMessages: asyncOk,
  getBookingMentionableParticipants: asyncOk,
  sendBookingMessage: async () => ({ success: true }),
  markBookingMessagesRead: async () => undefined,
  getActiveStartPin: async () => null,
};

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
  const filled = (name ?? '').includes('check');
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
