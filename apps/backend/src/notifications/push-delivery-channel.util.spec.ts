import { userHasRegisteredPushChannels } from './push-delivery-channel.util';

describe('userHasRegisteredPushChannels', () => {
  it('returns false when push is disabled', () => {
    expect(userHasRegisteredPushChannels(false, true, 1, true)).toBe(false);
  });

  it('returns true when push enabled and valid Expo token exists', () => {
    expect(userHasRegisteredPushChannels(true, true, 0, false)).toBe(true);
  });

  it('returns true when push enabled, VAPID configured, and web subscriptions exist', () => {
    expect(userHasRegisteredPushChannels(true, false, 2, true)).toBe(true);
  });

  it('returns false when only web count but VAPID not configured', () => {
    expect(userHasRegisteredPushChannels(true, false, 2, false)).toBe(false);
  });

  it('returns false when enabled but no Expo and no web subs', () => {
    expect(userHasRegisteredPushChannels(true, false, 0, true)).toBe(false);
  });
});
