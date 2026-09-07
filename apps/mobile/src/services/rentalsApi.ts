import type {
  BusinessRentalItemDetail,
  BusinessRentalItemRow,
  BusinessRentalRequestRow,
  BusinessRentalScheduleRow,
  ClientRentalBookingRow,
  ClientRentalRequestRow,
  CreateBusinessRentalItemBody,
  CreateBusinessRentalListingBody,
  CreateRentalBookingResult,
  CreateRentalRequestBody,
  CreateRentalRequestResult,
  FetchRentalListingsParams,
  RentalApiSuccess,
  RentalBookingDetail,
  RentalBookingPaymentStatus,
  RentalCatalogGeoParams,
  RentalCategory,
  RentalListingRow,
  RentalListingsPage,
  RentalStartPinResult,
  RentalTakenWindow,
  RespondRentalRequestBody,
  TopRentalLocationRow,
  UpdateBusinessRentalItemBody,
  UpdateBusinessRentalListingBody,
} from '../types/rentals';
import { apiRequest } from './apiClient';
import { publicApiGet } from './publicApiClient';

type Init = { signal?: AbortSignal };

function appendGeo(
  search: URLSearchParams,
  geo?: RentalCatalogGeoParams
): void {
  if (geo?.country_code) search.set('country_code', geo.country_code);
  if (geo?.state) search.set('state', geo.state);
  if (typeof geo?.origin_lat === 'number') {
    search.set('origin_lat', String(geo.origin_lat));
  }
  if (typeof geo?.origin_lng === 'number') {
    search.set('origin_lng', String(geo.origin_lng));
  }
  if (geo?.business_location_id) {
    search.set('business_location_id', geo.business_location_id);
  }
}

function listingsPath(params: FetchRentalListingsParams): string {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 25));
  if (params.sort) search.set('sort', params.sort);
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.category_id) search.set('category_id', params.category_id);
  if (typeof params.min_price === 'number') {
    search.set('min_price', String(params.min_price));
  }
  if (typeof params.max_price === 'number') {
    search.set('max_price', String(params.max_price));
  }
  if (params.operation_mode) {
    search.set('operation_mode', params.operation_mode);
  }
  appendGeo(search, params);
  return `/rentals/listings?${search.toString()}`;
}

function geoQuery(geo?: RentalCatalogGeoParams): string {
  const search = new URLSearchParams();
  appendGeo(search, geo);
  const q = search.toString();
  return q ? `?${q}` : '';
}

function parseListingsPage(data: {
  listings?: RentalListingRow[];
  items?: RentalListingRow[];
  total?: number;
  page?: number;
  limit?: number;
}): RentalListingsPage {
  const listings = data.listings ?? data.items ?? [];
  return {
    listings,
    total: data.total ?? listings.length,
    page: data.page ?? 1,
    limit: data.limit ?? listings.length,
  };
}

export async function getCategories(init?: Init): Promise<RentalCategory[]> {
  const res = await publicApiGet<{
    success: boolean;
    data: { categories: RentalCategory[] };
  }>('/rentals/categories', undefined, init);
  if (!res.success) return [];
  return res.data?.categories ?? [];
}

export async function getTopRentalLocations(
  params: RentalCatalogGeoParams & { limit?: number },
  init?: Init
): Promise<TopRentalLocationRow[]> {
  const search = new URLSearchParams();
  if (params.limit != null) search.set('limit', String(params.limit));
  appendGeo(search, params);
  const q = search.toString();
  const res = await publicApiGet<{
    success: boolean;
    data: { locations: TopRentalLocationRow[] };
  }>(`/rentals/top-locations${q ? `?${q}` : ''}`, undefined, init);
  if (!res.success) return [];
  return res.data?.locations ?? [];
}

export async function createCategory(
  name: string
): Promise<RentalCategory> {
  const res = await apiRequest<{
    success: boolean;
    data: { category: RentalCategory };
    message?: string;
  }>('/rentals/categories', {
    method: 'POST',
    body: JSON.stringify({ name: name.trim() }),
  });
  if (!res.success || !res.data?.category) {
    throw new Error(res.message || 'Failed to create category');
  }
  return res.data.category;
}

