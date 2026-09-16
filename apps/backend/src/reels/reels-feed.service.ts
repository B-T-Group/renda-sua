import { Injectable } from '@nestjs/common';
import { CatalogCacheService } from '../catalog-cache/catalog-cache.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { RequestContext } from '../auth/request-context';

const FEED_SESSION_TTL_SECONDS = 3600;
const SESSION_FEED_CAP = 200;
const VIEW_THRESHOLD_MS = 3000;

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
      ? `reels-feed:${params.sessionId}:${params.country || 'all'}`
      : null;
    if (sessionKey) {
      return this.pageFromSession(
        sessionKey,
        params.userId,
        params.offset,
        params.limit
      );
    }
    const blockedIds = params.userId
      ? await this.loadBlockedBusinessIds(params.userId)
      : [];
    const ids = await this.loadRankedReelIds(
      blockedIds,
      params.limit,
      params.offset
    );
    return {
      ids,
      nextCursor: ids.length === params.limit ? String(params.offset + params.limit) : null,
    };
  }

  private async pageFromSession(
    sessionKey: string,
    userId: string | null,
    offset: number,
    limit: number
  ): Promise<{ ids: string[]; nextCursor: string | null }> {
    let frozen = await this.loadSessionIds(sessionKey);
    if (!frozen?.length) {
      const blockedIds = userId
        ? await this.loadBlockedBusinessIds(userId)
        : [];
      frozen = await this.loadRankedReelIds(blockedIds, SESSION_FEED_CAP, 0);
      if (frozen.length) {
        await this.catalogCache.set(sessionKey, JSON.stringify(frozen), {
          ttlSeconds: FEED_SESSION_TTL_SECONDS,
        });
      }
    }
    const remaining = frozen.slice(offset);
    return {
      ids: remaining.slice(0, limit),
      nextCursor:
        remaining.length > limit ? String(offset + limit) : null,
    };
  }

  private async loadRankedReelIds(
    blockedIds: string[],
    limit: number,
    offset: number
  ): Promise<string[]> {
    const where: Record<string, unknown> = {
      moderation_status: { _eq: 'approved' },
      processing_status: { _eq: 'ready' },
      is_active: { _eq: true },
      video_url: { _is_null: false },
    };
    if (blockedIds.length) {
      where.business_id = { _nin: blockedIds };
    }
    const result = await this.hasura.executeQuery<{
      reels: Array<{ id: string }>;
    }>(
      `query RankedReelIds($where: reels_bool_exp!, $limit: Int!, $offset: Int!) {
        reels(
          where: $where
          order_by: [{ published_at: desc }, { created_at: desc }]
          limit: $limit
          offset: $offset
        ) { id }
      }`,
      { where, limit, offset }
    );
    return (result.reels ?? []).map((r) => r.id);
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
          market_country like_count view_count duration_ms published_at
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
