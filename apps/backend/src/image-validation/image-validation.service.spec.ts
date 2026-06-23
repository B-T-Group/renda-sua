import { ImageValidationService } from './image-validation.service';

describe('ImageValidationService flags', () => {
  const loadedImage = {
    buffer: Buffer.alloc(0),
    width: 1000,
    height: 1000,
    format: 'png',
    mimeType: 'image/png',
    clientIndex: 0,
  };

  function buildService(cfg: {
    enableVision?: boolean;
    moderationProvider?: 'none' | 'rekognition' | 'openai';
  }) {
    const configGet = jest.fn((key: string) => {
      if (key === 'imageValidation') {
        return {
          enabled: true,
          enableVision: cfg.enableVision ?? false,
          requireVision: false,
          moderationProvider: cfg.moderationProvider ?? 'none',
          timeoutMs: 5000,
          rekognitionMinConfidence: 80,
        };
      }
      return undefined;
    });

    const noopValidator = { validate: jest.fn().mockResolvedValue([]) };
    const blurValidator = {
      validate: jest.fn().mockResolvedValue([]),
    };

    const visionAnalysis = {
      analyzeBatch: jest.fn().mockResolvedValue([]),
    };
    const rekognitionModeration = {
      analyzeBatch: jest.fn().mockResolvedValue([]),
    };

    const service = new ImageValidationService(
      { get: configGet } as never,
      { loadFromBase64: jest.fn().mockResolvedValue(loadedImage) } as never,
      {
        loadExistingPhashes: jest.fn().mockResolvedValue([]),
        computeHash: jest.fn().mockResolvedValue('hash'),
      } as never,
      visionAnalysis as never,
      rekognitionModeration as never,
      { clearBatch: jest.fn(), validate: jest.fn().mockResolvedValue([]) } as never,
      noopValidator as never,
      blurValidator as never,
      noopValidator as never,
      noopValidator as never,
      noopValidator as never,
      noopValidator as never,
      noopValidator as never,
      { clearBatch: jest.fn(), validate: jest.fn().mockResolvedValue([]) } as never
    );

    return { service, visionAnalysis, rekognitionModeration };
  }

  it('does not call OpenAI vision when enableVision is false', async () => {
    const { service, visionAnalysis } = buildService({ enableVision: false });
    await service.validateImages('biz', {
      images: [{ data: 'abc', mimeType: 'image/png' }],
    });
    expect(visionAnalysis.analyzeBatch).not.toHaveBeenCalled();
  });

  it('calls Rekognition when moderationProvider is rekognition', async () => {
    const { service, rekognitionModeration } = buildService({
      moderationProvider: 'rekognition',
    });
    await service.validateImages('biz', {
      images: [{ data: 'abc', mimeType: 'image/png' }],
    });
    expect(rekognitionModeration.analyzeBatch).toHaveBeenCalled();
  });

  it('calls OpenAI vision when enableVision is true', async () => {
    const { service, visionAnalysis } = buildService({ enableVision: true });
    await service.validateImages('biz', {
      images: [{ data: 'abc', mimeType: 'image/png' }],
    });
    expect(visionAnalysis.analyzeBatch).toHaveBeenCalled();
  });
});
