/** Application-level generation tier (not a provider model id). */
export type VideoGenerationTier = 'fast' | 'standard';

export type VideoGenerationProviderId = 'google' | 'runway';

export type VideoGenerationJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type VideoGenerationErrorCategory =
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_CONFIGURATION'
  | 'AUTHENTICATION_ERROR'
  | 'UNKNOWN_PROVIDER_ERROR';

export const RETRYABLE_ERROR_CATEGORIES: ReadonlySet<VideoGenerationErrorCategory> =
  new Set([
    'QUOTA_EXCEEDED',
    'RATE_LIMITED',
    'PROVIDER_UNAVAILABLE',
    'TIMEOUT',
  ]);

export interface VideoImageInput {
  imageBase64: string;
  mimeType: string;
}

export interface GenerateVideoRequest {
  prompt: string;
  images: VideoImageInput[];
  durationSeconds: number;
  aspectRatio: string;
  resolution: string;
  tier: VideoGenerationTier;
  metadata?: {
    reelId?: string;
    businessId?: string;
  };
}

export interface GenerateVideoResponse {
  jobId: string;
  provider: VideoGenerationProviderId;
  providerModel: string;
  tier: VideoGenerationTier;
  status: VideoGenerationJobStatus;
  fallbackUsed: boolean;
  originalProvider?: VideoGenerationProviderId;
  failureCategory?: VideoGenerationErrorCategory;
}

export interface VideoJobStatus {
  jobId: string;
  status: VideoGenerationJobStatus;
  videoUri?: string | null;
  errorMessage?: string | null;
  failureCategory?: VideoGenerationErrorCategory;
}

export interface VideoProviderMetadata {
  id: VideoGenerationProviderId;
  modelsByTier: Record<VideoGenerationTier, string>;
}

export interface VideoGenerationRoutingConfig {
  primaryProvider: VideoGenerationProviderId;
  fallbackProviders: VideoGenerationProviderId[];
  enableFallback: boolean;
}
