import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { businessItemsApiParams } from '../utils/businessItemsApiParams';
import { OperatingHours } from '../utils/operatingHours';

function normalizeOrderAlertPhone(
  value: string | null | undefined
): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const digits = raw.replace(/^\+/, '').replace(/\D/g, '');
  return digits ? `+${digits}` : null;
}

export interface BusinessLocation {
  id: string;
  name: string;
  address: {
    id: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    instructions?: string;
  };
  phone?: string;
  order_alert_phone?: string | null;
  mobile_payment_phone_id?: string | null;
  mobile_payment_phone?: {
    id: string;
    phone_e164: string;
    is_verified: boolean;
    verified_at?: string | null;
  } | null;
  email?: string;
  operating_hours?: OperatingHours | null;
  is_active: boolean;
  is_primary: boolean;
  location_type: 'store' | 'warehouse' | 'office' | 'pickup_point';
  created_at: string;
  updated_at: string;
  /**
   * @deprecated Commission is now derived from Business.accountType.
   * TODO: remove this field after the business_locations.rendasua_item_commission_percentage column is dropped.
   */
  rendasua_item_commission_percentage?: number | null;
  /** When true, order payouts are auto-sent to this location's phone when set. */
  auto_withdraw_commissions?: boolean;
  /** Public URL for location logo (S3 or external). */
  logo_url?: string | null;
}

export interface AddBusinessLocationData {
  name: string;
  address_id?: string;
  phone?: string;
  order_alert_phone?: string | null;
  mobile_payment_phone_id?: string | null;
  email?: string;
  operating_hours?: OperatingHours;
  location_type?: 'store' | 'warehouse' | 'office' | 'pickup_point';
  is_primary?: boolean;
  /** Defaults to true when omitted (server default). */
  auto_withdraw_commissions?: boolean;
  logo_url?: string | null;
  address?: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    instructions?: string;
  };
}

export interface UpdateBusinessLocationData {
  name?: string;
  address_id?: string;
  phone?: string;
  order_alert_phone?: string | null;
  mobile_payment_phone_id?: string | null;
  email?: string;
  operating_hours?: OperatingHours;
  location_type?: 'store' | 'warehouse' | 'office' | 'pickup_point';
  is_active?: boolean;
  is_primary?: boolean;
  auto_withdraw_commissions?: boolean;
  logo_url?: string | null;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    instructions?: string;
  };
}

