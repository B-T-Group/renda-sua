import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AssistantMarkdownText } from '@/components/common/AssistantMarkdownText';
import { AppTextInput } from '@/components/common/AppTextInput';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/stores/RootStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { spacing, borderRadius } from '@/theme/spacing';
import { motionDuration } from '@/theme/motion';
import { postAssistantChat } from '@/services/assistantApi';
import type { AssistantMessage } from '@/stores/AssistantStore';

const WHATSAPP_SUPPORT_NUMBER = '18556488855';
/** AC9: the composer grows with the text up to 4 rows, then scrolls. */
const COMPOSER_MAX_LINES = 4;

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
          backgroundColor: colors.primary.main,
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

interface MessageBubbleProps {
  item: AssistantMessage;
  isUser: boolean;
  showOrb: boolean;
}

function MessageBubble({ item, isUser, showOrb }: MessageBubbleProps) {
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
      {!isUser && showOrb && <MiniOrb size={36} />}
      {!isUser && !showOrb && <View style={{ width: 36 }} />}
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
  const firstName = store.auth.user?.firstName?.trim();

  return (
    <View style={styles.empty}>
      <MiniOrb size={88} />
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
        {firstName
          ? t('assistant.emptyTitleNamed', {
              defaultValue: 'Hi, {{name}}! What do you need today?',
              name: firstName,
            })
          : t('assistant.emptyTitle', 'Hi! What do you need today?')}
      </Text>
      <View style={styles.chips}>
        {SUGGESTIONS.map((item) => {
          const label = t(item.key, item.fallback);
          return (
            <Pressable
              key={item.key}
              onPress={() => onPick(label)}
              accessibilityRole="button"
              hitSlop={{ top: 4, bottom: 4 }}
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
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const store = useStore();
  const { assistant } = store;
  const listRef = useRef<FlatList<AssistantMessage>>(null);
  const [draft, setDraft] = useState('');

  // Check idle on screen focus
  useFocusEffect(
    useCallback(() => {
      assistant.checkAndRotateIfIdle();
    }, [assistant])
  );

  const onSend = useCallback(
    async (override?: string) => {
      const text = (override ?? draft).trim();
      if (!text || assistant.isSending) return;
      // Typed text is now a bubble; on failure it stays there and Retry re-sends it.
      if (override === undefined) setDraft('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      await assistant.sendMessage(text, postAssistantChat);
    },
    [assistant, draft]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: AssistantMessage; index: number }) => {
      const prevMsg = index > 0 ? assistant.messages[index - 1] : null;
      // Show orb only on first assistant bubble of a group
      const showOrb = item.role === 'assistant' && prevMsg?.role !== 'assistant';
      // AC3: 8 within a group, 16 between turns
      const marginTop = !prevMsg ? 0 : prevMsg.role === item.role ? spacing.xs : spacing.md;

      return (
        <View style={{ marginTop }}>
          <MessageBubble item={item} isUser={item.role === 'user'} showOrb={showOrb} />
        </View>
      );
    },
    [assistant.messages]
  );

  const onRetry = useCallback(() => {
    void assistant.retryFailed(postAssistantChat);
  }, [assistant]);

  const onOpenWhatsApp = useCallback(() => {
    void Linking.openURL(`https://wa.me/${WHATSAPP_SUPPORT_NUMBER}`);
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.pageBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        ref={listRef}
        data={assistant.messages.slice()}
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
              accessibilityRole="button"
              accessibilityLabel={t('assistant.handoffButton', 'Open WhatsApp')}
              style={({ pressed }) => [
                styles.bannerButton,
                {
                  backgroundColor: colors.info.main,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
            {assistant.errorKind === 'network'
              ? t('assistant.errorGeneric', 'Message not sent. Check your connection.')
              : t('assistant.errorServer', 'Message not sent. Please try again.')}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t('assistant.errorRetry', 'Retry')}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: colors.error.main,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
          inputStyle={{ maxHeight: typography.body.lineHeight * COMPOSER_MAX_LINES }}
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
          accessibilityState={{ disabled: assistant.isSending || !draft.trim() }}
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
    flexShrink: 1,
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
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.button,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  bannerButtonText: { fontSize: 13, fontWeight: '600' },
  errorText: { flex: 1, fontSize: 12 },
  retryButton: {
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.button,
    marginLeft: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
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
