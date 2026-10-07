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
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AssistantMarkdownText } from '@/components/common/AssistantMarkdownText';
import { AppTextInput } from '@/components/common/AppTextInput';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/stores/RootStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { spacing, borderRadius } from '@/theme/spacing';
import { motionDuration } from '@/theme/motion';
import { postAssistantChat, type AssistantMarketContext } from '@/services/assistantApi';
import type { AssistantMessage } from '@/stores/AssistantStore';
import { RendaCharacter } from '@/components/assistant/renda/RendaCharacter';
import { StageDisc } from '@/components/assistant/renda/rendaCharacterLayers';
import { useInteractionSettled } from '@/components/assistant/launcher/launcherHooks';
import { assistantViewer, canSeeRendaCharacter } from '@/utils/assistantLauncher';
import type { AssistantContext } from '@/utils/assistantChips';
import { getContextualChips, buildChipMessage } from '@/utils/assistantChips';
import { trackSiteEvent } from '@/services/AppEventsService';
import { useReorderOrder } from '@/hooks/useReorderOrder';
import { ReorderCartConflictSheet } from '@/components/orders/ReorderCartConflictSheet';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ClientRootStackParamList } from '@/navigation/types';
import type { ReorderCartAction, ReorderOrderResponse } from '@/types/reorder';
import { trackReorderEvent } from '@/utils/reorderAnalytics';
import { formatSkippedNames, mapReorderLineToCartLine, resolveReorderCartAction } from '@/utils/reorderCart';
import { reorderNavigator } from '@/utils/reorderNavigator';

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

/** #451: client / guest see the Renda character; agent / business keep the static smart-toy orb. */
function useShowsRendaCharacter(): boolean {
  const { auth, persona } = useStore();
  return canSeeRendaCharacter(assistantViewer(auth.isAuthenticated, persona.activePersona));
}

/**
 * Creates a market-aware transport for the assistant chat.
 * Wraps postAssistantChat with the current market context from MarketStore.
 */
function useAssistantTransport() {
  const { market } = useStore();
  return useCallback(
    async (messages: { role: 'user' | 'assistant'; content: string }[]) => {
      const marketContext: AssistantMarketContext | null =
        market.selectedCountryCode
          ? {
              country_code: market.selectedCountryCode,
              state: market.selectedStateCode || undefined,
            }
          : null;
      return postAssistantChat(messages, marketContext);
    },
    [market.selectedCountryCode, market.selectedStateCode]
  );
}

const MESSAGE_AVATAR = 28;
/** Character width at 28 (0.82 aspect), so grouped bubbles line up with the avatar. */
const MESSAGE_AVATAR_WIDTH = Math.round(MESSAGE_AVATAR * 0.82);
const HERO_SIZE = 128;

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
  character: boolean;
  onLinkPress?: (url: string) => boolean;
}

function MessageBubble({ item, isUser, showOrb, character, onLinkPress }: MessageBubbleProps) {
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
      {!isUser && showOrb && character ? (
        // Dot eyes (20–35), static: many on screen, motion in the thread is noise.
        <RendaCharacter size={MESSAGE_AVATAR} state="idle" animated={false} />
      ) : null}
      {!isUser && showOrb && !character ? <MiniOrb size={36} /> : null}
      {!isUser && !showOrb ? <View style={{ width: character ? MESSAGE_AVATAR_WIDTH : 36 }} /> : null}
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
            onLinkPress={onLinkPress}
          />
        )}
      </View>
    </Animated.View>
  );
}

