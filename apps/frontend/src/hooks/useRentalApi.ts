import { useCallback, useMemo } from 'react';
import { useApiClient } from './useApiClient';
import { useRentalCatalogGeoParams } from './useRentalCatalogGeoParams';
import type { RentalListingRow } from './useRentalListings';

export type RentalPricingSnapshotLine =
  | {
      kind: 'hourly';
      startAt: string;
      endAt: string;
      billableHours: number;
      ratePerHour: number;
      subtotal: number;
    }
  | {
      kind: 'all_day';
      calendarDate: string;
      ratePerDay: number;
      subtotal: number;
    };

export interface RentalPricingSnapshotBody {
  version: number;
  currency: string;
  total: number;
  unitsBooked?: number;
  ratePerHour?: number;
  hours?: number;
  securityDeposit?: number;
  lines?: RentalPricingSnapshotLine[];
  computedAt: string;
}

export interface RentalWeeklyAvailabilityRow {
  id?: string;
  weekday: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
}

export interface BusinessRentalItemImageRow {
  id: string;
  image_url: string;
  display_order: number;
}

export interface BusinessRentalItemRow {
  id: string;
  name: string;
  description: string;
  currency: string;
  rental_category_id: string;
  is_active?: boolean;
  deleted_at?: string | null;
  rental_item_images?: BusinessRentalItemImageRow[];
  rental_location_listings: {
    id: string;
    business_location_id: string;
    base_price_per_hour: number;
    base_price_per_day: number;
    is_active?: boolean;
    deleted_at?: string | null;
    moderation_status?: string;
    moderated_at?: string | null;
  }[];
}

export interface BusinessRentalListingDetail {
  id: string;
  business_location_id: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  offers_daily?: boolean;
  offers_hourly?: boolean;
  security_deposit_amount?: number;
  reservation_fee_enabled?: boolean | null;
  min_rental_hours: number;
  max_rental_hours: number | null;
  units_available: number;
  is_active: boolean;
  deleted_at?: string | null;
  moderation_status?: string;
  moderated_at?: string | null;
  moderated_by_user_id?: string | null;
  /** Set by API when moderation_status is rejected */
  rejection_reason?: string | null;
  pickup_instructions?: string | null;
  dropoff_instructions?: string | null;
  weekly_availability: RentalWeeklyAvailabilityRow[];
  business_location?: { id: string; name: string } | null;
}

export interface BusinessRentalItemDetail {
  id: string;
  name: string;
  description: string | null;
  rental_category_id: string;
  currency: string;
  tags?: string[] | null;
  is_active: boolean;
  deleted_at?: string | null;
  operation_mode?: string;
  rental_item_images: BusinessRentalItemImageRow[];
  rental_location_listings: BusinessRentalListingDetail[];
}

export interface BusinessAiProposalPayload {
  listing: {
    id: string;
    moderation_status: string;
    rental_item: {
      id: string;
      name: string;
      description: string | null;
      rental_item_images: Array<{
        id: string;
        image_url: string;
        display_order: number;
      }>;
    };
  } | null;
  proposal: {
    id: string;
    decision_reason: string | null;
    proposed_title: string | null;
    proposed_description: string | null;
  } | null;
}

export interface UpdateBusinessRentalItemBody {
  rental_category_id?: string;
  name?: string;
  description?: string;
  tags?: string[];
  currency?: string;
  is_active?: boolean;
}

export interface UpdateBusinessRentalListingBody {
  offers_daily?: boolean;
  offers_hourly?: boolean;
  pickup_instructions?: string;
  dropoff_instructions?: string;
  base_price_per_hour?: number;
  base_price_per_day?: number;
  security_deposit_amount?: number;
  reservation_fee_enabled?: boolean;
  min_rental_hours?: number;
  max_rental_hours?: number | null;
  units_available?: number;
  is_active?: boolean;
  weekly_availability?: RentalWeeklyAvailabilityRow[];
}

export type UnavailableRentalReasonCode =
  | 'fully_booked'
  | 'dates_not_available'
  | 'item_unavailable'
  | 'pricing_mismatch'
  | 'other';

