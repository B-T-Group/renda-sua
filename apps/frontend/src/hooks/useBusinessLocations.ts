import { useCallback, useEffect, useState } from 'react';
import { useGraphQLRequest } from './useGraphQLRequest';

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
  };
  phone?: string;
  email?: string;
  operating_hours?: any;
  is_active: boolean;
  is_primary: boolean;
  location_type: 'store' | 'warehouse' | 'office' | 'pickup_point';
  created_at: string;
  updated_at: string;
}

export interface AddBusinessLocationData {
  name: string;
  address_id?: string;
  phone?: string;
  email?: string;
  operating_hours?: any;
  location_type?: 'store' | 'warehouse' | 'office' | 'pickup_point';
  is_primary?: boolean;
  address?: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
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
}

const GET_BUSINESS_LOCATIONS = `
  query GetBusinessLocations($businessId: uuid!) {
    business_locations(
      where: { business_id: { _eq: $businessId } }
    ) {
      id
      name
      business_id
      address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
      }
      phone
      email
      operating_hours
      is_active
      is_primary
      location_type
      created_at
      updated_at
    }
    businesses {
      id
      user_id
      name
    }
  }
`;

const ADD_BUSINESS_LOCATION = `
  mutation AddBusinessLocation($data: business_locations_insert_input!) {
    insert_business_locations_one(object: $data) {
      id
      name
      address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
      }
      phone
      email
      operating_hours
      is_active
      is_primary
      location_type
      created_at
      updated_at
    }
  }
`;

const UPDATE_BUSINESS_LOCATION = `
  mutation UpdateBusinessLocation($id: uuid!, $data: business_locations_set_input!) {
    update_business_locations_by_pk(pk_columns: {id: $id}, _set: $data) {
      id
      name
      address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
      }
      phone
      email
      operating_hours
      is_active
      is_primary
      location_type
      created_at
      updated_at
    }
  }
`;

const DELETE_BUSINESS_LOCATION = `
  mutation DeleteBusinessLocation($id: uuid!) {
    delete_business_locations_by_pk(id: $id) {
      id
    }
  }
`;

const ADD_BUSINESS_LOCATION_NESTED = `
  mutation AddBusinessLocationNested($businessLocation: business_locations_insert_input!) {
    insert_business_locations_one(object: $businessLocation) {
      address_id
      business_id
      created_at
      email
      id
      is_active
      is_primary
      location_type
      name
      operating_hours
      phone
      updated_at
              address {
          address_line_1
          address_line_2
          address_type
          city
          country
          created_at
          id
          is_primary
          latitude
          longitude
          postal_code
          state
          updated_at
        }
    }
  }
`;

export const useBusinessLocations = (businessId?: string, userId?: string) => {
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { execute: executeQuery, refetch: refetchQuery } = useGraphQLRequest(
    GET_BUSINESS_LOCATIONS
  );
  const { execute: executeAddMutation } = useGraphQLRequest(
    ADD_BUSINESS_LOCATION
  );
  const { execute: executeUpdateMutation } = useGraphQLRequest(
    UPDATE_BUSINESS_LOCATION
  );
  const { execute: executeDeleteMutation } = useGraphQLRequest(
    DELETE_BUSINESS_LOCATION
  );

  const { execute: executeAddNestedMutation } = useGraphQLRequest(
    ADD_BUSINESS_LOCATION_NESTED
  );

  const fetchLocations = useCallback(async () => {
    if (!businessId) {
      console.log(
        'useBusinessLocations: No businessId provided, skipping fetch'
      );
      return;
    }

    console.log(
      'useBusinessLocations: Fetching locations for businessId:',
      businessId
    );
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching business locations...');
      const result = await executeQuery({ businessId });
      console.log('Business locations result:', result);
      if (result?.business_locations) {
        console.log('Found business locations:', result.business_locations);
        setLocations(result.business_locations);
      } else {
        console.log('No business locations found in result');
        setLocations([]);
      }
    } catch (err) {
      console.error('Error fetching business locations:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch business locations'
      );
    } finally {
      setLoading(false);
    }
  }, [executeQuery, businessId]);

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
        // Compose the nested insert input
        const businessLocationInput = {
          name: data.name,
          phone: data.phone,
          email: data.email,
          operating_hours: data.operating_hours,
          location_type: data.location_type,
          is_primary: data.is_primary,
          business_id: businessId,
          is_active: true,
          address: {
            data: {
              ...data.address,
            },
          },
        };
        const result = await executeAddNestedMutation({
          businessLocation: businessLocationInput,
        });
        if (result.data?.insert_business_locations_one) {
          // Optionally, you can refetch or update state here
          await fetchLocations();
          return result.data.insert_business_locations_one;
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to add business location'
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [executeAddNestedMutation, businessId, fetchLocations]
  );

  const updateLocation = useCallback(
    async (id: string, data: UpdateBusinessLocationData) => {
      setLoading(true);
      setError(null);
      try {
        const result = await executeUpdateMutation({ id, data });
        if (result.data?.update_business_locations_by_pk) {
          setLocations((prev) =>
            prev.map((location) =>
              location.id === id
                ? result.data.update_business_locations_by_pk
                : location
            )
          );
          return result.data.update_business_locations_by_pk;
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to update business location'
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [executeUpdateMutation]
  );

  const deleteLocation = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await executeDeleteMutation({ id });
        if (result.data?.delete_business_locations_by_pk) {
          setLocations((prev) => prev.filter((location) => location.id !== id));
          return result.data.delete_business_locations_by_pk;
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
    loading,
    error,
    fetchLocations,
    addLocation,
    updateLocation,
    deleteLocation,
  };
};
