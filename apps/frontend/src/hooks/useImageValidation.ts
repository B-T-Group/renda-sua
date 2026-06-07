import { useCallback, useState } from 'react';
import type {
  ImageValidationMetadata,
  ImageValidationResult,
  ValidateImagesResponse,
  ValidationIssue,
} from '../types/imageValidation';
import { fileMimeType, fileToBase64 } from '../utils/imageFileToBase64';
import { useApiClient } from './useApiClient';

export interface CleanupPreviewInput {
  imageBase64: string;
  mimeType: string;
  issues?: ValidationIssue[];
}

export const useImageValidation = () => {
  const apiClient = useApiClient();
  const [validating, setValidating] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [lastResults, setLastResults] = useState<ImageValidationResult[]>([]);

  const validateFiles = useCallback(
    async (
      files: File[],
      options?: { itemId?: string; rentalItemId?: string }
    ): Promise<ValidateImagesResponse> => {
      setValidating(true);
      try {
        const images = await Promise.all(
          files.map(async (file) => ({
            data: await fileToBase64(file),
            mimeType: fileMimeType(file),
            fileName: file.name,
          }))
        );
        const response = await apiClient.post<{
          success: boolean;
          data: ValidateImagesResponse;
        }>('/images/validate', {
          images,
          itemId: options?.itemId,
          rentalItemId: options?.rentalItemId,
        });
        const data = response.data.data;
        setLastResults(data.results);
        return data;
      } finally {
        setValidating(false);
      }
    },
    [apiClient]
  );

  const metadataFromResults = useCallback(
    (results: ImageValidationResult[]): ImageValidationMetadata[] =>
      results.map((r) => ({
        quality_score: r.score,
        perceptual_hash: r.perceptualHash ?? null,
        validation_errors: r.errors,
        validation_warnings: r.warnings,
        validated_at: new Date().toISOString(),
      })),
    []
  );

  const cleanupPreview = useCallback(
    async (input: CleanupPreviewInput) => {
      setCleanupLoading(true);
      try {
        const response = await apiClient.post<{
          success: boolean;
          data: { b64_json: string };
        }>('/images/cleanup-preview', input);
        return response.data.data.b64_json;
      } finally {
        setCleanupLoading(false);
      }
    },
    [apiClient]
  );

  return {
    validating,
    cleanupLoading,
    lastResults,
    validateFiles,
    metadataFromResults,
    cleanupPreview,
  };
};
