import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type SupportTicketType = 'dispute' | 'complaint' | 'question';
export type SupportTicketStatus = 'open' | 'in_review' | 'resolved';

export interface CreateTicketDto {
  orderId: string;
  type: SupportTicketType;
  subject: string;
  description?: string;
}

export interface SupportTicket {
  id: string;
  order_id: string;
  user_id: string;
  type: string;
  status: string;
  subject: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  order?: { order_number: string };
}

@Injectable()
export class SupportService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async createTicket(
    userIdentifier: string,
    dto: CreateTicketDto
  ): Promise<SupportTicket> {
    const userQuery = `
      query GetUserByIdentifier($identifier: String!) {
        users(where: { identifier: { _eq: $identifier } }, limit: 1) {
          id
        }
      }
    `;
    const userResult = await this.hasuraSystemService.executeQuery(userQuery, {
      identifier: userIdentifier,
    });
    const users = (userResult?.users as { id: string }[]) ?? [];
    if (users.length === 0) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    const userId = users[0].id;

    const mutation = `
      mutation InsertSupportTicket($object: support_tickets_insert_input!) {
        insert_support_tickets_one(object: $object) {
          id
          order_id
          user_id
          type
          status
          subject
          description
          created_at
          updated_at
          resolved_at
          resolved_by
        }
      }
    `;
    const result = await this.hasuraSystemService.executeMutation(mutation, {
      object: {
        order_id: dto.orderId,
        user_id: userId,
        type: dto.type,
        subject: dto.subject,
        description: dto.description ?? null,
      },
    });
    const ticket = result?.insert_support_tickets_one;
    if (!ticket) {
      throw new HttpException(
        'Failed to create ticket',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return ticket as SupportTicket;
  }

  async getMyTickets(userIdentifier: string): Promise<SupportTicket[]> {
    const userQuery = `
      query GetUserByIdentifier($identifier: String!) {
        users(where: { identifier: { _eq: $identifier } }, limit: 1) {
          id
        }
      }
    `;
    const userResult = await this.hasuraSystemService.executeQuery(userQuery, {
      identifier: userIdentifier,
    });
    const users = (userResult?.users as { id: string }[]) ?? [];
    if (users.length === 0) return [];
    const userId = users[0].id;

    const query = `
      query GetSupportTickets($userId: uuid!) {
        support_tickets(
          where: { user_id: { _eq: $userId } }
          order_by: { created_at: desc }
        ) {
          id
          order_id
          user_id
          type
          status
          subject
          description
          created_at
          updated_at
          resolved_at
          resolved_by
          order {
            order_number
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      userId,
    });
    return (result?.support_tickets ?? []) as SupportTicket[];
  }

  async getTicketById(
    ticketId: string,
    userIdentifier: string
  ): Promise<SupportTicket | null> {
    const tickets = await this.getMyTickets(userIdentifier);
    return tickets.find((t) => t.id === ticketId) ?? null;
  }

  async updateTicketStatus(
    ticketId: string,
    status: SupportTicketStatus,
    resolvedByIdentifier?: string
  ): Promise<SupportTicket> {
    const set: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'resolved') {
      set.resolved_at = new Date().toISOString();
      if (resolvedByIdentifier) {
        const userQuery = `
          query GetUserByIdentifier($identifier: String!) {
            users(where: { identifier: { _eq: $identifier } }, limit: 1) {
              id
            }
          }
        `;
        const userResult = await this.hasuraSystemService.executeQuery(
          userQuery,
          { identifier: resolvedByIdentifier }
        );
        const users = (userResult?.users as { id: string }[]) ?? [];
        if (users.length > 0) set.resolved_by = users[0].id;
      }
    }

    const mutation = `
      mutation UpdateSupportTicket($id: uuid!, $set: support_tickets_set_input!) {
        update_support_tickets_by_pk(pk_columns: { id: $id }, _set: $set) {
          id
          order_id
          user_id
          type
          status
          subject
          description
          created_at
          updated_at
          resolved_at
          resolved_by
        }
      }
    `;
    const result = await this.hasuraSystemService.executeMutation(mutation, {
      id: ticketId,
      set,
    });
    const ticket = result?.update_support_tickets_by_pk;
    if (!ticket) {
      throw new HttpException(
        'Ticket not found or update failed',
        HttpStatus.NOT_FOUND
      );
    }
    return ticket as SupportTicket;
  }
}
