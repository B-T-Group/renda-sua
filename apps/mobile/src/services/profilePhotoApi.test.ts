import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient');

import { uploadProfilePhoto } from './profilePhotoApi';
import { api } from './apiClient';

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

    expect(api.post).toHaveBeenCalledWith('/users/me/profile-picture/presigned-url', {
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

  it('should return error when profile picture update fails', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        success: true,
        presigned_url: 'https://s3.presigned.url',
        final_url: 'https://s3.final.url/profile_picture.jpg',
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'Profile update failed',
      });

    const mockBlob = new Blob(['fake image data']);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ blob: async () => mockBlob } as any)
      .mockResolvedValueOnce({ ok: true } as any);

    const result = await uploadProfilePhoto('file://photo.jpg', mockUserId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Profile update failed');
  });

  it('should succeed with complete flow', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        success: true,
        presigned_url: 'https://s3.presigned.url',
        final_url: 'https://s3.final.url/profile_picture.jpg',
      })
      .mockResolvedValueOnce({
        success: true,
      });

    const mockBlob = new Blob(['fake image data']);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ blob: async () => mockBlob } as any)
      .mockResolvedValueOnce({ ok: true } as any);

    const result = await uploadProfilePhoto('file://photo.jpg', mockUserId);

    expect(result.success).toBe(true);
    expect(result.profile_picture_url).toBe('https://s3.final.url/profile_picture.jpg');
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post).toHaveBeenNthCalledWith(2, '/users/me/profile-picture', {
      profile_picture_url: 'https://s3.final.url/profile_picture.jpg',
    });
  });
});
