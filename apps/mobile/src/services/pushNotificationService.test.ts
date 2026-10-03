import { beforeEach, describe, expect, it, vi } from 'vitest';

const setNotificationChannelAsync = vi.fn(async () => undefined);

vi.mock('./expoNotificationsLoader', () => ({
  loadExpoNotifications: vi.fn(async () => ({
    AndroidImportance: { MAX: 'max', DEFAULT: 'default', HIGH: 'high' },
    AndroidNotificationVisibility: { PUBLIC: 'public' },
    AndroidAudioUsage: { ALARM: 'alarm' },
    AndroidAudioContentType: { SONIFICATION: 'sonification' },
    setNotificationChannelAsync,
  })),
}));

import { Platform } from 'react-native';
import {
  ORDER_INCOMING_CHANNEL_ID,
  ORDER_OFFERS_CHANNEL_ID,
  PushNotificationService,
} from './pushNotificationService';

describe('PushNotificationService alarm channels', () => {
  beforeEach(() => {
    setNotificationChannelAsync.mockClear();
    (Platform as { OS: string }).OS = 'ios';
  });

  it('does not register channels off Android', async () => {
    await PushNotificationService.setupAndroidChannel();
    expect(setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('registers offer and incoming channels on the alarm stream under new ids', async () => {
    (Platform as { OS: string }).OS = 'android';
    await PushNotificationService.setupAndroidChannel();

    expect(ORDER_OFFERS_CHANNEL_ID).toBe('order_offers_alarm');
    expect(ORDER_INCOMING_CHANNEL_ID).toBe('order_incoming_alarm');
    expect(setNotificationChannelAsync).toHaveBeenCalledWith(
      'order_offers_alarm',
      expect.objectContaining({
        name: 'Delivery offers',
        importance: 'max',
        sound: 'default',
        audioAttributes: { usage: 'alarm', contentType: 'sonification' },
      })
    );
    expect(setNotificationChannelAsync).toHaveBeenCalledWith(
      'order_incoming_alarm',
      expect.objectContaining({
        name: 'Incoming orders',
        importance: 'max',
        sound: 'default',
        audioAttributes: { usage: 'alarm', contentType: 'sonification' },
      })
    );
  });
});
