import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OrderMessageComposer } from '@/components/messaging/OrderMessageComposer';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrderMessages } from '@/hooks/useOrderMessages';

export type OrderMessagesParams = {
  orderId: string;
  highlightMessageId?: string;
  draftMessage?: string;
};

type Props = NativeStackScreenProps<
  { OrderMessages: OrderMessagesParams; [key: string]: object | undefined },
  'OrderMessages'
>;

function formatWhen(locale: string, iso: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Full-screen order chat for client, agent, business, and delegate.
 * Back returns to the previous screen (typically order detail).
 */
export default function UserOrderMessagesScreen({ route, navigation }: Props) {
  const { orderId, highlightMessageId, draftMessage } = route.params;
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    messages,
    loading: msgLoading,
    error: msgError,
    sendMessage,
    refetch: refetchMsgs,
    markMessagesRead,
    mentionableParticipants,
  } = useOrderMessages(orderId);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('messages.orderMessages', 'Order messages'),
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginLeft: 8, paddingVertical: 4, justifyContent: 'center' }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
        </Pressable>
      ),
    });
  }, [navigation, t, colors.text.primary]);

  useEffect(() => {
    if (!messages.length) return;
    void markMessagesRead(messages[0].id);
  }, [messages, markMessagesRead]);

  const chronological = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = useCallback(
    async (message: string, mentionedUserId?: string) => {
      return sendMessage(message, mentionedUserId);
    },
    [sendMessage]
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <OrderMessageComposer
        messages={chronological}
        loading={msgLoading}
        error={msgError}
        mentionableParticipants={mentionableParticipants}
        onSend={handleSend}
        formatDate={(iso) => formatWhen(locale, iso)}
        highlightMessageId={highlightMessageId}
        onRefresh={() => void refetchMsgs()}
        refreshing={msgLoading}
        showAllMessages
        layout="page"
        contentPaddingBottom={insets.bottom}
        orderId={orderId}
        emptyHint={t(
          'messages.emptyHint',
          'Write below to chat with the store or delivery person.'
        )}
        initialDraft={draftMessage}
        onQuickMessageError={(message) => Alert.alert(t('common.error'), message)}
        onQuickMessageSuccess={(message) =>
          Alert.alert(t('common.success', 'Success'), message)
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
