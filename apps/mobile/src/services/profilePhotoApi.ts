import { api } from './apiClient';
import { awsApi, buildS3PublicUrl } from './awsApi';

export interface UploadProfilePhotoResponse {
  success: boolean;
  profile_picture_url?: string;
  error?: string;
}

export async function uploadProfilePhoto(uri: string): Promise<UploadProfilePhotoResponse> {
  try {
    // Get presigned URL for profile photo upload
    const presignRes = await awsApi.presignImageUpload({
      bucketName: 'rendasua-uploads',
      prefix: 'profile-photos',
      contentType: 'image/jpeg',
    });

    if (!presignRes.success || !presignRes.data?.url || !presignRes.data?.key) {
      return { success: false, error: 'Failed to get upload URL' };
    }

    // Upload to S3
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const uploadResponse = await fetch(presignRes.data.url, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': 'image/jpeg',
      },
    });

    if (!uploadResponse.ok) {
      return { success: false, error: 'Failed to upload photo' };
    }

    const photoUrl = buildS3PublicUrl(presignRes.data.key);

    // Update user profile with new photo URL
    const updateRes = await api.post<{ success: boolean; error?: string }>(
      '/users/me/profile-photo',
      { profile_picture_url: photoUrl }
    );

    if (!updateRes.success) {
      return { success: false, error: updateRes.error || 'Failed to update profile' };
    }

    return { success: true, profile_picture_url: photoUrl };
  } catch (error: any) {
    return { success: false, error: error.message || 'Upload failed' };
  }
}
