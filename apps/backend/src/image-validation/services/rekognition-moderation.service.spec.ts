import { RekognitionModerationService } from './rekognition-moderation.service';

describe('RekognitionModerationService', () => {
  it('returns safe when Rekognition finds no labels', async () => {
    const send = jest.fn().mockResolvedValue({ ModerationLabels: [] });
    const service = new RekognitionModerationService({
      get: jest.fn().mockReturnValue({
        region: 'ca-central-1',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
      }),
    } as never);
    (service as any).client = { send };

    const results = await service.analyzeBatch([
      {
        buffer: Buffer.from('test'),
        width: 100,
        height: 100,
        format: 'png',
        mimeType: 'image/png',
        clientIndex: 0,
      },
    ]);

    expect(results[0]?.safe).toBe(true);
    expect(send).toHaveBeenCalled();
  });
});
