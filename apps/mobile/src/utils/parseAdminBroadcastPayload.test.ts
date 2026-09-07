import { describe, expect, it } from 'vitest';
import {
  parseAdminBroadcastFromNotification,
  parseAdminBroadcastPayload,
} from './parseAdminBroadcastPayload';

describe('parseAdminBroadcastPayload', () => {
  it('parses a valid admin broadcast payload', () => {
    const parsed = parseAdminBroadcastPayload({
      type: 'admin_broadcast',
      campaignId: 'camp-1',
      messageId: 'msg-1',
      actionType: 'app_upgrade',
      title: 'Update',
      body: 'Please update',
    });
    expect(parsed).toEqual({
      type: 'admin_broadcast',
      campaignId: 'camp-1',
      messageId: 'msg-1',
      actionType: 'app_upgrade',
      title: 'Update',
      body: 'Please update',
      titleEn: undefined,
      bodyEn: undefined,
      titleFr: undefined,
      bodyFr: undefined,
    });
  });

  it('returns null for unrelated payloads', () => {
    expect(parseAdminBroadcastPayload({ type: 'order_offer' })).toBeNull();
    expect(parseAdminBroadcastPayload(null)).toBeNull();
  });

  it('defaults unknown action types to generic', () => {
    const parsed = parseAdminBroadcastPayload({
      type: 'admin_broadcast',
      campaignId: 'c',
      messageId: 'm',
      actionType: 'something_else',
    });
    expect(parsed?.actionType).toBe('generic');
  });

  it('fills title/body from notification content when data omits them', () => {
    const parsed = parseAdminBroadcastFromNotification({
      title: 'Push title',
      body: 'Push body',
      data: {
        type: 'admin_broadcast',
        campaignId: 'c',
        messageId: 'm',
        actionType: 'generic',
      },
    });
    expect(parsed?.title).toBe('Push title');
    expect(parsed?.body).toBe('Push body');
  });
});
