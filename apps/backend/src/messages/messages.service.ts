import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface GetMyMessagesFilters {
  entity_type?: string;
  entity_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UserMessageRow {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  message: string;
  read_at: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  entity_type_info?: {
    id: string;
    comment: string;
  };
}

@Injectable()
export class MessagesService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getMyMessages(
    userId: string,
    filters?: GetMyMessagesFilters
  ): Promise<{ messages: UserMessageRow[] }> {
    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 500, 500);
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {
      user_id: { _eq: userId },
    };
    if (filters?.entity_type) {
      where.entity_type = { _eq: filters.entity_type };
    }
    if (filters?.entity_id) {
      where.entity_id = { _eq: filters.entity_id };
    }
    if (filters?.search?.trim()) {
      where.message = { _ilike: `%${filters.search.trim()}%` };
    }

    const query = `
      query GetUserMessages($where: user_messages_bool_exp!, $limit: Int!, $offset: Int!) {
        user_messages(
          where: $where
          order_by: { created_at: desc }
          limit: $limit
          offset: $offset
        ) {
          id
          user_id
          entity_type
          entity_id
          message
          read_at
          created_at
          updated_at
          user {
            id
            first_name
            last_name
            email
          }
          entity_type_info {
            id
            comment
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      where,
      limit,
      offset,
    });

    const messages = (result?.user_messages ?? []) as UserMessageRow[];
    return { messages };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const query = `
      query GetUnreadCount($userId: uuid!) {
        user_messages_aggregate(
          where: { user_id: { _eq: $userId }, read_at: { _is_null: true } }
        ) { aggregate { count } }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, { userId });
    return result?.user_messages_aggregate?.aggregate?.count ?? 0;
  }

  async markRead(userId: string, messageId: string): Promise<void> {
    const mutation = `
      mutation MarkMessageRead($userId: uuid!, $id: uuid!, $now: timestamptz!) {
        update_user_messages(
          where: { id: { _eq: $id }, user_id: { _eq: $userId }, read_at: { _is_null: true } }
          _set: { read_at: $now }
        ) { affected_rows }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      userId,
      id: messageId,
      now: new Date().toISOString(),
    });
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const mutation = `
      mutation MarkAllMessagesRead($userId: uuid!, $now: timestamptz!) {
        update_user_messages(
          where: { user_id: { _eq: $userId }, read_at: { _is_null: true } }
          _set: { read_at: $now }
        ) { affected_rows }
      }
    `;
    const result = await this.hasuraSystemService.executeMutation(mutation, {
      userId,
      now: new Date().toISOString(),
    });
    return { count: result?.update_user_messages?.affected_rows ?? 0 };
  }

  async getEntityTypes(): Promise<{ id: string; comment: string }[]> {
    const query = `
      query GetEntityTypes {
        entity_types {
          id
          comment
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {});
    return result?.entity_types ?? [];
  }
}
