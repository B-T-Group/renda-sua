import { extractHasuraUserIdFromToken } from '../auth/request-context.util';

export interface TrackViewerIdentity {
  viewerType: string;
  viewerId: string;
  /** True when viewerId came from a verified Bearer JWT (safe for PII enrichment). */
  jwtVerified: boolean;
}

type TrackRequestLike = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  user?: { sub?: string };
};

function headerString(
  h: TrackRequestLike['headers'],
  name: string
): string | undefined {
  const v = h[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v;
}

/**
 * Prefer Hasura DB user id from the Bearer JWT so Meta `external_id` matches
 * Purchase events (`client.user_id`). Fall back to X-User-Id / anon / ip|ua.
 */
export function resolveTrackViewerFromRequest(
  req: TrackRequestLike
): TrackViewerIdentity {
  const { headers } = req;
  const auth = headerString(headers, 'authorization');
  if (auth?.startsWith('Bearer ')) {
    try {
      const hasuraUserId = extractHasuraUserIdFromToken(auth.slice(7));
      if (hasuraUserId?.trim()) {
        return {
          viewerType: 'user',
          viewerId: hasuraUserId.trim(),
          jwtVerified: true,
        };
      }
    } catch {
      // invalid/missing claims — fall through
    }
  }

  const userIdHeader = headerString(headers, 'x-user-id');
  const anonIdHeader = headerString(headers, 'x-anonymous-id');
  const userSub = req.user?.sub;
  const ua = headerString(headers, 'user-agent') ?? 'unknown';

  if (userIdHeader || userSub) {
    return {
      viewerType: 'user',
      viewerId: (userIdHeader || userSub)!,
      jwtVerified: false,
    };
  }
  if (anonIdHeader) {
    return { viewerType: 'anon', viewerId: anonIdHeader, jwtVerified: false };
  }
  return {
    viewerType: 'ip_ua',
    viewerId: `${req.ip || 'unknown'}|${ua}`,
    jwtVerified: false,
  };
}
