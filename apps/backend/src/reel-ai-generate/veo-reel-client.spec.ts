import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { VeoReelClient } from './veo-reel-client';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    post: jest.fn(),
    get: jest.fn(),
  };
});

describe('VeoReelClient', () => {
  const config = {
    get: jest.fn(() => ({ apiKey: 'test-key' })),
  };
  const client = new VeoReelClient(config as never);

  const startParams = {
    model: 'veo-3.1-fast-generate-preview',
    prompt: 'Product ad',
    images: [
      { imageBase64: 'abc', mimeType: 'image/jpeg' },
      { imageBase64: 'def', mimeType: 'image/jpeg' },
    ],
    aspectRatio: '9:16',
    resolution: '720p',
    durationSeconds: 8,
    personGeneration: 'allow_adult' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue({ apiKey: 'test-key' });
  });

  it('sends referenceImages for multiple photos', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { name: 'operations/veo-1' },
    });

    await client.startImageToVideo(startParams);

    const body = (axios.post as jest.Mock).mock.calls[0][1];
    expect(body.instances[0].referenceImages).toHaveLength(2);
    expect(body.instances[0].image).toBeUndefined();
  });

  it('falls back to single image when referenceImages is rejected', async () => {
    (axios.post as jest.Mock)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 400,
          data: { error: { message: 'Your use case is currently not supported' } },
        },
      })
      .mockResolvedValueOnce({ data: { name: 'operations/veo-2' } });

    const name = await client.startImageToVideo(startParams);
    expect(name).toBe('operations/veo-2');
    expect(axios.post).toHaveBeenCalledTimes(2);
    const retryBody = (axios.post as jest.Mock).mock.calls[1][1];
    expect(retryBody.instances[0].image.bytesBase64Encoded).toBe('abc');
    expect(retryBody.instances[0].referenceImages).toBeUndefined();
  });

  it('maps Google 400 to BadRequestException after failed fallback', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: { error: { message: 'Invalid personGeneration' } },
      },
    });

    await expect(client.startImageToVideo(startParams)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('maps Google 429 to too many requests', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 429, data: {} },
    });

    try {
      await client.startImageToVideo(startParams);
      fail('expected 429');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('maps Google 5xx to bad gateway', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 503, data: {} },
    });

    try {
      await client.startImageToVideo(startParams);
      fail('expected 502');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    }
  });

  it('omits generateAudio from Gemini predictLongRunning parameters', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { name: 'operations/veo-1' },
    });

    await client.startImageToVideo(startParams);

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('veo-3.1-fast-generate-preview:predictLongRunning'),
      expect.objectContaining({
        parameters: expect.not.objectContaining({
          generateAudio: expect.anything(),
        }),
      }),
      expect.any(Object)
    );
    const body = (axios.post as jest.Mock).mock.calls[0][1];
    expect(body.parameters).toEqual({
      aspectRatio: '9:16',
      resolution: '720p',
      durationSeconds: 8,
      personGeneration: 'allow_adult',
      sampleCount: 1,
    });
  });
});
