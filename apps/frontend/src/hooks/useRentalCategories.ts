import { useAuth0 } from '@auth0/auth0-react';
import { gql } from 'graphql-request';
import { useCallback, useEffect, useState } from 'react';
import useGraphQLClient from './useGraphQLClient';

const LIST_CATEGORIES = gql`
  query RentalCategories {
    rental_categories(
      where: { is_active: { _eq: true } }
      order_by: { display_order: asc }
    ) {
      id
      name
      slug
    }
  }
`;

export interface RentalCategoryRow {
  id: string;
  name: string;
  slug: string;
}

export function useRentalCategories() {
  const { isAuthenticated } = useAuth0();
  const { baseClient, client } = useGraphQLClient();
  const [categories, setCategories] = useState<RentalCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const gqlClient =
        isAuthenticated && client ? client : baseClient;
      const res = await gqlClient.request<{
        rental_categories: RentalCategoryRow[];
      }>(LIST_CATEGORIES);
      setCategories(res.rental_categories ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [baseClient, client, isAuthenticated]);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  return { categories, loading, error, refetch: fetchCategories };
}
