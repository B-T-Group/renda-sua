import { useCallback, useEffect, useState } from 'react';
import { useGraphQLRequest } from './useGraphQLRequest';
import { useApiClient } from './useApiClient';

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
  email?: string;
  operating_hours?: any;
  is_active: boolean;
  is_primary: boolean;
  location_type: 'store' | 'warehouse' | 'office' | 'pickup_point';
  created_at: string;
  updated_at: string;
  /** Overrides application default. Null = use platform default (e.g. 5%). */
  rendasua_item_commission_percentage?: number | null;
}

export interface AddBusinessLocationData {
  name: string;
  address_id?: string;
  phone?: string;
  email?: string;
  operating_hours?: any;
  location_type?: 'store' | 'warehouse' | 'office' | 'pickup_point';
  is_primary?: boolean;
  /** Optional. Leave empty to use platform default (e.g. 5%). */
  rendasua_item_commission_percentage?: number | null;
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
  email?: string;
  operating_hours?: any;
  location_type?: 'store' | 'warehouse' | 'office' | 'pickup_point';
  is_active?: boolean;
  is_primary?: boolean;
  rendasua_item_commission_percentage?: number | null;
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

const DELETE_BUSINESS_LOCATION = `
  mutation DeleteBusinessLocation($id: uuid!) {
    delete_business_locations_by_pk(id: $id) {
      id
    }
  }
`;

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

  const { execute: executeDeleteMutation } = useGraphQLRequest(
    DELETE_BUSINESS_LOCATION
  );

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
      }>('/business-items/locations');
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
  }, [apiClient]);

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
        if (!data.address) {
          throw new Error('Address data is required');
        }
        if (!apiClient) {
          throw new Error('API client not available');
        }
        // Always use backend REST endpoint: country from business primary address, account created, validation (e.g. add-address-first).
        const response = await apiClient.post<{
          success: boolean;
          message?: string;
          data?: { business_location?: BusinessLocation };
        }>('/business-items/locations', {
          name: data.name,
          address: {
            address_line_1: data.address.address_line_1,
            address_line_2: data.address.address_line_2,
            city: data.address.city,
            state: data.address.state,
            postal_code: data.address.postal_code,
            instructions: data.address.instructions,
          },
          phone: data.phone,
          email: data.email,
          location_type: data.location_type ?? 'store',
          is_primary: data.is_primary ?? false,
          rendasua_item_commission_percentage: data.rendasua_item_commission_percentage ?? null,
        });
        if (response.data.success && response.data.data?.business_location) {
          await fetchLocations();
          if (onAddressCreated) {
            onAddressCreated();
          }
          return response.data.data.business_location;
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
    [apiClient, businessId, fetchLocations, onAddressCreated]
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

        // Update location fields via backend PATCH (name, phone, email, commission, etc.)
        const locationFields = {
          ...(locationData.name !== undefined && { name: locationData.name }),
          ...(locationData.phone !== undefined && { phone: locationData.phone }),
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
          ...(locationData.rendasua_item_commission_percentage !== undefined && {
            rendasua_item_commission_percentage:
              locationData.rendasua_item_commission_percentage,
          }),
        };
        if (Object.keys(locationFields).length > 0) {
          await apiClient.patch<{
            success: boolean;
            data?: { business_location?: BusinessLocation };
          }>(`/business-items/locations/${id}`, locationFields);
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
    [fetchLocations, apiClient]
  );

  const deleteLocation = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await executeDeleteMutation({ id });
        if (result.delete_business_locations_by_pk) {
          setLocations((prev) => prev.filter((location) => location.id !== id));
          return result.delete_business_locations_by_pk;
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to delete business location'
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [executeDeleteMutation]
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
