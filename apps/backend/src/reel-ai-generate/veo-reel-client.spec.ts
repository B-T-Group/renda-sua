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
    model: 'veo-3.1-lite-generate-preview',
    prompt: 'Product ad',
    imageBase64: 'abc',
    mimeType: 'image/jpeg',
    aspectRatio: '9:16',
    resolution: '720p',
    durationSeconds: 8,
    personGeneration: 'allow_adult' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue({ apiKey: 'test-key' });
  });

  it('maps Google 400 to BadRequestException', async () => {
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
});
