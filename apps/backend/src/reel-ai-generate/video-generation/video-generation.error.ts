import {
  RETRYABLE_ERROR_CATEGORIES,
  type VideoGenerationErrorCategory,
  type VideoGenerationProviderId,
} from './video-generation.types';

export class VideoGenerationError extends Error {
  readonly category: VideoGenerationErrorCategory;
  readonly retryable: boolean;
  readonly provider: VideoGenerationProviderId;
  readonly httpStatus?: number;

  constructor(params: {
    message: string;
    category: VideoGenerationErrorCategory;
    provider: VideoGenerationProviderId;
    httpStatus?: number;
    retryable?: boolean;
  }) {
    super(params.message);
    this.name = 'VideoGenerationError';
    this.category = params.category;
    this.provider = params.provider;
    this.httpStatus = params.httpStatus;
    this.retryable =
      params.retryable ?? RETRYABLE_ERROR_CATEGORIES.has(params.category);
  }
}

export function isVideoGenerationError(
  error: unknown
): error is VideoGenerationError {
  return error instanceof VideoGenerationError;
}
