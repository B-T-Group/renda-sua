import { useCallback } from 'react';
import { useApiClient } from './useApiClient';
import { useRentalCatalogGeoParams } from './useRentalCatalogGeoParams';
import type { RentalListingRow } from './useRentalListings';

export interface RentalPricingSnapshotBody {
  version: number;
  currency: string;
  total: number;
  ratePerDay?: number;
  days?: number;
  computedAt: string;
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
  rental_item_images?: BusinessRentalItemImageRow[];
  rental_location_listings: {
    id: string;
    business_location_id: string;
    base_price_per_day: number;
  }[];
}

export interface BusinessRentalListingDetail {
  id: string;
  business_location_id: string;
  base_price_per_day: number;
  min_rental_days: number;
  max_rental_days: number | null;
  units_available: number;
  is_active: boolean;
  pickup_instructions?: string | null;
  dropoff_instructions?: string | null;
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
  operation_mode?: string;
  rental_item_images: BusinessRentalItemImageRow[];
  rental_location_listings: BusinessRentalListingDetail[];
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
  pickup_instructions?: string;
  dropoff_instructions?: string;
  base_price_per_day?: number;
  min_rental_days?: number;
  max_rental_days?: number | null;
  units_available?: number;
  is_active?: boolean;
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
}

export interface RespondRentalRequestBody {
  status: 'available' | 'unavailable';
  rentalPricingSnapshot?: RentalPricingSnapshotBody;
  contractExpiryHours?: number;
  unavailableReasonCode?: UnavailableRentalReasonCode;
  businessResponseNote?: string;
}

export interface BusinessRentalRequestRow {
  id: string;
  status: string;
  requested_start_at: string;
  requested_end_at: string;
  rental_pricing_snapshot: unknown;
  business_response_note?: string | null;
  client_request_note?: string | null;
  unavailable_reason_code?: string | null;
  expires_at?: string | null;
  responded_at?: string | null;
  rental_location_listing: {
    id: string;
    base_price_per_day: number;
    rental_item: { name: string; currency: string };
  };
}

export interface ClientRentalRequestRow {
  id: string;
  status: string;
  requested_start_at: string;
  requested_end_at: string;
  created_at: string;
  business_response_note?: string | null;
  unavailable_reason_code?: string | null;
  client_request_note?: string | null;
  rental_pricing_snapshot?: unknown;
  responded_at?: string | null;
  expires_at?: string | null;
  rental_location_listing: {
    id: string;
    base_price_per_day: number | string;
    business_location?: { name: string } | null;
    rental_item: { name: string; currency: string };
  } | null;
  rental_booking?: {
    id: string;
    status: string;
    contract_expires_at?: string | null;
  } | null;
}

export function useRentalApi() {
  const api = useApiClient();
  const rentalCatalogGeo = useRentalCatalogGeoParams();

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

  const fetchClientRentalRequests = useCallback(async () => {
    const { data } = await api.get<{
      success: boolean;
      data: { requests: ClientRentalRequestRow[] };
    }>('/rentals/client/requests');
    if (!data.success) return [];
    return data.data.requests ?? [];
  }, [api]);

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
      base_price_per_day: number;
      min_rental_days?: number;
      max_rental_days?: number | null;
      units_available?: number;
    }) => {
      const { data } = await api.post<{
        success: boolean;
        data: { id: string };
      }>('/rentals/business/listings', body);
      return data as { success: boolean; data: { id: string } };
    },
    [api]
  );

  const createRequest = useCallback(
    async (body: {
      rentalLocationListingId: string;
      requestedStartAt: string;
      requestedEndAt: string;
      clientRequestNote?: string;
    }) => {
      const { data } = await api.post('/rentals/requests', body);
      return data as { success: boolean; requestId: string };
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
      return data as { success: boolean; bookingId: string };
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

  const getStartPin = useCallback(
    async (bookingId: string) => {
      const { data } = await api.get(`/rentals/bookings/${bookingId}/start-pin`);
      return data as { pin: string };
    },
    [api]
  );

  const verifyStartPin = useCallback(
    async (bookingId: string, body: { pin?: string; overwriteCode?: string }) => {
      const { data } = await api.post(
        `/rentals/bookings/${bookingId}/verify-start-pin`,
        body
      );
      return data as { success: boolean };
    },
    [api]
  );

  const generateOverwrite = useCallback(
    async (bookingId: string) => {
      const { data } = await api.post(
        `/rentals/bookings/${bookingId}/start-overwrite-code`
      );
      return data as { overwriteCode: string };
    },
    [api]
  );

  const confirmReturn = useCallback(
    async (bookingId: string) => {
      const { data } = await api.post(
        `/rentals/bookings/${bookingId}/confirm-return`
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
    fetchClientRentalRequests,
    createBusinessRentalItem,
    createBusinessRentalListing,
    createRequest,
    respondRequest,
    createBooking,
    cancelClientRentalRequest,
    cancelBooking,
    getStartPin,
    verifyStartPin,
    generateOverwrite,
    confirmReturn,
  };
}