const EmptyHero = observer(function EmptyHero() {
  const { isDark } = useTheme();
  const { assistantCharacter } = useStore();
  const isFocused = useIsFocused();
  // Battery: pause off-screen and after the 20 s settle (focus resumes).
  const settled = useInteractionSettled(isFocused);
  const state = assistantCharacter.state;
  const disc = HERO_SIZE * 1.5;
  return (
    <View style={[styles.hero, { width: disc, height: disc }]}>
      {/* Subtle primary.light 8% disc (soft edge) so the light-mode glow has something to sit on. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <StageDisc diameter={disc} dark={isDark} />
      </View>
      <RendaCharacter
        size={HERO_SIZE}
        state={state}
        paused={!isFocused || (settled && state === 'idle')}
        testID="assistant-hero-character"
      />
    </View>
  );
});

function EmptyState({
  onPick,
  context,
}: {
  onPick: (text: string) => void;
  context?: AssistantContext;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const store = useStore();
  const firstName = store.auth.user?.firstName?.trim();
  const character = useShowsRendaCharacter();
  const chips = getContextualChips(context);

  const handleChipTap = useCallback(
    (chipId: string, label: string) => {
      trackSiteEvent({
        eventType: 'assistant.chip.tap',
        metadata: {
          chip_id: chipId,
          context: context?.type || 'generic',
        },
      });
      onPick(label);
    },
    [context, onPick]
  );

  return (
    <View style={styles.empty}>
      {character ? <EmptyHero /> : <MiniOrb size={88} />}
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
        {firstName
          ? t('assistant.emptyTitleNamed', {
              defaultValue: 'Hi, {{name}}! What do you need today?',
              name: firstName,
            })
          : t('assistant.emptyTitle', 'Hi! What do you need today?')}
      </Text>
      <View style={styles.chips}>
        {chips.map((chip) => {
          // Build interpolation variables from context
          let interpolation = {};
          if (context?.type === 'item_detail' && context.itemName) {
            interpolation = { name: context.itemName };
          } else if (context?.type === 'delivery_tracking' && context.orderNumber) {
            interpolation = { orderNumber: context.orderNumber };
          }
          
          const label = t(chip.translationKey, { defaultValue: chip.fallback, ...interpolation });
          const message = buildChipMessage(chip, label, context);
          return (
            <Pressable
              key={chip.id}
              onPress={() => handleChipTap(chip.id, message)}
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

type AssistantChatScreenProps = {
  route?: {
    params?: {
      context?: AssistantContext;
    };
  };
};

type Nav = NativeStackNavigationProp<ClientRootStackParamList>;

const AssistantChatScreen = observer(function AssistantChatScreen({
  route,
}: AssistantChatScreenProps) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const store = useStore();
  const { assistant } = store;
  const { assistantCharacter } = store;
  const { cart } = store;
  const listRef = useRef<FlatList<AssistantMessage>>(null);
  const [draft, setDraft] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const character = useShowsRendaCharacter();
  const assistantTransport = useAssistantTransport();
  const context = route?.params?.context;
  const navigation = useNavigation<Nav>();
  const { reorder } = useReorderOrder();
  
  // Track clicked reorder link and conflict sheet
  const [pendingReorderId, setPendingReorderId] = useState<string | undefined>(undefined);
  const [pendingPayload, setPendingPayload] = useState<ReorderOrderResponse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reorderSnack, setReorderSnack] = useState<string | null>(null);

  // Hero: Attentive while the composer is focused, Listening once it has text.
  useEffect(() => {
    assistantCharacter.setComposer(composerFocused, draft.trim().length > 0);
  }, [assistantCharacter, composerFocused, draft]);
  useEffect(() => () => assistantCharacter.setComposer(false, false), [assistantCharacter]);

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
      await assistant.sendMessage(text, assistantTransport);
    },
    [assistant, draft, assistantTransport]
  );

  // Handle reorder when pendingReorderId is set
  useEffect(() => {
    if (!pendingReorderId) return;
    
    const executeReorder = async () => {
      try {
        const payload = await reorder(pendingReorderId, false);
        
        // No items? Show toast and done
        if (payload.lines.length === 0) {
          const skipToast = buildSkipToast(payload);
          if (skipToast) setReorderSnack(skipToast);
          else {
            setReorderSnack(
              t('orders.reorder.unavailable', 'These items are not available to order again.')
            );
          }
          setPendingReorderId(undefined);
          return;
        }
        
        // Check cart conflict
        const cartBizIds = [...new Set(cart.items.map((l) => l.businessId))];
        const decision = resolveReorderCartAction(cartBizIds, payload.business_id);
        
        if (decision === 'replace') {
          // Auto-replace when cart is empty or same business
          applyLines(payload, 'replace');
          setPendingReorderId(undefined);
          return;
        }
        
        // Show conflict sheet
        setPendingPayload(payload);
        setSheetOpen(true);
        
        if (decision === 'blocked_other_store') {
          setReorderSnack(
            t('orders.reorder.otherStoreToast', 'Your cart has items from another store')
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error 
          ? err.message 
          : t('orders.reorder.failed', 'Could not reorder. Try again.');
        setReorderSnack(msg);
        setPendingReorderId(undefined);
      }
    };
    
    void executeReorder();
  }, [pendingReorderId, reorder, cart.items, t]);

  const buildSkipToast = useCallback((payload: ReorderOrderResponse) => {
    const names = payload.skipped.map((s) => s.name);
    if (names.length === 0) return null;
    const list = formatSkippedNames(names, (n) =>
      t('orders.reorder.andMore', 'and {{count}} more', { count: n })
    );
    return t('orders.reorder.skippedToast', 'Unavailable: {{names}}', { names: list });
  }, [t]);

  const navigateAfterApply = useCallback((payload: ReorderOrderResponse, cartAction: ReorderCartAction) => {
    trackReorderEvent('reorder_result', {
      orderId: pendingReorderId!,
      dest: payload.navigation_hint,
      skipped_count: payload.skipped.length,
      cart_action: cartAction,
    });
    const skipToast = buildSkipToast(payload);
    if (skipToast) setReorderSnack(skipToast);

    if (payload.navigation_hint === 'none') {
      if (!skipToast) {
        setReorderSnack(
          t('orders.reorder.unavailable', 'These items are not available to order again.')
        );
      }
      return;
    }

    const stack = reorderNavigator(navigation);
    if (payload.navigation_hint === 'checkout') {
      stack.navigate('CartCheckout', {
        deliveryAddressId: payload.fulfillment.address_id ?? undefined,
        fulfillmentMethod: payload.fulfillment.type,
      });
      return;
    }

    let banner: 'business_closed' | 'address_invalid' | undefined;
    if (!payload.fulfillment.business_accepting_orders) {
      banner = 'business_closed';
    } else if (!payload.fulfillment.address_valid) {
      banner = 'address_invalid';
    }
    reorderNavigator(navigation).navigate('Cart', banner ? { reorderBanner: banner } : undefined);
  }, [buildSkipToast, navigation, pendingReorderId, t]);

  const applyLines = useCallback((payload: ReorderOrderResponse, action: 'replace' | 'add') => {
    const lines = payload.lines.map((line) => mapReorderLineToCartLine(line, payload.business_id));
    if (action === 'replace') cart.replaceLines(lines);
    else cart.addLines(lines);
    navigateAfterApply(payload, action);
  }, [cart, navigateAfterApply]);

  const onReplace = useCallback(() => {
    if (!pendingPayload) return;
    setSheetOpen(false);
    applyLines(pendingPayload, 'replace');
    setPendingPayload(null);
    setPendingReorderId(undefined);
  }, [applyLines, pendingPayload]);

  const onAdd = useCallback(() => {
    if (!pendingPayload) return;
    const cartBizIds = [...new Set(cart.items.map((l) => l.businessId))];
    const decision = resolveReorderCartAction(cartBizIds, pendingPayload.business_id);
    if (decision === 'blocked_other_store') {
      setReorderSnack(
        t('orders.reorder.otherStoreToast', 'Your cart has items from another store')
      );
      return;
    }
    setSheetOpen(false);
    applyLines(pendingPayload, 'add');
    setPendingPayload(null);
    setPendingReorderId(undefined);
  }, [applyLines, cart.items, pendingPayload, t]);

  const onDismissSheet = useCallback(() => {
    setSheetOpen(false);
    setPendingPayload(null);
    setPendingReorderId(undefined);
  }, []);

  const allowAdd = !!pendingPayload &&
    resolveReorderCartAction(
      [...new Set(cart.items.map((l) => l.businessId))],
      pendingPayload.business_id
    ) !== 'blocked_other_store';

  // Handle reorder links from assistant messages
  const handleReorderLink = useCallback(
    async (url: string) => {
      const reorderMatch = url.match(/\/orders\/([^/?]+)\/reorder/);
      if (!reorderMatch) return false;

      const orderId = reorderMatch[1];
      trackReorderEvent('reorder_tap', { orderId });
      setPendingReorderId(orderId);
      return true;
    },
    []
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
          <MessageBubble
            item={item}
            isUser={item.role === 'user'}
            showOrb={showOrb}
            character={character}
            onLinkPress={handleReorderLink}
          />
        </View>
      );
    },
    [assistant.messages, character, handleReorderLink]
  );

  const onRetry = useCallback(() => {
    void assistant.retryFailed(assistantTransport);
  }, [assistant, assistantTransport]);

  const onOpenWhatsApp = useCallback(() => {
    void Linking.openURL(`https://wa.me/${WHATSAPP_SUPPORT_NUMBER}`);
  }, []);

  return (
    <>
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
        ListEmptyComponent={<EmptyState onPick={(text) => void onSend(text)} context={context} />}
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
          onFocus={() => setComposerFocused(true)}
          onBlur={() => setComposerFocused(false)}
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
      <ReorderCartConflictSheet
        visible={sheetOpen}
        allowAdd={allowAdd}
        otherStoreBlocked={!!pendingPayload && !allowAdd}
        onReplace={onReplace}
        onAdd={onAdd}
        onDismiss={onDismissSheet}
      />
      {reorderSnack ? (
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + 80,
            left: 16,
            right: 16,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.card,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text.primary }}>{reorderSnack}</Text>
        </View>
      ) : null}
    </>
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
  hero: {
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
