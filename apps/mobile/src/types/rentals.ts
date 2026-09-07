/** Client/guest + business rentals types mirroring web useRentalApi / useRentalListings. */

export type RentalOperationMode = 'business_operated' | 'take_home';

export type RentalListingsSortMode =
  | 'relevance'
  | 'newest'
  | 'fastest'
  | 'cheapest'
  | 'expensive';

export type RentalRequestStatus =
  | 'pending'
  | 'available'
  | 'unavailable'
  | 'booked'
  | 'expired'
  | 'cancelled';

export type RentalBookingStatus =
  | 'proposed'
  | 'reserved'
  | 'confirmed'
  | 'active'
  | 'awaiting_return'
  | 'completed'
  | 'cancelled';

export type RentalPaymentTiming = 'pay_now' | 'pay_at_pickup';

export type RentalBookingPaymentState =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'cancelled';

export type RentalBillingMode = 'hourly' | 'all_day';

export interface RentalWeeklyAvailabilityRow {
  id?: string;
  weekday: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
}

export interface RentalCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
}

export interface RentalTakenWindow {
  startAt: string;
  endAt: string;
  unitsBooked?: number;
}

export interface RentalSelectionWindow {
  start_at: string;
  end_at: string;
  billing?: RentalBillingMode;
  calendar_date?: string;
}

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
  ratePerHour?: number;
  hours?: number;
  securityDeposit?: number;
  lines?: RentalPricingSnapshotLine[];
  computedAt: string;
}

