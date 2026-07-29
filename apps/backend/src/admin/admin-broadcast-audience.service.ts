import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type {
  BroadcastAudienceFiltersDto,
  BroadcastAudienceType,
} from './dto/admin-broadcast.dto';

export interface BroadcastAudienceUser {
  userId: string;
  preferredLanguage: 'en' | 'fr';
  hasPushToken: boolean;
}

const DEDUPE_DAYS = 7;

@Injectable()
export class AdminBroadcastAudienceService {
  constructor(private readonly hasura: HasuraSystemService) {}

  hashMessage(templateKey: string, body: string, title?: string): string {
    const canonical = `${templateKey}\n${(title ?? '').trim()}\n${body.trim()}`
      .toLowerCase()
      .replace(/\s+/g, ' ');
    return createHash('sha256').update(canonical).digest('hex');
  }

  async listAudienceUsers(
    audienceType: BroadcastAudienceType,
    filters?: BroadcastAudienceFiltersDto
  ): Promise<BroadcastAudienceUser[]> {
    let users: BroadcastAudienceUser[];
    if (audienceType === 'business') {
      users = await this.queryBusinessUsers(filters);
    } else if (audienceType === 'agent') {
      users = await this.queryAgentUsers(filters);
    } else if (audienceType === 'client') {
      users = await this.queryClientUsers(filters);
    } else {
      users = await this.queryEveryoneUsers(filters);
    }
    return users.sort((a, b) => a.userId.localeCompare(b.userId));
  }

  async countDedupeSkips(
    userIds: string[],
    messageHash: string
  ): Promise<number> {
    if (userIds.length === 0 || !messageHash) return 0;
    const since = new Date(
      Date.now() - DEDUPE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const result = await this.hasura.executeQuery<{
      admin_broadcast_retargets_aggregate: { aggregate: { count: number } };
    }>(
      `query Dedupe($ids: [uuid!]!, $hash: String!, $since: timestamptz!) {
        admin_broadcast_retargets_aggregate(
          where: {
            user_id: { _in: $ids }
            message_hash: { _eq: $hash }
            last_sent_at: { _gte: $since }
          }
        ) { aggregate { count } }
      }`,
      { ids: userIds, hash: messageHash, since }
    );
    return result.admin_broadcast_retargets_aggregate?.aggregate?.count ?? 0;
  }

  async wasRecentlyTargeted(
    userId: string,
    messageHash: string
  ): Promise<boolean> {
    const since = new Date(
      Date.now() - DEDUPE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const result = await this.hasura.executeQuery<{
      admin_broadcast_retargets: Array<{ user_id: string }>;
    }>(
      `query One($userId: uuid!, $hash: String!, $since: timestamptz!) {
        admin_broadcast_retargets(
          where: {
            user_id: { _eq: $userId }
            message_hash: { _eq: $hash }
            last_sent_at: { _gte: $since }
          }
          limit: 1
        ) { user_id }
      }`,
      { userId, hash: messageHash, since }
    );
    return (result.admin_broadcast_retargets?.length ?? 0) > 0;
  }

  private mapUsers(
    rows: Array<{
      id: string;
      preferred_language?: string | null;
      mobile_push_tokens?: Array<{ id: string }>;
    }>
  ): BroadcastAudienceUser[] {
    const seen = new Set<string>();
    const out: BroadcastAudienceUser[] = [];
    for (const row of rows) {
      if (!row?.id || seen.has(row.id)) continue;
      seen.add(row.id);
      out.push({
        userId: row.id,
        preferredLanguage: row.preferred_language === 'en' ? 'en' : 'fr',
        hasPushToken: (row.mobile_push_tokens?.length ?? 0) > 0,
      });
    }
    return out;
  }

  private countryFilter(countries?: string[]) {
    if (!countries?.length) return undefined;
    return {
      address: {
        is_primary: { _eq: true },
        status: { _eq: 'active' },
        country: { _in: countries.map((c) => c.toUpperCase()) },
      },
    };
  }

  private async queryBusinessUsers(
    filters?: BroadcastAudienceFiltersDto
  ): Promise<BroadcastAudienceUser[]> {
    const where: Record<string, unknown> = {};
    if (filters?.lifecycleStatuses?.length) {
      where.lifecycle_status = { _in: filters.lifecycleStatuses };
    }
    if (filters?.isStorefrontVisible !== undefined) {
      where.is_storefront_visible = { _eq: filters.isStorefrontVisible };
    }
    if (filters?.canAcceptOrders !== undefined) {
      where.can_accept_orders = { _eq: filters.canAcceptOrders };
    }
    const addr = this.countryFilter(filters?.countries);
    if (addr) where.business_addresses = addr;

    const result = await this.hasura.executeQuery<{
      businesses: Array<{
        user: {
          id: string;
          preferred_language?: string | null;
          mobile_push_tokens: Array<{ id: string }>;
        };
      }>;
    }>(
      `query Biz($where: businesses_bool_exp) {
        businesses(where: $where, order_by: { id: asc }) {
          user {
            id
            preferred_language
            mobile_push_tokens(limit: 1) { id }
          }
        }
      }`,
      { where }
    );
    return this.mapUsers((result.businesses ?? []).map((b) => b.user));
  }

  private async queryAgentUsers(
    filters?: BroadcastAudienceFiltersDto
  ): Promise<BroadcastAudienceUser[]> {
    const where: Record<string, unknown> = {};
    if (filters?.isAvailable !== undefined) {
      where.is_available = { _eq: filters.isAvailable };
    }
    const addr = this.countryFilter(filters?.countries);
    if (addr) where.agent_addresses = addr;

    const result = await this.hasura.executeQuery<{
      agents: Array<{
        user: {
          id: string;
          preferred_language?: string | null;
          mobile_push_tokens: Array<{ id: string }>;
        };
      }>;
    }>(
      `query Agents($where: agents_bool_exp) {
        agents(where: $where, order_by: { id: asc }) {
          user {
            id
            preferred_language
            mobile_push_tokens(limit: 1) { id }
          }
        }
      }`,
      { where }
    );
    return this.mapUsers((result.agents ?? []).map((a) => a.user));
  }

  private async queryClientUsers(
    filters?: BroadcastAudienceFiltersDto
  ): Promise<BroadcastAudienceUser[]> {
    const where: Record<string, unknown> = {};
    const addr = this.countryFilter(filters?.countries);
    if (addr) where.client_addresses = addr;

    const result = await this.hasura.executeQuery<{
      clients: Array<{
        user: {
          id: string;
          preferred_language?: string | null;
          mobile_push_tokens: Array<{ id: string }>;
        };
      }>;
    }>(
      `query Clients($where: clients_bool_exp) {
        clients(where: $where, order_by: { id: asc }) {
          user {
            id
            preferred_language
            mobile_push_tokens(limit: 1) { id }
          }
        }
      }`,
      { where }
    );
    return this.mapUsers((result.clients ?? []).map((c) => c.user));
  }

  private async queryEveryoneUsers(
    filters?: BroadcastAudienceFiltersDto
  ): Promise<BroadcastAudienceUser[]> {
    const [business, agent, client] = await Promise.all([
      this.queryBusinessUsers(filters),
      this.queryAgentUsers(filters),
      this.queryClientUsers(filters),
    ]);
    const seen = new Set<string>();
    const out: BroadcastAudienceUser[] = [];
    for (const u of [...business, ...agent, ...client]) {
      if (seen.has(u.userId)) continue;
      seen.add(u.userId);
      out.push(u);
    }
    return out;
  }
}
