import { useCallback, useEffect, useState } from 'react';
import { useGraphQLClient } from './useGraphQLClient';

export interface ItemCategory {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  item_sub_categories: ItemSubCategory[];
}

export interface ItemSubCategory {
  id: number;
  name: string;
  description: string;
  item_category_id: number;
  created_at: string;
  updated_at: string;
}

interface UseCategoriesResult {
  categories: ItemCategory[];
  loading: boolean;
  error: string | null;
  fetchCategories: () => Promise<void>;
  getSubCategoriesByCategory: (categoryId: number) => ItemSubCategory[];
}

export const useCategories = (): UseCategoriesResult => {
  const { client } = useGraphQLClient();
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!client) return;

    setLoading(true);
    setError(null);

    try {
      const query = `
        query GetItemCategories {
          item_categories(order_by: { name: asc }) {
            id
            name
            description
            created_at
            updated_at
            item_sub_categories(order_by: { name: asc }) {
              id
              name
              description
              item_category_id
              created_at
              updated_at
            }
          }
        }
      `;

      const response = (await client.request(query)) as any;
      const categoriesData = response.item_categories || [];

      setCategories(categoriesData);
    } catch (err) {
      console.error('Error fetching item categories:', err);
      setError('Failed to fetch item categories');
    } finally {
      setLoading(false);
    }
  }, [client]);

  const getSubCategoriesByCategory = useCallback(
    (categoryId: number): ItemSubCategory[] => {
      const category = categories.find((cat) => cat.id === categoryId);
      return category?.item_sub_categories || [];
    },
    [categories]
  );

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    fetchCategories,
    getSubCategoriesByCategory,
  };
};