export interface RentalListingRow {
  id: string;
  base_price_per_hour: string | number;
  base_price_per_day: string | number;
  security_deposit_amount?: string | number | null;
  min_rental_hours: number;
  max_rental_hours: number | null;
  units_available?: number;
  pickup_instructions: string;
  dropoff_instructions: string;
  weekly_availability: RentalWeeklyAvailabilityRow[];
  updated_at?: string;
  rental_item: {
    id: string;
    name: string;
    description: string;
    tags: string[];
    currency: string;
    operation_mode: string;
    rental_category: { id: string; name: string };
    rental_item_images: Array<{
      id: string;
      image_url: string;
      alt_text?: string;
      /** Server-resolved display URL: thumbnail when ready, else image_url. */
      display_url?: string | null;
    }>;
    business: {
      id: string;
      name: string;
      is_verified?: boolean;
      can_accept_orders?: boolean;
      is_storefront_visible?: boolean;
    };
  };
  business_location: {
    id: string;
    name: string;
    address: {
      id?: string;
      address_line_1?: string;
      address_line_2?: string | null;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
  distance_text?: string;
  duration_text?: string;
  distance_value?: number;
}

export interface ClientRentalRequestRow {
  id: string;
  status: RentalRequestStatus | string;
  rental_selection_windows?: RentalSelectionWindow[] | null;
  created_at: string;
  business_response_note?: string | null;
  unavailable_reason_code?: string | null;
  client_request_note?: string | null;
  rental_pricing_snapshot?: unknown;
  responded_at?: string | null;
  expires_at?: string | null;
  rental_location_listing: {
    id: string;
    base_price_per_hour: number | string;
    base_price_per_day?: number | string;
    business_location?: { name: string } | null;
    rental_item: { name: string; currency: string };
  } | null;
  rental_booking?: {
    id: string;
    status: RentalBookingStatus | string;
    contract_expires_at?: string | null;
  } | null;
}

export interface ClientRentalBookingRow {
  id: string;
  booking_number?: string | null;
  status: RentalBookingStatus | string;
  start_at: string;
  end_at: string;
  total_amount: number;
  currency: string;
  contract_expires_at?: string | null;
  created_at?: string;
  rental_request_id?: string;
  rental_pricing_snapshot?: unknown;
  payment_timing?: RentalPaymentTiming | string | null;
  payment_status?: RentalBookingPaymentState | string | null;
  rental_location_listing?: {
    id: string;
    business_location?: { name: string } | null;
    rental_item?: {
      name: string;
      currency?: string;
      rental_item_images?: Array<{ id: string; image_url: string }>;
    } | null;
  } | null;
}

export interface RentalBookingDetail {
  id: string;
  booking_number?: string | null;
  status: RentalBookingStatus | string;
  start_at: string;
  end_at: string;
  total_amount: number;
  currency: string;
  security_deposit_amount?: number | string | null;
  authorized_amount?: number | string | null;
  captured_amount?: number | string | null;
  overtime_amount?: number | string | null;
  payment_timing?: RentalPaymentTiming | string | null;
  payment_status?: RentalBookingPaymentState | string | null;
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  rental_pricing_snapshot?: unknown;
  client_id: string;
  business_id: string;
  contract_expires_at?: string | null;
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
    business_location?: { name?: string | null } | null;
  } | null;
  rental_hold?: {
    client_hold_amount: number;
    status: string;
  } | null;
  rental_request?: {
    rental_selection_windows?: RentalSelectionWindow[] | null;
  } | null;
}

export interface RentalCatalogGeoParams {
  country_code?: string;
  state?: string;
  origin_lat?: number;
  origin_lng?: number;
  business_location_id?: string;
}

export interface RentalOrigin {
  lat: number;
  lng: number;
}

export interface TopRentalLocationRow {
  id: string;
  name: string;
  logo_url: string | null;
  listing_count: number;
  distance_meters: number | null;
  city?: string | null;
  state?: string | null;
}

export interface FetchRentalListingsParams extends RentalCatalogGeoParams {
  page?: number;
  limit?: number;
  sort?: RentalListingsSortMode;
  q?: string;
  category_id?: string;
  min_price?: number;
  max_price?: number;
  /** Optional catalog filter when backend supports it. */
  operation_mode?: RentalOperationMode;
}

export interface BusinessRentalItemImageRow {
  id: string;
  image_url: string;
  display_order: number;
  alt_text?: string | null;
}

export interface BusinessRentalItemRow {
  id: string;
  name: string;
  description: string;
  currency: string;
  rental_category_id: string;
  is_active?: boolean;
  deleted_at?: string | null;
  operation_mode?: RentalOperationMode | string;
  rental_item_images?: BusinessRentalItemImageRow[];
  rental_location_listings: {
    id: string;
    business_location_id: string;
    base_price_per_hour: number;
    base_price_per_day: number;
    security_deposit_amount?: number | string | null;
    is_active?: boolean;
    deleted_at?: string | null;
    moderation_status?: string;
    moderated_at?: string | null;
  }[];
}

export interface BusinessRentalAiReviewSummary {
  id: string;
  status: string;
  decision_reason?: string | null;
  proposed_title?: string | null;
  proposed_description?: string | null;
  rejection_fields?: string[];
  completed_at?: string | null;
}

export interface BusinessRentalListingDetail {
  id: string;
  business_location_id: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  security_deposit_amount?: number;
  min_rental_hours: number;
  max_rental_hours: number | null;
  units_available: number;
  is_active: boolean;
  deleted_at?: string | null;
  moderation_status?: string;
  moderated_at?: string | null;
  moderated_by_user_id?: string | null;
  moderation_source?: string | null;
  ai_reviewed_at?: string | null;
  /** Set by API when moderation_status is rejected */
  rejection_reason?: string | null;
  pickup_instructions?: string | null;
  dropoff_instructions?: string | null;
  weekly_availability: RentalWeeklyAvailabilityRow[];
  business_location?: { id: string; name: string } | null;
  ai_reviews?: BusinessRentalAiReviewSummary[];
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
  operation_mode?: RentalOperationMode | string;
  rental_item_images: BusinessRentalItemImageRow[];
  rental_location_listings: BusinessRentalListingDetail[];
}

export interface CreateBusinessRentalItemBody {
  rental_category_id: string;
  name: string;
  description?: string;
  tags?: string[];
  currency?: string;
  operation_mode?: RentalOperationMode;
}

export interface UpdateBusinessRentalItemBody {
  rental_category_id?: string;
  name?: string;
  description?: string;
  tags?: string[];
  currency?: string;
  is_active?: boolean;
  operation_mode?: RentalOperationMode;
}

export interface CreateBusinessRentalListingBody {
  rental_item_id: string;
  business_location_id: string;
  pickup_instructions?: string;
  dropoff_instructions?: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  security_deposit_amount?: number;
  min_rental_hours?: number;
  max_rental_hours?: number | null;
  units_available: number;
  weekly_availability?: RentalWeeklyAvailabilityRow[];
}

export interface UpdateBusinessRentalListingBody {
  pickup_instructions?: string;
  dropoff_instructions?: string;
  base_price_per_hour?: number;
  base_price_per_day?: number;
  security_deposit_amount?: number;
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

export interface RespondRentalRequestBody {
  status: 'available' | 'unavailable';
  rentalPricingSnapshot?: RentalPricingSnapshotBody;
  contractExpiryHours?: number;
  unavailableReasonCode?: UnavailableRentalReasonCode;
  businessResponseNote?: string;
}

export interface BusinessRentalRequestRow {
  id: string;
  created_at: string;
  status: string;
  rental_selection_windows?: RentalSelectionWindow[] | null;
  rental_pricing_snapshot: unknown;
  business_response_note?: string | null;
  client_request_note?: string | null;
  unavailable_reason_code?: string | null;
  expires_at?: string | null;
  responded_at?: string | null;
  rental_location_listing: {
    id: string;
    base_price_per_hour: number;
    base_price_per_day: number;
    weekly_availability?: RentalWeeklyAvailabilityRow[];
    rental_item: {
      name: string;
      currency: string;
      rental_item_images?: Array<{
        id: string;
        image_url: string;
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
    booking_number?: string | null;
    actual_start_at?: string | null;
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

export interface CreateRentalFromImagePayload {
  mode?: 'manual' | 'ai';
  imageId: string;
  name?: string;
  rental_category_id?: string;
  description?: string;
  currency?: string;
  is_active?: boolean;
  tags?: string[];
  operation_mode?: RentalOperationMode;
}

export interface RentalFromImageSuggestionData {
  name?: string;
  description?: string;
  rental_category_id: string | null;
  rentalCategorySuggestion?: string;
  suggested_tags: string[];
  currency: string;
}

export interface CreatedRentalItemSummary {
  id: string;
  name: string;
  currency: string;
  operation_mode: RentalOperationMode;
}

export interface RentalListingsPage {
  listings: RentalListingRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateRentalRequestBody {
  rentalLocationListingId: string;
  requestedStartAt?: string;
  requestedEndAt?: string;
  windows?: Array<{
    requestedStartAt: string;
    requestedEndAt: string;
    billing?: RentalBillingMode;
    calendarDate?: string;
  }>;
  unitsRequested?: number;
  clientRequestNote?: string;
}

export interface CreateRentalRequestResult {
  success: boolean;
  requestId: string;
}

export interface CreateRentalBookingResult {
  success: boolean;
  bookingId: string;
  paymentPending?: boolean;
  confirmed?: boolean;
  reserved?: boolean;
  payment_rail?: 'wallet' | 'mobile_money' | 'stripe';
  checkout_url?: string;
  payment_intent_client_secret?: string;
  payment_transaction_id?: string;
}

export interface RentalBookingPaymentStatus {
  status: RentalBookingStatus | string;
  paymentPending: boolean;
  contractExpiresAt: string | null;
  bookingNumber: string | null;
  payment_rail?: 'wallet' | 'mobile_money' | 'stripe' | null;
  checkout_url?: string | null;
  payment_transaction_id?: string | null;
  has_payment_intent?: boolean;
}

export interface CreateRentalBookingOptions {
  stripe_payment_method?: 'payment_sheet';
}

export interface RetryRentalBookingPaymentOptions {
  stripe_payment_method?: 'payment_sheet';
}

export interface RentalApiSuccess {
  success: boolean;
  message?: string;
}

export interface RentalStartPinResult {
  pin: string;
}
