/**
 * REST API for business persona (orders, dashboard, catalog, failed deliveries).
 */

import { api } from './apiClient';
import type { DashboardAggregatesResponse } from '../types/business/dashboard';
import type { ActionsNeededDto } from '../types/actions';
import type {
  BusinessOrder,
  BusinessOrderFilters,
  ConfirmOrderPayload,
  OrderActionPayload,
  ReconcileCashPayload,
} from '../types/business/orders';
import type { FailedDelivery, ResolutionRequest } from '../types/business/failedDeliveries';
import type {
  BusinessLocation,
  BusinessLocationsListData,
  CreateBusinessLocationPayload,
  PatchBusinessLocationAddressPayload,
  UpdateBusinessLocationPayload,
} from '../types/business/locations';
import type {
  TransferBusinessOption,
  TransferMode,
  TransferPreview,
  TransferRequest,
} from '../types/business/locationTransfer';
import type {
  BusinessCollectionOption,
  CollectionSuggestion,
  ItemRefinementSuggestion,
} from '../types/business/collections';
import type {
  BusinessCatalogItem,
  BusinessInventoryRow,
  BusinessPageData,
  CreateInventoryPayload,
  CreateItemFromImagePayload,
  ImageItemSuggestions,
  QuickPublishPayload,
  UpdateBusinessItemPayload,
  UpdateInventoryPayload,
} from '../types/business/items';
import type {
  ItemVariant,
  ItemVariantImage,
  ItemVariantInput,
  VariantPriceOverrideInput,
  VariantSuggestion,
} from '../types/business/itemVariant';
import { normalizePageDataItems } from '../utils/businessItemUtils';
import type { OrderActionResponse, OrdersResponse } from '../types/agent';
import type { FoodAvailabilitySlot, FoodSettings } from '../types/food';

function foodSettingsPath(itemId: string, locationId: string): string {
  return `/business-items/items/${encodeURIComponent(itemId)}/locations/${encodeURIComponent(locationId)}`;
}

function assertActionSuccess<T extends { success?: boolean; message?: string; error?: string }>(
  res: T,
  fallback: string
): T {
  if (res.success === false) {
    throw new Error(res.message || res.error || fallback);
  }
  return res;
}

function buildFiltersQuery(filters?: BusinessOrderFilters): string {
  if (!filters || Object.keys(filters).length === 0) return '';
  const clean = Object.entries(filters).reduce(
    (acc, [key, value]) => {
      if (value !== '' && value != null) acc[key] = value;
      return acc;
    },
    {} as Record<string, unknown>
  );
  if (Object.keys(clean).length === 0) return '';
  return `?filters=${encodeURIComponent(JSON.stringify(clean))}`;
}

