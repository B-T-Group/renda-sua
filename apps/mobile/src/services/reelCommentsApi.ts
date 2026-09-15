import { apiRequest } from './apiClient';
import { publicApiGet } from './publicApiClient';

export type ReelComment = {
  id: string;
  reel_id: string;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
  is_hidden: boolean;
  is_pinned: boolean;
  created_at: string;
};

export async function fetchReelComments(reelId: string): Promise<ReelComment[]> {
  const res = await publicApiGet<{ success: boolean; data: ReelComment[] }>(
    `/reels/${reelId}/comments`
  );
  return res.data ?? [];
}

export async function postReelComment(reelId: string, body: string): Promise<ReelComment> {
  const res = await apiRequest<{ success: boolean; data: ReelComment }>(
    `/reels/${reelId}/comments`,
    { method: 'POST', body: JSON.stringify({ body }) }
  );
  return res.data;
}
