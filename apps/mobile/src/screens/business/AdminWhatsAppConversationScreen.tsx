import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WhatsAppInboxMessageBubble } from '../../components/admin/WhatsAppInboxMessageBubble';
import { useTheme } from '../../contexts/ThemeContext';
import { useWhatsAppInboxThread } from '../../hooks/useWhatsAppInboxThread';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type { WhatsAppInboxMessage } from '../../types/whatsappInbox';

type Props = NativeStackScreenProps<
  BusinessRootStackParamList,
  'AdminWhatsAppConversation'
>;

export default function AdminWhatsAppConversationScreen({
  navigation,
  route,
}: Props) {
  const { conversationId } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, typography, spacing } = useTheme();
  const thread = useWhatsAppInboxThread(conversationId);
  const [draft, setDraft] = useState('');

  const title = useMemo(() => {
    const c = thread.conversation;
    if (!c) return t('admin.whatsappInbox.conversationTitle', 'Conversation');
    return c.userDisplayName || `+${c.customerPhone.replace(/^\+/, '')}`;
  }, [t, thread.conversation]);

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const onSend = useCallback(async () => {
    const ok = await thread.sendReply(draft);
    if (ok) setDraft('');
  }, [draft, thread]);

  const renderMessage = useCallback(
    ({ item }: { item: WhatsAppInboxMessage }) => (
      <WhatsAppInboxMessageBubble message={item} />
    ),
    []
  );

  if (thread.profileLoading || (thread.loading && !thread.conversation)) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!thread.canAccess) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text style={{ color: colors.text.primary, textAlign: 'center' }}>
          {t('admin.whatsappInbox.accessDenied', 'Access denied')}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <FlatList
        data={thread.messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.lg,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={thread.refreshing}
            onRefresh={thread.refresh}
          />
        }
        ListEmptyComponent={
          <Text
            style={[
              typography.body2,
              { color: colors.text.secondary, textAlign: 'center' },
            ]}
          >
            {thread.error ||
              t('admin.whatsappInbox.emptyThread', 'No messages in this thread')}
          </Text>
        }
      />

      <View
        style={[
          styles.composer,
          {
            borderTopColor: colors.divider,
            backgroundColor: colors.background.paper,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
          },
        ]}
      >
        {!thread.canReply ? (
          <Text
            style={[
              typography.caption,
              { color: colors.text.secondary, marginBottom: spacing.xs },
            ]}
          >
            {t(
              'admin.whatsappInbox.sessionExpiredHelp',
              'The 24-hour reply window has ended. Wait for the customer to message again.'
            )}
          </Text>
        ) : null}
        {thread.sendError ? (
          <Text
            style={[
              typography.caption,
              { color: colors.error.main, marginBottom: spacing.xs },
            ]}
          >
            {thread.sendError}
          </Text>
        ) : null}
        <View style={styles.composerRow}>
          <TextInput
            mode="outlined"
            value={draft}
            onChangeText={setDraft}
            placeholder={t(
              'admin.whatsappInbox.replyPlaceholder',
              'Type a reply…'
            )}
            disabled={!thread.canReply || thread.sending}
            style={{ flex: 1 }}
            dense
          />
          <Button
            mode="contained"
            onPress={() => void onSend()}
            disabled={!thread.canReply || thread.sending || !draft.trim()}
            loading={thread.sending}
            style={{ marginLeft: spacing.sm }}
          >
            {t('admin.whatsappInbox.send', 'Send')}
          </Button>
        </View>
        {thread.conversation?.status === 'open' ? (
          <Button
            mode="text"
            onPress={() => void thread.closeConversation()}
            style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
          >
            {t('admin.whatsappInbox.closeConversation', 'Close conversation')}
          </Button>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth },
  composerRow: { flexDirection: 'row', alignItems: 'center' },
});
