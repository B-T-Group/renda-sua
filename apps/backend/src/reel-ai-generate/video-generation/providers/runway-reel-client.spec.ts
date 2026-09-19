import axios from 'axios';
import { VideoGenerationError } from '../video-generation.error';
import {
  RunwayReelClient,
  truncateUtf16,
} from './runway-reel-client';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    post: jest.fn(),
    get: jest.fn(),
  };
});

describe('RunwayReelClient', () => {
  const config = {
    get: jest.fn(() => ({
      apiKey: 'runway-key',
      apiVersion: '2024-11-06',
      modelFast: 'gen4_turbo',
      modelStandard: 'gen4.5',
    })),
  };
  const client = new RunwayReelClient(config as never);

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue({
      apiKey: 'runway-key',
      apiVersion: '2024-11-06',
      modelFast: 'gen4_turbo',
      modelStandard: 'gen4.5',
    });
  });

  it('submits image_to_video and returns task id', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { id: 'task-123' },
    });

    const id = await client.startImageToVideo({
      model: 'gen4_turbo',
      prompt: 'Product ad',
      promptImageDataUri: 'data:image/jpeg;base64,abc',
      ratio: '720:1280',
      duration: 8,
    });

    expect(id).toBe('task-123');
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.dev.runwayml.com/v1/image_to_video',
      expect.objectContaining({
        model: 'gen4_turbo',
        ratio: '720:1280',
        duration: 8,
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer runway-key',
          'X-Runway-Version': '2024-11-06',
        }),
      })
    );
  });

  it('normalizes Runway 429 quota or credit errors as QUOTA_EXCEEDED', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 429, data: { error: 'quota / credit exhausted' } },
    });

    await expect(
      client.startImageToVideo({
        model: 'gen4_turbo',
        prompt: 'Product ad',
        promptImageDataUri: 'data:image/jpeg;base64,abc',
        ratio: '720:1280',
        duration: 8,
      })
    ).rejects.toMatchObject({
      category: 'QUOTA_EXCEEDED',
      provider: 'runway',
      retryable: true,
    });
  });

  it('fails when Runway returns no task id', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: {} });

    await expect(
      client.startImageToVideo({
        model: 'gen4_turbo',
        prompt: 'Product ad',
        promptImageDataUri: 'data:image/jpeg;base64,abc',
        ratio: '720:1280',
        duration: 8,
      })
    ).rejects.toMatchObject({
      category: 'UNKNOWN_PROVIDER_ERROR',
      provider: 'runway',
    });
  });

  it('normalizes Runway 429 as RATE_LIMITED', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 429, data: { error: 'Too many requests' } },
    });

    await expect(
      client.startImageToVideo({
        model: 'gen4_turbo',
        prompt: 'Product ad',
        promptImageDataUri: 'data:image/jpeg;base64,abc',
        ratio: '720:1280',
        duration: 8,
      })
    ).rejects.toMatchObject({
      category: 'RATE_LIMITED',
      provider: 'runway',
      retryable: true,
    });
  });

  it('throws AUTHENTICATION_ERROR when API key is missing', async () => {
    config.get.mockReturnValue({
      apiKey: '',
      apiVersion: '2024-11-06',
      modelFast: 'gen4_turbo',
      modelStandard: 'gen4.5',
    });

    await expect(
      client.startImageToVideo({
        model: 'gen4_turbo',
        prompt: 'Product ad',
        promptImageDataUri: 'data:image/jpeg;base64,abc',
        ratio: '720:1280',
        duration: 8,
      })
    ).rejects.toBeInstanceOf(VideoGenerationError);
  });
});

describe('truncateUtf16', () => {
  it('truncates to max UTF-16 code units', () => {
    expect(truncateUtf16('abcdef', 3)).toBe('abc');
    expect(truncateUtf16('😀😀', 2)).toBe('😀');
  });
});
