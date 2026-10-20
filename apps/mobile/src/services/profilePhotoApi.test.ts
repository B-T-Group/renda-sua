import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient');
vi.mock('./awsApi');

import { uploadProfilePhoto } from './profilePhotoApi';
import { api } from './apiClient';
import { awsApi, buildS3PublicUrl } from './awsApi';

global.fetch = vi.fn();

describe('profilePhotoApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call presignImageUpload with correct params', async () => {
    vi.mocked(awsApi.presignImageUpload).mockResolvedValue({
      success: false,
    });

    await uploadProfilePhoto('file://photo.jpg');

    expect(awsApi.presignImageUpload).toHaveBeenCalledWith({
      bucketName: 'rendasua-uploads',
      prefix: 'profile-photos',
      contentType: 'image/jpeg',
    });
  });

  it('should return error when presigned URL request fails', async () => {
    vi.mocked(awsApi.presignImageUpload).mockResolvedValue({
      success: false,
    });

    const result = await uploadProfilePhoto('file://photo.jpg');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to get upload URL');
  });

  it('should return error when S3 upload fails', async () => {
    vi.mocked(awsApi.presignImageUpload).mockResolvedValue({
      success: true,
      data: {
        url: 'https://s3.presigned.url',
        key: 'profile-photos/photo123.jpg',
      },
    });

    const mockBlob = new Blob(['fake image data']);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ blob: async () => mockBlob } as any)
      .mockResolvedValueOnce({ ok: false } as any);

    const result = await uploadProfilePhoto('file://photo.jpg');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to upload photo');
  });

  it('should return error when profile update fails', async () => {
    vi.mocked(awsApi.presignImageUpload).mockResolvedValue({
      success: true,
      data: {
        url: 'https://s3.presigned.url',
        key: 'profile-photos/photo123.jpg',
      },
    });

    const mockBlob = new Blob(['fake image data']);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ blob: async () => mockBlob } as any)
      .mockResolvedValueOnce({ ok: true } as any);

    vi.mocked(api.post).mockResolvedValue({
      success: false,
      error: 'Profile update failed',
    });

    const result = await uploadProfilePhoto('file://photo.jpg');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Profile update failed');
  });
});
