import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { agentApi, type UserMessage } from '../../services/agentApi';
import { useThreads } from '../../hooks/useThreads';
import { useProfileMe } from '../../hooks/useProfileMe';
import { useNotificationNavigation } from '../../hooks/useNotificationNavigation';
import type { ThreadListItem } from '../../types/threads';
import { resolveMessageText } from '../../utils/resolveMessageText';

type AnyNavigation = NativeStackNavigationProp<{ ThreadDetail: { threadId: string }; [key: string]: any }>;

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ConversationRow({ thread, currentUserId }: { thread: ThreadListItem; currentUserId: string }) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const navigation = useNavigation<AnyNavigation>();

  const other = thread.created_by_user_id === currentUserId ? thread.recipient : thread.creator;
  const otherName = other
    ? `${other.first_name ?? ''} ${other.last_name ?? ''}`.trim() || other.email
    : t('messages.unknownSender', 'Unknown');
  const lastMsg = thread.messages?.[0];
  const preview = lastMsg?.body ?? '';

  const isCreator = thread.created_by_user_id === currentUserId;
  const lastReadAt = isCreator ? thread.creator_last_read_at : thread.recipient_last_read_at;
  const hasUnread = lastMsg && (!lastReadAt || new Date(lastMsg.created_at) > new Date(lastReadAt));

  return (
    <Pressable
      onPress={() => navigation.navigate('ThreadDetail', { threadId: thread.id })}
      style={[
        styles.conversationRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primaryTint }]}>
        <MaterialCommunityIcons name="message-text-outline" size={22} color={colors.primary.main} />
        {hasUnread ? (
          <View style={[styles.unreadDot, { backgroundColor: colors.primary.main }]} />
        ) : null}
      </View>
      <View style={styles.convBody}>
        <View style={styles.convHeaderRow}>
          <Text
            style={[typography.body, { color: colors.text.primary, flex: 1, minWidth: 0 }]}
            numberOfLines={1}
          >
            {thread.subject ? `${thread.subject} · ${otherName}` : otherName}
          </Text>
          <Text style={[typography.caption, { color: colors.text.disabled }]}>
            {formatDate(thread.last_message_at)}
          </Text>
        </View>
        {preview ? (
          <Text
            style={[typography.body2, { color: colors.text.secondary, marginTop: 2 }]}
            numberOfLines={2}
          >
            {preview}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function EntityMessageRow({
  message,
  getNavTarget,
}: {
  message: UserMessage;
  getNavTarget: ReturnType<typeof useNotificationNavigation>;
}) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const displayText = resolveMessageText(message.message, t);
  const navTarget = getNavTarget(message);

  return (
    <Pressable
      onPress={() => navTarget?.navigate()}
      disabled={!navTarget}
      style={({ pressed }) => [
        styles.conversationRow,
        {
          backgroundColor: pressed && navTarget ? colors.pageBackground : colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
        },
      ]}
    >
      <View style={[styles.rowInner, { padding: spacing.md }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primaryTint }]}>
          <MaterialCommunityIcons name="message-text-outline" size={22} color={colors.primary.main} />
        </View>
        <View style={styles.convBody}>
          <View style={styles.convHeaderRow}>
            <Text style={[typography.caption, { color: colors.text.secondary, flex: 1 }]} numberOfLines={1}>
              {message.entity_type_info?.comment ?? message.entity_type}
            </Text>
            <Text style={[typography.caption, { color: colors.text.disabled }]}>
              {formatDate(message.created_at)}
            </Text>
          </View>
          <Text style={[typography.body2, { color: colors.text.primary, marginTop: 2 }]} numberOfLines={3}>
            {displayText}
          </Text>
        </View>
      </View>
      {navTarget ? (
        <View
          style={[
            styles.navCta,
            {
              borderTopColor: colors.divider,
              borderBottomLeftRadius: borderRadius.md,
              borderBottomRightRadius: borderRadius.md,
            },
          ]}
        >
          <Text style={[typography.caption, { color: colors.primary.main, fontWeight: '600', flex: 1 }]}>
            {t(`notifications.center.navLabel.${navTarget.label}`, 'View details')}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary.main} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function MessagesScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const { me } = useProfileMe();
  const getNavTarget = useNotificationNavigation();
  const [entityMessages, setEntityMessages] = useState<UserMessage[]>([]);
  const [entityLoading, setEntityLoading] = useState(true);
  const [entityError, setEntityError] = useState<string | null>(null);
  const { threads, loading: threadsLoading, refreshing, error: threadsError, refresh: refreshThreads } = useThreads();

  const fetchEntityMessages = useCallback(async () => {
    setEntityLoading(true);
    setEntityError(null);
    try {
      const res = await agentApi.messages.getMyMessages({ limit: 100 });
      setEntityMessages(res?.messages ?? []);
    } catch (e: any) {
      setEntityError(e?.message ?? t('common.error'));
      setEntityMessages([]);
    } finally {
      setEntityLoading(false);
    }
  }, [t]);

  useEffect(() => { void fetchEntityMessages(); }, [fetchEntityMessages]);

  const onRefresh = useCallback(() => {
    refreshThreads();
    void fetchEntityMessages();
  }, [refreshThreads, fetchEntityMessages]);

  const isLoading = (threadsLoading && threads.length === 0) || (entityLoading && entityMessages.length === 0);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  const hasConversations = threads.length > 0;
  const hasEntityMessages = entityMessages.length > 0;
  const currentUserId = me?.id ?? '';

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40, gap: spacing.sm }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary.main]} />
      }
      data={[]}
      renderItem={null}
      ListHeaderComponent={
        <>
          {/* Conversations section */}
          <Text style={[typography.subheading, { color: colors.text.primary, marginBottom: spacing.xs }]}>
            {t('messages.conversations', 'Conversations')}
          </Text>
          {threadsError ? (
            <Text style={[typography.body2, { color: colors.error.main, marginBottom: spacing.sm }]}>
              {threadsError}
            </Text>
          ) : !hasConversations ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
              <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center' }]}>
                {t('messages.noConversations', 'No conversations yet')}
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {threads.map((thread) => (
                <ConversationRow key={thread.id} thread={thread} currentUserId={currentUserId} />
              ))}
            </View>
          )}

          {/* Entity messages section */}
          <Text style={[typography.subheading, { color: colors.text.primary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
            {t('messages.entityMessages', 'Order & Document messages')}
          </Text>
          {entityError ? (
            <Text style={[typography.body2, { color: colors.error.main }]}>{entityError}</Text>
          ) : !hasEntityMessages ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
              <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center' }]}>
                {t('messages.noMessages', 'No messages yet')}
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {entityMessages.map((m) => (
                <EntityMessageRow key={m.id} message={m} getNavTarget={getNavTarget} />
              ))}
            </View>
          )}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  conversationRow: { borderWidth: 1, overflow: 'hidden' },
  rowInner: { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  convBody: { flex: 1, minWidth: 0 },
  convHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
});
