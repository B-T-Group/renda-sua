import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface UploadUrlRequest {
  file_name: string;
  content_type: string;
  file_size: number;
  note?: string;
  document_type_id: number;
}

export interface UploadUrlResponse {
  success: boolean;
  upload_record: {
    id: string;
    user_id: string;
    document_type_id: number;
    note?: string;
    content_type: string;
    key: string;
    file_name: string;
    file_size: number;
    is_approved: boolean;
    created_at: string;
    updated_at: string;
  };
  presigned_url: string;
  expires_at: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export const useDocumentUpload = () => {
  const apiClient = useApiClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null
  );

  const uploadFile = useCallback(
    async (
      file: File,
      documentTypeId: number,
      note?: string
    ): Promise<UploadUrlResponse['upload_record']> => {
      if (!apiClient) {
        throw new Error('API client not available');
      }

      setIsUploading(true);
      setUploadProgress(null);

      try {
        // Step 1: Get upload URL from backend
        const uploadUrlRequest: UploadUrlRequest = {
          file_name: file.name,
          content_type: file.type,
          file_size: file.size,
          note,
          document_type_id: documentTypeId,
        };

        const uploadUrlResponse = await apiClient.post<UploadUrlResponse>(
          '/uploads/get_upload_url',
          uploadUrlRequest
        );

        if (!uploadUrlResponse.data.success) {
          throw new Error('Failed to get upload URL');
        }

        const { presigned_url, upload_record } = uploadUrlResponse.data;

        // Step 2: Upload file to AWS S3 using PUT with presigned URL
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress: UploadProgress = {
                loaded: event.loaded,
                total: event.total,
                percentage: Math.round((event.loaded / event.total) * 100),
              };
              setUploadProgress(progress);
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status: ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'));
          });

          xhr.addEventListener('abort', () => {
            reject(new Error('Upload aborted'));
          });

          // Use PUT method and send file directly
          xhr.open('PUT', presigned_url);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });

        return upload_record;
      } catch (error) {
        console.error('Upload error:', error);
        throw error;
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
      }
    },
    [apiClient]
  );

  const cancelUpload = useCallback(() => {
    // This would need to be implemented with a way to track the current XHR request
    // For now, we'll just reset the state
    setIsUploading(false);
    setUploadProgress(null);
  }, []);

  return {
    uploadFile,
    cancelUpload,
    isUploading,
    uploadProgress,
  };
};
