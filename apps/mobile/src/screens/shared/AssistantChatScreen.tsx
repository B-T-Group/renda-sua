import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, Defs, RadialGradient, Stop, Svg } from 'react-native-svg';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AssistantMarkdownText } from '@/components/common/AssistantMarkdownText';
import { useAssistantChat } from '../../hooks/useAssistantChat';
import type { AssistantUiMessage } from '../../hooks/useAssistantChat';

const BG = '#050b16';
const SURFACE = 'rgba(255,255,255,0.05)';
const ACCENT = '#00e5ff';
const ACCENT_DIM = 'rgba(0,229,255,0.18)';
const TEXT_MUTED = 'rgba(255,255,255,0.55)';

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

function usePulse(delay: number) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.delay(Math.max(0, 560 - delay)),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);
  return anim;
}

function TypingDot({ delay }: { delay: number }) {
  const anim = usePulse(delay);
  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: ACCENT,
          opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.25, 1],
          }),
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -6],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function ThinkingOrb() {
  const { t } = useTranslation();
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  return (
    <View style={styles.thinkingRow}>
      <Animated.View
        style={[
          styles.thinkingOrb,
          {
            opacity: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0.7, 1],
            }),
            transform: [
              {
                scale: glow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1.08],
                }),
              },
            ],
          },
        ]}
      />
      <View>
        <Text style={styles.thinkingLabel}>
          {t('assistant.thinking', 'Thinking…')}
        </Text>
        <View style={styles.typingRow}>
          <TypingDot delay={0} />
          <TypingDot delay={160} />
          <TypingDot delay={320} />
        </View>
      </View>
    </View>
  );
}

function AssistantIllustration({ size = 140 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      accessibilityRole="image"
      accessibilityLabel="AI assistant"
    >
      <Defs>
        <RadialGradient id="orb" cx="38%" cy="33%">
          <Stop offset="0%" stopColor="#26c6da" />
          <Stop offset="100%" stopColor="#00575e" />
        </RadialGradient>
        <RadialGradient id="glow" cx="50%" cy="50%">
          <Stop offset="0%" stopColor="#00e5ff" stopOpacity={0.3} />
          <Stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="80" cy="80" r="72" fill="none" stroke="#00e5ff" strokeWidth="0.8" strokeOpacity={0.2} />
      <Circle cx="80" cy="80" r="57" fill="none" stroke="#00e5ff" strokeWidth="0.8" strokeOpacity={0.12} />
      <Circle cx="80" cy="80" r="52" fill="url(#glow)" />
      <Circle cx="80" cy="80" r="37" fill="url(#orb)" />
      <Circle cx="67" cy="80" r="4.5" fill="#fff" fillOpacity={0.9} />
      <Circle cx="80" cy="80" r="4.5" fill="#fff" fillOpacity={0.9} />
      <Circle cx="93" cy="80" r="4.5" fill="#fff" fillOpacity={0.9} />
    </Svg>
  );
}