export interface RentalTakenWindow {
  startAt: string;
  endAt: string;
  unitsBooked?: number;
}

export interface RespondRentalRequestBody {
  status: 'available' | 'unavailable';
  rentalPricingSnapshot?: RentalPricingSnapshotBody;
  totalOverride?: number;
  contractExpiryHours?: number;
  unavailableReasonCode?: UnavailableRentalReasonCode;
  businessResponseNote?: string;
  expectedVersion?: number;
}

export interface RentalSelectionWindow {
  start_at: string;
  end_at: string;
  billing?: 'hourly' | 'all_day';
  calendar_date?: string;
}

export interface BusinessRentalRequestRow {
  id: string;
  created_at: string;
  status: string;
  rental_selection_windows?: RentalSelectionWindow[] | null;
  rental_pricing_snapshot: unknown;
  business_response_note?: string | null;
  client_request_note?: string | null;
  units_requested?: number;
  edit_version?: number | null;
  change_summary?: {
    fields?: string[];
    dates?: { from: RentalSelectionWindow[]; to: RentalSelectionWindow[] };
    quantity?: { from: number; to: number };
  } | null;
  quoted_total?: number | string | null;
  requested_start_at?: string | null;
  respond_by?: string | null;
  respond_window?: 'sla' | 'start' | null;
  listing_timezone?: string | null;
  dates_available?: boolean | null;
  payment_rail?: string | null;
  total_override_ceiling?: number | null;
  unavailable_reason_code?: string | null;
  expires_at?: string | null;
  responded_at?: string | null;
  rental_location_listing: {
    id: string;
    base_price_per_hour: number;
    base_price_per_day: number;
    security_deposit_amount?: number | null;
    weekly_availability?: RentalWeeklyAvailabilityRow[];
    business_location?: { name?: string | null; address?: { city?: string | null; country?: string | null } | null } | null;
    rental_item: {
      name: string;
      currency: string;
      rental_category?: { name?: string | null } | null;
      rental_item_images?: Array<{
        id: string;
        image_url: string;
        display_url?: string | null;
        thumbnail?: string | null;
        alt_text?: string | null;
      }>;
    };
  };
  client?: {
    id: string;
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      phone_number?: string | null;
    } | null;
  } | null;
  rental_booking?: {
    id: string;
    status: string;
    end_at?: string | null;
    booking_number?: string | null;
    actual_start_at?: string | null;
    inspection_policy_version?: number | null;
    renter_reported_returned_at?: string | null;
    renter_return_escalated_at?: string | null;
  } | null;
}

export interface ClientRentalRequestRow {
  id: string;
  status: string;
  /** Listing zone; request and booking times are its wall clock stored as UTC components. */
  listing_timezone?: string | null;
  rental_selection_windows?: RentalSelectionWindow[] | null;
  created_at: string;
  business_response_note?: string | null;
  unavailable_reason_code?: string | null;
  client_request_note?: string | null;
  units_requested?: number;
  quoted_total?: number | string | null;
  price_change_seen_at?: string | null;
  rental_pricing_snapshot?: unknown;
  responded_at?: string | null;
  expires_at?: string | null;
  rental_location_listing: {
    id: string;
    base_price_per_hour: number | string;
    base_price_per_day?: number | string;
    business_location?: { name: string } | null;
    rental_item: { name: string; currency: string; business?: { name?: string | null } | null };
  } | null;
  rental_booking?: {
    id: string;
    status: string;
    end_at?: string | null;
    contract_expires_at?: string | null;
    inspection_policy_version?: number | null;
    renter_reported_returned_at?: string | null;
    renter_return_escalated_at?: string | null;
    /** Reserve now, pay at pickup: the card is authorized at Pay & start, not at reservation. */
    card_pay_at_pickup?: boolean | null;
    /** Optional reservation fee (0 when the listing has it off). Counts toward the total. */
    reservation_fee_amount?: number | string | null;
    reservation_fee_status?: string | null;
    reservation_fee_rail?: string | null;
    reservation_fee_settled_at?: string | null;
  } | null;
}

