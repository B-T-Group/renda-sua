import { useCallback, useEffect, useState } from 'react';
import { useGraphQLClient } from './useGraphQLClient';
import { useUserProfile } from './useUserProfile';

export interface EntityType {
  id: string;
  comment: string;
}

export interface UserMessage {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  message: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  entity_type_info?: EntityType;
}

export interface MessageFilters {
  entity_type?: string;
  entity_id?: string;
  search?: string;
}

export const useUserMessages = () => {
  const { client } = useGraphQLClient();
  const { profile: user } = useUserProfile();
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch entity types
  const fetchEntityTypes = useCallback(async () => {
    if (!client) return;

    try {
      const query = `
        query GetEntityTypes {
          entity_types {
            id
            comment
          }
        }
      `;

      const response = await client.request(query);
      setEntityTypes(response.entity_types || []);
    } catch (err) {
      console.error('Error fetching entity types:', err);
      setError('Failed to fetch entity types');
    }
  }, [client]);

  // Fetch user messages
  const fetchMessages = useCallback(
    async (filters?: MessageFilters) => {
      if (!client) return;

      setLoading(true);
      setError(null);

      try {
        let whereClause: any = {};

        if (filters) {
          if (filters.entity_type) {
            whereClause.entity_type = { _eq: filters.entity_type };
          }

          if (filters.entity_id) {
            whereClause.entity_id = { _eq: filters.entity_id };
          }

          if (filters.search) {
            whereClause.message = { _ilike: `%${filters.search}%` };
          }
        }

        // For business admins, show all messages. For others, show only their own
        if (user?.user_type_id === 'business' && user?.business?.is_admin) {
          // Business admins can see all messages - no user_id filter
        } else {
          // Regular users can only see their own messages
          whereClause.user_id = { _eq: user?.id };
        }

        const query = `
          query GetUserMessages($where: user_messages_bool_exp!) {
            user_messages(where: $where, order_by: {created_at: desc}) {
              id
              user_id
              entity_type
              entity_id
              message
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

        const result = await client.request(query, { where: whereClause });
        setMessages(result.user_messages || []);
      } catch (err) {
        console.error('Error fetching messages:', err);
        setError('Failed to fetch messages');
      } finally {
        setLoading(false);
      }
    },
    [client, user?.id, user?.user_type_id, user?.business?.is_admin]
  );

  // Create a new message
  const createMessage = useCallback(
    async (entityType: string, entityId: string, message: string) => {
      if (!client || !user?.id) return false;

      try {
        const mutation = `
          mutation CreateUserMessage($user_id: uuid!, $entity_type: String!, $entity_id: uuid!, $message: String!) {
            insert_user_messages_one(object: {
              user_id: $user_id,
              entity_type: $entity_type,
              entity_id: $entity_id,
              message: $message
            }) {
              id
              user_id
              entity_type
              entity_id
              message
              created_at
            }
          }
        `;

        const result = await client.request(mutation, {
          user_id: user.id,
          entity_type: entityType,
          entity_id: entityId,
          message,
        });

        if (result.insert_user_messages_one) {
          // Add to local state
          setMessages((prev) => [result.insert_user_messages_one, ...prev]);
          return true;
        }

        return false;
      } catch (err) {
        console.error('Error creating message:', err);
        setError('Failed to create message');
        return false;
      }
    },
    [client, user?.id]
  );

  // Update a message
  const updateMessage = useCallback(
    async (messageId: string, message: string) => {
      if (!client) return false;

      try {
        const mutation = `
          mutation UpdateUserMessage($id: uuid!, $message: String!) {
            update_user_messages_by_pk(
              pk_columns: { id: $id }
              _set: { message: $message }
            ) {
              id
              message
              updated_at
            }
          }
        `;

        const result = await client.request(mutation, {
          id: messageId,
          message,
        });

        if (result.update_user_messages_by_pk) {
          // Update local state
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? {
                    ...msg,
                    message: result.update_user_messages_by_pk.message,
                    updated_at: result.update_user_messages_by_pk.updated_at,
                  }
                : msg
            )
          );
          return true;
        }

        return false;
      } catch (err) {
        console.error('Error updating message:', err);
        setError('Failed to update message');
        return false;
      }
    },
    [client]
  );

  // Delete a message
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!client) return false;

      try {
        const mutation = `
          mutation DeleteUserMessage($id: uuid!) {
            delete_user_messages_by_pk(id: $id) {
              id
            }
          }
        `;

        const result = await client.request(mutation, { id: messageId });

        if (result.delete_user_messages_by_pk) {
          // Remove from local state
          setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
          return true;
        }

        return false;
      } catch (err) {
        console.error('Error deleting message:', err);
        setError('Failed to delete message');
        return false;
      }
    },
    [client]
  );

  // Get messages for a specific entity
  const getMessagesForEntity = useCallback(
    (entityType: string, entityId: string) => {
      return messages.filter(
        (msg) => msg.entity_type === entityType && msg.entity_id === entityId
      );
    },
    [messages]
  );

  // Format date
  const formatDate = useCallback((dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Load initial data
  useEffect(() => {
    fetchEntityTypes();
    fetchMessages();
  }, [fetchEntityTypes, fetchMessages]);

  return {
    messages,
    entityTypes,
    loading,
    error,
    fetchMessages,
    createMessage,
    updateMessage,
    deleteMessage,
    getMessagesForEntity,
    formatDate,
  };
};
