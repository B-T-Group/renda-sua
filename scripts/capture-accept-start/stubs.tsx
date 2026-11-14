import React, { useMemo } from 'react';

type Scene =
  | 'review'
  | 'started'
  | 'waiting'
  | 'handed'
  | 'momo'
  | 'conflict'
  | 'legacy'
  | 'clientReview'
  | 'businessWait'
  | 'reportSent'
  | 'rentalStarted'
  | 'momoStarted'
  | 'push';

interface CaptureWindow extends Window {
  __scene?: Scene;
  __acceptCalls?: number;
}

function scene(): Scene {
  return ((window as CaptureWindow).__scene ?? 'review') as Scene;
}

const clientId = 'client-1';
const businessId = 'biz-1';

function reviewBooking(current: Scene) {
  return {
    id: 'b1',
    booking_number: 'RB-25496259',
    status: 'reserved',
    start_at: '2026-11-17T20:00:00.000Z',
    end_at: '2026-11-19T01:00:00.000Z',
    total_amount: 45,
    currency: 'CAD',
    payment_timing: 'pay_now',
    payment_status: 'authorized',
    actual_start_at: null,
    not_received_report: null,
    units_booked: 1,
    inspection_policy_version: 1,
    client_id: clientId,
    business_id: businessId,
    client: { user: { first_name: 'Amina', last_name: 'N.' } },
    rental_location_listing: {
      rental_item: {
        name: 'JBL PartyBox 310',
        rental_item_images: [{ id: 'img', image_url: '/hero-jbl.png', alt_text: 'JBL PartyBox 310' }],
      },
      business_location: { name: 'Atelier Nord, Toronto', address: { country: 'CA' } },
    },
    accept_start_preview: null,
    rental_request: {
      rental_selection_windows: [
        {
          billing: 'daily',
          calendar_date: '2026-11-17',
          start_at: '2026-11-17T20:00:00.000Z',
          end_at: '2026-11-19T01:00:00.000Z',
        },
      ],
    },
    security_deposit_amount: 20,
    authorized_amount: 65,
    overtime_amount: 0,
    _business: current === 'businessWait',
  };
}

function bookingFor(current: Scene) {
  if (current === 'clientReview' || current === 'businessWait') return reviewBooking(current);
  const active = current === 'started' || current === 'handed';
  const legacy = current === 'legacy';
  const business = current === 'waiting' || current === 'handed';
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
    client_id: clientId,
    business_id: businessId,
    client: { user: { first_name: 'Amina', last_name: 'N.' } },
    rental_location_listing: {
      rental_item: { name: 'Canon EOS R50' },
      business_location: { name: 'Studio K, Bonanjo' },
    },
    accept_start_preview: legacy || active
      ? null
      : { payment_rail: 'mobile_money' as const, amount_due_at_pickup: 760 },
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
    _business: business,
  };
}

const unit = (id: string, label: string) => ({
  unitId: id,
  slotIndex: id === 'u1' ? 1 : 2,
  displayLabel: label,
  physicalLabel: null,
  condition: 'good',
  wear: 'none',
  accessories: id === 'u2' ? [{ name: 'Battery + charger', count: 2 }] : [],
  photos: [
    { id: `${id}-1`, role: 'overview', url: '/hero-jbl.png' },
    { id: `${id}-2`, role: 'other_side', url: '/hero-jbl.png' },
    { id: `${id}-3`, role: 'accessories', url: '/hero-jbl.png' },
  ],
});

function viewFor(labels: [string, string]) {
  return {
    status: 'submitted' as const,
    submittedAt: '2026-11-12T15:12:00.000Z',
    yourDecision: null,
    versionId: 'ver-1',
    minPhotos: 3,
    units: [unit('u1', labels[0]), unit('u2', labels[1])],
  };
}

export function useSessionAuth() {
  return useMemo(() => ({ isAuthenticated: true, accessToken: 'capture' }), []);
}

export function useUserProfileContext() {
  const current = scene();
  const business = current === 'waiting' || current === 'handed' || current === 'businessWait';
  return useMemo(
    () => ({
      loading: false,
      userType: business ? 'business' : 'client',
      personas: business ? ['business'] : ['client'],
      setActivePersona: async () => undefined,
      profile: business
        ? { business: { id: businessId }, client: null }
        : { client: { id: clientId }, business: null },
    }),
    [business]
  );
}

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

