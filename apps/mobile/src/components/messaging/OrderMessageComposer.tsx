import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { MentionableParticipant, OrderMessage } from '../../services/agentApi';
import { useTheme } from '../../contexts/ThemeContext';
import { QuickMessageButtons } from '../orders/QuickMessageButtons';
import { MentionChip } from './MentionChip';
import { MentionInput } from './MentionInput';
import { MessageRenderer } from './MessageRenderer';

interface OrderMessageComposerProps {
  messages: OrderMessage[];
  loading: boolean;
  error: string | null;
  mentionableParticipants: MentionableParticipant[];
  participantsLoading?: boolean;
  onSend: (message: string, mentionedUserId?: string) => Promise<boolean>;
  formatDate: (date: string) => string;
  highlightMessageId?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  emptyHint?: string;
  /** When set, shows catalog quick-message buttons above the composer. */
  orderId?: string;
  orderStatus?: string | null;
  onQuickMessageError?: (message: string) => void;
  onQuickMessageSuccess?: (message: string) => void;
  /** When true, show the full thread (no 10-message cap). */
  showAllMessages?: boolean;
  /**
   * `page` = scrollable thread + composer pinned at the bottom (full-screen chat).
   * `embed` = inline list with composer below (default).
   */
  layout?: 'embed' | 'page';
  contentPaddingBottom?: number;
  /** Optional draft text to prefill the composer once. */
  initialDraft?: string | null;
}