export const businessApi = {
  dashboard: {
    getAggregates: (): Promise<DashboardAggregatesResponse> =>
      api.get<DashboardAggregatesResponse>('/dashboard/aggregates'),

    getActions: (): Promise<{ success: boolean; data: ActionsNeededDto }> =>
      api.get<{ success: boolean; data: ActionsNeededDto }>('/dashboard/actions'),

    getClientCities: (): Promise<{
      success: boolean;
      data: {
        cities: { name: string; count: number }[];
        totalClientsWithCity: number;
      };
    }> => api.get('/dashboard/client-cities'),
  },

  orders: {
    list: (filters?: BusinessOrderFilters): Promise<OrdersResponse> =>
      api.get<OrdersResponse>(`/orders${buildFiltersQuery(filters)}`),

    getById: (
      orderId: string,
      headerOverrides?: Record<string, string>
    ): Promise<{ success: boolean; order: BusinessOrder }> =>
      api.get<{ success: boolean; order: BusinessOrder }>(
        `/orders/${orderId}`,
        headerOverrides
      ),

    confirm: async (
      body: ConfirmOrderPayload,
      headerOverrides?: Record<string, string>
    ): Promise<OrderActionResponse> => {
      const res = await api.post<OrderActionResponse>(
        '/orders/confirm',
        body,
        undefined,
        headerOverrides
      );
      return assertActionSuccess(res, 'Failed to confirm order');
    },

    getPendingAcceptance: (
      headerOverrides?: Record<string, string>
    ): Promise<{
      active: boolean;
      order: import('../types/incomingOrder').IncomingOrderDetails | null;
    }> => api.get('/orders/acceptance/pending', headerOverrides),

    markBusy: async (
      orderId: string,
      headerOverrides?: Record<string, string>
    ): Promise<{
      success: boolean;
      order: import('../types/incomingOrder').IncomingOrderDetails;
      message?: string;
      snoozeUntil?: string;
    }> => {
      const res = await api.post<{
        success: boolean;
        order: import('../types/incomingOrder').IncomingOrderDetails;
        message?: string;
        snoozeUntil?: string;
      }>('/orders/busy', { orderId }, undefined, headerOverrides);
      return assertActionSuccess(res, 'Failed to mark order busy');
    },

    getReliability: (): Promise<{
      acceptanceRatePct: number;
      autoDeclineRatePct: number;
      merchantCancelRatePct: number;
      averageAcceptanceSeconds: number | null;
      reliability_score: number;
      reliability_tier: string;
      accepting_orders: boolean;
      paused_until: string | null;
      orders_accepted_count: number;
      orders_auto_declined_count: number;
      orders_merchant_cancelled_count: number;
    }> => api.get('/business/reliability'),

    pauseAvailability: async (
      duration: '15m' | '1h' | 'until_tomorrow' | 'indefinite'
    ): Promise<{ success: boolean }> => {
      const res = await api.post<{ success: boolean }>(
        '/business/availability/pause',
        { duration }
      );
      return assertActionSuccess(res, 'Failed to pause store');
    },

    resumeAvailability: async (): Promise<{ success: boolean }> => {
      const res = await api.post<{ success: boolean }>(
        '/business/availability/resume',
        {}
      );
      return assertActionSuccess(res, 'Failed to resume store');
    },

    updateLocationHours: async (
      locationId: string,
      operatingHours: Record<string, unknown>
    ): Promise<{ success: boolean }> => {
      const res = await api.put<{ success: boolean }>(
        `/business/locations/${locationId}/hours`,
        { operatingHours }
      );
      return assertActionSuccess(res, 'Failed to update hours');
    },

    getOrderTiming: (): Promise<{
      acceptance_timeout_seconds: number | null;
      future_acceptance_timeout_seconds: number | null;
      order_activation_lead_minutes: number | null;
      default_estimated_prep_minutes: number | null;
      effective: {
        acceptance_timeout_seconds: number;
        future_acceptance_timeout_seconds: number;
        order_activation_lead_minutes: number;
        default_estimated_prep_minutes: number;
      };
      defaults: {
        acceptance_timeout_seconds: number;
        future_acceptance_timeout_seconds: number;
        order_activation_lead_minutes: number;
        default_estimated_prep_minutes: number;
      };
      activation_lead_choices: number[];
    }> => api.get('/business/order-timing'),

    updateOrderTiming: async (body: {
      acceptance_timeout_seconds?: number | null;
      future_acceptance_timeout_seconds?: number | null;
      order_activation_lead_minutes?: number | null;
      default_estimated_prep_minutes?: number | null;
    }): Promise<{ success: boolean }> => {
      const res = await api.put<{ success: boolean }>(
        '/business/order-timing',
        body
      );
      return assertActionSuccess(res, 'Failed to update order timing');
    },

    completePreparation: async (body: OrderActionPayload): Promise<OrderActionResponse> => {
      const res = await api.post<OrderActionResponse>('/orders/complete_preparation', body);
      return assertActionSuccess(res, 'Failed to complete preparation');
    },

    markShipped: async (
      orderId: string,
      body?: { tracking_number?: string; carrier?: string }
    ): Promise<OrderActionResponse> => {
      const res = await api.post<OrderActionResponse>(
        `/orders/${orderId}/mark-shipped`,
        body ?? {}
      );
      return assertActionSuccess(res, 'Failed to mark order as shipped');
    },

    updateTracking: async (
      orderId: string,
      body: { tracking_number: string; carrier?: string }
    ): Promise<OrderActionResponse> => {
      const res = await api.patch<OrderActionResponse>(
        `/orders/${orderId}/tracking`,
        body
      );
      return assertActionSuccess(res, 'Failed to update tracking');
    },

    complete: async (body: OrderActionPayload): Promise<OrderActionResponse> => {
      const res = await api.post<OrderActionResponse>('/orders/complete', body);
      return assertActionSuccess(res, 'Failed to complete order');
    },

    cancel: async (
      body: OrderActionPayload,
      headerOverrides?: Record<string, string>
    ): Promise<OrderActionResponse> => {
      const res = await api.post<OrderActionResponse>(
        '/orders/cancel',
        body,
        undefined,
        headerOverrides
      );
      return assertActionSuccess(res, 'Failed to cancel order');
    },

    refund: async (body: OrderActionPayload): Promise<OrderActionResponse> => {
      const res = await api.post<OrderActionResponse>('/orders/refund', body);
      return assertActionSuccess(res, 'Failed to refund order');
    },

    generateDeliveryOverwriteCode: async (
      orderId: string
    ): Promise<{ success: boolean; overwriteCode?: string; message?: string }> => {
      const res = await api.post<{ success: boolean; overwriteCode?: string; message?: string }>(
        `/orders/${orderId}/delivery-overwrite-code`,
        {}
      );
      return assertActionSuccess(res, 'Failed to generate overwrite code');
    },

    confirmClientPickup: async (
      orderId: string,
      pin: string,
      options?: { useLatestSharedPin?: boolean; pinMessageId?: string }
    ): Promise<{ success: boolean; message?: string }> => {
      const res = await api.post<{ success: boolean; message?: string }>(
        `/orders/${orderId}/confirm-pickup`,
        {
          pin: pin || undefined,
          useLatestSharedPin: options?.useLatestSharedPin,
          pinMessageId: options?.pinMessageId,
        }
      );
      return assertActionSuccess(res, 'Failed to confirm pickup');
    },

    getActiveDeliveryPin: async (
      orderId: string
    ): Promise<{
      messageId: string;
      pin: string;
      pinVersion: number;
      sharedAt: string;
    } | null> => {
      // apiClient returns the JSON body directly (not axios `{ data }`).
      const res = await api.get<{
        success: boolean;
        activePin: {
          messageId: string;
          pin: string;
          pinVersion: number;
          sharedAt: string;
        } | null;
      }>(`/orders/${orderId}/messages/active-delivery-pin`);
      return res?.activePin ?? null;
    },

    initiatePayAtPickupPayment: async (
      orderId: string,
      body?: { phone_number?: string }
    ): Promise<{ success: boolean; message?: string }> => {
      const res = await api.post<{ success: boolean; message?: string }>(
        `/orders/${orderId}/initiate-pay-at-pickup-payment`,
        body ?? {}
      );
      return assertActionSuccess(res, 'Failed to request pickup payment');
    },

    getDeliverySlots: (params: {
      countryCode: string;
      stateCode: string;
      date: string;
      isFastDelivery?: boolean;
    }): Promise<{
      success: boolean;
      slots: Array<{ id: string; slot_name: string; start_time?: string; end_time?: string }>;
    }> => {
      const q = new URLSearchParams({
        countryCode: params.countryCode,
        stateCode: params.stateCode,
        date: params.date,
        ...(params.isFastDelivery ? { isFastDelivery: 'true' } : {}),
      });
      return api.get(`/delivery-windows/slots?${q.toString()}`);
    },

    getNextAvailableDaySlots: (params: {
      countryCode: string;
      stateCode: string;
      isFastDelivery?: boolean;
    }): Promise<{
      success: boolean;
      date?: string;
      slots: Array<{ id: string; slot_name: string }>;
    }> => {
      const q = new URLSearchParams({
        countryCode: params.countryCode,
        stateCode: params.stateCode,
        ...(params.isFastDelivery ? { isFastDelivery: 'true' } : {}),
      });
      return api.get(`/delivery-windows/next-available-day?${q.toString()}`);
    },

    reconcileCashException: (
      orderId: string,
      body: ReconcileCashPayload
    ): Promise<{ success: boolean; message?: string }> =>
      api.post(`/orders/${orderId}/reconcile-cash-exception`, body),

    markPaidInCashException: (
      orderId: string,
      notes?: string
    ): Promise<{ success: boolean; message?: string }> =>
      api.post(`/orders/${orderId}/mark-paid-in-cash-exception`, { notes }),
  },

  failedDeliveries: {
    list: (status?: 'pending' | 'completed'): Promise<{ success: boolean; failed_deliveries: FailedDelivery[] }> => {
      const q = status ? `?status=${status}` : '';
      return api.get(`/failed-deliveries${q}`);
    },

    get: (
      orderId: string
    ): Promise<{ success: boolean; failed_delivery: FailedDelivery }> =>
      api.get(`/failed-deliveries/${orderId}`),

    resolve: (
      orderId: string,
      body: ResolutionRequest
    ): Promise<{ success: boolean; message?: string }> =>
      api.post(`/failed-deliveries/${orderId}/resolve`, body),
  },

  locations: {
    list: (): Promise<{
      success: boolean;
      data: BusinessLocationsListData;
    }> => api.get('/business-items/locations'),

    delete: (
      locationId: string
    ): Promise<{ success: boolean; message?: string }> =>
      api.delete(`/business-items/locations/${locationId}`),

    create: (
      body: CreateBusinessLocationPayload
    ): Promise<{ success: boolean; data: { business_location: BusinessLocation } }> =>
      api.post('/business-items/locations', body),

    update: (
      locationId: string,
      body: UpdateBusinessLocationPayload
    ): Promise<{ success: boolean; data: { business_location: BusinessLocation } }> =>
      api.patch(`/business-items/locations/${locationId}`, body),

    patchAddress: (
      locationId: string,
      body: PatchBusinessLocationAddressPayload
    ): Promise<{ success: boolean; data?: { address?: unknown; warning?: string } }> =>
      api.patch(`/addresses/business-locations/${locationId}`, body),

    searchBusinesses: (
      q: string,
      businessId?: string
    ): Promise<{
      success: boolean;
      data: { businesses: TransferBusinessOption[] };
    }> => {
      const params = new URLSearchParams({ q });
      if (businessId) params.set('businessId', businessId);
      return api.get(`/business-items/businesses/search?${params}`);
    },

    listDestLocations: (
      targetBusinessId: string,
      businessId?: string
    ): Promise<{
      success: boolean;
      data: { locations: Array<{ id: string; name: string }> };
    }> => {
      const q = businessId
        ? `?businessId=${encodeURIComponent(businessId)}`
        : '';
      return api.get(
        `/business-items/businesses/${targetBusinessId}/locations${q}`
      );
    },

    transferPreview: (
      locationId: string,
      toBusinessId: string,
      businessId?: string,
      options?: { mode?: TransferMode; toLocationId?: string }
    ): Promise<{ success: boolean; data: TransferPreview }> => {
      const params = new URLSearchParams({ toBusinessId });
      if (options?.mode) params.set('mode', options.mode);
      if (options?.toLocationId) params.set('toLocationId', options.toLocationId);
      if (businessId) params.set('businessId', businessId);
      return api.get(
        `/business-items/locations/${locationId}/transfer-preview?${params}`
      );
    },

    createTransferRequest: (
      locationId: string,
      body: {
        toBusinessId: string;
        confirmBusinessName: string;
        mode?: TransferMode;
        toLocationId?: string;
      },
      businessId?: string
    ): Promise<{ success: boolean; data: { request: TransferRequest } }> => {
      const q = businessId
        ? `?businessId=${encodeURIComponent(businessId)}`
        : '';
      return api.post(
        `/business-items/locations/${locationId}/transfer-requests${q}`,
        body
      );
    },

    listPendingTransfers: (
      businessId?: string
    ): Promise<{
      success: boolean;
      data: { incoming: TransferRequest[]; outgoing: TransferRequest[] };
    }> => {
      const q = businessId
        ? `?businessId=${encodeURIComponent(businessId)}`
        : '';
      return api.get(`/business-items/transfer-requests/pending${q}`);
    },

    acceptTransferRequest: (
      id: string
    ): Promise<{ success: boolean; data: { request: TransferRequest } }> =>
      api.post(`/business-items/transfer-requests/${id}/accept`),

    rejectTransferRequest: (
      id: string
    ): Promise<{ success: boolean; data: { request: TransferRequest } }> =>
      api.post(`/business-items/transfer-requests/${id}/reject`),

    cancelTransferRequest: (
      id: string,
      businessId?: string
    ): Promise<{ success: boolean; data: { request: TransferRequest } }> => {
      const q = businessId
        ? `?businessId=${encodeURIComponent(businessId)}`
        : '';
      return api.post(`/business-items/transfer-requests/${id}/cancel${q}`);
    },

    getTransferRequest: (
      id: string,
      businessId?: string
    ): Promise<{ success: boolean; data: { request: TransferRequest } }> => {
      const q = businessId
        ? `?businessId=${encodeURIComponent(businessId)}`
        : '';
      return api.get(`/business-items/transfer-requests/${id}${q}`);
    },
  },

  catalog: {
    getPageData: async (): Promise<{ success: boolean; data: BusinessPageData }> => {
      const res = await api.get<{ success: boolean; data: BusinessPageData }>(
        '/business-items/page-data'
      );
      if (res.success && res.data?.items) {
        res.data.items = normalizePageDataItems(res.data.items);
      }
      return res;
    },

    getItem: async (
      itemId: string
    ): Promise<{ success: boolean; data: { item: BusinessCatalogItem } }> => {
      const res = await api.get<{ success: boolean; data: { item: BusinessCatalogItem } }>(
        `/business-items/items/${itemId}`
      );
      if (res.success && res.data?.item) {
        res.data.item = normalizePageDataItems([res.data.item])[0];
      }
      return res;
    },

    getItems: async (): Promise<{ success: boolean; data: { items: BusinessCatalogItem[] } }> => {
      const res = await api.get<{ success: boolean; data: { items: BusinessCatalogItem[] } }>(
        '/business-items/items'
      );
      if (res.success && res.data?.items) {
        res.data.items = normalizePageDataItems(res.data.items);
      }
      return res;
    },

    updateItem: async (
      itemId: string,
      body: UpdateBusinessItemPayload
    ): Promise<{ success: boolean; data: { item: BusinessCatalogItem } }> => {
      const res = await api.patch<{ success: boolean; data: { item: BusinessCatalogItem } }>(
        `/business-items/items/${itemId}`,
        body
      );
      if (res.success && res.data?.item) {
        res.data.item = normalizePageDataItems([res.data.item])[0];
      }
      return res;
    },

    deleteItem: async (itemId: string): Promise<void> => {
      await api.delete(`/business-items/${itemId}`);
    },

    setFavorite: async (itemId: string, favorited: boolean): Promise<{ success: boolean }> => {
      return api.put(`/business-items/items/${itemId}/favorite`, { favorited });
    },

    deleteInventory: (inventoryId: string): Promise<{ success: boolean }> =>
      api.delete(`/business-items/inventory/${inventoryId}`),

    updateInventory: (
      inventoryId: string,
      body: UpdateInventoryPayload
    ): Promise<{ success: boolean; data: { inventory: BusinessInventoryRow } }> =>
      api.patch(`/business-items/inventory/${inventoryId}`, body),

    updateVariantPriceOverrides: (
      inventoryId: string,
      overrides: VariantPriceOverrideInput[]
    ): Promise<{ success: boolean; data: { overrides: VariantPriceOverrideInput[] } }> =>
      api.put(`/business-items/inventory/${inventoryId}/variant-price-overrides`, {
        overrides,
      }),

    createFromImage: (
      body: CreateItemFromImagePayload
    ): Promise<{ success: boolean; data?: { item: BusinessCatalogItem }; error?: string }> =>
      api.post('/business-items/create-from-image', body),

    createInventory: (
      body: CreateInventoryPayload
    ): Promise<{
      success: boolean;
      data?: { inventory: BusinessInventoryRow };
      error?: string;
    }> => api.post('/business-items/inventory', body),

    publishItem: async (
      itemId: string
    ): Promise<{
      success: boolean;
      data?: { item: { id: string; moderation_status: string } };
      error?: string;
    }> =>
      api.post(`/business-items/items/${encodeURIComponent(itemId)}/publish`, {}),

    quickPublish: (
      itemId: string,
      body: QuickPublishPayload
    ): Promise<{
      success: boolean;
      data?: {
        item: { id: string; moderation_status: string };
        inventory: { id: string };
      };
      error?: string;
    }> =>
      api.post(
        `/business-items/items/${encodeURIComponent(itemId)}/quick-publish`,
        body
      ),

    setItemTags: (
      itemId: string,
      tags: string[]
    ): Promise<{ success: boolean; data?: { tags: string[] }; error?: string }> =>
      api.put(`/business-items/items/${encodeURIComponent(itemId)}/tags`, {
        tags,
      }),

    getFoodSettings: (
      itemId: string,
      locationId: string
    ): Promise<{ success: boolean; data: FoodSettings }> =>
      api.get(`${foodSettingsPath(itemId, locationId)}/food-settings`),

    updateFoodSettings: (
      itemId: string,
      locationId: string,
      slots: FoodAvailabilitySlot[]
    ): Promise<{ success: boolean; data: FoodSettings }> =>
      api.put(`${foodSettingsPath(itemId, locationId)}/food-settings`, { slots }),

    setFoodAvailability: (
      itemId: string,
      locationId: string,
      available: boolean
    ): Promise<{ success: boolean; data: FoodSettings }> =>
      api.post(`${foodSettingsPath(itemId, locationId)}/food-availability`, {
        available,
      }),
  },

  variants: {
    list: (
      itemId: string
    ): Promise<{ success: boolean; data: ItemVariant[] }> =>
      api.get(`/business-items/items/${itemId}/variants`),

    create: (
      itemId: string,
      body: ItemVariantInput
    ): Promise<{ success: boolean; data: ItemVariant }> =>
      api.post(`/business-items/items/${itemId}/variants`, body),

    update: (
      variantId: string,
      body: Partial<ItemVariantInput>
    ): Promise<{ success: boolean; data: ItemVariant }> =>
      api.patch(`/item-variants/${variantId}`, body),

    delete: (variantId: string): Promise<{ success: boolean }> =>
      api.delete(`/item-variants/${variantId}`),

    setDefault: (variantId: string): Promise<{ success: boolean; data: ItemVariant }> =>
      api.post(`/item-variants/${variantId}/set-default`, {}),

    addImage: (
      variantId: string,
      body: Omit<ItemVariantImage, 'id'>
    ): Promise<{ success: boolean; data: ItemVariantImage }> =>
      api.post(`/item-variants/${variantId}/images`, body),

    updateImage: (
      imageId: string,
      body: Partial<Omit<ItemVariantImage, 'id'>>
    ): Promise<{ success: boolean; data: ItemVariantImage }> =>
      api.patch(`/item-variant-images/${imageId}`, body),

    deleteImage: (imageId: string): Promise<{ success: boolean }> =>
      api.delete(`/item-variant-images/${imageId}`),
  },

  images: {
    validate: async (body: {
      images: Array<{ data: string; mimeType: string; fileName?: string }>;
      itemId?: string;
      rentalItemId?: string;
    }) => {
      const res = await api.post<{
        success: boolean;
        data: import('../types/imageValidation').ValidateImagesResponse;
      }>('/images/validate', body);
      if (!res.success || !res.data) {
        throw new Error('Image validation failed');
      }
      return res.data;
    },

    bulkCreate: (body: {
      images: Array<{
        image_url: string;
        s3_key?: string;
        file_size?: number;
        format?: string;
        quality_score?: number | null;
        perceptual_hash?: string | null;
        validation_errors?: unknown[] | null;
        validation_warnings?: unknown[] | null;
        validated_at?: string | null;
      }>;
    }): Promise<{ success: boolean; data?: { images: Array<{ id: string }> } }> =>
      api.post('/business-images/bulk', body),

    associateItem: (imageId: string, itemId: string): Promise<{ success: boolean }> =>
      api.post(`/business-images/${imageId}/associate-item`, { item_id: itemId }),

    setAsMain: (imageId: string): Promise<{ success: boolean }> =>
      api.post(`/business-images/${imageId}/set-as-main`, {}),

    setAsGallery: (imageId: string): Promise<{ success: boolean }> =>
      api.post(`/business-images/${imageId}/set-as-gallery`, {}),

    deleteImage: (imageId: string): Promise<{ success: boolean }> =>
      api.delete(`/business-images/${imageId}`),

    cleanup: (
      imageId: string,
      body?: { kind?: 'rembg' | 'ai' }
    ): Promise<{
      success: boolean;
      data?: { jobId: string; job?: { id: string } };
      ai_tokens_remaining?: number;
      error?: string;
    }> => api.post(`/business-images/${imageId}/cleanup`, body ?? {}),

    setActiveVersion: (
      imageId: string,
      version: 'original' | 'rembg' | 'enhanced'
    ): Promise<{ success: boolean; error?: string }> =>
      api.patch(`/business-images/${encodeURIComponent(imageId)}/active-version`, {
        version,
      }),

    update: (
      imageId: string,
      body: {
        image_url: string;
        s3_key?: string;
        file_size?: number;
        format?: string;
        is_ai_cleaned?: boolean;
      }
    ): Promise<{ success: boolean }> => api.patch(`/business-images/${imageId}`, body),
  },

  aiImageCleanup: {
    request: (
      itemId: string,
      options?: {
        imageIds?: string[];
        selections?: Array<{ imageId: string; kind: 'rembg' | 'ai' }>;
      }
    ): Promise<{
      success: boolean;
      data?: { job: { id: string }; ai_tokens_remaining: number };
      error?: string;
    }> =>
      api.post(`/business-items/items/${encodeURIComponent(itemId)}/ai-image-cleanup`, {
        ...(options?.selections?.length
          ? { selections: options.selections }
          : { imageIds: options?.imageIds }),
      }),

    getOpenForItem: (
      itemId: string
    ): Promise<{
      success: boolean;
      data?: { open: boolean; jobId: string | null; status: string | null };
    }> =>
      api.get(
        `/business-items/items/${encodeURIComponent(itemId)}/ai-image-cleanup/open`
      ),

    requestForVariant: (
      variantId: string,
      options?: {
        imageIds?: string[];
        selections?: Array<{ imageId: string; kind: 'rembg' | 'ai' }>;
      }
    ): Promise<{
      success: boolean;
      data?: { job: { id: string }; ai_tokens_remaining: number };
      error?: string;
    }> =>
      api.post(`/item-variants/${encodeURIComponent(variantId)}/ai-image-cleanup`, {
        ...(options?.selections?.length
          ? { selections: options.selections }
          : { imageIds: options?.imageIds }),
      }),

    pending: (): Promise<{
      success: boolean;
      data?: {
        jobs: Array<{
          id: string;
          item_id: string;
          item_variant_id?: string | null;
          status: string;
          mode?: string;
          item?: { id: string; name: string } | null;
          item_variant?: { id: string; name: string } | null;
          results?: Array<{ id: string; status: string; confidence_tier?: string | null }>;
        }>;
        pendingResultCount: number;
      };
    }> => api.get('/business-items/ai-image-cleanup/pending'),

    activity: (): Promise<{
      success: boolean;
      data?: {
        results: Array<{
          id: string;
          job_id: string;
          original_image_url: string;
          cleaned_image_url: string | null;
          status: string;
          confidence_tier?: string | null;
          changes?: string[] | null;
          applied_at?: string | null;
          reverted_at?: string | null;
        }>;
      };
    }> => api.get('/business-items/ai-image-cleanup/activity'),

    getPreference: (): Promise<{
      success: boolean;
      data?: { auto_enhance_enabled: boolean; ai_tokens: number };
    }> => api.get('/business-items/ai-image-cleanup/preference'),

    setPreference: (
      auto_enhance_enabled: boolean
    ): Promise<{
      success: boolean;
      data?: { auto_enhance_enabled: boolean };
    }> =>
      api.patch('/business-items/ai-image-cleanup/preference', {
        auto_enhance_enabled,
      }),

    getJob: (
      jobId: string
    ): Promise<{
      success: boolean;
      data?: {
        job: {
          id: string;
          item_id: string | null;
          item_variant_id?: string | null;
          status: string;
          mode?: string;
          item?: { id: string; name: string } | null;
          item_variant?: { id: string; name: string } | null;
          results: Array<{
            id: string;
            business_image_id: string | null;
            item_variant_image_id?: string | null;
            rental_item_image_id?: string | null;
            kind?: 'rembg' | 'ai' | null;
            original_image_url: string;
            cleaned_image_url: string | null;
            rembg_image_url?: string | null;
            enhanced_image_url?: string | null;
            status: string;
            error_message: string | null;
            retry_of_result_id?: string | null;
            confidence_score?: number | null;
            confidence_tier?: 'high' | 'medium' | 'low' | null;
            changes?: string[] | null;
            applied_at?: string | null;
            reverted_at?: string | null;
          }>;
        };
      };
    }> =>
      api.get(
        `/business-items/ai-image-cleanup/jobs/${encodeURIComponent(jobId)}`
      ),

    accept: (resultId: string): Promise<{ success: boolean }> =>
      api.post(
        `/business-items/ai-image-cleanup/results/${encodeURIComponent(resultId)}/accept`,
        {}
      ),

    revert: (resultId: string): Promise<{ success: boolean }> =>
      api.post(
        `/business-items/ai-image-cleanup/results/${encodeURIComponent(resultId)}/revert`,
        {}
      ),

    reapply: (resultId: string): Promise<{ success: boolean }> =>
      api.post(
        `/business-items/ai-image-cleanup/results/${encodeURIComponent(resultId)}/reapply`,
        {}
      ),

    reject: (resultId: string): Promise<{ success: boolean }> =>
      api.post(
        `/business-items/ai-image-cleanup/results/${encodeURIComponent(resultId)}/reject`,
        {}
      ),

    retry: (
      resultId: string
    ): Promise<{ success: boolean; data?: { ai_tokens_remaining: number } }> =>
      api.post(
        `/business-items/ai-image-cleanup/results/${encodeURIComponent(resultId)}/retry`,
        {}
      ),

    cancel: (jobId: string): Promise<{ success: boolean }> =>
      api.post(
        `/business-items/ai-image-cleanup/jobs/${encodeURIComponent(jobId)}/cancel`,
        {}
      ),
  },

  collections: {
    list: (itemId: string) =>
      api.get<{ success: boolean; data: { collections: BusinessCollectionOption[] } }>(
        `/business-items/collections?itemId=${encodeURIComponent(itemId)}`
      ),

    suggestions: (itemId: string) =>
      api.get<{ success: boolean; data: { suggestions: CollectionSuggestion[] } }>(
        `/business-items/items/${itemId}/collection-suggestions`
      ),

    setForItem: (itemId: string, collectionIds: string[]) =>
      api.put(`/business-items/items/${itemId}/collections`, { collectionIds }),
  },

  ai: {
    imageItemSuggestions: (
      imageIds: string[],
      options?: { hint?: string; isFoodItem?: boolean }
    ): Promise<{ success: boolean; data?: ImageItemSuggestions; error?: string }> =>
      api.post('/ai/image-item-suggestions', {
        imageIds,
        ...(options?.hint?.trim() ? { hint: options.hint.trim() } : {}),
        ...(options?.isFoodItem === true ? { isFoodItem: true } : {}),
      }),

    itemRefinementSuggestions: (
      itemId: string
    ): Promise<{ success: boolean; data?: ItemRefinementSuggestion; error?: string }> =>
      api.post('/ai/item-refinement-suggestions', { itemId }),

    variantSuggestions: (
      itemId: string,
      imageIds: string[]
    ): Promise<{ success: boolean; data?: VariantSuggestion; error?: string }> =>
      api.post('/ai/variant-suggestions', { itemId, imageIds }),
  },

  accountType: {
    get: () =>
      api.get<{
        success: boolean;
        data: {
          accountType: string;
          commissionPercentage: number;
          lockedUntil: string | null;
          countryCode: string | null;
          plans: Array<{ id: string; commissionPercent: number }>;
        };
      }>('/business-items/business/account-type'),
    change: (accountType: string) =>
      api.patch<{
        success: boolean;
        data: {
          accountType: string;
          commissionPercentage: number;
          lockedUntil: string | null;
          countryCode: string | null;
          plans: Array<{ id: string; commissionPercent: number }>;
        };
      }>('/business-items/business/account-type', { accountType }),
  },

  tokens: {
    packs: () =>
      api.get<{
        success: boolean;
        data: Array<{
          id: 'pack_100' | 'pack_1000' | 'pack_5000';
          tokens: number;
          prices: { CAD: number; XAF: number };
        }>;
      }>('/business-tokens/packs'),

    balance: () =>
      api.get<{ success: boolean; data: { ai_tokens: number } }>(
        '/business-tokens/balance'
      ),

    purchase: (body: {
      packId: 'pack_100' | 'pack_1000' | 'pack_5000';
      phoneNumber?: string;
      stripePaymentMethod?: 'checkout' | 'payment_sheet';
    }) =>
      api.post<{
        success: boolean;
        data: {
          payment_rail: 'stripe' | 'mobile_money';
          paymentUrl?: string;
          payment_intent_client_secret?: string;
          paymentPending?: boolean;
          tokens: number;
          amount: number;
          currency: string;
        };
      }>('/business-tokens/purchase', body),
  },
};
