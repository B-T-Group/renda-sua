import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useThread } from '../../hooks/useThread';
import { useProfileMe } from '../../hooks/useProfileMe';
import type { ThreadMessage } from '../../types/threads';

type Params = { threadId: string };
type Props = NativeStackScreenProps<{ ThreadDetail: Params }, 'ThreadDetail'>;

function MessageBubble({
  msg,
  isOwn,
}: {
  msg: ThreadMessage;
  isOwn: boolean;
}) {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const time = new Date(msg.created_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isOwn ? colors.primary.main : colors.surface,
            borderColor: isOwn ? colors.primary.main : colors.divider,
            borderRadius: borderRadius.md,
            padding: spacing.sm,
          },
        ]}
      >
        <Text
          style={[
            typography.body2,
            { color: isOwn ? '#fff' : colors.text.primary },
          ]}
        >
          {msg.body}
        </Text>
        <Text
          style={[
            typography.caption,
            { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.text.disabled, marginTop: 4, alignSelf: 'flex-end' },
          ]}
        >
          {time}
        </Text>
      </View>
    </View>
  );
}

export default function ThreadDetailScreen({ route, navigation }: Props) {
  const { threadId } = route.params;
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useProfileMe();
  const { thread, loading, sending, error, reply } = useThread(threadId);
  const [draftBody, setDraftBody] = useState('');
  const listRef = useRef<FlatList<ThreadMessage>>(null);

  const handleSend = useCallback(async () => {
    const text = draftBody.trim();
    if (!text || sending) return;
    setDraftBody('');
    await reply(text);
    listRef.current?.scrollToEnd({ animated: true });
  }, [draftBody, sending, reply]);

  const currentUserId = me?.id ?? '';
  const messages = thread?.messages ?? [];

  const other = thread
    ? thread.created_by_user_id === currentUserId
      ? thread.recipient
      : thread.creator
    : null;
  const otherName = other
    ? `${other.first_name ?? ''} ${other.last_name ?? ''}`.trim() || other.email
    : t('messages.unknownSender', 'Unknown');

  if (loading && !thread) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error && !thread) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground, padding: spacing.lg }]}>
        <Text style={{ color: colors.error.main }}>{error}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.divider,
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.sm,
          },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.subheading, { color: colors.text.primary }]} numberOfLines={1}>
            {thread?.subject ?? otherName}
          </Text>
          {thread?.subject ? (
            <Text style={[typography.caption, { color: colors.text.secondary }]} numberOfLines={1}>
              {otherName}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Messages list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{
          padding: spacing.md,
          gap: spacing.sm,
          paddingBottom: spacing.sm,
        }}
        renderItem={({ item }) => (
          <MessageBubble msg={item} isOwn={item.sender_user_id === currentUserId} />
        )}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center' }]}>
              {t('messages.noReplies', 'No messages yet. Start the conversation!')}
            </Text>
          </View>
        }
      />

      {/* Composer */}
      <View
        style={[
          styles.composer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.pageBackground,
              borderColor: colors.divider,
              borderRadius: borderRadius.sm,
              color: colors.text.primary,
              padding: spacing.sm,
            },
          ]}
          placeholder={t('messages.replyPlaceholder', 'Write a reply…')}
          placeholderTextColor={colors.text.disabled}
          value={draftBody}
          onChangeText={setDraftBody}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={handleSend}
          disabled={!draftBody.trim() || sending}
          style={[
            styles.sendBtn,
            {
              backgroundColor: draftBody.trim() && !sending ? colors.primary.main : colors.divider,
              borderRadius: borderRadius.sm,
              padding: spacing.sm,
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator size={20} color="#fff" />
          ) : (
            <MaterialCommunityIcons name="send" size={20} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: { padding: 4 },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    borderWidth: 1,
  },
  emptyList: { alignItems: 'center', paddingVertical: 40 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1 },
  sendBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
