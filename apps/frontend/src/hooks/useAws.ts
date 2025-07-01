import { useState } from 'react';
import { useApiClient } from './useApiClient';

export interface GeneratePresignedUrlRequest {
  bucketName: string;
  key?: string;
  originalFileName?: string;
  contentType?: string;
  expiresIn?: number;
  prefix?: string;
  metadata?: Record<string, string>;
}

export interface GeneratePresignedUrlResponse {
  success: boolean;
  data?: {
    url: string;
    fields: Record<string, string>;
    expiresAt: Date;
    key: string;
  };
  error?: string;
}

export const useAws = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const generateImageUploadUrl = async (
    request: GeneratePresignedUrlRequest
  ): Promise<GeneratePresignedUrlResponse | null> => {
    if (!apiClient) {
      setError('API client not available');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<GeneratePresignedUrlResponse>(
        '/aws/presigned-url/image',
        request
      );

      if (response.data.success) {
        return response.data;
      } else {
        setError(response.data.error || 'Failed to generate image upload URL');
        return null;
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        'Failed to generate image upload URL';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generateDocumentUploadUrl = async (
    request: GeneratePresignedUrlRequest
  ): Promise<GeneratePresignedUrlResponse | null> => {
    if (!apiClient) {
      setError('API client not available');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<GeneratePresignedUrlResponse>(
        '/aws/presigned-url/document',
        request
      );

      if (response.data.success) {
        return response.data;
      } else {
        setError(
          response.data.error || 'Failed to generate document upload URL'
        );
        return null;
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        'Failed to generate document upload URL';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generatePresignedUrl = async (
    request: GeneratePresignedUrlRequest
  ): Promise<GeneratePresignedUrlResponse | null> => {
    if (!apiClient) {
      setError('API client not available');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<GeneratePresignedUrlResponse>(
        '/aws/presigned-url',
        request
      );

      if (response.data.success) {
        return response.data;
      } else {
        setError(response.data.error || 'Failed to generate presigned URL');
        return null;
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        'Failed to generate presigned URL';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generateKey = async (
    originalFileName: string,
    prefix?: string
  ): Promise<{ success: boolean; key: string; error?: string } | null> => {
    if (!apiClient) {
      setError('API client not available');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<{
        success: boolean;
        key: string;
        error?: string;
      }>('/aws/generate-key', {
        params: {
          originalFileName,
          prefix,
        },
      });

      if (response.data.success) {
        return response.data;
      } else {
        setError(response.data.error || 'Failed to generate key');
        return null;
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || 'Failed to generate key';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    loading,
    error,
    generateImageUploadUrl,
    generateDocumentUploadUrl,
    generatePresignedUrl,
    generateKey,
    clearError,
  };
};
