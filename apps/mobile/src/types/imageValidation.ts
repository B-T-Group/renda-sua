export interface ValidationIssue {
  code: string;
  message: string;
  severity?: 'error' | 'warning';
}

export interface ImageValidationResult {
  passed: boolean;
  score: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  fileName?: string;
  clientIndex?: number;
  perceptualHash?: string;
}

export interface ValidateImagesResponse {
  passed: boolean;
  score: number;
  results: ImageValidationResult[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ImageValidationMetadata {
  quality_score: number;
  perceptual_hash: string | null;
  validation_errors: ValidationIssue[];
  validation_warnings: ValidationIssue[];
  validated_at: string;
}
