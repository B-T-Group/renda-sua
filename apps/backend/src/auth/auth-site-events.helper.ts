import { HttpException } from '@nestjs/common';
import { SiteEventsService } from '../site-events/site-events.service';
import type { TrackViewerIdentity } from '../tracking/resolve-track-viewer';
import type { ClientPlatform } from './platform.decorator';

export function serverAuthViewer(userId?: string): TrackViewerIdentity {
  return {
    viewerType: userId ? 'user' : 'server',
    viewerId: userId || 'auth',
    jwtVerified: false,
  };
}

export function authSendFailReason(error: unknown): string {
  if (error instanceof HttpException && error.getStatus() === 429) {
    return 'rate_limited';
  }
  const status =
    (error as { status?: number; response?: { status?: number } })?.status ??
    (error as { response?: { status?: number } })?.response?.status;
  if (status === 429) return 'rate_limited';
  return 'send_failed';
}

export function emitAuthSiteEvent(
  siteEvents: SiteEventsService | undefined,
  eventType: string,
  platform: ClientPlatform,
  metadata: Record<string, unknown>,
  viewer: TrackViewerIdentity
): void {
  if (!siteEvents) return;
  void siteEvents.trackEvent(
    {
      eventType: eventType as never,
      metadata: { source: 'server', platform, ...metadata },
    },
    viewer
  );
}
