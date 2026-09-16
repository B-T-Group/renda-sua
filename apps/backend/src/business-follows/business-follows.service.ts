import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

const GET_BUSINESS = `
  query GetBusinessForFollow($id: uuid!) {
    businesses_by_pk(id: $id) {
      id
      name
      lifecycle_status
      followers_count
    }
  }
`;

const INSERT_FOLLOW = `
  mutation InsertBusinessFollow($userId: uuid!, $businessId: uuid!) {
    insert_business_follows_one(
      object: { user_id: $userId, business_id: $businessId }
      on_conflict: {
        constraint: business_follows_user_business_unique
        update_columns: []
      }
    ) {
      id
    }
  }
`;

const DELETE_FOLLOW = `
  mutation DeleteBusinessFollow($userId: uuid!, $businessId: uuid!) {
    delete_business_follows(
      where: {
        user_id: { _eq: $userId }
        business_id: { _eq: $businessId }
      }
    ) {
      affected_rows
    }
  }
`;

const LIST_FOLLOWS = `
  query ListBusinessFollows($userId: uuid!, $limit: Int!, $offset: Int!) {
    business_follows_aggregate(where: { user_id: { _eq: $userId } }) {
      aggregate {
        count
      }
    }
    business_follows(
      where: { user_id: { _eq: $userId } }
      order_by: { created_at: desc }
      limit: $limit
      offset: $offset
    ) {
      business_id
      created_at
    }
  }
`;

const FOLLOWED_BUSINESS_IDS = `
  query FollowedBusinessIds($userId: uuid!, $businessIds: [uuid!]!) {
    business_follows(
      where: {
        user_id: { _eq: $userId }
        business_id: { _in: $businessIds }
      }
    ) {
      business_id
    }
  }
`;

const BUSINESSES_BY_IDS = `
  query FollowedBusinessesByIds($ids: [uuid!]!) {
    businesses(where: { id: { _in: $ids } }) {
      id
      name
      lifecycle_status
      followers_count
    }
  }
`;

export interface FollowedBusiness {
  id: string;
  name: string;
  followers_count: number;
  following: boolean;
}

export interface PaginatedBusinessFollows {
  businesses: FollowedBusiness[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface BusinessRow {
  id: string;
  name: string;
  lifecycle_status: string;
  followers_count: number;
}

@Injectable()
export class BusinessFollowsService {
  private readonly logger = new Logger(BusinessFollowsService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async setFollow(
    userId: string,
    businessId: string,
    following: boolean
  ): Promise<{ following: boolean; followers_count: number }> {
    await this.assertFollowableBusiness(businessId);
    if (following) {
      await this.hasuraSystemService.executeMutation(INSERT_FOLLOW, {
        userId,
        businessId,
      });
    } else {
      await this.hasuraSystemService.executeMutation(DELETE_FOLLOW, {
        userId,
        businessId,
      });
    }
    return {
      following,
      followers_count: await this.getFollowersCount(businessId),
    };
  }

  async getFollowedBusinessIdSet(
    userId: string,
    businessIds: string[]
  ): Promise<Set<string>> {
    if (!userId || userId === 'anonymous' || businessIds.length === 0) {
      return new Set();
    }
    try {
      const result = await this.hasuraSystemService.executeQuery<{
        business_follows: Array<{ business_id: string }>;
      }>(FOLLOWED_BUSINESS_IDS, { userId, businessIds });
      return new Set(
        (result.business_follows ?? []).map((row) => row.business_id)
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to load followed business ids for user ${userId}: ${error?.message}`
      );
      return new Set();
    }
  }

  async getUserFollows(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedBusinessFollows> {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(1, Math.floor(limit)), 50)
      : 20;
    const allIds = await this.fetchAllFollowBusinessIds(userId);
    const resolved = await this.resolveFollowedBusinesses(allIds);
    if (resolved.length === 0 && allIds.length > 0) {
      return this.emptyPage(allIds.length, safePage, safeLimit, 1);
    }
    const total = resolved.length;
    const offset = (safePage - 1) * safeLimit;
    return {
      businesses: resolved.slice(offset, offset + safeLimit),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: total === 0 ? 0 : Math.ceil(total / safeLimit),
    };
  }

  private emptyPage(
    total: number,
    page: number,
    limit: number,
    totalPages: number
  ): PaginatedBusinessFollows {
    return { businesses: [], total, page, limit, totalPages };
  }

  private async assertFollowableBusiness(businessId: string): Promise<void> {
    const business = await this.fetchBusiness(businessId);
    if (!business || business.lifecycle_status === 'suspended') {
      throw new HttpException(
        { success: false, message: 'Business not found' },
        HttpStatus.NOT_FOUND
      );
    }
  }

  private async getFollowersCount(businessId: string): Promise<number> {
    const business = await this.fetchBusiness(businessId);
    return business?.followers_count ?? 0;
  }

  private async fetchBusiness(businessId: string): Promise<BusinessRow | null> {
    const result = await this.hasuraSystemService.executeQuery<{
      businesses_by_pk: BusinessRow | null;
    }>(GET_BUSINESS, { id: businessId });
    return result.businesses_by_pk ?? null;
  }

  private async resolveFollowedBusinesses(
    ids: string[]
  ): Promise<FollowedBusiness[]> {
    if (ids.length === 0) return [];
    const result = await this.hasuraSystemService.executeQuery<{
      businesses: BusinessRow[];
    }>(BUSINESSES_BY_IDS, { ids });
    const byId = new Map((result.businesses ?? []).map((row) => [row.id, row]));
    const resolved: FollowedBusiness[] = [];
    for (const id of ids) {
      const row = byId.get(id);
      if (!row || row.lifecycle_status === 'suspended') continue;
      resolved.push({
        id: row.id,
        name: row.name,
        followers_count: row.followers_count,
        following: true,
      });
    }
    return resolved;
  }

  private async fetchAllFollowBusinessIds(userId: string): Promise<string[]> {
    const batchSize = 100;
    const maxIds = 2000;
    const businessIds: string[] = [];
    let offset = 0;
    while (businessIds.length < maxIds) {
      const batch = await this.fetchFollowBatch(userId, batchSize, offset);
      if (batch.businessIds.length === 0) break;
      businessIds.push(...batch.businessIds);
      offset += batch.businessIds.length;
      if (batch.businessIds.length < batchSize) break;
    }
    return businessIds.slice(0, maxIds);
  }

  private async fetchFollowBatch(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ total: number; businessIds: string[] }> {
    const result = await this.hasuraSystemService.executeQuery<{
      business_follows_aggregate: { aggregate: { count: number } | null };
      business_follows: Array<{ business_id: string }>;
    }>(LIST_FOLLOWS, { userId, limit, offset });
    return {
      total: result.business_follows_aggregate?.aggregate?.count ?? 0,
      businessIds: (result.business_follows ?? []).map((row) => row.business_id),
    };
  }
}
