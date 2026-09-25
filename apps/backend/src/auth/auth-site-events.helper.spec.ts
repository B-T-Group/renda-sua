import { HttpException, HttpStatus } from '@nestjs/common';
import {
  authSendFailReason,
  emitAuthSiteEvent,
  serverAuthViewer,
} from './auth-site-events.helper';

describe('authSendFailReason', () => {
  it('classifies HTTP 429 as rate_limited and other failures as send_failed', () => {
    expect(
      authSendFailReason(new HttpException('no', HttpStatus.TOO_MANY_REQUESTS))
    ).toBe('rate_limited');
    expect(authSendFailReason({ response: { status: 429 } })).toBe('rate_limited');
    expect(authSendFailReason({ status: 500 })).toBe('send_failed');
    expect(authSendFailReason(new Error('boom'))).toBe('send_failed');
  });
});

describe('serverAuthViewer', () => {
  it('uses the user id when one is known', () => {
    expect(serverAuthViewer('user-1')).toEqual({
      viewerType: 'user',
      viewerId: 'user-1',
      jwtVerified: false,
    });
    expect(serverAuthViewer()).toEqual({
      viewerType: 'server',
      viewerId: 'auth',
      jwtVerified: false,
    });
  });
});

describe('emitAuthSiteEvent', () => {
  it('does nothing when site events are not wired', () => {
    expect(() =>
      emitAuthSiteEvent(
        undefined,
        'auth_otp_send_failed',
        'web',
        { fail_reason: 'send_failed' },
        serverAuthViewer()
      )
    ).not.toThrow();
  });

  it('tags the event with source and platform', () => {
    const trackEvent = jest.fn();
    emitAuthSiteEvent(
      { trackEvent } as never,
      'auth_otp_send_failed',
      'mobile',
      { fail_reason: 'rate_limited' },
      serverAuthViewer()
    );
    expect(trackEvent).toHaveBeenCalledWith(
      {
        eventType: 'auth_otp_send_failed',
        metadata: {
          source: 'server',
          platform: 'mobile',
          fail_reason: 'rate_limited',
        },
      },
      { viewerType: 'server', viewerId: 'auth', jwtVerified: false }
    );
  });
});
