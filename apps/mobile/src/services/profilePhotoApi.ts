import { api } from './apiClient';

export interface UploadProfilePhotoResponse {
  success: boolean;
  profile_picture_url?: string;
  error?: string;
}

export async function uploadProfilePhoto(uri: string, userId: string): Promise<UploadProfilePhotoResponse> {
  try {
    // Get file extension from URI
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const contentType = contentTypeMap[ext] || 'image/jpeg';

    // Get presigned URL from backend
    const presignRes = await api.post<{
      success: boolean;
      presigned_url?: string;
      final_url?: string;
      error?: string;
    }>('/users/me/profile-picture/presigned-url', {
      contentType,
      fileName: `profile_picture.${ext}`,
    });

    if (!presignRes.success || !presignRes.presigned_url || !presignRes.final_url) {
      return { success: false, error: presignRes.error || 'Failed to get upload URL' };
    }

    // Upload to S3 using presigned URL
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const uploadResponse = await fetch(presignRes.presigned_url, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': contentType,
      },
    });

    if (!uploadResponse.ok) {
      return { success: false, error: 'Failed to upload photo to S3' };
    }

    // Update user profile_picture_url via backend endpoint
    const updateRes = await api.post<{
      success: boolean;
      error?: string;
    }>('/users/me/profile-picture', {
      profile_picture_url: presignRes.final_url,
    });

    if (!updateRes.success) {
      return { success: false, error: updateRes.error || 'Failed to update profile' };
    }

    return { success: true, profile_picture_url: presignRes.final_url };
  } catch (error: any) {
    return { success: false, error: error.message || 'Upload failed' };
  }
}