export function OrderMessageComposer({
  messages,
  loading,
  error,
  mentionableParticipants,
  participantsLoading = false,
  onSend,
  formatDate,
  highlightMessageId,
  onRefresh,
  refreshing = false,
  emptyHint,
  orderId,
  orderStatus,
  onQuickMessageError,
  onQuickMessageSuccess,
  showAllMessages = false,
  layout = 'embed',
  contentPaddingBottom = 0,
  initialDraft = null,
}: OrderMessageComposerProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing } = useTheme();
  const [newMessage, setNewMessage] = useState(initialDraft?.trim() || '');
  const [sending, setSending] = useState(false);
  const [selectedMention, setSelectedMention] = useState<MentionableParticipant | null>(null);
  const isPage = layout === 'page';
  const scrollRef = useRef<ScrollView>(null);
  const highlightYRef = useRef<number | null>(null);
  const highlightDoneRef = useRef(false);
  const preferEndRef = useRef(true);

  useEffect(() => {
    const draft = initialDraft?.trim();
    if (draft) setNewMessage(draft);
  }, [initialDraft]);

  const canSend = !!newMessage.trim() && !sending;

  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const ok = await onSend(newMessage.trim(), selectedMention?.userId);
      if (ok) {
        setNewMessage('');
        setSelectedMention(null);
        preferEndRef.current = true;
        highlightDoneRef.current = true;
        requestAnimationFrame(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        });
      }
    } finally {
      setSending(false);
    }
  }, [newMessage, onSend, selectedMention, sending]);

  const displayMessages = showAllMessages
    ? Array.isArray(messages)
      ? messages
      : []
    : (Array.isArray(messages) ? messages : []).slice(0, 10);

  useEffect(() => {
    highlightDoneRef.current = false;
    preferEndRef.current = !highlightMessageId;
    highlightYRef.current = null;
  }, [highlightMessageId, orderId]);

  useEffect(() => {
    if (!isPage || displayMessages.length === 0) return;
    if (highlightMessageId && !highlightDoneRef.current) return;
    if (!preferEndRef.current) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
      preferEndRef.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, [isPage, displayMessages.length, highlightMessageId]);

  const threadBody = (
    <>
      {loading && !messages.length ? (
        <ActivityIndicator size="small" color={colors.primary.main} style={styles.spinner} />
      ) : null}

      {error ? (
        <Text
          style={[styles.errorText, { color: colors.error.main }, typography.caption]}
        >
          {error}
        </Text>
      ) : null}

      {displayMessages.length === 0 && !loading ? (
        <View
          style={[
            styles.emptyBox,
            {
              backgroundColor: colors.pageBackground,
              borderColor: colors.divider,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="message-text-outline"
            size={28}
            color={colors.text.secondary}
          />
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs }}
          >
            {t('messages.noMessages', 'No messages yet')}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 4 }}
          >
            {emptyHint ??
              t(
                'messages.emptyHint',
                'Write below to chat with the store or delivery person.'
              )}
          </Text>
        </View>
      ) : null}

      {displayMessages.map((m) => {
        const author =
          `${m.user?.first_name ?? ''} ${m.user?.last_name ?? ''}`.trim() ||
          t('common.user', 'User');
        const isHighlighted = highlightMessageId === m.id;
        return (
          <View
            key={m.id}
            onLayout={
              isHighlighted
                ? (e) => {
                    highlightYRef.current = e.nativeEvent.layout.y;
                    if (
                      isPage &&
                      !highlightDoneRef.current &&
                      !preferEndRef.current
                    ) {
                      highlightDoneRef.current = true;
                      scrollRef.current?.scrollTo({
                        y: Math.max(0, e.nativeEvent.layout.y - 24),
                        animated: true,
                      });
                    }
                  }
                : undefined
            }
            style={[
              styles.messageRow,
              { borderBottomColor: colors.divider },
              isHighlighted
                ? {
                    backgroundColor: colors.primaryTint,
                    borderRadius: borderRadius.sm,
                    padding: spacing.xs,
                  }
                : null,
            ]}
          >
            <View style={styles.messageMetaRow}>
              <Text
                style={[
                  styles.messageAuthor,
                  { color: colors.text.primary },
                  typography.caption,
                ]}
                numberOfLines={1}
              >
                {author}
              </Text>
              <Text
                style={[styles.messageDate, { color: colors.text.secondary }, typography.caption]}
              >
                {formatDate(m.created_at)}
              </Text>
            </View>
            {(m.mentions?.length
              ? m.mentions
              : m.mention
                ? [m.mention]
                : []
            ).map((mention) => (
              <View key={mention.mentionedUserId} style={styles.mentionRow}>
                <MentionChip
                  displayName={mention.displayName}
                  persona={mention.persona}
                />
              </View>
            ))}
            <View style={styles.messageTextWrap}>
              <MessageRenderer message={m} />
            </View>
          </View>
        );
      })}
    </>
  );

  const composer = (
    <View
      style={[
        styles.composerContainer,
        {
          marginTop: spacing.sm,
          paddingTop: spacing.sm,
          borderTopColor: colors.divider,
          backgroundColor: isPage ? colors.surface : undefined,
          paddingBottom: isPage ? contentPaddingBottom || spacing.sm : 0,
          paddingHorizontal: isPage ? spacing.md : 0,
        },
      ]}
    >
      {orderId ? (
        <QuickMessageButtons
          orderId={orderId}
          orderStatus={orderStatus}
          onSent={onRefresh}
          onError={onQuickMessageError}
          onSuccess={onQuickMessageSuccess}
        />
      ) : null}
      {selectedMention ? (
        <View style={styles.selectedMentionRow}>
          <MentionChip
            displayName={selectedMention.displayName}
            persona={selectedMention.persona}
            onRemove={() => setSelectedMention(null)}
          />
        </View>
      ) : null}

      <MentionInput
        value={newMessage}
        onChangeText={setNewMessage}
        mentionableParticipants={mentionableParticipants}
        participantsLoading={participantsLoading}
        onMentionSelect={setSelectedMention}
        disabled={sending}
        inputStyle={styles.composerInput}
      />

      <Button
        mode="contained"
        icon="send"
        onPress={() => void handleSend()}
        disabled={!canSend}
        loading={sending}
        style={styles.sendButton}
        contentStyle={styles.sendButtonContent}
      >
        {t('messages.send', 'Send')}
      </Button>

      {onRefresh ? (
        <Button
          mode="text"
          compact
          icon="refresh"
          onPress={onRefresh}
          loading={refreshing}
          textColor={colors.primary.main}
        >
          {t('common.refresh', 'Refresh')}
        </Button>
      ) : null}
    </View>
  );

  if (isPage) {
    return (
      <View style={styles.pageContainer}>
        <ScrollView
          ref={scrollRef}
          style={styles.pageThread}
          contentContainerStyle={{
            padding: spacing.md,
            flexGrow: 1,
            gap: 4,
          }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={colors.primary.main}
              />
            ) : undefined
          }
          onContentSizeChange={() => {
            if (preferEndRef.current) {
              scrollRef.current?.scrollToEnd({ animated: false });
              preferEndRef.current = false;
              return;
            }
            if (
              highlightMessageId &&
              highlightYRef.current != null &&
              !highlightDoneRef.current
            ) {
              highlightDoneRef.current = true;
              scrollRef.current?.scrollTo({
                y: Math.max(0, highlightYRef.current - 24),
                animated: false,
              });
            }
          }}
        >
          {threadBody}
        </ScrollView>
        {composer}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {threadBody}
      {composer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  pageContainer: { flex: 1, minHeight: 0 },
  pageThread: { flex: 1, minHeight: 0 },
  spinner: { alignSelf: 'center', marginVertical: 8 },
  errorText: { marginBottom: 4 },
  emptyBox: {
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 4,
  },
  messageRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  messageMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  messageAuthor: { fontWeight: '600', flex: 1, minWidth: 0 },
  messageDate: { flexShrink: 0 },
  mentionRow: { marginTop: 2 },
  messageTextWrap: { marginTop: 2 },
  composerContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  selectedMentionRow: { flexDirection: 'row' },
  composerInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  sendButton: { alignSelf: 'stretch' },
  sendButtonContent: { height: 44 },
});