export async function getListings(
  params: FetchRentalListingsParams,
  options?: Init & { withAuth?: boolean }
): Promise<RentalListingsPage> {
  const path = listingsPath(params);
  const fetchPage = options?.withAuth
    ? () =>
        apiRequest<{
          success: boolean;
          data: {
            listings?: RentalListingRow[];
            items?: RentalListingRow[];
            total?: number;
            page?: number;
            limit?: number;
          };
        }>(path, { method: 'GET', signal: options?.signal })
    : () =>
        publicApiGet<{
          success: boolean;
          data: {
            listings?: RentalListingRow[];
            items?: RentalListingRow[];
            total?: number;
            page?: number;
            limit?: number;
          };
        }>(path, undefined, { signal: options?.signal });
  const res = await fetchPage();
  if (!res.success) {
    return { listings: [], total: 0, page: 1, limit: params.limit ?? 25 };
  }
  return parseListingsPage(res.data ?? {});
}

export async function getListing(
  id: string,
  geo?: RentalCatalogGeoParams,
  options?: Init & { withAuth?: boolean }
): Promise<RentalListingRow | null> {
  const path = `/rentals/listings/${encodeURIComponent(id)}${geoQuery(geo)}`;
  try {
    const fetchOne = options?.withAuth
      ? () =>
          apiRequest<{
            success: boolean;
            data: { listing: RentalListingRow };
          }>(path, { method: 'GET', signal: options?.signal })
      : () =>
          publicApiGet<{
            success: boolean;
            data: { listing: RentalListingRow };
          }>(path, undefined, { signal: options?.signal });
    const res = await fetchOne();
    if (!res.success) return null;
    return res.data?.listing ?? null;
  } catch {
    return null;
  }
}

export async function getBookedWindows(
  listingId: string,
  geo?: RentalCatalogGeoParams,
  options?: Init & { withAuth?: boolean }
): Promise<RentalTakenWindow[]> {
  const path = `/rentals/listings/${encodeURIComponent(listingId)}/booked-windows${geoQuery(geo)}`;
  try {
    const fetchWindows = options?.withAuth
      ? () =>
          apiRequest<{
            success: boolean;
            data: { windows: RentalTakenWindow[] };
          }>(path, { method: 'GET', signal: options?.signal })
      : () =>
          publicApiGet<{
            success: boolean;
            data: { windows: RentalTakenWindow[] };
          }>(path, undefined, { signal: options?.signal });
    const res = await fetchWindows();
    if (!res.success) return [];
    return res.data?.windows ?? [];
  } catch {
    return [];
  }
}

export async function getClientRequests(
  init?: Init
): Promise<ClientRentalRequestRow[]> {
  const res = await apiRequest<{
    success: boolean;
    data: { requests: ClientRentalRequestRow[] };
  }>('/rentals/client/requests', { method: 'GET', signal: init?.signal });
  if (!res.success) return [];
  return res.data?.requests ?? [];
}

export async function getClientBookings(
  init?: Init
): Promise<ClientRentalBookingRow[]> {
  const res = await apiRequest<{
    success: boolean;
    data: { bookings: ClientRentalBookingRow[] };
  }>('/rentals/client/bookings', { method: 'GET', signal: init?.signal });
  if (!res.success) return [];
  return res.data?.bookings ?? [];
}

