/**
 * AWS presigned URL helpers for business image uploads.
 */

import { api } from './apiClient';

const S3_BUCKET = 'rendasua-uploads';

export interface PresignImageRequest {
  bucketName: string;
  originalFileName?: string;
  contentType?: string;
  prefix?: string;
}

export interface PresignImageResponse {
  success: boolean;
  data?: { url: string; key: string; expiresAt?: string };
  error?: string;
}

export const awsApi = {
  presignImageUpload: (body: PresignImageRequest): Promise<PresignImageResponse> =>
    api.post<PresignImageResponse>('/aws/presigned-url/image', body),
};

export function buildS3PublicUrl(key: string, bucketName = S3_BUCKET): string {
  return `https://${bucketName}.s3.amazonaws.com/${key}`;
}

export { S3_BUCKET };
