import { useCallback, useEffect, useState } from 'react';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { useApiClient } from './useApiClient';
import { useGraphQLClient } from './useGraphQLClient';

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

export const useUserMessages = (specificUserId?: string) => {
  const apiClient = useApiClient();
  const { client } = useGraphQLClient();
  const { profile: user } = useUserProfileContext();
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch entity types from backend
  const fetchEntityTypes = useCallback(async () => {
    if (!apiClient) return;

    try {
      const { data } = await apiClient.get<{
        success: boolean;
        entity_types: EntityType[];
      }>('/messages/entity-types');
      setEntityTypes(data.entity_types || []);
    } catch (err) {
      console.error('Error fetching entity types:', err);
      setError('Failed to fetch entity types');
    }
  }, [apiClient]);

  // Fetch user messages from backend (or admin API when viewing a specific user)
  const fetchMessages = useCallback(
    async (filters?: MessageFilters) => {
      if (!apiClient) return;

      setLoading(true);
      setError(null);

      try {
        if (specificUserId) {
          const { data } = await apiClient.get<{
            success: boolean;
            messages: UserMessage[];
          }>(`/admin/users/${specificUserId}/messages?page=1&limit=500`);
          setMessages(data.messages || []);
        } else {
          const params = new URLSearchParams();
          if (filters?.entity_type) params.set('entity_type', filters.entity_type);
          if (filters?.entity_id) params.set('entity_id', filters.entity_id);
          if (filters?.search) params.set('search', filters.search);
          const { data } = await apiClient.get<{
            success: boolean;
            messages: UserMessage[];
          }>(`/messages?${params.toString()}`);
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
        setError('Failed to fetch messages');
      } finally {
        setLoading(false);
      }
    },
    [apiClient, specificUserId]
  );

  // Create a new message
  const createMessage = useCallback(
    async (entityType: string, entityId: string, message: string) => {
      if (!client || !user?.id) return false;

      try {
        const mutation = `
          mutation CreateUserMessage($user_id: uuid!, $entity_type: entity_types_enum!, $entity_id: uuid!, $message: String!) {
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
