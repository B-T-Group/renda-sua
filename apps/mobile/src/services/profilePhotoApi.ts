import { gql } from '@apollo/client';
import { api } from './apiClient';
import { client } from './apolloClient';
import { agentApi } from './agentApi';

export interface UploadProfilePhotoResponse {
  success: boolean;
  profile_picture_url?: string;
  error?: string;
}

// Same mutation as apps/frontend/src/contexts/UserProfileContext.tsx:169
const UPDATE_USER_PROFILE_PICTURE = gql`
  mutation UpdateUserProfilePicture($id: uuid!, $profile_picture_url: String) {
    update_users_by_pk(
      pk_columns: { id: $id }
      _set: { profile_picture_url: $profile_picture_url }
    ) {
      id
      profile_picture_url
    }
  }
`;

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

    // Get presigned URL from backend (apps/backend/src/users/users.controller.ts:1037)
    const presignRes = await api.post<{
      success: boolean;
      presigned_url?: string;
      final_url?: string;
      error?: string;
    }>('/users/profile-picture/presigned-url', {
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

    // Update profile_picture_url via GraphQL mutation (same as frontend: apps/frontend/src/contexts/UserProfileContext.tsx:729-746)
    const result = await client.mutate({
      mutation: UPDATE_USER_PROFILE_PICTURE,
      variables: {
        id: userId,
        profile_picture_url: presignRes.final_url,
      },
    });

    if (!result.data?.update_users_by_pk) {
      return { success: false, error: 'Failed to update profile' };
    }

    return { success: true, profile_picture_url: presignRes.final_url };
  } catch (error: any) {
    return { success: false, error: error.message || 'Upload failed' };
  }
}

/**
 * Upload a photo as the signed-in user's profile picture.
 *
 * The Hasura `users.id` (uuid) is resolved from `/users/me`. Do NOT pass
 * `auth.user.id`: that is the Auth0 `sub` (e.g. `auth0|abc`), which makes the
 * `update_users_by_pk(id: uuid!)` mutation fail with an invalid-uuid error —
 * the root cause of the Dedicated apply photo-gate upload error.
 */
export async function uploadMyProfilePhoto(uri: string): Promise<UploadProfilePhotoResponse> {
  let userId: string | undefined;
  try {
    const me = await agentApi.users.getMe();
    userId = me?.success ? me.user?.id : undefined;
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load profile' };
  }
  if (!userId) {
    return { success: false, error: 'Failed to load profile' };
  }
  return uploadProfilePhoto(uri, userId);
}