function MessageBubble({
  item,
  isUser,
}: {
  item: AssistantUiMessage;
  isUser: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.bubbleWrap,
        {
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          opacity: anim,
          transform: [
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
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.aiBubble,
        ]}
      >
        {!isUser ? (
          <View style={styles.aiTag}>
            <MaterialCommunityIcons name="creation" size={12} color={ACCENT} />
            <Text style={styles.aiTagText}>AI</Text>
          </View>
        ) : null}
        {isUser ? (
          <Text style={styles.bubbleText}>{item.content}</Text>
        ) : (
          <AssistantMarkdownText
            content={item.content}
            color="#e8f7fa"
            style={styles.bubbleText}
          />
        )}
      </View>
    </Animated.View>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.empty}>
      <AssistantIllustration size={140} />
      <Text style={styles.emptyTitle}>
        {t('assistant.emptyTitle', 'What can I help you with?')}
      </Text>
      <Text style={styles.emptySubtitle}>
        {t(
          'assistant.emptySubtitle',
          'Ask about our services, delivery, payments, or pickup locations.'
        )}
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
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={styles.chipText}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AssistantChatScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<AssistantUiMessage>>(null);
  const [draft, setDraft] = useState('');
  const { messages, isSending, error, handoff, sendMessage, clearChat } =
    useAssistantChat();

  const statusLabel = useMemo(
    () =>
      isSending
        ? t('assistant.statusThinking', 'Generating response')
        : t('assistant.statusOnline', 'Online · AI powered'),
    [isSending, t]
  );

  const onSend = useCallback(
    async (override?: string) => {
      const text = (override ?? draft).trim();
      if (!text || isSending) return;
      setDraft('');
      await sendMessage(text);
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true })
      );
    },
    [draft, isSending, sendMessage]
  );

  const renderItem = useCallback(
    ({ item }: { item: AssistantUiMessage }) => (
      <View style={styles.messageRow}>
        <MessageBubble item={item} isUser={item.role === 'user'} />
      </View>
    ),
    []
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerOrb, isSending && styles.headerOrbBusy]} />
          <View>
            <Text style={styles.headerTitle}>
              {t('assistant.title', 'Rendasua Assistant')}
            </Text>
            <Text style={styles.headerStatus}>{statusLabel}</Text>
          </View>
        </View>
        {messages.length > 0 ? (
          <Pressable onPress={clearChat} accessibilityRole="button">
            <MaterialCommunityIcons
              name="delete-sweep-outline"
              size={20}
              color={ACCENT}
            />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={<EmptyState onPick={(text) => void onSend(text)} />}
        ListFooterComponent={isSending ? <ThinkingOrb /> : null}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
      />

      {handoff ? (
        <View style={styles.banner}>
          <MaterialCommunityIcons
            name="account-group-outline"
            size={18}
            color={ACCENT}
          />
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>
              {t('assistant.handoffTitle', 'Connecting you to our team')}
            </Text>
            <Text style={styles.bannerBody}>
              {t(
                'assistant.handoffBody',
                'You can also reach us on WhatsApp.'
              )}
            </Text>
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.banner, styles.errorBanner]}>
          <Text style={styles.errorText}>
            {t(
              'assistant.errorGeneric',
              'Something went wrong. Please try again.'
            )}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.composer,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
        <TextInput
          mode="flat"
          value={draft}
          onChangeText={setDraft}
          placeholder={t('assistant.placeholder', 'Type your question…')}
          style={styles.input}
          dense
          disabled={isSending}
          textColor="#fff"
          placeholderTextColor={TEXT_MUTED}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          onSubmitEditing={() => void onSend()}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={() => void onSend()}
          disabled={isSending || !draft.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              opacity: isSending || !draft.trim() ? 0.35 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons name="send" size={18} color="#041018" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ACCENT_DIM,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerOrb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#00838f',
    borderWidth: 2,
    borderColor: ACCENT,
  },
  headerOrbBusy: {
    shadowColor: ACCENT,
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  headerStatus: { color: ACCENT, fontSize: 11, marginTop: 2, opacity: 0.9 },
  listContent: { flexGrow: 1, padding: 16, paddingBottom: 20 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  emptyTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
    marginTop: 18,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 18,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: ACCENT_DIM,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  messageRow: { marginBottom: 10 },
  bubbleWrap: { maxWidth: '88%' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  userBubble: {
    backgroundColor: '#00838f',
    borderBottomRightRadius: 5,
  },
  aiBubble: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: ACCENT_DIM,
    borderBottomLeftRadius: 5,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  aiTagText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  bubbleText: { color: '#fff', lineHeight: 20 },
  thinkingRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: ACCENT_DIM,
  },
  thinkingOrb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
  },
  thinkingLabel: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 4,
  },
  typingRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ACCENT_DIM,
    backgroundColor: 'rgba(0,188,212,0.08)',
  },
  bannerText: { flex: 1 },
  bannerTitle: { color: ACCENT, fontWeight: '700', fontSize: 13 },
  bannerBody: { color: TEXT_MUTED, fontSize: 12, marginTop: 2 },
  errorBanner: {
    borderColor: 'rgba(255,120,120,0.35)',
    backgroundColor: 'rgba(255,80,80,0.12)',
  },
  errorText: { color: 'rgba(255,160,160,0.95)', fontSize: 12 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ACCENT_DIM,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: '#07101c',
  },
  input: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 18,
    paddingHorizontal: 4,
  },
  sendBtn: {
    marginLeft: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
  },
});
