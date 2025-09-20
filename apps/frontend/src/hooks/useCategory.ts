import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useGraphQLClient } from './useGraphQLClient';

export interface ItemCategory {
  id: number;
  name: string;
  description: string;
  status: 'draft' | 'active';
  created_at: string;
  updated_at: string;
  item_sub_categories: ItemSubCategory[];
}

export interface ItemSubCategory {
  id: number;
  name: string;
  description: string;
  item_category_id: number;
  status: 'draft' | 'active';
  created_at: string;
  updated_at: string;
}

interface UseCategoriesResult {
  categories: ItemCategory[];
  loading: boolean;
  error: string | null;
  fetchCategories: () => Promise<void>;
  getSubCategoriesByCategory: (categoryId: number) => ItemSubCategory[];
  createCategory: (name: string, description?: string) => Promise<ItemCategory>;
  createSubcategory: (
    name: string,
    categoryId: number,
    description?: string
  ) => Promise<ItemSubCategory>;
}

export const useCategories = (): UseCategoriesResult => {
  const { client } = useGraphQLClient();
  const apiClient = useApiClient();
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
            status
            created_at
            updated_at
            item_sub_categories(order_by: { name: asc }) {
              id
              name
              description
              item_category_id
              status
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

  const createCategory = useCallback(
    async (name: string, description: string = ''): Promise<ItemCategory> => {
      try {
        const response = await apiClient.post('/categories', {
          name,
          description,
          status: 'draft',
        });

        if (response.data.success) {
          const newCategory = response.data.data;
          // Add the new category to the local state
          setCategories((prev) => [
            ...prev,
            { ...newCategory, item_sub_categories: [] },
          ]);
          return newCategory;
        } else {
          throw new Error(response.data.message || 'Failed to create category');
        }
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          'Failed to create category';
        throw new Error(errorMessage);
      }
    },
    [apiClient]
  );

  const createSubcategory = useCallback(
    async (
      name: string,
      categoryId: number,
      description: string = ''
    ): Promise<ItemSubCategory> => {
      try {
        const response = await apiClient.post('/subcategories', {
          name,
          description,
          item_category_id: categoryId,
          status: 'draft',
        });

        if (response.data.success) {
          const newSubcategory = response.data.data;
          // Add the new subcategory to the local state
          setCategories((prev) =>
            prev.map((category) =>
              category.id === categoryId
                ? {
                    ...category,
                    item_sub_categories: [
                      ...category.item_sub_categories,
                      newSubcategory,
                    ],
                  }
                : category
            )
          );
          return newSubcategory;
        } else {
          throw new Error(
            response.data.message || 'Failed to create subcategory'
          );
        }
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          'Failed to create subcategory';
        throw new Error(errorMessage);
      }
    },
    [apiClient]
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
    createCategory,
    createSubcategory,
  };
};