export interface BusinessRentalScheduleRow {
  id: string;
  status: string;
  start_at: string;
  end_at: string;
  total_amount: number;
  currency: string;
  rental_location_listing?: {
    id: string;
    business_location?: { id: string; name: string } | null;
    rental_item?: { id: string; name: string } | null;
  } | null;
  rental_request?: {
    id: string;
    created_at: string;
    client?: {
      id: string;
      user?: {
        first_name?: string | null;
        last_name?: string | null;
        phone_number?: string | null;
        email?: string | null;
      } | null;
    } | null;
  } | null;
}

export type BusinessRentalItemActivityScope = 'all' | 'upcoming' | 'past';

export interface BusinessRentalItemActivityStats {
  earnedTotal: number;
  timesRented: number;
  currentlyOut: number;
  upcoming: number;
  openRequests: number;
  lastCompletedAt: string | null;
  nextStartAt: string | null;
  currency: string | null;
}

export interface BusinessRentalItemActivityBooking extends BusinessRentalScheduleRow {
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  overtime_amount?: number | null;
  settlement_completed_at?: string | null;
}

export interface BusinessRentalItemActivity {
  item: { id: string; name: string; currency: string | null };
  stats: BusinessRentalItemActivityStats;
  suggestedScope: BusinessRentalItemActivityScope;
  scope: BusinessRentalItemActivityScope;
  bookings: BusinessRentalItemActivityBooking[];
  total: number;
  page: number;
  limit: number;
}

export type RentalPaymentRail = 'wallet' | 'stripe' | 'mobile_money';

export interface RentalBookingActionResult {
  success: boolean;
  bookingId: string;
  payment_rail?: RentalPaymentRail;
  checkout_url?: string;
  paymentPending?: boolean;
  confirmed?: boolean;
  reserved?: boolean;
  /** Set when the listing asks for a reservation fee; the booking reserves once it is paid. */
  reservation_fee?: { amount: number; currency: string; status: string } | null;
}

export interface RentalBookingPaymentStatus {
  status: string;
  paymentPending: boolean;
  payment_rail: RentalPaymentRail | null;
  checkout_url: string | null;
  contractExpiresAt: string | null;
  bookingNumber: string | null;
}

export interface RentalBookingDetail {
  id: string;
  booking_number?: string | null;
  status: string;
  start_at: string;
  end_at: string;
  start_opens_at?: string | null;
  total_amount: number;
  currency: string;
  security_deposit_amount?: number | string | null;
  authorized_amount?: number | string | null;
  captured_amount?: number | string | null;
  overtime_amount?: number | string | null;
  overtime_amount_override?: number | string | null;
  claimed_damage_amount?: number | string | null;
  reserved_cancel_after?: string | null;
  payment_timing?: 'pay_now' | 'pay_at_pickup' | null;
  payment_status?: 'pending' | 'authorized' | 'paid' | 'cancelled' | null;
  /** Reserve now, pay at pickup: the card is authorized at Pay & start, not at reservation. */
  card_pay_at_pickup?: boolean | null;
  /** Optional reservation fee (0 when the listing has it off). Counts toward the total. */
  reservation_fee_amount?: number | string | null;
  reservation_fee_status?: string | null;
  reservation_fee_rail?: string | null;
  reservation_fee_settled_at?: string | null;
  actual_start_at?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  actual_end_at?: string | null;
  units_booked?: number | null;
  inspection_policy_version?: number | null;
  condition_declined_at?: string | null;
  refund_status?: 'none' | 'refund_pending' | 'refunded' | 'failed' | 'manual' | null;
  refund_amount?: number | string | null;
  refund_currency?: string | null;
  condition_decline?: {
    reason: string;
    reasonText?: string | null;
    rail?: 'card' | 'wallet' | 'momo_unpaid' | 'momo_paid';
    amount?: number;
    currency?: string | null;
    phoneMask?: string | null;
    walletCredited?: boolean;
    refundSent?: boolean;
    photos: Array<{ url: string; capturedAt: string; slotKey?: string }>;
  } | null;
  not_received_report?: { id: string; reported_at: string } | null;
  renter_reported_returned_at?: string | null;
  renter_return_escalated_at?: string | null;
  return_place?: { name: string; address: string | null; phone: string | null } | null;
  accept_start_preview?: {
    payment_rail: 'card' | 'wallet' | 'mobile_money';
    amount_due_at_pickup: number;
    deposit_hold_amount?: number | null;
  } | null;
  return_handed_back_at?: string | null;
  return_resolution?: string | null;
  rental_pricing_snapshot?: unknown;
  client_id: string;
  business_id: string;
  client?: {
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      phone_number?: string | null;
      email?: string | null;
    } | null;
  } | null;
  rental_location_listing?: {
    rental_item?: {
      name?: string | null;
      rental_item_images?: Array<{
        id: string;
        image_url: string;
        alt_text?: string | null;
      }>;
    } | null;
    business_location?: { name?: string | null; address?: { country?: string | null } | null } | null;
  } | null;
  rental_hold?: {
    client_hold_amount: number;
    status: string;
  } | null;
  rental_request?: {
    rental_selection_windows?: RentalSelectionWindow[] | null;
  } | null;
}

