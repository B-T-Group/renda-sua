import { RunwayVideoGenerationProvider } from './runway-video-generation.provider';
import { VideoGenerationError } from '../video-generation.error';
import type { GenerateVideoRequest } from '../video-generation.types';

const mockSharpToBuffer = jest.fn();
const mockSharp = jest.fn(() => ({
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: mockSharpToBuffer,
}));

jest.mock('sharp', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockSharp(...args),
}));

function makeRequest(
  overrides: Partial<GenerateVideoRequest> = {}
): GenerateVideoRequest {
  return {
    prompt: 'Product ad',
    images: [{ imageBase64: 'abc', mimeType: 'image/jpeg' }],
    durationSeconds: 8,
    aspectRatio: '9:16',
    resolution: '720p',
    tier: 'fast',
    ...overrides,
  };
}

describe('RunwayVideoGenerationProvider', () => {
  const runway = {
    isConfigured: jest.fn().mockReturnValue(true),
    startImageToVideo: jest.fn(),
    getTask: jest.fn(),
    downloadVideo: jest.fn(),
  };
  const config = {
    get: jest.fn(() => ({
      modelFast: 'gen4_turbo',
      modelStandard: 'gen4.5',
    })),
  };
  const provider = new RunwayVideoGenerationProvider(
    runway as never,
    config as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    runway.isConfigured.mockReturnValue(true);
    config.get.mockReturnValue({
      modelFast: 'gen4_turbo',
      modelStandard: 'gen4.5',
    });
    mockSharpToBuffer.mockResolvedValue(Buffer.from('compressed'));
  });

  it('does not support unconfigured, empty, or illegal requests', () => {
    runway.isConfigured.mockReturnValue(false);
    expect(provider.supports(makeRequest())).toBe(false);
    runway.isConfigured.mockReturnValue(true);
    expect(provider.supports(makeRequest({ images: [] }))).toBe(false);
    expect(provider.supports(makeRequest({ durationSeconds: 1 }))).toBe(false);
    expect(provider.supports(makeRequest({ aspectRatio: '4:3' }))).toBe(false);
    expect(provider.supports(makeRequest())).toBe(true);
  });

  it('submits a small image without compressing and returns QUEUED', async () => {
    runway.startImageToVideo.mockResolvedValue('rw-1');

    await expect(provider.submit(makeRequest())).resolves.toEqual({
      jobId: 'rw-1',
      provider: 'runway',
      providerModel: 'gen4_turbo',
      tier: 'fast',
      status: 'QUEUED',
      fallbackUsed: false,
    });
    expect(mockSharp).not.toHaveBeenCalled();
    expect(runway.startImageToVideo).toHaveBeenCalledWith({
      model: 'gen4_turbo',
      prompt: 'Product ad',
      promptImageDataUri: 'data:image/jpeg;base64,abc=',
      ratio: '720:1280',
      duration: 8,
    });
  });

  it('uses the standard Runway model for standard-tier submits', async () => {
    runway.startImageToVideo.mockResolvedValue('rw-std');

    await provider.submit(makeRequest({ tier: 'standard' }));

    expect(runway.startImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gen4.5' })
    );
  });

  it('compresses oversized product photos before starting Runway', async () => {
    runway.startImageToVideo.mockResolvedValue('rw-2');
    const hugeBase64 = 'A'.repeat(4_500_000);

    await provider.submit(
      makeRequest({
        images: [{ imageBase64: hugeBase64, mimeType: 'image/png' }],
      })
    );

    expect(mockSharp).toHaveBeenCalled();
    expect(runway.startImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        promptImageDataUri: 'data:image/jpeg;base64,Y29tcHJlc3NlZA==',
      })
    );
  });

  it('fails when the photo is still too large after compression', async () => {
    mockSharpToBuffer.mockResolvedValue(Buffer.alloc(4_000_000, 1));

    await expect(
      provider.submit(
        makeRequest({
          images: [{ imageBase64: 'A'.repeat(4_500_000), mimeType: 'image/jpeg' }],
        })
      )
    ).rejects.toMatchObject({
      category: 'INVALID_REQUEST',
      provider: 'runway',
    });
    expect(runway.startImageToVideo).not.toHaveBeenCalled();
  });

  it('throws UNSUPPORTED_CONFIGURATION instead of starting Runway', async () => {
    await expect(
      provider.submit(makeRequest({ images: [] }))
    ).rejects.toBeInstanceOf(VideoGenerationError);
    expect(runway.startImageToVideo).not.toHaveBeenCalled();
  });

  it('maps PENDING and RUNNING task statuses to in-flight job states', async () => {
    runway.getTask.mockResolvedValueOnce({ id: 't1', status: 'PENDING' });
    await expect(provider.getJobStatus('t1')).resolves.toEqual({
      jobId: 't1',
      status: 'QUEUED',
    });

    runway.getTask.mockResolvedValueOnce({ id: 't2', status: 'RUNNING' });
    await expect(provider.getJobStatus('t2')).resolves.toEqual({
      jobId: 't2',
      status: 'PROCESSING',
    });
  });

  it('fails SUCCEEDED tasks that return no video instead of completing', async () => {
    runway.getTask.mockResolvedValue({
      id: 't1',
      status: 'SUCCEEDED',
      output: [],
    });

    await expect(provider.getJobStatus('t1')).resolves.toMatchObject({
      status: 'FAILED',
      failureCategory: 'UNKNOWN_PROVIDER_ERROR',
      errorMessage: 'Runway generation returned no video',
    });
  });

  it('maps FAILED and CANCELED tasks to terminal failures', async () => {
    runway.getTask.mockResolvedValueOnce({
      id: 't1',
      status: 'FAILED',
      failure: 'moderation',
    });
    await expect(provider.getJobStatus('t1')).resolves.toMatchObject({
      status: 'FAILED',
      errorMessage: 'moderation',
    });

    runway.getTask.mockResolvedValueOnce({ id: 't2', status: 'CANCELED' });
    await expect(provider.getJobStatus('t2')).resolves.toMatchObject({
      status: 'CANCELLED',
    });
  });
});
