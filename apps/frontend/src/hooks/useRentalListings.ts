import { useAuth0 } from '@auth0/auth0-react';
import { gql } from 'graphql-request';
import { useCallback, useEffect, useState } from 'react';
import useGraphQLClient from './useGraphQLClient';

const LIST_RENTAL_LISTINGS = gql`
  query ListRentalListings {
    rental_location_listings(order_by: { updated_at: desc }) {
      id
      base_price_per_day
      min_rental_days
      max_rental_days
      pickup_instructions
      dropoff_instructions
      rental_item {
        id
        name
        description
        tags
        currency
        operation_mode
        rental_category {
          id
          name
        }
        rental_item_images(order_by: { display_order: asc }) {
          id
          image_url
          alt_text
        }
        business {
          id
          name
        }
      }
      business_location {
        id
        name
        address {
          city
          country
        }
      }
    }
  }
`;

export interface RentalListingRow {
  id: string;
  base_price_per_day: string | number;
  min_rental_days: number;
  max_rental_days: number | null;
  pickup_instructions: string;
  dropoff_instructions: string;
  rental_item: {
    id: string;
    name: string;
    description: string;
    tags: string[];
    currency: string;
    operation_mode: string;
    rental_category: { id: string; name: string };
    rental_item_images: Array<{ id: string; image_url: string; alt_text?: string }>;
    business: { id: string; name: string };
  };
  business_location: {
    id: string;
    name: string;
    address: { city?: string; country?: string };
  };
}

export function useRentalListings() {
  const { isAuthenticated } = useAuth0();
  const { baseClient, client } = useGraphQLClient();
  const [listings, setListings] = useState<RentalListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const gqlClient =
        isAuthenticated && client ? client : baseClient;
      const res = await gqlClient.request<{
        rental_location_listings: RentalListingRow[];
      }>(LIST_RENTAL_LISTINGS);
      setListings(res.rental_location_listings ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load rentals');
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [baseClient, client, isAuthenticated]);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  return { listings, loading, error, refetch: fetchListings };
}
