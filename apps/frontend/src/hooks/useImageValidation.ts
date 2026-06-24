import { useCallback, useState } from 'react';
import type {
  ImageValidationMetadata,
  ImageValidationResult,
  ValidateImagesResponse,
  ValidationIssue,
} from '../types/imageValidation';
import { useApiClient } from './useApiClient';

export interface CleanupPreviewInput {
  imageBase64: string;
  mimeType: string;
  issues?: ValidationIssue[];
}

const passedResultForFile = (
  file: File,
  clientIndex: number
): ImageValidationResult => ({
  passed: true,
  score: 100,
  errors: [],
  warnings: [],
  fileName: file.name,
  clientIndex,
});

export const useImageValidation = () => {
  const apiClient = useApiClient();
  const [validating] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [lastResults, setLastResults] = useState<ImageValidationResult[]>([]);

  // Pre-upload image validation is intentionally disabled: sending the image
  // data to /images/validate doubled the upload over slow networks. This now
  // resolves instantly without a network call so uploads stay fast. Re-enable
  // by restoring the POST below and setting IMAGE_VALIDATION_ENABLED on the
  // backend.
  const validateFiles = useCallback(
    async (
      files: File[],
      _options?: { itemId?: string; rentalItemId?: string }
    ): Promise<ValidateImagesResponse> => {
      const results = files.map(passedResultForFile);
      const data: ValidateImagesResponse = {
        passed: true,
        score: 100,
        results,
        errors: [],
        warnings: [],
      };
      setLastResults(data.results);
      return data;
    },
    []
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
