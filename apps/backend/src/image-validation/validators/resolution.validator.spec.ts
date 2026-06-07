import { ResolutionValidator } from './resolution.validator';

const baseCtx = {
  businessId: 'biz',
  existingPhashes: [],
  flags: {
    enableVision: false,
    requireVision: false,
    moderationProvider: 'none' as const,
  },
};

describe('ResolutionValidator', () => {
  const validator = new ResolutionValidator();

  it('passes at 800x800', async () => {
    const issues = await validator.validate(
      {
        buffer: Buffer.alloc(0),
        width: 800,
        height: 800,
        format: 'png',
        mimeType: 'image/png',
        clientIndex: 0,
      },
      baseCtx
    );
    expect(issues).toHaveLength(0);
  });

  it('fails below minimum', async () => {
    const issues = await validator.validate(
      {
        buffer: Buffer.alloc(0),
        width: 799,
        height: 800,
        format: 'png',
        mimeType: 'image/png',
        clientIndex: 0,
      },
      baseCtx
    );
    expect(issues[0]?.code).toBe('LOW_RESOLUTION');
  });
});
