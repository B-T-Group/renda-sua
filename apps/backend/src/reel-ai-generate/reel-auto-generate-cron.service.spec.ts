import { ReelAutoGenerateCronService } from './reel-auto-generate-cron.service';

describe('ReelAutoGenerateCronService', () => {
  it('delegates to tryCreateDailySponsoredReel and swallows errors', async () => {
    const autoGenerate = {
      tryCreateDailySponsoredReel: jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(null),
    };
    const cron = new ReelAutoGenerateCronService(autoGenerate as never);

    await expect(cron.run()).resolves.toBeUndefined();
    await expect(cron.run()).resolves.toBeUndefined();
    expect(autoGenerate.tryCreateDailySponsoredReel).toHaveBeenCalledTimes(2);
  });
});
