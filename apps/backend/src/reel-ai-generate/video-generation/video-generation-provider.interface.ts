import type {
  GenerateVideoRequest,
  GenerateVideoResponse,
  VideoGenerationProviderId,
  VideoJobStatus,
  VideoProviderMetadata,
} from './video-generation.types';

export interface VideoGenerationProvider {
  readonly id: VideoGenerationProviderId;

  supports(request: GenerateVideoRequest): boolean;

  submit(request: GenerateVideoRequest): Promise<GenerateVideoResponse>;

  getJobStatus(jobId: string): Promise<VideoJobStatus>;

  retrieveVideo(videoUri: string): Promise<Buffer>;

  getMetadata(): VideoProviderMetadata;
}