function reportEnabled(): boolean {
  return captureParams().get('report') === '1';
}

function confirmationsScene(): boolean {
  const current = scene();
  return (
    current === 'clientReview' ||
    current === 'businessWait' ||
    current === 'reportSent' ||
    current === 'rentalStarted' ||
    current === 'momoStarted'
  );
}

export function useClientFlags() {
  return useMemo(
    () => ({
      loaded: true,
      flags: {
        rentals_not_received_report_enabled: reportEnabled(),
        rentals_renter_return_report_enabled: Boolean(captureParams().get('return')),
        rentals_inspection_confirmations_enabled: confirmationsScene(),
      },
    }),
    []
  );
}

export function useApiClient() {
  return useMemo(
    () => ({
      get: async (url: string) => {
        if (url.includes('return-reports')) {
          return {
            data: [
              {
                id: 'b-wait',
                booking_number: 'RB-27251416',
                status: 'awaiting_return',
                renter_reported_returned_at: '2026-11-12T18:42:00.000Z',
                renter_return_escalated_at: null,
                rental_location_listing: {
                  rental_item: { name: 'JBL PartyBox 310' },
                  business_location: { name: "Atelier Nord, Toronto" },
                },
              },
              {
                id: 'b-esc',
                booking_number: 'RB-27251417',
                status: 'awaiting_return',
                renter_reported_returned_at: '2026-11-11T18:42:00.000Z',
                renter_return_escalated_at: '2026-11-12T18:42:00.000Z',
                rental_location_listing: {
                  rental_item: { name: 'JBL PartyBox 310' },
                  business_location: { name: "Atelier Nord, Toronto" },
                },
              },
            ],
          };
        }
        if (url.includes('not-received')) {
          return {
            data: [
              {
                id: 'nr-1',
                rental_booking_id: 'b1',
                reported_at: '2026-11-12T14:22:00.000Z',
                rental_booking: {
                  booking_number: 'RB-104218',
                  status: 'active',
                  rental_location_listing: { rental_item: { name: 'Canon EOS R50' } },
                },
              },
            ],
          };
        }
        return { data: [] };
      },
      post: async () => ({ data: { success: true } }),
    }),
    []
  );
}

export function usePermission() {
  return true;
}

export function useIsStripeRail() {
  return useMemo(() => ({ isStripeRail: false, loading: false, refetch: async () => false }), []);
}

export function useTrackSiteEvent() {
  return useMemo(() => ({ trackSiteEvent: () => undefined }), []);
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
      name: "Atelier Nord, Toronto",
      address: "Atelier Nord, Toronto",
      phone: '+237600000000',
    },
    inspection_policy_version: null,
    rental_location_listing: {
      rental_item: {
        name: 'JBL PartyBox 310',
        rental_item_images: [{ id: 'img', image_url: '/hero.png', alt_text: 'JBL PartyBox 310' }],
      },
      business_location: { name: "Atelier Nord, Toronto" },
    },
  };
}

