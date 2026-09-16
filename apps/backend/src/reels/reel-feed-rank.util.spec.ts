import {
  mergeWatchSignals,
  rankReelsByRelevance,
  scoreReelRelevance,
  watchTimePenalty,
  type RankableReel,
} from './reel-feed-rank.util';

describe('reel-feed-rank.util', () => {
  const now = Date.parse('2026-09-16T12:00:00.000Z');

  const fresh: RankableReel = {
    id: 'a',
    business_id: 'biz-1',
    like_count: 0,
    published_at: '2026-09-16T10:00:00.000Z',
  };
  const older: RankableReel = {
    id: 'b',
    business_id: 'biz-2',
    like_count: 0,
    published_at: '2026-09-10T10:00:00.000Z',
  };

  it('penalizes longer watch_time_ms more than short views', () => {
    expect(watchTimePenalty({ reel_id: 'a', watch_time_ms: 4000, completed: false })).toBe(
      10
    );
    expect(watchTimePenalty({ reel_id: 'a', watch_time_ms: 20000, completed: false })).toBe(
      50
    );
    expect(watchTimePenalty({ reel_id: 'a', watch_time_ms: 8000, completed: true })).toBe(
      55
    );
  });

  it('ranks watched-long reels below unseen fresher ones', () => {
    const ranked = rankReelsByRelevance({
      reels: [older, fresh],
      nowMs: now,
      watchByReelId: mergeWatchSignals([
        { reel_id: 'a', watch_time_ms: 20000, completed: true },
      ]),
    });
    expect(ranked.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('boosts followed merchants', () => {
    const score = scoreReelRelevance({
      reel: older,
      nowMs: now,
      followedBusinessIds: new Set(['biz-2']),
    });
    const baseline = scoreReelRelevance({ reel: older, nowMs: now });
    expect(score).toBeGreaterThan(baseline);
  });

  it('diversifies consecutive same-business reels', () => {
    const reels: RankableReel[] = [
      { id: '1', business_id: 'biz-1', like_count: 10, published_at: '2026-09-16T11:00:00.000Z' },
      { id: '2', business_id: 'biz-1', like_count: 9, published_at: '2026-09-16T10:50:00.000Z' },
      { id: '3', business_id: 'biz-1', like_count: 8, published_at: '2026-09-16T10:40:00.000Z' },
      { id: '4', business_id: 'biz-2', like_count: 1, published_at: '2026-09-16T10:30:00.000Z' },
    ];
    const ranked = rankReelsByRelevance({ reels, nowMs: now, maxPerBusinessStreak: 2 });
    expect(ranked.slice(0, 3).map((r) => r.business_id)).not.toEqual([
      'biz-1',
      'biz-1',
      'biz-1',
    ]);
  });
});
