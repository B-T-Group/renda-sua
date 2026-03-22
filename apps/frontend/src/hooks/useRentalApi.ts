import { useCallback } from 'react';
import { useApiClient } from './useApiClient';

export interface RentalPricingSnapshotBody {
  version: number;
  currency: string;
  total: number;
  ratePerDay?: number;
  days?: number;
  computedAt: string;
}

export interface BusinessRentalItemRow {
  id: string;
  name: string;
  description: string;
  currency: string;
  rental_category_id: string;
  rental_location_listings: {
    id: string;
    business_location_id: string;
    base_price_per_day: number;
  }[];
}

export interface BusinessRentalRequestRow {
  id: string;
  status: string;
  requested_start_at: string;
  requested_end_at: string;
  rental_pricing_snapshot: unknown;
  rental_location_listing: {
    id: string;
    base_price_per_day: number;
    rental_item: { name: string; currency: string };
  };
}

export function useRentalApi() {
  const api = useApiClient();

  const fetchBusinessRentalItems = useCallback(async () => {
    const { data } = await api.get<{
      success: boolean;
      data: { items: BusinessRentalItemRow[] };
    }>('/rentals/business/items');
    if (!data.success) return [];
    return data.data.items ?? [];
  }, [api]);

  const fetchBusinessRentalRequests = useCallback(async () => {
    const { data } = await api.get<{
      success: boolean;
      data: { requests: BusinessRentalRequestRow[] };
    }>('/rentals/business/requests');
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
    }) => {
      const { data } = await api.post('/rentals/requests', body);
      return data as { success: boolean; requestId: string };
    },
    [api]
  );

  const respondRequest = useCallback(
    async (
      requestId: string,
      body: {
        status: 'available' | 'unavailable';
        rentalPricingSnapshot?: RentalPricingSnapshotBody;
        businessResponseNote?: string;
      }
    ) => {
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
    fetchBusinessRentalRequests,
    createBusinessRentalItem,
    createBusinessRentalListing,
    createRequest,
    respondRequest,
    createBooking,
    cancelBooking,
    getStartPin,
    verifyStartPin,
    generateOverwrite,
    confirmReturn,
  };
}