export function useRentalApi() {
  const api = useApiClient();
  const geoParams = useRentalCatalogGeoParams();
  const rentalCatalogGeo = useMemo(
    () => ({
      ...(geoParams.country_code ? { country_code: geoParams.country_code } : {}),
      ...(geoParams.state ? { state: geoParams.state } : {}),
    }),
    [geoParams.country_code, geoParams.state]
  );

  const fetchBusinessRentalItems = useCallback(async () => {
    const { data } = await api.get<{
      success: boolean;
      data: { items: BusinessRentalItemRow[] };
    }>('/rentals/business/items');
    if (!data.success) return [];
    return data.data.items ?? [];
  }, [api]);

  const fetchBusinessRentalItem = useCallback(
    async (itemId: string): Promise<BusinessRentalItemDetail | null> => {
      try {
        const { data } = await api.get<{
          success: boolean;
          data: { item: BusinessRentalItemDetail };
        }>(`/rentals/business/items/${itemId}`);
        if (!data.success) return null;
        return data.data.item ?? null;
      } catch {
        return null;
      }
    },
    [api]
  );

  const updateBusinessRentalItem = useCallback(
    async (itemId: string, body: UpdateBusinessRentalItemBody) => {
      const { data } = await api.patch<{ success: boolean }>(
        `/rentals/business/items/${itemId}`,
        body
      );
      return data as { success: boolean };
    },
    [api]
  );

  const updateBusinessRentalListing = useCallback(
    async (listingId: string, body: UpdateBusinessRentalListingBody) => {
      const { data } = await api.patch<{ success: boolean }>(
        `/rentals/business/listings/${listingId}`,
        body
      );
      return data as { success: boolean };
    },
    [api]
  );

  const fetchListingBookedWindows = useCallback(
    async (listingId: string): Promise<RentalTakenWindow[]> => {
      try {
        const { data } = await api.get<{
          success: boolean;
          data: { windows: RentalTakenWindow[] };
        }>(`/rentals/listings/${listingId}/booked-windows`, { params: rentalCatalogGeo });
        if (!data.success) return [];
        return data.data?.windows ?? [];
      } catch {
        return [];
      }
    },
    [api, rentalCatalogGeo]
  );

  const fetchPublicRentalListing = useCallback(
    async (listingId: string): Promise<RentalListingRow | null> => {
      try {
        const { data } = await api.get<{
          success: boolean;
          data: { listing: RentalListingRow };
        }>(`/rentals/listings/${listingId}`, { params: rentalCatalogGeo });
        if (!data.success) return null;
        return data.data.listing ?? null;
      } catch {
        return null;
      }
    },
    [api, rentalCatalogGeo]
  );

  const fetchBusinessRentalRequests = useCallback(async () => {
    const { data } = await api.get<{
      success: boolean;
      data: { requests: BusinessRentalRequestRow[] };
    }>('/rentals/business/requests');
    if (!data.success) return [];
    return data.data.requests ?? [];
  }, [api]);

  const fetchDashboardRentalRequests = useCallback(async () => {
    const { data } = await api.get<{
      success: boolean;
      data: {
        requests: BusinessRentalRequestRow[];
        expiryNotices?: Array<{
          id: string;
          itemName: string;
          renterName: string;
          window: 'sla' | 'start';
        }>;
      };
    }>('/rentals/business/requests', { params: { status: 'pending', limit: 100 } });
    if (!data.success) return { requests: [], expiryNotices: [] };
    return {
      requests: data.data.requests ?? [],
      expiryNotices: data.data.expiryNotices ?? [],
    };
  }, [api]);

  const fetchClientRentalRequests = useCallback(async () => {
    const { data } = await api.get<{
      success: boolean;
      data: { requests: ClientRentalRequestRow[] };
    }>('/rentals/client/requests');
    if (!data.success) return [];
    return data.data.requests ?? [];
  }, [api]);

  const fetchBusinessRentalSchedule = useCallback(
    async (rentalItemId: string): Promise<BusinessRentalScheduleRow[]> => {
      if (!rentalItemId) {
        return [];
      }
      const { data } = await api.get<{
        success: boolean;
        data: { schedule: BusinessRentalScheduleRow[] };
      }>('/rentals/business/schedule', {
        params: { rental_item_id: rentalItemId },
      });
      if (!data.success) return [];
      return data.data.schedule ?? [];
    },
    [api]
  );

  const fetchBusinessRentalItemActivity = useCallback(
    async (
      itemId: string,
      opts?: { scope?: BusinessRentalItemActivityScope; page?: number; limit?: number }
    ): Promise<BusinessRentalItemActivity | null> => {
      if (!itemId) return null;
      const { data } = await api.get<{
        success: boolean;
        data: BusinessRentalItemActivity;
      }>(`/rentals/business/items/${encodeURIComponent(itemId)}/activity`, {
        params: {
          scope: opts?.scope,
          page: opts?.page,
          limit: opts?.limit,
        },
      });
      if (!data.success) return null;
      return data.data ?? null;
    },
    [api]
  );

  const createBusinessRentalItem = useCallback(
    async (body: {
      rental_category_id: string;
      name: string;
      description?: string;
      tags?: string[];
      currency?: string;
    }) => {
      const { data } = await api.post<{
        success: boolean;
        data: { id: string };
      }>('/rentals/business/items', body);
      return data as { success: boolean; data: { id: string } };
    },
    [api]
  );

  const createBusinessRentalListing = useCallback(
    async (body: {
      rental_item_id: string;
      business_location_id: string;
      pickup_instructions?: string;
      dropoff_instructions?: string;
      base_price_per_hour: number;
      base_price_per_day: number;
      /** Listing switches; omitted means both on. */
      offers_daily?: boolean;
      offers_hourly?: boolean;
      security_deposit_amount?: number;
      reservation_fee_enabled?: boolean;
      min_rental_hours?: number;
      max_rental_hours?: number | null;
      units_available: number;
      weekly_availability?: RentalWeeklyAvailabilityRow[];
    }) => {
      const { data } = await api.post<{
        success: boolean;
        data: { id: string };
      }>('/rentals/business/listings', body);
      return data as { success: boolean; data: { id: string } };
    },
    [api]
  );

  const publishBusinessRentalListing = useCallback(
    async (listingId: string) => {
      const { data } = await api.post<{
        success: boolean;
        data: { listing: { id: string; moderation_status: string } };
      }>(`/rentals/business/listings/${listingId}/publish`, {});
      return data as {
        success: boolean;
        data: { listing: { id: string; moderation_status: string } };
      };
    },
    [api]
  );

  const fetchBusinessAiProposal = useCallback(
    async (listingId: string) => {
      const { data } = await api.get<{
        success: boolean;
        listing: BusinessAiProposalPayload['listing'];
        proposal: BusinessAiProposalPayload['proposal'];
      }>(`/rentals/business/listings/${listingId}/ai-proposal`);
      return {
        listing: data.listing ?? null,
        proposal: data.proposal ?? null,
      } as BusinessAiProposalPayload;
    },
    [api]
  );

  const acceptBusinessAiProposal = useCallback(
    async (
      listingId: string,
      edits?: {
        applyTitle?: boolean;
        applyDescription?: boolean;
        title?: string;
        description?: string;
      }
    ) => {
      const { data } = await api.post<{ success: boolean }>(
        `/rentals/business/listings/${listingId}/ai-proposal/accept`,
        edits ?? {}
      );
      return !!data.success;
    },
    [api]
  );

  const declineBusinessAiProposal = useCallback(
    async (listingId: string) => {
      const { data } = await api.post<{ success: boolean }>(
        `/rentals/business/listings/${listingId}/ai-proposal/decline`,
        {}
      );
      return !!data.success;
    },
    [api]
  );

  const fetchRequestInspectionPolicy = useCallback(async (requestId: string) => {
    const { data } = await api.get<{ success: boolean; inspection_policy_version: number | null }>(
      `/rentals/requests/${requestId}/inspection-policy`
    );
    return data.inspection_policy_version ?? null;
  }, [api]);

  const createRequest = useCallback(
    async (body: {
      rentalLocationListingId: string;
      requestedStartAt: string;
      requestedEndAt: string;
      windows?: Array<{
        requestedStartAt: string;
        requestedEndAt: string;
        billing?: 'hourly' | 'all_day';
        calendarDate?: string;
      }>;
      unitsRequested?: number;
      clientRequestNote?: string;
    }) => {
      const { data } = await api.post('/rentals/requests', body);
      return data as { success: boolean; requestId: string; inspection_policy_version?: number | null };
    },
    [api]
  );

  const respondRequest = useCallback(
    async (requestId: string, body: RespondRentalRequestBody) => {
      const { data } = await api.post(`/rentals/requests/${requestId}/respond`, body);
      return data as { success: boolean };
    },
    [api]
  );

  const createBooking = useCallback(
    async (rentalRequestId: string) => {
      const { data } = await api.post('/rentals/bookings', { rentalRequestId });
      return data as RentalBookingActionResult;
    },
    [api]
  );

  const getBookingPaymentStatus = useCallback(
    async (bookingId: string) => {
      const { data } = await api.get<{
        success: boolean;
        data: RentalBookingPaymentStatus;
      }>(`/rentals/bookings/${bookingId}/payment-status`);
      return data.data;
    },
    [api]
  );

  const retryBookingPayment = useCallback(
    async (bookingId: string) => {
      const { data } = await api.post(
        `/rentals/bookings/${bookingId}/retry-payment`
      );
      return data as RentalBookingActionResult;
    },
    [api]
  );

  const cancelClientRentalRequest = useCallback(
    async (requestId: string) => {
      const { data } = await api.post<{ success: boolean }>(
        `/rentals/requests/${requestId}/cancel`
      );
      return data;
    },
    [api]
  );

  const cancelBooking = useCallback(
    async (bookingId: string) => {
      const { data } = await api.post(`/rentals/bookings/${bookingId}/cancel`);
      return data as { success: boolean };
    },
    [api]
  );

  const initiatePickupPayment = useCallback(
    async (bookingId: string) => {
      const { data } = await api.post(
        `/rentals/bookings/${bookingId}/pickup-payment`
      );
      return data as RentalBookingActionResult;
    },
    [api]
  );

  const reportReturned = useCallback(
    async (bookingId: string) => {
      const { data } = await api.post(`/rentals/bookings/${bookingId}/report-returned`);
      return data as {
        success: true;
        alreadyReported: boolean;
        wasOverdue: boolean;
        report: { rentalBookingId: string; reportedAt: string };
      };
    },
    [api]
  );

  const reportNotReceived = useCallback(
    async (bookingId: string) => {
      const { data } = await api.post(`/rentals/bookings/${bookingId}/report-not-received`);
      return data as {
        success: true;
        alreadyReported: boolean;
        report: { id: string; rentalBookingId: string; reportedAt: string };
      };
    },
    [api]
  );

  const acceptAndStart = useCallback(
    async (bookingId: string, versionId: string) => {
      const { data } = await api.post(`/rentals/bookings/${bookingId}/accept-and-start`, {
        versionId,
      });
      return data as {
        success: true;
        started: boolean;
        alreadyStarted: boolean;
        paymentPending: boolean;
        payment_rail: 'card' | 'wallet' | 'mobile_money';
        amount_due_at_pickup: number;
        bookingId: string;
        checkout_url?: string;
        deposit_hold_amount?: number;
      };
    },
    [api]
  );

  const fetchBookingDetail = useCallback(
    async (bookingId: string): Promise<RentalBookingDetail | null> => {
      try {
        const { data } = await api.get<{
          success: boolean;
          data: { booking: RentalBookingDetail };
        }>(`/rentals/bookings/${bookingId}`);
        if (!data.success) return null;
        return data.data.booking ?? null;
      } catch {
        return null;
      }
    },
    [api]
  );

  const startRental = useCallback(async (bookingId: string) => {
    const { data } = await api.post(`/rentals/bookings/${bookingId}/start`);
    return data as {
      started: boolean;
      paymentPending: boolean;
      start_opens_at?: string;
      payment_rail?: string;
      amount_due_at_pickup?: number;
      /** Card pay at pickup: hosted Checkout for (rental − paid fee + deposit). */
      checkout_url?: string;
      deposit_hold_amount?: number;
    };
  }, [api]);

  const reportItemNotCollected = useCallback(async (bookingId: string) => {
    const { data } = await api.post(`/rentals/bookings/${bookingId}/item-not-collected`);
    return data as { success: boolean };
  }, [api]);

  const confirmReturn = useCallback(
    async (bookingId: string, body?: { actualEndAt?: string }) => {
      const { data } = await api.post(
        `/rentals/bookings/${bookingId}/confirm-return`,
        body ?? {}
      );
      return data as {
        success: boolean;
        overtimeDue?: boolean;
        overtimeAmount?: number;
        paymentPending?: boolean;
      };
    },
    [api]
  );

  const deleteBusinessRentalListing = useCallback(
    async (listingId: string) => {
      const { data } = await api.delete<{ success: boolean }>(
        `/rentals/business/listings/${listingId}`
      );
      return data as { success: boolean };
    },
    [api]
  );

  const declineCondition = useCallback(
    async (bookingId: string, body: { versionId: string; reason: string; text?: string; photos?: string[] }) => {
      const { data } = await api.post(`/rentals/bookings/${bookingId}/decline-condition`, body);
      return data;
    },
    [api]
  );

  const fetchConditionPhotos = useCallback(async (listingId: string) => {
    const { data } = await api.get(`/rentals/listings/${listingId}/condition-photos`);
    return data as { photos?: Array<{ slotKey: string; capturedAt: string | null; url: string; expiresAt: string }> };
  }, [api]);

  const deleteBusinessRentalItem = useCallback(
    async (itemId: string) => {
      const { data } = await api.delete<{ success: boolean }>(
        `/rentals/business/items/${itemId}`
      );
      return data as { success: boolean };
    },
    [api]
  );

  return {
    fetchBusinessRentalItems,
    fetchBusinessRentalItem,
    updateBusinessRentalItem,
    updateBusinessRentalListing,
    fetchListingBookedWindows,
    fetchPublicRentalListing,
    fetchBusinessRentalRequests,
    fetchDashboardRentalRequests,
    fetchClientRentalRequests,
    fetchBusinessRentalSchedule,
    fetchBusinessRentalItemActivity,
    createBusinessRentalItem,
    createBusinessRentalListing,
    publishBusinessRentalListing,
    fetchBusinessAiProposal,
    acceptBusinessAiProposal,
    declineBusinessAiProposal,
    createRequest,
    fetchRequestInspectionPolicy,
    respondRequest,
    createBooking,
    getBookingPaymentStatus,
    retryBookingPayment,
    cancelClientRentalRequest,
    cancelBooking,
    initiatePickupPayment,
    acceptAndStart,
    reportNotReceived,
    reportReturned,
    startRental,
    reportItemNotCollected,
    fetchBookingDetail,
    confirmReturn,
    deleteBusinessRentalListing,
    deleteBusinessRentalItem,
    declineCondition,
    fetchConditionPhotos,
  };
}