export async function createRequest(
  body: CreateRentalRequestBody
): Promise<CreateRentalRequestResult> {
  return apiRequest<CreateRentalRequestResult>('/rentals/requests', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function cancelRequest(id: string): Promise<RentalApiSuccess> {
  return apiRequest<RentalApiSuccess>(
    `/rentals/requests/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' }
  );
}

export async function createBooking(body: {
  rentalRequestId: string;
  stripe_payment_method?: 'payment_sheet';
}): Promise<CreateRentalBookingResult> {
  return apiRequest<CreateRentalBookingResult>('/rentals/bookings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getBooking(
  id: string,
  init?: Init
): Promise<RentalBookingDetail | null> {
  try {
    const res = await apiRequest<{
      success: boolean;
      data: { booking: RentalBookingDetail };
    }>(`/rentals/bookings/${encodeURIComponent(id)}`, {
      method: 'GET',
      signal: init?.signal,
    });
    if (!res.success) return null;
    return res.data?.booking ?? null;
  } catch {
    return null;
  }
}

export async function getPaymentStatus(
  bookingId: string,
  init?: Init
): Promise<RentalBookingPaymentStatus> {
  const res = await apiRequest<{
    success: boolean;
    data: RentalBookingPaymentStatus;
  }>(`/rentals/bookings/${encodeURIComponent(bookingId)}/payment-status`, {
    method: 'GET',
    signal: init?.signal,
  });
  return res.data;
}

export async function retryPayment(
  bookingId: string,
  body?: { stripe_payment_method?: 'payment_sheet' }
): Promise<CreateRentalBookingResult> {
  return apiRequest<CreateRentalBookingResult>(
    `/rentals/bookings/${encodeURIComponent(bookingId)}/retry-payment`,
    {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }
  );
}

export async function getStartPin(
  bookingId: string
): Promise<RentalStartPinResult> {
  return apiRequest<RentalStartPinResult>(
    `/rentals/bookings/${encodeURIComponent(bookingId)}/start-pin`,
    { method: 'GET' }
  );
}

export async function cancelBooking(bookingId: string): Promise<RentalApiSuccess> {
  return apiRequest<RentalApiSuccess>(
    `/rentals/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { method: 'POST' }
  );
}

export async function initiatePickupPayment(
  bookingId: string
): Promise<CreateRentalBookingResult> {
  return apiRequest<CreateRentalBookingResult>(
    `/rentals/bookings/${encodeURIComponent(bookingId)}/pickup-payment`,
    { method: 'POST' }
  );
}

export async function getBusinessItems(
  init?: Init
): Promise<BusinessRentalItemRow[]> {
  const res = await apiRequest<{
    success: boolean;
    data: { items: BusinessRentalItemRow[] };
  }>('/rentals/business/items', { method: 'GET', signal: init?.signal });
  if (!res.success) return [];
  return res.data?.items ?? [];
}

export async function getBusinessItem(
  itemId: string,
  init?: Init
): Promise<BusinessRentalItemDetail | null> {
  try {
    const res = await apiRequest<{
      success: boolean;
      data: { item: BusinessRentalItemDetail };
    }>(`/rentals/business/items/${encodeURIComponent(itemId)}`, {
      method: 'GET',
      signal: init?.signal,
    });
    if (!res.success) return null;
    return res.data?.item ?? null;
  } catch {
    return null;
  }
}

export async function createBusinessItem(
  body: CreateBusinessRentalItemBody
): Promise<{ success: boolean; data: { id: string } }> {
  return apiRequest('/rentals/business/items', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateBusinessItem(
  itemId: string,
  body: UpdateBusinessRentalItemBody
): Promise<RentalApiSuccess> {
  return apiRequest(`/rentals/business/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteBusinessItem(itemId: string): Promise<RentalApiSuccess> {
  return apiRequest(`/rentals/business/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  });
}

export async function createBusinessListing(
  body: CreateBusinessRentalListingBody
): Promise<{ success: boolean; data: { id: string } }> {
  return apiRequest('/rentals/business/listings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function publishBusinessListing(
  listingId: string
): Promise<{
  success: boolean;
  data: { listing: { id: string; moderation_status: string } };
}> {
  return apiRequest(
    `/rentals/business/listings/${encodeURIComponent(listingId)}/publish`,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

export async function updateBusinessListing(
  listingId: string,
  body: UpdateBusinessRentalListingBody
): Promise<RentalApiSuccess> {
  return apiRequest(
    `/rentals/business/listings/${encodeURIComponent(listingId)}`,
    { method: 'PATCH', body: JSON.stringify(body) }
  );
}

export async function deleteBusinessListing(
  listingId: string
): Promise<RentalApiSuccess> {
  return apiRequest(
    `/rentals/business/listings/${encodeURIComponent(listingId)}`,
    { method: 'DELETE' }
  );
}

export async function getBusinessRequests(
  init?: Init & { status?: string }
): Promise<BusinessRentalRequestRow[]> {
  const search = new URLSearchParams();
  if (init?.status) search.set('status', init.status);
  const q = search.toString();
  const path = q
    ? `/rentals/business/requests?${q}`
    : '/rentals/business/requests';
  const res = await apiRequest<{
    success: boolean;
    data: { requests: BusinessRentalRequestRow[] };
  }>(path, { method: 'GET', signal: init?.signal });
  if (!res.success) return [];
  return res.data?.requests ?? [];
}

export async function respondToRequest(
  requestId: string,
  body: RespondRentalRequestBody
): Promise<RentalApiSuccess> {
  return apiRequest(
    `/rentals/requests/${encodeURIComponent(requestId)}/respond`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function getBusinessSchedule(
  rentalItemId: string,
  init?: Init
): Promise<BusinessRentalScheduleRow[]> {
  if (!rentalItemId) return [];
  const search = new URLSearchParams({ rental_item_id: rentalItemId });
  const res = await apiRequest<{
    success: boolean;
    data: { schedule: BusinessRentalScheduleRow[] };
  }>(`/rentals/business/schedule?${search.toString()}`, {
    method: 'GET',
    signal: init?.signal,
  });
  if (!res.success) return [];
  return res.data?.schedule ?? [];
}

export async function verifyStartPin(
  bookingId: string,
  body: {
    pin?: string;
    overwriteCode?: string;
    useLatestSharedPin?: boolean;
    pinMessageId?: string;
  }
): Promise<RentalApiSuccess> {
  return apiRequest(
    `/rentals/bookings/${encodeURIComponent(bookingId)}/verify-start-pin`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function generateOverwriteCode(
  bookingId: string
): Promise<{ overwriteCode: string }> {
  return apiRequest(
    `/rentals/bookings/${encodeURIComponent(bookingId)}/start-overwrite-code`,
    { method: 'POST' }
  );
}

export async function confirmReturn(
  bookingId: string,
  body?: { actualEndAt?: string }
): Promise<{
  success: boolean;
  overtimeDue?: boolean;
  overtimeAmount?: number;
  paymentPending?: boolean;
  message?: string;
}> {
  return apiRequest(
    `/rentals/bookings/${encodeURIComponent(bookingId)}/confirm-return`,
    { method: 'POST', body: JSON.stringify(body ?? {}) }
  );
}

export async function getBookingMessages(bookingId: string): Promise<{
  success: boolean;
  messages?: import('./agentApi').OrderMessage[];
  error?: string;
}> {
  return apiRequest(`/rentals/bookings/${encodeURIComponent(bookingId)}/messages`, {
    method: 'GET',
  });
}

export async function sendBookingMessage(
  bookingId: string,
  message: string,
  mentionedUserId?: string
): Promise<{
  success: boolean;
  message?: import('./agentApi').OrderMessage;
  error?: string;
}> {
  return apiRequest(`/rentals/bookings/${encodeURIComponent(bookingId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      ...(mentionedUserId ? { mentionedUserId } : {}),
    }),
  });
}

export async function getBookingMentionableParticipants(bookingId: string): Promise<{
  success: boolean;
  participants?: import('./agentApi').MentionableParticipant[];
  error?: string;
}> {
  return apiRequest(
    `/rentals/bookings/${encodeURIComponent(bookingId)}/mentionable-participants`,
    { method: 'GET' }
  );
}

export async function markBookingMessagesRead(
  bookingId: string,
  lastReadMessageId: string
): Promise<{ success: boolean }> {
  return apiRequest(
    `/rentals/bookings/${encodeURIComponent(bookingId)}/messages/read`,
    {
      method: 'POST',
      body: JSON.stringify({ lastReadMessageId }),
    }
  );
}

export async function shareStartPin(bookingId: string): Promise<{
  success: boolean;
  message?: import('./agentApi').OrderMessage;
  error?: string;
}> {
  return apiRequest(
    `/rentals/bookings/${encodeURIComponent(bookingId)}/messages/start-pin`,
    { method: 'POST' }
  );
}

export async function getActiveStartPin(bookingId: string): Promise<{
  messageId: string;
  pin: string;
  pinVersion: number;
  sharedAt: string;
} | null> {
  const res = await apiRequest<{
    success: boolean;
    activePin?: {
      messageId: string;
      pin: string;
      pinVersion: number;
      sharedAt: string;
    } | null;
  }>(
    `/rentals/bookings/${encodeURIComponent(bookingId)}/messages/active-start-pin`,
    { method: 'GET' }
  );
  return res.activePin ?? null;
}

export const rentalsApi = {
  getCategories,
  createCategory,
  getListings,
  getListing,
  getBookedWindows,
  getClientRequests,
  getClientBookings,
  createRequest,
  cancelRequest,
  createBooking,
  getBooking,
  getPaymentStatus,
  retryPayment,
  getStartPin,
  cancelBooking,
  initiatePickupPayment,
  getBusinessItems,
  getBusinessItem,
  createBusinessItem,
  updateBusinessItem,
  deleteBusinessItem,
  createBusinessListing,
  publishBusinessListing,
  updateBusinessListing,
  deleteBusinessListing,
  getBusinessRequests,
  respondToRequest,
  getBusinessSchedule,
  verifyStartPin,
  generateOverwriteCode,
  confirmReturn,
  getBookingMessages,
  sendBookingMessage,
  getBookingMentionableParticipants,
  markBookingMessagesRead,
  shareStartPin,
  getActiveStartPin,
};
