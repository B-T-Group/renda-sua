import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AssistantMarkdownText } from '@/components/common/AssistantMarkdownText';
import { AppTextInput } from '@/components/common/AppTextInput';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/stores/RootStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { spacing, borderRadius } from '@/theme/spacing';
import { motion, motionDuration } from '@/theme/motion';
import { postAssistantChat, type AssistantChatMessagePayload } from '@/services/assistantApi';
import type { AssistantMessage } from '@/stores/AssistantStore';

const MAX_API_MESSAGES = 20;

function MiniOrb({ size = 36 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.miniOrb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.info.main,
        },
      ]}
    >
      <MaterialIcons name="smart-toy" size={size * 0.6} color={colors.primary.contrast} />
    </View>
  );
}

function TypingIndicator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const duration = motionDuration('normal', reduceMotion);

  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const createLoop = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 320, useNativeDriver: true }),
          Animated.delay(Math.max(0, 560 - delay)),
        ])
      );
    };
    const loop1 = createLoop(dot1, 0);
    const loop2 = createLoop(dot2, 160);
    const loop3 = createLoop(dot3, 320);
    loop1.start();
    loop2.start();
    loop3.start();
    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
    };
  }, [dot1, dot2, dot3, reduceMotion]);

  const dotStyle = (anim: Animated.Value) => ({
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
    backgroundColor: colors.text.muted,
    opacity: reduceMotion ? 0.5 : anim,
  });

  return (
    <View
      style={[
        styles.typingRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={t('assistant.thinking', 'Thinking…')}
    >
      <View style={styles.typingDots}>
        <Animated.View style={dotStyle(dot1)} />
        <Animated.View style={dotStyle(dot2)} />
        <Animated.View style={dotStyle(dot3)} />
      </View>
    </View>
  );
}

function MessageBubble({ item, isUser }: { item: AssistantMessage; isUser: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const duration = motionDuration('normal', reduceMotion);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  }, [anim, duration]);

  return (
    <Animated.View
      style={[
        styles.bubbleWrap,
        {
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          opacity: reduceMotion ? 1 : anim,
          transform: reduceMotion
            ? []
            : [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
        },
      ]}
    >
      {!isUser && <MiniOrb size={36} />}
      <View
        style={[
          styles.bubble,
          isUser
            ? {
                backgroundColor: colors.primary.main,
                borderBottomRightRadius: 4,
              }
            : {
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderBottomLeftRadius: 4,
              },
        ]}
      >
        {isUser ? (
          <Text style={[styles.bubbleText, { color: colors.primary.contrast }]}>
            {item.content}
          </Text>
        ) : (
          <AssistantMarkdownText
            content={item.content}
            color={colors.text.primary}
            style={styles.bubbleText}
          />
        )}
      </View>
    </Animated.View>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const store = useStore();
  const firstName = store.auth.user?.firstName;
  const nameParam = firstName ? `, ${firstName}` : '';

  return (
    <View style={styles.empty}>
      <MiniOrb size={88} />
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
        {t('assistant.emptyTitle', {
          defaultValue: 'Hi{{name}}! What do you need today?',
          name: nameParam,
        })}
      </Text>
      <View style={styles.chips}>
        {SUGGESTIONS.map((item) => {
          const label = t(item.key, item.fallback);
          return (
            <Pressable
              key={item.key}
              onPress={() => onPick(label)}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.primary.main }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const SUGGESTIONS = [
  { key: 'assistant.suggestion.location', fallback: 'Where are you located?' },
  {
    key: 'assistant.suggestion.payDelivery',
    fallback: 'Do you support payment at delivery?',
  },
  {
    key: 'assistant.suggestion.pickup',
    fallback: 'Do you support in-store pickup?',
  },
  {
    key: 'assistant.suggestion.mobilePay',
    fallback: 'Do you support mobile payments?',
  },
] as const;

const AssistantChatScreen = observer(function AssistantChatScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const store = useStore();
  const { assistant } = store;
  const listRef = useRef<FlatList<AssistantMessage>>(null);
  const [draft, setDraft] = useState('');
  const requestIdRef = useRef(0);

  const onSend = useCallback(
    async (override?: string) => {
      const text = (override ?? draft).trim();
      if (!text || assistant.isSending) return;
      setDraft('');
      assistant.addUserMessage(text);
      assistant.setIsSending(true);
      assistant.setError(null);
      const requestId = ++requestIdRef.current;

      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

      try {
        const payload: AssistantChatMessagePayload[] = assistant.messages
          .slice(-MAX_API_MESSAGES)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));
        const data = await postAssistantChat(payload);
        if (requestId !== requestIdRef.current) return;
        if (data.reply?.trim()) {
          assistant.addAssistantMessage(data.reply.trim());
        }
        if (data.handoff) assistant.setHandoff(true);
      } catch (e: any) {
        if (requestId !== requestIdRef.current) return;
        assistant.setError(e?.message ?? 'Failed to reach the assistant');
      } finally {
        if (requestId === requestIdRef.current) {
          assistant.setIsSending(false);
        }
      }
    },
    [assistant, draft]
  );

  const renderItem = useCallback(
    ({ item }: { item: AssistantMessage }) => (
      <View style={styles.messageRow}>
        <MessageBubble item={item} isUser={item.role === 'user'} />
      </View>
    ),
    []
  );

  const onRetry = useCallback(() => {
    assistant.setError(null);
    if (assistant.messages.length > 0) {
      const last = assistant.messages[assistant.messages.length - 1];
      if (last.role === 'user') {
        void onSend(last.content);
      }
    }
  }, [assistant, onSend]);

  const onOpenWhatsApp = useCallback(() => {
    void Linking.openURL('https://wa.me/18556488855');
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.pageBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        ref={listRef}
        data={assistant.messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={<EmptyState onPick={(text) => void onSend(text)} />}
        ListFooterComponent={assistant.isSending ? <TypingIndicator /> : null}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {assistant.handoff ? (
        <View
          style={[
            styles.banner,
            {
              borderColor: colors.info.light,
              backgroundColor: colors.infoTint,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="face-agent"
            size={20}
            color={colors.info.main}
            style={styles.bannerIcon}
          />
          <View style={styles.bannerText}>
            <Text style={[styles.bannerTitle, { color: colors.info.main }]}>
              {t('assistant.handoffTitle', 'A team member will help you')}
            </Text>
            <Text style={[styles.bannerBody, { color: colors.text.secondary }]}>
              {t(
                'assistant.handoffBody',
                'Continue on WhatsApp. We usually reply within 1 hour.'
              )}
            </Text>
            <Pressable
              onPress={onOpenWhatsApp}
              style={({ pressed }) => [
                styles.bannerButton,
                {
                  backgroundColor: colors.info.main,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.bannerButtonText, { color: colors.primary.contrast }]}>
                {t('assistant.handoffButton', 'Open WhatsApp')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {assistant.error ? (
        <View
          style={[
            styles.banner,
            {
              borderColor: colors.error.light,
              backgroundColor: colors.errorTint,
            },
          ]}
        >
          <Text style={[styles.errorText, { color: colors.error.main }]}>
            {t('assistant.errorGeneric', 'Message not sent. Check your connection.')}
          </Text>
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: colors.error.main,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.retryButtonText, { color: colors.primary.contrast }]}>
              {t('assistant.errorRetry', 'Retry')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View
        style={[
          styles.composer,
          {
            borderTopColor: colors.divider,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <AppTextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t(
            'assistant.placeholder',
            'Ask about an item, order or delivery…'
          )}
          multiline
          disabled={assistant.isSending}
          onSubmitEditing={() => void onSend()}
          blurOnSubmit={false}
          containerStyle={[
            styles.input,
            {
              backgroundColor: colors.surfaceInput,
            },
          ]}
        />
        <Pressable
          onPress={() => void onSend()}
          disabled={assistant.isSending || !draft.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: colors.primary.main,
              opacity: assistant.isSending || !draft.trim() ? 0.35 : pressed ? 0.8 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('assistant.send', 'Send')}
        >
          <MaterialIcons name="send" size={20} color={colors.primary.contrast} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
});

export default AssistantChatScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  listContent: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.s20 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s20,
    paddingTop: spacing.lg,
  },
  emptyTitle: {
    fontWeight: '700',
    fontSize: 18,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  chip: {
    borderWidth: 1,
    borderRadius: borderRadius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  messageRow: { marginBottom: spacing.sm },
  bubbleWrap: {
    maxWidth: '80%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  miniOrb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    flex: 1,
    borderRadius: borderRadius.card,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm - 1,
  },
  bubbleText: { lineHeight: 22, fontSize: 15 },
  typingRow: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  typingDots: { flexDirection: 'row', alignItems: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
  },
  bannerIcon: { marginRight: spacing.xs },
  bannerText: { flex: 1 },
  bannerTitle: { fontWeight: '700', fontSize: 13 },
  bannerBody: { fontSize: 12, marginTop: 2 },
  bannerButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.button,
    alignSelf: 'flex-start',
  },
  bannerButtonText: { fontSize: 13, fontWeight: '600' },
  errorText: { flex: 1, fontSize: 12 },
  retryButton: {
    paddingVertical: spacing.xs - 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.button,
    marginLeft: spacing.xs,
  },
  retryButtonText: { fontSize: 12, fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: borderRadius.input,
    minHeight: 48,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