export function useRentalApi() {
  return useMemo(() => ({
    fetchRequestInspectionPolicy: async () => 1,
    fetchBookingDetail: async () => {
      const row = applyReturn(bookingFor(scene()));
      const { _business: _ignored, ...booking } = row;
      return booking;
    },
    fetchClientRentalRequests: async () => {
      if (captureParams().get('return') !== 'list') return [];
      const booking = applyReturn(bookingFor('started'));
      return [
        {
          id: 'req-overdue',
          status: 'booked',
          created_at: '2026-11-10T10:00:00.000Z',
          rental_location_listing: {
            id: 'loc',
            base_price_per_hour: 1000,
            business_location: { name: "Atelier Nord, Toronto" },
            rental_item: { name: 'JBL PartyBox 310', currency: 'XAF' },
          },
          rental_booking: {
            id: 'overdue',
            status: 'awaiting_return',
            end_at: '2026-11-12T19:00:00.000Z',
            renter_reported_returned_at: null,
            renter_return_escalated_at: null,
          },
        },
        {
          id: 'req-waiting',
          status: 'booked',
          created_at: '2026-11-10T11:00:00.000Z',
          rental_location_listing: {
            id: 'loc',
            base_price_per_hour: 1000,
            business_location: { name: "Atelier Nord, Toronto" },
            rental_item: { name: 'JBL PartyBox 310', currency: 'XAF' },
          },
          rental_booking: {
            ...booking,
            id: 'waiting',
            status: 'awaiting_return',
            renter_reported_returned_at: '2026-11-12T18:42:00.000Z',
          },
        },
      ];
    },
    createBooking: async () => ({ success: true }),
    cancelClientRentalRequest: async () => ({ success: true }),
    reportReturned: async () => ({
      success: true,
      alreadyReported: false,
      wasOverdue: false,
      report: { rentalBookingId: 'b1', reportedAt: '2026-11-12T18:42:00.000Z' },
    }),
    getBookingPaymentStatus: async () => ({
      status: 'reserved',
      paymentPending: scene() === 'momo' && ((window as CaptureWindow).__acceptCalls ?? 0) >= 2,
      payment_rail: 'mobile_money',
      checkout_url: null,
      contractExpiresAt: null,
      bookingNumber: 'RB-104218',
    }),
    acceptAndStart: async () => {
      const win = window as CaptureWindow;
      win.__acceptCalls = (win.__acceptCalls ?? 0) + 1;
      if (scene() === 'conflict') {
        throw { response: { status: 409, data: { code: 'RENTAL_ACCEPT_START_CONFLICT' } } };
      }
      if (scene() === 'momo' && win.__acceptCalls === 1) {
        throw { response: { status: 400, data: { message: 'MoMo failed', error: 'PAYMENT_INITIATION_FAILED' } } };
      }
      if (scene() === 'momo') {
        return {
          success: true as const,
          started: false,
          alreadyStarted: false,
          paymentPending: true,
          payment_rail: 'mobile_money' as const,
          amount_due_at_pickup: 760,
          bookingId: 'b1',
        };
      }
      return {
        success: true as const,
        started: true,
        alreadyStarted: false,
        paymentPending: false,
        payment_rail: 'card' as const,
        amount_due_at_pickup: 0,
        bookingId: 'b1',
      };
    },
    getStartPin: async () => ({ pin: '1234' }),
    cancelBooking: async () => ({ success: true }),
    initiatePickupPayment: async () => ({ success: true }),
    verifyStartPin: async () => ({ success: true }),
    shareStartPin: async () => ({ messageId: 'm', pin: '1234', pinVersion: 1 }),
    getActiveStartPin: async () => null,
    confirmReturn: async () => ({ success: true }),
    retryBookingPayment: async () => ({ success: true }),
    reportNotReceived: async () => {
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
    },
  }), []);
}

export function useRentalInspection() {
  const current = scene();
  const french = document.documentElement.lang === 'fr';
  return useMemo(() => {
  const labels: [string, string] = french ? ['Unité 1', 'Unité 2'] : ['Unit 1', 'Unit 2'];
  const one = current === 'clientReview' || current === 'businessWait';
  const full = viewFor(labels);
  const pickup = current === 'legacy' ? null : one ? { ...full, units: [full.units[0]] } : full;
  const enrolled = current !== 'legacy' && !captureParams().get('return');
  return {
    api: {
      acknowledge: async () => undefined,
      openDraft: async () => undefined,
      upload: async () => undefined,
      saveItems: async () => undefined,
      submit: async () => undefined,
      handback: async () => undefined,
      get: async () => pickup,
    },
    enrolled,
    pickup,
    returnView: null,
    loading: false,
    error: null,
    reload: async () => undefined,
    gate: enrolled
      ? { mode: 'waiting' as const, showCollectPayment: false, showStart: false, showOverwrite: false }
      : { mode: 'legacy' as const, showCollectPayment: false, showStart: true, showOverwrite: true },
    reviewStage:
      current === 'review' || current === 'momo' || current === 'conflict' || current === 'clientReview'
        ? 'pickup'
        : null,
    showLegacyReturn: captureParams().get('return') === 'business',
    showEnrolledReturn: false,
  };
  }, [current, french]);
}

export function UserMessagesComponent() {
  return null;
}
