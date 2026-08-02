import { formatCloudWatchMessage } from './logging.config';

describe('formatCloudWatchMessage', () => {
  it('emits full JSON including metadata', () => {
    const formatted = formatCloudWatchMessage({
      level: 'error',
      message: 'boom',
      timestamp: '2026-01-01T00:00:00.000Z',
      requestId: 'req-1',
      status: 500,
    });

    expect(JSON.parse(formatted)).toEqual({
      level: 'error',
      message: 'boom',
      timestamp: '2026-01-01T00:00:00.000Z',
      requestId: 'req-1',
      status: 500,
    });
  });
});
