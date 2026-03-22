import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface RentalItemImage {
  id: string;
  business_id: string;
  rental_item_id: string | null;
  rental_category_id: string | null;
  image_url: string;
  s3_key?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  caption?: string | null;
  alt_text?: string | null;
  tags: string[];
  status: string;
  is_ai_cleaned?: boolean;
  display_order?: number;
  created_at: string;
  rental_item?: { id: string; name: string } | null;
}

export interface FetchRentalItemImagesParams {
  page?: number;
  pageSize?: number;
  rental_category_id?: string | null;
  status?: string;
  search?: string;
}

export interface BulkCreateRentalItemImagesPayload {
  rental_category_id?: string | null;
  images: {
    image_url: string;
    s3_key?: string | null;
    file_size?: number | null;
    width?: number | null;
    height?: number | null;
    format?: string | null;
    caption?: string | null;
    alt_text?: string | null;
  }[];
}

export interface UpdateRentalItemImagePayload {
  rental_category_id?: string | null;
  image_url?: string;
  s3_key?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  caption?: string | null;
  alt_text?: string | null;
  tags?: string[];
  status?: string;
  is_ai_cleaned?: boolean;
  display_order?: number;
}

export const useRentalItemImages = () => {
  const apiClient = useApiClient();
  const [images, setImages] = useState<RentalItemImage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImages = useCallback(
    async (params: FetchRentalItemImagesParams = {}) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: {
            images: RentalItemImage[];
            total: number;
            page: number;
            pageSize: number;
          };
        }>('/rental-item-images', {
          params: {
            page: params.page ?? page,
            pageSize: params.pageSize ?? pageSize,
            rental_category_id: params.rental_category_id ?? undefined,
            status: params.status ?? undefined,
            search: params.search ?? undefined,
          },
        });
        if (response.data.success) {
          const data = response.data.data;
          setImages(data.images);
          setTotal(data.total);
          setPage(data.page);
          setPageSize(data.pageSize);
        } else {
          setError('Failed to load images');
        }
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to load images'
        );
      } finally {
        setLoading(false);
      }
    },
    [apiClient, page, pageSize]
  );

  const bulkCreateImages = useCallback(
    async (payload: BulkCreateRentalItemImagesPayload) => {
      setSubmitting(true);
      setError(null);
      try {
        await apiClient.post<{ success: boolean }>(
          '/rental-item-images/bulk',
          payload
        );
        await fetchImages();
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to create images'
        );
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [apiClient, fetchImages]
  );

  const associateToRentalItem = useCallback(
    async (imageId: string, rentalItemId: string) => {
      setSubmitting(true);
      setError(null);
      try {
        await apiClient.post<{ success: boolean }>(
          `/rental-item-images/${imageId}/associate-rental-item`,
          { rental_item_id: rentalItemId }
        );
        await fetchImages();
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to associate image'
        );
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [apiClient, fetchImages]
  );

  const disassociateFromRentalItem = useCallback(
    async (imageId: string) => {
      setSubmitting(true);
      setError(null);
      try {
        await apiClient.post<{ success: boolean }>(
          `/rental-item-images/${imageId}/disassociate-rental-item`
        );
        await fetchImages();
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to disassociate image'
        );
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [apiClient, fetchImages]
  );

  const updateImage = useCallback(
    async (imageId: string, changes: UpdateRentalItemImagePayload) => {
      setSubmitting(true);
      setError(null);
      try {
        const response = await apiClient.patch<{
          success: boolean;
          data?: { image: RentalItemImage };
        }>(`/rental-item-images/${imageId}`, changes);
        if (response.data.success && response.data.data?.image) {
          const updated = response.data.data.image;
          setImages((prev) =>
            prev.map((img) => (img.id === updated.id ? updated : img))
          );
        } else {
          await fetchImages();
        }
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to update image'
        );
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [apiClient, fetchImages]
  );

  const deleteImage = useCallback(
    async (imageId: string) => {
      setSubmitting(true);
      setError(null);
      try {
        await apiClient.delete<{ success: boolean }>(
          `/rental-item-images/${imageId}`
        );
        await fetchImages();
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to delete image'
        );
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [apiClient, fetchImages]
  );

  const cleanupImage = useCallback(
    async (imageId: string): Promise<{ b64_json: string } | null> => {
      try {
        const response = await apiClient.post<{
          success: boolean;
          data: { b64_json: string };
        }>(`/rental-item-images/${imageId}/cleanup`);
        if (response.data.success && response.data.data?.b64_json) {
          return response.data.data;
        }
        return null;
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to cleanup image'
        );
        return null;
      }
    },
    [apiClient]
  );

  return {
    images,
    total,
    page,
    pageSize,
    loading,
    submitting,
    error,
    fetchImages,
    bulkCreateImages,
    associateToRentalItem,
    disassociateFromRentalItem,
    updateImage,
    deleteImage,
    cleanupImage,
    setPage,
    setPageSize,
  };
};
