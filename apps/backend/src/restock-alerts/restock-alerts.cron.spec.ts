import { Logger } from '@nestjs/common';
import { RestockSchemaUnavailableError } from './restock-alerts.errors';
import { logRestockCronFailure } from './restock-alerts.cron';

describe('logRestockCronFailure', () => {
  it('warns when the restock schema is missing and does not error', () => {
    const logger = { warn: jest.fn(), error: jest.fn() } as unknown as Logger;
    logRestockCronFailure(
      logger,
      new RestockSchemaUnavailableError({
        message: "field 'restock_alerts' not found in type: 'query_root'",
      })
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('errors for unexpected failures', () => {
    const logger = { warn: jest.fn(), error: jest.fn() } as unknown as Logger;
    logRestockCronFailure(logger, new Error('lock update failed'));
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
