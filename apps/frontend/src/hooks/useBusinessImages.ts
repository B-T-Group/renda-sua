import { useCallback, useState } from 'react';
import { environment } from '../config/environment';
import { useApiClient } from './useApiClient';

export interface BusinessImage {
  id: string;
  business_id: string;
  item_id: string | null;
  item_sub_category_id: number | null;
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
  created_at: string;
  item?: { id: string; name: string; sku: string | null } | null;
}

export interface FetchBusinessImagesParams {
  page?: number;
  pageSize?: number;
  sub_category_id?: number | null;
  status?: string;
  search?: string;
}

export interface BulkCreateBusinessImagesPayload {
  sub_category_id?: number | null;
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

export interface UpdateBusinessImagePayload {
  item_sub_category_id?: number | null;
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
}

export const useBusinessImages = () => {
  const apiClient = useApiClient();
  const [images, setImages] = useState<BusinessImage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImages = useCallback(
    async (params: FetchBusinessImagesParams = {}) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: {
            images: BusinessImage[];
            total: number;
            page: number;
            pageSize: number;
          };
        }>('/business-images', {
          params: {
            page: params.page ?? page,
            pageSize: params.pageSize ?? pageSize,
            sub_category_id: params.sub_category_id ?? undefined,
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
    async (
      payload: BulkCreateBusinessImagesPayload,
      options?: { skipRefetch?: boolean }
    ): Promise<{ id: string }[]> => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await apiClient.post<{
          success: boolean;
          data?: { images: { id: string }[] };
        }>('/business-images/bulk', payload);
        const ids = res.data.data?.images ?? [];
        if (!options?.skipRefetch) {
          await fetchImages();
        }
        return ids;
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

  const associateImageToItem = useCallback(
    async (
      imageId: string,
      itemId: string,
      options?: { skipRefetch?: boolean }
    ) => {
      setSubmitting(true);
      setError(null);
      try {
        await apiClient.post<{ success: boolean }>(
          `/business-images/${imageId}/associate-item`,
          { item_id: itemId }
        );
        if (!options?.skipRefetch) {
          await fetchImages();
        }
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

  const disassociateImageFromItem = useCallback(
    async (imageId: string) => {
      setSubmitting(true);
      setError(null);
      try {
        await apiClient.post<{ success: boolean }>(
          `/business-images/${imageId}/disassociate-item`
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
    async (imageId: string, changes: UpdateBusinessImagePayload) => {
      setSubmitting(true);
      setError(null);
      try {
        const response = await apiClient.patch<{
          success: boolean;
          data?: { image: BusinessImage };
        }>(`/business-images/${imageId}`, changes);

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
          `/business-images/${imageId}`
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

  const removeTag = useCallback(
    async (imageId: string, tag: string) => {
      setSubmitting(true);
      setError(null);
      try {
        await apiClient.post<{ success: boolean }>(
          `/business-images/${imageId}/remove-tag`,
          { tag }
        );
        await fetchImages();
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to remove tag'
        );
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [apiClient, fetchImages]
  );

  const setImageAsMain = useCallback(
    async (imageId: string) => {
      setSubmitting(true);
      setError(null);
      try {
        await apiClient.post<{ success: boolean }>(
          `/business-images/${imageId}/set-as-main`
        );
        await fetchImages();
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to set main image'
        );
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [apiClient, fetchImages]
  );

  const setImageAsGallery = useCallback(
    async (imageId: string) => {
      setSubmitting(true);
      setError(null);
      try {
        await apiClient.post<{ success: boolean }>(
          `/business-images/${imageId}/set-as-gallery`
        );
        await fetchImages();
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

  const cleanupImage = useCallback(
    async (
      imageId: string
    ): Promise<{ b64_json: string } | null> => {
      try {
        const response = await apiClient.post<{
          success: boolean;
          data: { b64_json: string };
        }>(
          `/business-images/${imageId}/cleanup`,
          undefined,
          { timeout: environment.imageCleanupRequestTimeoutMs }
        );
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
    associateImageToItem,
    disassociateImageFromItem,
    updateImage,
    deleteImage,
    removeTag,
    setImageAsMain,
    setImageAsGallery,
    cleanupImage,
    setPage,
    setPageSize,
  };
};
