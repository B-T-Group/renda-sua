import { RunwayVideoGenerationProvider } from './runway-video-generation.provider';
import type { GenerateVideoRequest } from '../video-generation.types';

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
