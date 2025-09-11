import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface Brand {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  items_aggregate?: {
    aggregate: {
      count: number;
    };
  };
}

export interface CreateBrandDto {
  name: string;
  description: string;
}

export interface UpdateBrandDto {
  name?: string;
  description?: string;
}

export interface BrandsResponse {
  success: boolean;
  data: Brand[];
  message: string;
}

export interface BrandResponse {
  success: boolean;
  data: Brand;
  message: string;
}

export const useBrands = (search?: string) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchBrands = async (searchTerm?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (searchTerm) {
        params.search = searchTerm;
      }

      const response = await apiClient.get<BrandsResponse>('/brands', {
        params,
      });

      if (response.data.success) {
        setBrands(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch brands');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to fetch brands'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands(search);
  }, [search]);

  const createBrand = async (
    brandData: CreateBrandDto
  ): Promise<BrandResponse> => {
    const response = await apiClient.post<BrandResponse>('/brands', brandData);
    return response.data;
  };

  const updateBrand = async (
    id: string,
    brandData: UpdateBrandDto
  ): Promise<BrandResponse> => {
    const response = await apiClient.put<BrandResponse>(
      `/brands/${id}`,
      brandData
    );
    return response.data;
  };

  const deleteBrand = async (
    id: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{
      success: boolean;
      message: string;
    }>(`/brands/${id}`);
    return response.data;
  };

  const getBrandById = async (id: string): Promise<BrandResponse> => {
    const response = await apiClient.get<BrandResponse>(`/brands/${id}`);
    return response.data;
  };

  return {
    brands,
    loading,
    error,
    fetchBrands,
    createBrand,
    updateBrand,
    deleteBrand,
    getBrandById,
  };
};
