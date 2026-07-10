import { useAuth0 } from '@auth0/auth0-react';
import { gql } from 'graphql-request';
import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
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

/** Prefer seeded "Other" category for new rental items. */
export function getOtherRentalCategoryId(
  categories: RentalCategoryRow[]
): string | null {
  const bySlug = categories.find((c) => c.slug === 'other');
  if (bySlug) return bySlug.id;
  const byName = categories.find(
    (c) => c.name.trim().toLowerCase() === 'other'
  );
  return byName?.id ?? null;
}

export function useRentalCategories() {
  const { isAuthenticated } = useAuth0();
  const { baseClient, client } = useGraphQLClient();
  const api = useApiClient();
  const [categories, setCategories] = useState<RentalCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const gqlClient = isAuthenticated && client ? client : baseClient;
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

  const createCategory = useCallback(
    async (name: string): Promise<RentalCategoryRow> => {
      setCreating(true);
      try {
        const { data } = await api.post<{
          success: boolean;
          data: { category: RentalCategoryRow };
        }>('/rentals/categories', { name: name.trim() });
        const created = data.data.category;
        setCategories((prev) => {
          if (prev.some((c) => c.id === created.id)) return prev;
          return [...prev, created].sort((a, b) =>
            a.name.localeCompare(b.name)
          );
        });
        return created;
      } finally {
        setCreating(false);
      }
    },
    [api]
  );

  return {
    categories,
    loading,
    creating,
    error,
    refetch: fetchCategories,
    createCategory,
  };
}
