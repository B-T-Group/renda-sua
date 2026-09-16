import { api, apiRequest } from './apiClient';

export type FeedReel = {
  id: string;
  business_id: string;
  subject_type: string;
  subject_id: string;
  caption: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  market_country: string;
  like_count: number;
  view_count: number;
  duration_ms: number | null;
  published_at: string | null;
  prompt_preset?: string | null;
  business: { id: string; name: string };
  liked?: boolean;
  purchasable?: boolean;
  inventoryItemId?: string | null;
};

type FeedResponse = {
  success: boolean;
  data: { items: FeedReel[]; nextCursor: string | null };
};

/**
 * Uses apiRequest so logged-in shoppers send Bearer auth and get
 * personalized ranking (follows, watch history). Guests still work
 * because the feed endpoint is @Public().
 */
export async function fetchReelsFeed(params: {
  country?: string;
  cursor?: string;
  limit?: number;
  sessionId?: string;
}): Promise<{ items: FeedReel[]; nextCursor: string | null }> {
  const q = new URLSearchParams();
  if (params.country) q.set('country', params.country);
  if (params.cursor) q.set('cursor', params.cursor);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.sessionId) q.set('sessionId', params.sessionId);
  const path = `/reels/feed${q.toString() ? `?${q}` : ''}`;
  const res = await apiRequest<FeedResponse>(path);
  return res.data;
}

export async function recordReelView(
  reelId: string,
  watchTimeMs: number,
  sessionId?: string
): Promise<void> {
  try {
    await api.post(`/reels/${reelId}/view`, { watchTimeMs, sessionId });
  } catch {
    /* non-blocking */
  }
}

export async function setReelLike(reelId: string, liked: boolean): Promise<void> {
  await apiRequest(`/reels/${reelId}/like`, {
    method: 'POST',
    body: JSON.stringify({ liked }),
  });
}
