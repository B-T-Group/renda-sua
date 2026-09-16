import { Injectable } from '@nestjs/common';
import { CatalogCacheService } from '../catalog-cache/catalog-cache.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { RequestContext } from '../auth/request-context';
import {
  mergeWatchSignals,
  rankReelsByRelevance,
  type RankableReel,
  type ReelWatchSignal,
} from './reel-feed-rank.util';

const FEED_SESSION_TTL_SECONDS = 3600;
const SESSION_FEED_CAP = 200;
const CANDIDATE_POOL = 500;
const VIEW_THRESHOLD_MS = 3000;
const WATCH_LOOKBACK_DAYS = 14;

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
  /** Resolved `business_inventory.id` for checkout when subject is a catalog item. */
  inventoryItemId?: string | null;
};

@Injectable()
export class ReelsFeedService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly catalogCache: CatalogCacheService
  ) {}

  async getFeed(params: {
    ctx?: RequestContext;
    country?: string;
    cursor?: string;
    limit?: number;
    sessionId?: string;
  }): Promise<{ items: FeedReel[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(params.limit ?? 10, 1), 25);
    const country = params.country?.trim().toUpperCase();
    const userId = this.resolveUserId(params.ctx);
    const offset = params.cursor ? Number.parseInt(params.cursor, 10) || 0 : 0;
    const page = await this.resolveFeedPage({
      userId,
      country,
      sessionId: params.sessionId,
      offset,
      limit,
    });
    const items = await this.hydrateFeedRows(page.ids, country, userId);
    return { items, nextCursor: page.nextCursor };
  }

  async recordView(params: {
    reelId: string;
    userId?: string | null;
    sessionId?: string;
    watchTimeMs: number;
  }): Promise<void> {
    if (params.watchTimeMs < VIEW_THRESHOLD_MS) return;
    await this.hasura.executeMutation(
      `mutation TrackReelView($object: reel_view_events_insert_input!) {
        insert_reel_view_events_one(object: $object) { id }
      }`,
      {
        object: {
          reel_id: params.reelId,
          user_id: params.userId || null,
          session_id: params.sessionId || null,
          watch_time_ms: params.watchTimeMs,
          completed: params.watchTimeMs >= 15000,
          last_served_at: new Date().toISOString(),
        },
      }
    );
    await this.hasura.executeMutation(
      `mutation IncReelViews($id: uuid!) {
        update_reels_by_pk(pk_columns: { id: $id }, _inc: { view_count: 1 }) { id }
      }`,
      { id: params.reelId }
    );
  }

  async setLike(userId: string, reelId: string, liked: boolean): Promise<void> {
    if (liked) {
      await this.insertLikeIfNew(userId, reelId);
      return;
    }
    await this.deleteLikeIfPresent(userId, reelId);
  }

  private resolveUserId(ctx?: RequestContext): string | null {
    if (!ctx?.userId || ctx.userId === 'anonymous') return null;
    return ctx.userId;
  }

  private async resolveFeedPage(params: {
    userId: string | null;
    country?: string;
    sessionId?: string;
    offset: number;
    limit: number;
  }): Promise<{ ids: string[]; nextCursor: string | null }> {
    const sessionKey = params.sessionId
      ? `reels-feed:${params.sessionId}:${params.userId || 'anon'}:${params.country || 'all'}`
      : null;
    if (sessionKey) {
      return this.pageFromSession({
        sessionKey,
        userId: params.userId,
        sessionId: params.sessionId,
        offset: params.offset,
        limit: params.limit,
      });
    }
    const blockedIds = params.userId
      ? await this.loadBlockedBusinessIds(params.userId)
      : [];
    const ids = await this.loadRankedReelIds({
      blockedIds,
      userId: params.userId,
      sessionId: params.sessionId,
      limit: params.limit,
      offset: params.offset,
    });
    return {
      ids,
      nextCursor:
        ids.length === params.limit
          ? String(params.offset + params.limit)
          : null,
    };
  }

  private async pageFromSession(params: {
    sessionKey: string;
    userId: string | null;
    sessionId?: string;
    offset: number;
    limit: number;
  }): Promise<{ ids: string[]; nextCursor: string | null }> {
    let frozen = await this.loadSessionIds(params.sessionKey);
    if (!frozen?.length) {
      const blockedIds = params.userId
        ? await this.loadBlockedBusinessIds(params.userId)
        : [];
      frozen = await this.loadRankedReelIds({
        blockedIds,
        userId: params.userId,
        sessionId: params.sessionId,
        limit: SESSION_FEED_CAP,
        offset: 0,
      });
      if (frozen.length) {
        await this.catalogCache.set(params.sessionKey, JSON.stringify(frozen), {
          ttlSeconds: FEED_SESSION_TTL_SECONDS,
        });
      }
    }
    const remaining = frozen.slice(params.offset);
    return {
      ids: remaining.slice(0, params.limit),
      nextCursor:
        remaining.length > params.limit
          ? String(params.offset + params.limit)
          : null,
    };
  }

  private async loadRankedReelIds(params: {
    blockedIds: string[];
    userId: string | null;
    sessionId?: string;
    limit: number;
    offset: number;
  }): Promise<string[]> {
    const candidates = await this.loadCandidateReels(params.blockedIds);
    if (!candidates.length) return [];
    const [followed, watches] = await Promise.all([
      params.userId
        ? this.loadFollowedBusinessIds(params.userId)
        : Promise.resolve(new Set<string>()),
      this.loadWatchSignals({
        userId: params.userId,
        sessionId: params.sessionId,
        reelIds: candidates.map((r) => r.id),
      }),
    ]);
    const ranked = rankReelsByRelevance({
      reels: candidates,
      followedBusinessIds: followed,
      watchByReelId: watches,
    });
    return ranked
      .slice(params.offset, params.offset + params.limit)
      .map((r) => r.id);
  }

  private async loadCandidateReels(
    blockedIds: string[]
  ): Promise<RankableReel[]> {
    const where: Record<string, unknown> = {
      moderation_status: { _eq: 'approved' },
      processing_status: { _eq: 'ready' },
      is_active: { _eq: true },
      video_url: { _is_null: false },
      deleted_at: { _is_null: true },
    };
    if (blockedIds.length) {
      where.business_id = { _nin: blockedIds };
    }
    const result = await this.hasura.executeQuery<{
      reels: RankableReel[];
    }>(
      `query RankedReelCandidates($where: reels_bool_exp!, $limit: Int!) {
        reels(
          where: $where
          order_by: [{ published_at: desc }, { created_at: desc }]
          limit: $limit
        ) { id business_id like_count published_at }
      }`,
      { where, limit: CANDIDATE_POOL }
    );
    return result.reels ?? [];
  }

  private async loadFollowedBusinessIds(userId: string): Promise<Set<string>> {
    const result = await this.hasura.executeQuery<{
      business_follows: Array<{ business_id: string }>;
    }>(
      `query($userId:uuid!){
        business_follows(where:{user_id:{_eq:$userId}}){business_id}
      }`,
      { userId }
    );
    return new Set((result.business_follows ?? []).map((r) => r.business_id));
  }

  private async loadWatchSignals(params: {
    userId: string | null;
    sessionId?: string;
    reelIds: string[];
  }): Promise<Map<string, ReelWatchSignal>> {
    if (!params.reelIds.length) return new Map();
    if (!params.userId && !params.sessionId) return new Map();
    const since = new Date(
      Date.now() - WATCH_LOOKBACK_DAYS * 24 * 60 * 60_000
    ).toISOString();
    const viewerFilter = params.userId
      ? { user_id: { _eq: params.userId } }
      : { session_id: { _eq: params.sessionId } };
    const result = await this.hasura.executeQuery<{
      reel_view_events: ReelWatchSignal[];
    }>(
      `query($where:reel_view_events_bool_exp!){
        reel_view_events(where:$where){
          reel_id watch_time_ms completed
        }
      }`,
      {
        where: {
          _and: [
            viewerFilter,
            { reel_id: { _in: params.reelIds } },
            { created_at: { _gte: since } },
          ],
        },
      }
    );
    return mergeWatchSignals(result.reel_view_events ?? []);
  }

  private async loadSessionIds(sessionKey: string): Promise<string[] | null> {
    const raw = await this.catalogCache.get(sessionKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private async hydrateFeedRows(
    ids: string[],
    country?: string,
    userId?: string | null
  ): Promise<FeedReel[]> {
    if (!ids.length) return [];
    const result = await this.hasura.executeQuery<{ reels: FeedReel[] }>(
      `query($ids:[uuid!]!){
        reels(where:{id:{_in:$ids}}){
          id business_id subject_type subject_id caption video_url thumbnail_url
          market_country like_count view_count duration_ms published_at prompt_preset
          business { id name }
        }
      }`,
      { ids }
    );
    const byId = new Map((result.reels ?? []).map((r) => [r.id, r]));
    let items = ids.map((id) => byId.get(id)).filter(Boolean) as FeedReel[];
    items = await this.attachInventoryIds(items);
    if (country) {
      items = items.map((r) => ({
        ...r,
        purchasable:
          r.market_country === country && Boolean(r.inventoryItemId),
      }));
    }
    if (userId) {
      const liked = await this.loadLikedIds(userId, items.map((i) => i.id));
      items = items.map((r) => ({ ...r, liked: liked.has(r.id) }));
    }
    return items;
  }

  private async attachInventoryIds(reels: FeedReel[]): Promise<FeedReel[]> {
    const inventoryByKey = await this.loadInventoryIdsForItemSubjects(reels);
    return reels.map((r) => ({
      ...r,
      inventoryItemId:
        r.subject_type === 'item'
          ? inventoryByKey.get(`${r.business_id}:${r.subject_id}`) ?? null
          : null,
    }));
  }

  private async loadInventoryIdsForItemSubjects(
    reels: FeedReel[]
  ): Promise<Map<string, string>> {
    const itemIds = [
      ...new Set(
        reels
          .filter((r) => r.subject_type === 'item')
          .map((r) => r.subject_id)
          .filter(Boolean)
      ),
    ];
    if (!itemIds.length) return new Map();
    const result = await this.hasura.executeQuery<{
      business_inventory: Array<{
        id: string;
        item_id: string;
        business_location: { business_id: string };
      }>;
    }>(
      `query($itemIds:[uuid!]!){
        business_inventory(
          where:{
            item_id:{_in:$itemIds}
            is_active:{_eq:true}
            business_location:{is_active:{_eq:true}}
          }
          order_by:[{quantity:desc},{updated_at:desc}]
        ){id item_id business_location{business_id}}
      }`,
      { itemIds }
    );
    const map = new Map<string, string>();
    for (const row of result.business_inventory ?? []) {
      const key = `${row.business_location.business_id}:${row.item_id}`;
      if (!map.has(key)) map.set(key, row.id);
    }
    return map;
  }

  private async insertLikeIfNew(userId: string, reelId: string): Promise<void> {
    const res = await this.hasura.executeMutation<{
      insert_reel_likes: { affected_rows: number };
    }>(
      `mutation LikeReel($reelId: uuid!, $userId: uuid!) {
        insert_reel_likes(
          objects: [{ reel_id: $reelId, user_id: $userId }]
          on_conflict: { constraint: reel_likes_pkey, update_columns: [] }
        ) { affected_rows }
      }`,
      { reelId, userId }
    );
    if (!res.insert_reel_likes?.affected_rows) return;
    await this.hasura.executeMutation(
      `mutation IncLike($id: uuid!) {
        update_reels_by_pk(pk_columns: { id: $id }, _inc: { like_count: 1 }) { id }
      }`,
      { id: reelId }
    );
  }

  private async deleteLikeIfPresent(
    userId: string,
    reelId: string
  ): Promise<void> {
    const res = await this.hasura.executeMutation<{
      delete_reel_likes: { affected_rows: number };
    }>(
      `mutation UnlikeReel($reelId: uuid!, $userId: uuid!) {
        delete_reel_likes(
          where: { reel_id: { _eq: $reelId }, user_id: { _eq: $userId } }
        ) { affected_rows }
      }`,
      { reelId, userId }
    );
    if (!res.delete_reel_likes?.affected_rows) return;
    await this.hasura.executeMutation(
      `mutation DecLike($id: uuid!) {
        update_reels_by_pk(pk_columns: { id: $id }, _inc: { like_count: -1 }) { id }
      }`,
      { id: reelId }
    );
  }

  private async loadBlockedBusinessIds(userId: string): Promise<string[]> {
    const res = await this.hasura.executeQuery<{
      business_blocks: Array<{ business_id: string }>;
    }>(
      `query Blocks($userId: uuid!) {
        business_blocks(where: { blocker_user_id: { _eq: $userId } }) {
          business_id
        }
      }`,
      { userId }
    );
    return (res.business_blocks ?? []).map((b) => b.business_id);
  }

  private async loadLikedIds(
    userId: string,
    reelIds: string[]
  ): Promise<Set<string>> {
    if (!reelIds.length) return new Set();
    const res = await this.hasura.executeQuery<{
      reel_likes: Array<{ reel_id: string }>;
    }>(
      `query Liked($userId: uuid!, $ids: [uuid!]!) {
        reel_likes(where: { user_id: { _eq: $userId }, reel_id: { _in: $ids } }) {
          reel_id
        }
      }`,
      { userId, ids: reelIds }
    );
    return new Set((res.reel_likes ?? []).map((l) => l.reel_id));
  }
}
