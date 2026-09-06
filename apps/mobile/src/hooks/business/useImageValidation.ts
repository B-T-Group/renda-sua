import { useCallback, useState } from 'react';
import type { ImagePickerAsset } from 'expo-image-picker';
import type {
  ImageValidationMetadata,
  ImageValidationResult,
  ValidateImagesResponse,
} from '../../types/imageValidation';

export function useImageValidation() {
  const [validating] = useState(false);
  const [lastResults, setLastResults] = useState<ImageValidationResult[]>([]);

  // Pre-upload image validation is intentionally disabled: sending the image
  // data to /images/validate doubled the upload over slow networks. This now
  // resolves instantly without a network call so uploads stay fast. Re-enable
  // by restoring the businessApi.images.validate call below and setting
  // IMAGE_VALIDATION_ENABLED on the backend.
  const validateAssets = useCallback(
    async (
      _assets: ImagePickerAsset[],
      _options?: { itemId?: string }
    ): Promise<ValidateImagesResponse> => {
      const data: ValidateImagesResponse = {
        passed: true,
        score: 100,
        results: [],
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

  return {
    validating,
    lastResults,
    validateAssets,
    metadataFromResults,
  };
}
