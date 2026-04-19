export interface TrackViewerIdentity {
  viewerType: string;
  viewerId: string;
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

export function resolveTrackViewerFromRequest(
  req: TrackRequestLike
): TrackViewerIdentity {
  const { headers } = req;
  const userIdHeader = headerString(headers, 'x-user-id');
  const anonIdHeader = headerString(headers, 'x-anonymous-id');
  const userSub = req.user?.sub;
  const ua = headerString(headers, 'user-agent') ?? 'unknown';

  if (userIdHeader || userSub) {
    return { viewerType: 'user', viewerId: (userIdHeader || userSub)! };
  }
  if (anonIdHeader) {
    return { viewerType: 'anon', viewerId: anonIdHeader };
  }
  return {
    viewerType: 'ip_ua',
    viewerId: `${req.ip || 'unknown'}|${ua}`,
  };
}