export const useBusinessLocations = (
  businessId?: string,
  userId?: string,
  onAddressCreated?: () => void
) => {
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [primaryAddressCountry, setPrimaryAddressCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!apiClient) {
        throw new Error('API client not available');
      }
      const response = await apiClient.get<{
        success: boolean;
        message?: string;
        data?: {
          business_locations?: BusinessLocation[];
          primary_address_country?: string | null;
        };
      }>('/business-items/locations', businessItemsApiParams(businessId));
      if (response.data.success && response.data.data) {
        setLocations(response.data.data.business_locations ?? []);
        setPrimaryAddressCountry(
          response.data.data.primary_address_country ?? null
        );
      } else {
        setLocations([]);
        setPrimaryAddressCountry(null);
        if (response.data.message) {
          setError(response.data.message);
        }
      }
    } catch (err) {
      console.error(
        'useBusinessLocations: Error fetching business locations:',
        err
      );
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch business locations'
      );
    } finally {
      setLoading(false);
    }
  }, [apiClient, businessId]);

  const putLocationHours = useCallback(
    async (locationId: string, hours: OperatingHours) => {
      if (!apiClient) {
        throw new Error('API client not available');
      }
      await apiClient.put(`/business/locations/${locationId}/hours`, {
        operatingHours: hours,
      });
    },
    [apiClient]
  );

  const addLocation = useCallback(
    async (data: AddBusinessLocationData) => {
      setLoading(true);
      setError(null);
      try {
        if (!businessId) {
          throw new Error(
            'Business ID is required to create a business location'
          );
        }
        if (!data.address && !data.address_id) {
          throw new Error('Address data or address_id is required');
        }
        if (!apiClient) {
          throw new Error('API client not available');
        }
        const basePayload = {
          name: data.name,
          ...(data.mobile_payment_phone_id !== undefined && {
            mobile_payment_phone_id: data.mobile_payment_phone_id,
          }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.order_alert_phone !== undefined && {
            order_alert_phone: normalizeOrderAlertPhone(data.order_alert_phone),
          }),
          email: data.email,
          location_type: data.location_type ?? 'store',
          is_primary: data.is_primary ?? false,
          ...(data.auto_withdraw_commissions !== undefined && {
            auto_withdraw_commissions: data.auto_withdraw_commissions,
          }),
          ...(data.logo_url !== undefined && {
            logo_url: data.logo_url?.trim() ? data.logo_url.trim() : null,
          }),
        };
        const body =
          data.address_id && !data.address
            ? { ...basePayload, address_id: data.address_id }
            : {
                ...basePayload,
                address: {
                  address_line_1: data.address!.address_line_1,
                  address_line_2: data.address!.address_line_2,
                  city: data.address!.city,
                  state: data.address!.state,
                  postal_code: data.address!.postal_code,
                  instructions: data.address!.instructions,
                },
              };
        const response = await apiClient.post<{
          success: boolean;
          message?: string;
          data?: { business_location?: BusinessLocation };
        }>('/business-items/locations', body, businessItemsApiParams(businessId));
        if (response.data.success && response.data.data?.business_location) {
          const created = response.data.data.business_location;
          if (data.operating_hours) {
            await putLocationHours(created.id, data.operating_hours);
          }
          await fetchLocations();
          if (onAddressCreated) {
            onAddressCreated();
          }
          return created;
        }
        throw new Error(response.data.message ?? 'Failed to create location');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to add business location'
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, businessId, fetchLocations, onAddressCreated, putLocationHours]

  );

  const updateLocation = useCallback(
    async (
      id: string,
      data: UpdateBusinessLocationData & { address?: any }
    ) => {
      setLoading(true);
      setError(null);
      setWarning(null);
      try {
        if (!apiClient) {
          throw new Error('API client not available');
        }

        // Extract address data if present
        const { address, ...locationData } = data;

        // Update location fields via backend PATCH (name, phone, email, etc.)
        const locationFields = {
          ...(locationData.name !== undefined && { name: locationData.name }),
          ...(locationData.phone !== undefined && { phone: locationData.phone }),
          ...(locationData.mobile_payment_phone_id !== undefined && {
            mobile_payment_phone_id: locationData.mobile_payment_phone_id,
          }),
          ...(locationData.order_alert_phone !== undefined && {
            order_alert_phone: normalizeOrderAlertPhone(
              locationData.order_alert_phone
            ),
          }),
          ...(locationData.email !== undefined && { email: locationData.email }),
          ...(locationData.location_type !== undefined && {
            location_type: locationData.location_type,
          }),
          ...(locationData.is_active !== undefined && {
            is_active: locationData.is_active,
          }),
          ...(locationData.is_primary !== undefined && {
            is_primary: locationData.is_primary,
          }),
          ...(locationData.auto_withdraw_commissions !== undefined && {
            auto_withdraw_commissions: locationData.auto_withdraw_commissions,
          }),
          ...(locationData.logo_url !== undefined && {
            logo_url: locationData.logo_url?.trim()
              ? locationData.logo_url.trim()
              : null,
          }),
        };
        if (Object.keys(locationFields).length > 0) {
          await apiClient.patch<{
            success: boolean;
            data?: { business_location?: BusinessLocation };
          }>(
            `/business-items/locations/${id}`,
            locationFields,
            businessItemsApiParams(businessId)
          );
        }

        if (locationData.operating_hours) {
          await putLocationHours(id, locationData.operating_hours);
        }

        // If address data is provided, update the address using REST API
        if (address) {
          // Prepare address update data
          const addressUpdateData: any = {};
          if (address.address_line_1 !== undefined) {
            addressUpdateData.address_line_1 = address.address_line_1;
          }
          if (address.address_line_2 !== undefined) {
            addressUpdateData.address_line_2 = address.address_line_2;
          }
          if (address.city !== undefined) {
            addressUpdateData.city = address.city;
          }
          if (address.state !== undefined) {
            addressUpdateData.state = address.state;
          }
          if (address.postal_code !== undefined) {
            addressUpdateData.postal_code = address.postal_code;
          }
          if (address.country !== undefined) {
            addressUpdateData.country = address.country;
          }
          if (address.address_type !== undefined) {
            addressUpdateData.address_type = address.address_type;
          }
          if (address.latitude !== undefined) {
            addressUpdateData.latitude = address.latitude;
          }
          if (address.longitude !== undefined) {
            addressUpdateData.longitude = address.longitude;
          }
          if (address.instructions !== undefined) {
            addressUpdateData.instructions = address.instructions;
          }

          // Use PATCH endpoint for business location address
          const addressResponse = await apiClient.patch<{
            success: boolean;
            message: string;
            data: {
              address: any;
              warning?: string;
            };
          }>(`/addresses/business-locations/${id}`, addressUpdateData);

          if (addressResponse.data.success) {
            // Set warning if present
            if (addressResponse.data.data.warning) {
              setWarning(addressResponse.data.data.warning);
            }
          }
        }

        // Refetch locations to get updated data
        await fetchLocations();

        return { id };
      } catch (err: any) {
        console.error('useBusinessLocations: Error updating location:', err);
        
        // Handle axios error response
        if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to update business location');
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchLocations, apiClient, putLocationHours]
  );

  const deleteLocation = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        if (!apiClient) {
          throw new Error('API client not available');
        }
        await apiClient.delete(
          `/business-items/locations/${id}`,
          businessItemsApiParams(businessId)
        );
        setLocations((prev) => prev.filter((location) => location.id !== id));
        return { id };
      } catch (err: any) {
        const message =
          err?.response?.data?.error ||
          (err instanceof Error
            ? err.message
            : 'Failed to delete business location');
        setError(message);
        const code = err?.response?.data?.code as string | undefined;
        const wrapped = new Error(message) as Error & { code?: string };
        wrapped.code = code;
        throw wrapped;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, businessId]
  );

  useEffect(() => {
    console.log(
      'useBusinessLocations: useEffect triggered, businessId:',
      businessId
    );
    if (businessId) {
      fetchLocations();
    }
  }, [businessId, fetchLocations]);

  return {
    locations,
    primaryAddressCountry,
    loading,
    error,
    warning,
    fetchLocations,
    addLocation,
    updateLocation,
    deleteLocation,
  };
};
