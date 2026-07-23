import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface MessageThread {
  id: string;
  subject: string | null;
  created_by_user_id: string;
  recipient_user_id: string;
  last_message_at: string;
  creator_last_read_at: string | null;
  recipient_last_read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThreadMessage {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
}

interface ParticipantSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface ThreadRow extends MessageThread {
  creator?: ParticipantSummary;
  recipient?: ParticipantSummary;
  messages?: ThreadMessage[];
}

@Injectable()
export class ThreadsService {
  private readonly logger = new Logger(ThreadsService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly notifications: NotificationsService
  ) {}

  async createThread(params: {
    senderUserId: string;
    recipientUserId: string;
    body: string;
    subject?: string;
  }): Promise<{ thread: MessageThread; message: ThreadMessage }> {
    const { senderUserId, recipientUserId, body, subject } = params;
    const now = new Date().toISOString();

    const threadResult = await this.hasura.executeMutation<{
      insert_message_threads_one: MessageThread;
    }>(
      `mutation CreateThread($senderUserId: uuid!, $recipientUserId: uuid!, $subject: String, $now: timestamptz!) {
        insert_message_threads_one(object: {
          created_by_user_id: $senderUserId,
          recipient_user_id: $recipientUserId,
          subject: $subject,
          last_message_at: $now,
          creator_last_read_at: $now
        }) {
          id subject created_by_user_id recipient_user_id last_message_at
          creator_last_read_at recipient_last_read_at created_at updated_at
        }
      }`,
      { senderUserId, recipientUserId, subject: subject ?? null, now }
    );

    const thread = threadResult.insert_message_threads_one;

    const msgResult = await this.hasura.executeMutation<{
      insert_thread_messages_one: ThreadMessage;
    }>(
      `mutation CreateThreadMessage($threadId: uuid!, $senderUserId: uuid!, $body: String!) {
        insert_thread_messages_one(object: {
          thread_id: $threadId, sender_user_id: $senderUserId, body: $body
        }) { id thread_id sender_user_id body created_at }
      }`,
      { threadId: thread.id, senderUserId, body }
    );

    const message = msgResult.insert_thread_messages_one;
    void this.firePush(recipientUserId, senderUserId, thread.id);
    return { thread, message };
  }

  async listMyThreads(userId: string): Promise<ThreadRow[]> {
    const result = await this.hasura.executeQuery<{ message_threads: ThreadRow[] }>(
      `query ListMyThreads($userId: uuid!) {
        message_threads(
          where: { _or: [{ created_by_user_id: { _eq: $userId } }, { recipient_user_id: { _eq: $userId } }] }
          order_by: { last_message_at: desc }
        ) {
          id subject created_by_user_id recipient_user_id last_message_at
          creator_last_read_at recipient_last_read_at created_at updated_at
          creator { id first_name last_name email }
          recipient { id first_name last_name email }
          messages(order_by: { created_at: desc }, limit: 1) { id body created_at sender_user_id }
        }
      }`,
      { userId }
    );
    return result.message_threads;
  }

  async getThread(userId: string, threadId: string): Promise<ThreadRow> {
    const result = await this.hasura.executeQuery<{
      message_threads_by_pk: ThreadRow | null;
    }>(
      `query GetThread($threadId: uuid!) {
        message_threads_by_pk(id: $threadId) {
          id subject created_by_user_id recipient_user_id last_message_at
          creator_last_read_at recipient_last_read_at created_at updated_at
          creator { id first_name last_name email }
          recipient { id first_name last_name email }
          messages(order_by: { created_at: asc }) {
            id thread_id sender_user_id body created_at
          }
        }
      }`,
      { threadId }
    );

    const thread = result.message_threads_by_pk;
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.created_by_user_id !== userId && thread.recipient_user_id !== userId) {
      throw new ForbiddenException('Not a participant in this thread');
    }
    return thread;
  }

  async replyToThread(params: {
    userId: string;
    threadId: string;
    body: string;
  }): Promise<ThreadMessage> {
    const { userId, threadId, body } = params;
    const thread = await this.getThread(userId, threadId);
    const now = new Date().toISOString();

    await this.hasura.executeMutation(
      `mutation BumpThread($threadId: uuid!, $now: timestamptz!) {
        update_message_threads_by_pk(pk_columns: { id: $threadId }, _set: { last_message_at: $now, updated_at: $now }) { id }
      }`,
      { threadId, now }
    );

    const result = await this.hasura.executeMutation<{
      insert_thread_messages_one: ThreadMessage;
    }>(
      `mutation ReplyToThread($threadId: uuid!, $senderUserId: uuid!, $body: String!) {
        insert_thread_messages_one(object: {
          thread_id: $threadId, sender_user_id: $senderUserId, body: $body
        }) { id thread_id sender_user_id body created_at }
      }`,
      { threadId, senderUserId: userId, body }
    );

    const otherId =
      thread.created_by_user_id === userId
        ? thread.recipient_user_id
        : thread.created_by_user_id;
    void this.firePush(otherId, userId, threadId);
    return result.insert_thread_messages_one;
  }

  async markThreadRead(userId: string, threadId: string): Promise<void> {
    const thread = await this.getThread(userId, threadId);
    const now = new Date().toISOString();
    const field =
      thread.created_by_user_id === userId
        ? 'creator_last_read_at'
        : 'recipient_last_read_at';

    await this.hasura.executeMutation(
      `mutation MarkThreadRead($threadId: uuid!, $now: timestamptz!) {
        update_message_threads_by_pk(pk_columns: { id: $threadId }, _set: { ${field}: $now }) { id }
      }`,
      { threadId, now }
    );
  }

  private async firePush(
    recipientUserId: string,
    senderUserId: string,
    threadId: string
  ): Promise<void> {
    try {
      await this.notifications.sendUserThreadMessagePush({
        recipientUserId,
        senderUserId,
        threadId,
      });
    } catch (error: any) {
      this.logger.warn(`Thread push failed: ${error?.message ?? String(error)}`);
    }
  }
}
