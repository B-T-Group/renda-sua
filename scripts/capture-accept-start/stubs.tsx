import React, { useMemo } from 'react';

type Scene =
  | 'review'
  | 'started'
  | 'waiting'
  | 'handed'
  | 'momo'
  | 'conflict'
  | 'legacy';

interface CaptureWindow extends Window {
  __scene?: Scene;
  __acceptCalls?: number;
}

function scene(): Scene {
  return ((window as CaptureWindow).__scene ?? 'review') as Scene;
}

const clientId = 'client-1';
const businessId = 'biz-1';

function bookingFor(current: Scene) {
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
    actual_start_at: active ? new Date(Date.now() - 5 * 60 * 1000).toISOString() : null,
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
    { id: `${id}-1`, role: 'overview', url: '' },
    { id: `${id}-2`, role: 'other_side', url: '' },
    { id: `${id}-3`, role: 'accessories', url: '' },
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
  const business = current === 'waiting' || current === 'handed';
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

export function useIsStripeRail() {
  return useMemo(() => ({ isStripeRail: false, loading: false, refetch: async () => false }), []);
}

export function useTrackSiteEvent() {
  return useMemo(() => ({ trackSiteEvent: () => undefined }), []);
}

export function useRentalApi() {
  return useMemo(() => ({
    fetchBookingDetail: async () => {
      const row = bookingFor(scene());
      const { _business: _ignored, ...booking } = row;
      return booking;
    },
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
  }), []);
}

export function useRentalInspection() {
  const current = scene();
  const french = document.documentElement.lang === 'fr';
  return useMemo(() => {
  const labels: [string, string] = french ? ['Unité 1', 'Unité 2'] : ['Unit 1', 'Unit 2'];
  const pickup = current === 'legacy' ? null : viewFor(labels);
  const enrolled = current !== 'legacy';
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
    reviewStage: current === 'review' || current === 'momo' || current === 'conflict' ? 'pickup' : null,
    showLegacyReturn: false,
    showEnrolledReturn: false,
  };
  }, [current, french]);
}

export function UserMessagesComponent() {
  return null;
}
