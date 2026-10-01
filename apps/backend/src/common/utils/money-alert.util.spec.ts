import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { reportMoneyAnomaly } from './money-alert.util';

describe('reportMoneyAnomaly', () => {
  it('logs at error level with the marker and raises a Sentry message', () => {
    const logger = { error: jest.fn() } as unknown as Logger;
    const scope = { setTag: jest.fn(), setLevel: jest.fn(), setExtras: jest.fn() };
    jest
      .spyOn(Sentry, 'withScope')
      .mockImplementation(((cb: (s: unknown) => void) => cb(scope)) as never);
    const capture = jest
      .spyOn(Sentry, 'captureMessage')
      .mockReturnValue('id');

    reportMoneyAnomaly(logger, 'some_marker', 'order=1 broke', { orderId: '1' });

    expect(logger.error).toHaveBeenCalledWith('some_marker order=1 broke');
    expect(scope.setTag).toHaveBeenCalledWith('money_anomaly', 'some_marker');
    expect(scope.setExtras).toHaveBeenCalledWith({ orderId: '1' });
    expect(capture).toHaveBeenCalledWith('some_marker: order=1 broke', 'error');
  });

  it('never throws when Sentry throws', () => {
    const logger = { error: jest.fn() } as unknown as Logger;
    jest.spyOn(Sentry, 'withScope').mockImplementation(() => {
      throw new Error('sentry down');
    });
    expect(() => reportMoneyAnomaly(logger, 'm', 'x')).not.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});
