import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient');
vi.mock('./apolloClient', () => ({
  client: {
    mutate: vi.fn(),
  },
}));

import { uploadProfilePhoto } from './profilePhotoApi';
import { api } from './apiClient';
import { client } from './apolloClient';

global.fetch = vi.fn();

describe('profilePhotoApi', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call backend presigned URL endpoint with correct params', async () => {
    vi.mocked(api.post).mockResolvedValue({
      success: false,
    });

    await uploadProfilePhoto('file://photo.jpg', mockUserId);

    expect(api.post).toHaveBeenCalledWith('/users/profile-picture/presigned-url', {
      contentType: 'image/jpeg',
      fileName: 'profile_picture.jpg',
    });
  });

  it('should return error when presigned URL request fails', async () => {
    vi.mocked(api.post).mockResolvedValue({
      success: false,
      error: 'Backend error',
    });

    const result = await uploadProfilePhoto('file://photo.jpg', mockUserId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Backend error');
  });

  it('should return error when S3 upload fails', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      presigned_url: 'https://s3.presigned.url',
      final_url: 'https://s3.final.url/profile_picture.jpg',
    });

    const mockBlob = new Blob(['fake image data']);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ blob: async () => mockBlob } as any)
      .mockResolvedValueOnce({ ok: false } as any);

    const result = await uploadProfilePhoto('file://photo.jpg', mockUserId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to upload photo to S3');
  });

  it('should return error when GraphQL mutation fails', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      presigned_url: 'https://s3.presigned.url',
      final_url: 'https://s3.final.url/profile_picture.jpg',
    });

    vi.mocked(client.mutate).mockResolvedValueOnce({
      data: null,
    } as any);

    const mockBlob = new Blob(['fake image data']);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ blob: async () => mockBlob } as any)
      .mockResolvedValueOnce({ ok: true } as any);

    const result = await uploadProfilePhoto('file://photo.jpg', mockUserId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to update profile');
  });

  it('should succeed with complete flow', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      presigned_url: 'https://s3.presigned.url',
      final_url: 'https://s3.final.url/profile_picture.jpg',
    });

    vi.mocked(client.mutate).mockResolvedValueOnce({
      data: {
        update_users_by_pk: {
          id: mockUserId,
          profile_picture_url: 'https://s3.final.url/profile_picture.jpg',
        },
      },
    } as any);

    const mockBlob = new Blob(['fake image data']);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ blob: async () => mockBlob } as any)
      .mockResolvedValueOnce({ ok: true } as any);

    const result = await uploadProfilePhoto('file://photo.jpg', mockUserId);

    expect(result.success).toBe(true);
    expect(result.profile_picture_url).toBe('https://s3.final.url/profile_picture.jpg');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(client.mutate).toHaveBeenCalledWith({
      mutation: expect.any(Object),
      variables: {
        id: mockUserId,
        profile_picture_url: 'https://s3.final.url/profile_picture.jpg',
      },
    });
  });
});
