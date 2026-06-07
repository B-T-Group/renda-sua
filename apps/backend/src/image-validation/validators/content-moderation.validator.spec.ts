import { ImageModerationService } from '../services/image-moderation.service';
import { ContentModerationValidator } from './content-moderation.validator';

const image = {
  buffer: Buffer.alloc(0),
  width: 1000,
  height: 1000,
  format: 'png',
  mimeType: 'image/png',
  clientIndex: 0,
};

describe('ContentModerationValidator', () => {
  const validator = new ContentModerationValidator(new ImageModerationService());

  it('skips when moderation provider is none', async () => {
    const issues = await validator.validate(image, {
      businessId: 'b',
      existingPhashes: [],
      flags: {
        enableVision: false,
        requireVision: false,
        moderationProvider: 'none',
      },
    });
    expect(issues).toHaveLength(0);
  });

  it('blocks unsafe rekognition result', async () => {
    const issues = await validator.validate(image, {
      businessId: 'b',
      existingPhashes: [],
      flags: {
        enableVision: false,
        requireVision: false,
        moderationProvider: 'rekognition',
      },
      moderationResults: [
        { clientIndex: 0, safe: false, categories: ['Explicit'] },
      ],
    });
    expect(issues[0]?.code).toBe('INAPPROPRIATE_CONTENT');
  });
});
