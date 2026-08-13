import {
  getErrorStatusCode,
  isExpiredExpoPushError,
  isExpiredWebPushError,
} from './stale-push-subscription.util';

describe('stale-push-subscription.util', () => {
  it('treats web push 404 and 410 as expired', () => {
    expect(isExpiredWebPushError({ statusCode: 404 })).toBe(true);
    expect(isExpiredWebPushError({ statusCode: 410 })).toBe(true);
  });

  it('does not treat transient web push failures as expired', () => {
    expect(isExpiredWebPushError({ statusCode: 429 })).toBe(false);
    expect(isExpiredWebPushError({ statusCode: 500 })).toBe(false);
    expect(isExpiredWebPushError({ statusCode: 403 })).toBe(false);
    expect(isExpiredWebPushError(new Error('network'))).toBe(false);
    expect(isExpiredWebPushError(undefined)).toBe(false);
  });

  it('reads statusCode from web-push errors', () => {
    expect(getErrorStatusCode({ statusCode: 410 })).toBe(410);
    expect(getErrorStatusCode('gone')).toBeUndefined();
  });

  it('treats Expo DeviceNotRegistered as expired', () => {
    expect(isExpiredExpoPushError('DeviceNotRegistered')).toBe(true);
    expect(isExpiredExpoPushError('MessageRateExceeded')).toBe(false);
    expect(isExpiredExpoPushError(undefined)).toBe(false);
  });
});
