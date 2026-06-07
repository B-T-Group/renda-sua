export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  code: string;
  message: string;
  severity: ValidationSeverity;
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

export interface ValidatedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  mimeType: string;
  fileName?: string;
  clientIndex: number;
}

export interface ImageModerationResult {
  clientIndex: number;
  safe: boolean;
  categories: string[];
}

export interface ImageValidationFlags {
  enableVision: boolean;
  requireVision: boolean;
  moderationProvider: 'none' | 'rekognition' | 'openai';
}

export interface ValidationContext {
  businessId: string;
  itemId?: string;
  rentalItemId?: string;
  existingPhashes: string[];
  flags: ImageValidationFlags;
  visionResults?: VisionImageAnalysis[];
  moderationResults?: ImageModerationResult[];
}

export interface ValidateImagesResponse {
  passed: boolean;
  score: number;
  results: ImageValidationResult[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface VisionImageAnalysis {
  clientIndex: number;
  safe: boolean;
  moderationCategories: string[];
  productFillPercent: number;
  backgroundClutter: 'low' | 'medium' | 'high';
  promotionalTextLevel: 'none' | 'low' | 'high';
}

export interface ImageValidator {
  readonly name: string;
  validate(
    image: ValidatedImage,
    ctx: ValidationContext
  ): Promise<ValidationIssue[]>;
}

export const VALIDATION_CODES = {
  LOW_RESOLUTION: 'LOW_RESOLUTION',
  IMAGE_BLURRY: 'IMAGE_BLURRY',
  INAPPROPRIATE_CONTENT: 'INAPPROPRIATE_CONTENT',
  POOR_LIGHTING: 'POOR_LIGHTING',
  PRODUCT_TOO_SMALL: 'PRODUCT_TOO_SMALL',
  CLUTTERED_BACKGROUND: 'CLUTTERED_BACKGROUND',
  TOO_MUCH_TEXT: 'TOO_MUCH_TEXT',
  DUPLICATE_IMAGE: 'DUPLICATE_IMAGE',
} as const;
