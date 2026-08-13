import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  InventoryItem,
  InventoryItemsService,
} from '../inventory-items/inventory-items.service';

const GET_APPROVED_ITEM = `
  query GetApprovedItem($id: uuid!) {
    items_by_pk(id: $id) {
      id
      moderation_status
      likes_count
    }
  }
`;

const INSERT_LIKE = `
  mutation InsertUserItemLike($userId: uuid!, $itemId: uuid!) {
    insert_user_item_likes_one(
      object: { user_id: $userId, item_id: $itemId }
      on_conflict: {
        constraint: user_item_likes_user_id_item_id_key
        update_columns: []
      }
    ) {
      id
    }
  }
`;

const DELETE_LIKE = `
  mutation DeleteUserItemLike($userId: uuid!, $itemId: uuid!) {
    delete_user_item_likes(
      where: {
        user_id: { _eq: $userId }
        item_id: { _eq: $itemId }
      }
    ) {
      affected_rows
    }
  }
`;

const LIST_LIKES = `
  query ListUserItemLikes($userId: uuid!, $limit: Int!, $offset: Int!) {
    user_item_likes_aggregate(
      where: {
        user_id: { _eq: $userId }
        item: { moderation_status: { _eq: "approved" } }
      }
    ) {
      aggregate {
        count
      }
    }
    user_item_likes(
      where: {
        user_id: { _eq: $userId }
        item: { moderation_status: { _eq: "approved" } }
      }
      order_by: { created_at: desc }
      limit: $limit
      offset: $offset
    ) {
      item_id
      created_at
    }
  }
`;

const LIKED_ITEM_IDS = `
  query LikedItemIds($userId: uuid!, $itemIds: [uuid!]!) {
    user_item_likes(
      where: {
        user_id: { _eq: $userId }
        item_id: { _in: $itemIds }
      }
    ) {
      item_id
    }
  }
`;

export interface PaginatedItemLikes {
  items: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ItemLikesService {
  private readonly logger = new Logger(ItemLikesService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly inventoryItemsService: InventoryItemsService
  ) {}

  async setLike(
    userId: string,
    itemId: string,
    liked: boolean
  ): Promise<{ liked: boolean; likes_count: number }> {
    const item = await this.hasuraSystemService.executeQuery<{
      items_by_pk: {
        id: string;
        moderation_status: string;
        likes_count: number;
      } | null;
    }>(GET_APPROVED_ITEM, { id: itemId });

    if (
      !item.items_by_pk ||
      item.items_by_pk.moderation_status !== 'approved'
    ) {
      throw new HttpException(
        { success: false, message: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }

    if (liked) {
      await this.hasuraSystemService.executeMutation(INSERT_LIKE, {
        userId,
        itemId,
      });
    } else {
      await this.hasuraSystemService.executeMutation(DELETE_LIKE, {
        userId,
        itemId,
      });
    }

    const refreshed = await this.hasuraSystemService.executeQuery<{
      items_by_pk: { likes_count: number } | null;
    }>(GET_APPROVED_ITEM, { id: itemId });

    return {
      liked,
      likes_count: refreshed.items_by_pk?.likes_count ?? 0,
    };
  }

  async getLikedItemIdSet(
    userId: string,
    itemIds: string[]
  ): Promise<Set<string>> {
    if (!userId || userId === 'anonymous' || itemIds.length === 0) {
      return new Set();
    }
    try {
      const result = await this.hasuraSystemService.executeQuery<{
        user_item_likes: Array<{ item_id: string }>;
      }>(LIKED_ITEM_IDS, { userId, itemIds });
      return new Set(
        (result.user_item_likes ?? []).map((row) => row.item_id)
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to load liked item ids for user ${userId}: ${error?.message}`
      );
      return new Set();
    }
  }

  async getUserLikes(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedItemLikes> {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(1, Math.floor(limit)), 50)
      : 20;
    const allIds = await this.fetchAllLikeItemIds(userId);
    const listings =
      await this.inventoryItemsService.getBestListingsForCatalogItemIds(allIds);
    const byItemId = new Map(listings.map((item) => [item.item_id, item]));
    const resolved: InventoryItem[] = [];
    for (const id of allIds) {
      const listing = byItemId.get(id);
      if (listing) resolved.push({ ...listing, liked: true });
    }
    if (resolved.length === 0 && allIds.length > 0) {
      return {
        items: [],
        total: allIds.length,
        page: safePage,
        limit: safeLimit,
        totalPages: 1,
      };
    }
    const total = resolved.length;
    const offset = (safePage - 1) * safeLimit;
    const items = resolved.slice(offset, offset + safeLimit);
    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: total === 0 ? 0 : Math.ceil(total / safeLimit),
    };
  }

  private async fetchAllLikeItemIds(userId: string): Promise<string[]> {
    const batchSize = 100;
    const maxIds = 2000;
    const itemIds: string[] = [];
    let offset = 0;
    while (itemIds.length < maxIds) {
      const batch = await this.fetchLikeBatch(userId, batchSize, offset);
      if (batch.itemIds.length === 0) break;
      itemIds.push(...batch.itemIds);
      offset += batch.itemIds.length;
      if (batch.itemIds.length < batchSize) break;
    }
    return itemIds.slice(0, maxIds);
  }

  private async fetchLikeBatch(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ total: number; itemIds: string[] }> {
    const result = await this.hasuraSystemService.executeQuery<{
      user_item_likes_aggregate: { aggregate: { count: number } | null };
      user_item_likes: Array<{ item_id: string }>;
    }>(LIST_LIKES, { userId, limit, offset });
    return {
      total: result.user_item_likes_aggregate?.aggregate?.count ?? 0,
      itemIds: (result.user_item_likes ?? []).map((row) => row.item_id),
    };
  }
}
