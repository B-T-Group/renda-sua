import { apiRequest } from './apiClient';

/**
 * Resolves a short-lived S3 presigned URL for viewing an upload.
 * Shared by the user documents screen and admin verification flows.
 */
export async function fetchUploadViewUrl(
  uploadId: string
): Promise<string | null> {
  const res = await apiRequest<{
    success?: boolean;
    presigned_url?: string;
    data?: { presigned_url?: string; url?: string };
    error?: string;
  }>(`/uploads/${encodeURIComponent(uploadId)}/view`, { method: 'GET' });
  return (
    res.presigned_url ||
    res.data?.presigned_url ||
    res.data?.url ||
    null
  );
}
