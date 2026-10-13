import { Logger } from '@nestjs/common';
import { RepresentativeCommissionCronService } from './representative-commission-cron.service';

describe('RepresentativeCommissionCronService', () => {
  const commissions = {
    closePreviousMonth: jest.fn(),
    releaseDueHolds: jest.fn(),
  };
  const cron = new RepresentativeCommissionCronService(commissions as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs a close or release only when at least one row was processed', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    commissions.closePreviousMonth.mockResolvedValue(0);
    commissions.releaseDueHolds.mockResolvedValue(2);
    await cron.closePreviousMonth();
    await cron.releaseDueHolds();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Portfolio release: 2');
    log.mockRestore();
  });

  it('swallows a close failure so the scheduler keeps running', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    commissions.closePreviousMonth.mockRejectedValue(new Error('db down'));
    await expect(cron.closePreviousMonth()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('db down');
    error.mockRestore();
  });
});
