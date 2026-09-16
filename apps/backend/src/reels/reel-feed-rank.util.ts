export type RankableReel = {
  id: string;
  business_id: string;
  like_count: number;
  published_at: string | null;
};

export type ReelWatchSignal = {
  reel_id: string;
  watch_time_ms: number;
  completed: boolean;
};

const FRESHNESS_HALF_LIFE_HOURS = 36;
const FOLLOW_BOOST = 28;
const COMPLETED_PENALTY = 55;
const WATCH_MS_PENALTY_DIVISOR = 400;
const MAX_WATCH_PENALTY = 70;
const LIKE_WEIGHT = 0.6;

export function scoreReelRelevance(params: {
  reel: RankableReel;
  nowMs?: number;
  followedBusinessIds?: Set<string>;
  watchByReelId?: Map<string, ReelWatchSignal>;
}): number {
  const now = params.nowMs ?? Date.now();
  const freshness = freshnessScore(params.reel.published_at, now);
  const likes = LIKE_WEIGHT * Math.log1p(Math.max(0, params.reel.like_count));
  const follow =
    params.followedBusinessIds?.has(params.reel.business_id) ? FOLLOW_BOOST : 0;
  const watch = watchTimePenalty(params.watchByReelId?.get(params.reel.id));
  return freshness + likes + follow - watch;
}

export function freshnessScore(
  publishedAt: string | null,
  nowMs: number
): number {
  if (!publishedAt) return 0;
  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published)) return 0;
  const hours = Math.max(0, (nowMs - published) / 3_600_000);
  return FRESHNESS_HALF_LIFE_HOURS / (FRESHNESS_HALF_LIFE_HOURS + hours);
}

/** Heavier penalty when the user already watched longer / completed. */
export function watchTimePenalty(signal?: ReelWatchSignal): number {
  if (!signal) return 0;
  const fromMs = Math.min(
    MAX_WATCH_PENALTY,
    signal.watch_time_ms / WATCH_MS_PENALTY_DIVISOR
  );
  return signal.completed ? Math.max(fromMs, COMPLETED_PENALTY) : fromMs;
}

export function rankReelsByRelevance(params: {
  reels: RankableReel[];
  followedBusinessIds?: Set<string>;
  watchByReelId?: Map<string, ReelWatchSignal>;
  nowMs?: number;
  maxPerBusinessStreak?: number;
}): RankableReel[] {
  const scored = [...params.reels].sort((a, b) => {
    const scoreA = scoreReelRelevance({
      reel: a,
      nowMs: params.nowMs,
      followedBusinessIds: params.followedBusinessIds,
      watchByReelId: params.watchByReelId,
    });
    const scoreB = scoreReelRelevance({
      reel: b,
      nowMs: params.nowMs,
      followedBusinessIds: params.followedBusinessIds,
      watchByReelId: params.watchByReelId,
    });
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.id.localeCompare(b.id);
  });
  return diversifyByBusiness(scored, params.maxPerBusinessStreak ?? 2);
}

function diversifyByBusiness(
  reels: RankableReel[],
  maxStreak: number
): RankableReel[] {
  if (maxStreak < 1 || reels.length < 2) return reels;
  const remaining = [...reels];
  const out: RankableReel[] = [];
  while (remaining.length) {
    let picked = -1;
    for (let i = 0; i < remaining.length; i += 1) {
      const streak = businessStreak(out, remaining[i].business_id);
      if (streak < maxStreak) {
        picked = i;
        break;
      }
    }
    if (picked < 0) picked = 0;
    out.push(remaining.splice(picked, 1)[0]);
  }
  return out;
}

function businessStreak(ordered: RankableReel[], businessId: string): number {
  let streak = 0;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (ordered[i].business_id !== businessId) break;
    streak += 1;
  }
  return streak;
}

/** Keep the strongest watch signal per reel (max watch time / completed). */
export function mergeWatchSignals(
  rows: ReelWatchSignal[]
): Map<string, ReelWatchSignal> {
  const map = new Map<string, ReelWatchSignal>();
  for (const row of rows) {
    const prev = map.get(row.reel_id);
    if (!prev) {
      map.set(row.reel_id, row);
      continue;
    }
    map.set(row.reel_id, {
      reel_id: row.reel_id,
      watch_time_ms: Math.max(prev.watch_time_ms, row.watch_time_ms),
      completed: prev.completed || row.completed,
    });
  }
  return map;
}
