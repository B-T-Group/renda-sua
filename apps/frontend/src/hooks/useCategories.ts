import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface Category {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  item_sub_categories_aggregate?: {
    aggregate: {
      count: number;
    };
  };
}

export interface Subcategory {
  id: number;
  name: string;
  description: string;
  item_category_id: number;
  created_at: string;
  updated_at: string;
  item_category?: {
    id: number;
    name: string;
  };
  items_aggregate?: {
    aggregate: {
      count: number;
    };
  };
}

export interface CreateCategoryDto {
  name: string;
  description: string;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
}

export interface CreateSubcategoryDto {
  name: string;
  description: string;
  item_category_id: number;
}

export interface UpdateSubcategoryDto {
  name?: string;
  description?: string;
  item_category_id?: number;
}

export interface CategoriesResponse {
  success: boolean;
  data: Category[];
  message: string;
}

export interface SubcategoriesResponse {
  success: boolean;
  data: Subcategory[];
  message: string;
}

export interface CategoryResponse {
  success: boolean;
  data: Category;
  message: string;
}

export interface SubcategoryResponse {
  success: boolean;
  data: Subcategory;
  message: string;
}

export const useCategories = (search?: string) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchCategories = async (searchTerm?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (searchTerm) {
        params.search = searchTerm;
      }

      const response = await apiClient.get<CategoriesResponse>('/categories', {
        params,
      });

      if (response.data.success) {
        setCategories(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch categories');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to fetch categories'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories(search);
  }, [search]);

  const createCategory = async (
    categoryData: CreateCategoryDto
  ): Promise<CategoryResponse> => {
    const response = await apiClient.post<CategoryResponse>(
      '/categories',
      categoryData
    );
    return response.data;
  };

  const updateCategory = async (
    id: string,
    categoryData: UpdateCategoryDto
  ): Promise<CategoryResponse> => {
    const response = await apiClient.put<CategoryResponse>(
      `/categories/${id}`,
      categoryData
    );
    return response.data;
  };

  const deleteCategory = async (
    id: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{
      success: boolean;
      message: string;
    }>(`/categories/${id}`);
    return response.data;
  };

  const getCategoryById = async (id: string): Promise<CategoryResponse> => {
    const response = await apiClient.get<CategoryResponse>(`/categories/${id}`);
    return response.data;
  };

  return {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
  };
};

export const useSubcategories = (search?: string, category_id?: string) => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchSubcategories = async (
    searchTerm?: string,
    categoryId?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (searchTerm) {
        params.search = searchTerm;
      }
      if (categoryId) {
        params.category_id = categoryId;
      }

      const response = await apiClient.get<SubcategoriesResponse>(
        '/subcategories',
        { params }
      );

      if (response.data.success) {
        setSubcategories(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch subcategories');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to fetch subcategories'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubcategories(search, category_id);
  }, [search, category_id]);

  const createSubcategory = async (
    subcategoryData: CreateSubcategoryDto
  ): Promise<SubcategoryResponse> => {
    const response = await apiClient.post<SubcategoryResponse>(
      '/subcategories',
      subcategoryData
    );
    return response.data;
  };

  const updateSubcategory = async (
    id: string,
    subcategoryData: UpdateSubcategoryDto
  ): Promise<SubcategoryResponse> => {
    const response = await apiClient.put<SubcategoryResponse>(
      `/subcategories/${id}`,
      subcategoryData
    );
    return response.data;
  };

  const deleteSubcategory = async (
    id: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{
      success: boolean;
      message: string;
    }>(`/subcategories/${id}`);
    return response.data;
  };

  const getSubcategoryById = async (
    id: string
  ): Promise<SubcategoryResponse> => {
    const response = await apiClient.get<SubcategoryResponse>(
      `/subcategories/${id}`
    );
    return response.data;
  };

  return {
    subcategories,
    loading,
    error,
    fetchSubcategories,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    getSubcategoryById,
  };
};
