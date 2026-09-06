import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useOrderMessages } from '../../hooks/useOrderMessages';
import { businessApi } from '../../services/businessApi';
import type {
  FailedDelivery,
  FailedDeliveryResolutionType,
} from '../../types/business/failedDeliveries';
import { failedDeliveryPersonName } from '../../types/business/failedDeliveries';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ContactCard } from '../orders/shared/ContactCard';
import { AddressCard } from '../orders/shared/AddressCard';
import { OrderMessageComposer } from '../messaging/OrderMessageComposer';

type Props = {
  visible: boolean;
  orderId: string | null;
  seed?: FailedDelivery | null;
  onDismiss: () => void;
  onResolved: () => void;
};

const RESOLUTION_TYPES: FailedDeliveryResolutionType[] = [
  'agent_fault',
  'client_fault',
  'item_fault',
];

export function ResolveFailedDeliveryModal({
  visible,
  orderId,
  seed,
  onDismiss,
  onResolved,
}: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  // Empty while closed so useOrderMessages clears any prior thread.
  const activeOrderId = visible && orderId ? orderId : '';

  const [detail, setDetail] = useState<FailedDelivery | null>(seed ?? null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [resolutionType, setResolutionType] =
    useState<FailedDeliveryResolutionType>('client_fault');
  const [outcome, setOutcome] = useState('');
  const [restoreInventory, setRestoreInventory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const notesFocusedRef = useRef(false);

  // The notes input is the last element of the scroll area, so it ends up
  // hidden behind the keyboard when focused; scroll it into view once the
  // KeyboardAvoidingView has finished resizing.
  const scrollNotesIntoView = useCallback(() => {
    setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      Platform.OS === 'ios' ? 300 : 150
    );
  }, []);

  const handleNotesFocus = useCallback(() => {
    notesFocusedRef.current = true;
    scrollNotesIntoView();
  }, [scrollNotesIntoView]);

  const handleNotesBlur = useCallback(() => {
    notesFocusedRef.current = false;
  }, []);

  // Keeps the caret visible as the multiline input grows; guarded so the
  // initial layout does not scroll the freshly opened modal to the bottom.
  const handleNotesContentSizeChange = useCallback(() => {
    if (notesFocusedRef.current) scrollNotesIntoView();
  }, [scrollNotesIntoView]);

  const {
    messages,
    loading: msgLoading,
    error: msgError,
    sendMessage,
    refetch: refetchMsgs,
    mentionableParticipants,
  } = useOrderMessages(activeOrderId);

  const resetForm = useCallback(() => {
    setResolutionType('client_fault');
    setOutcome('');
    setRestoreInventory(true);
    setSnack(null);
  }, []);

  // Read seed/t through refs so the load effect below only re-runs when the
  // modal opens or targets another order — not on i18n or seed identity
  // changes, which would wipe the user's form input mid-edit.
  const seedRef = useRef(seed ?? null);
  seedRef.current = seed ?? null;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!visible || !orderId) {
      setDetail(null);
      return;
    }
    setDetail(seedRef.current);
    resetForm();
    let cancelled = false;
    setLoadingDetail(true);
    void businessApi.failedDeliveries
      .get(orderId)
      .then((res) => {
        if (!cancelled && res.success) setDetail(res.failed_delivery);
      })
      .catch(() => {
        if (!cancelled && !seedRef.current) {
          setSnack(
            tRef.current(
              'business.failedDeliveries.loadError',
              'Unable to load failed delivery details.'
            )
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, orderId, resetForm]);

  const submit = useCallback(async () => {
    if (!orderId || !outcome.trim()) {
      setSnack(
        t(
          'business.failedDeliveries.validationError',
          'Select a resolution type and add resolution notes.'
        )
      );
      return;
    }
    setSubmitting(true);
    try {
      await businessApi.failedDeliveries.resolve(orderId, {
        resolution_type: resolutionType,
        outcome: outcome.trim(),
        restore_inventory:
          resolutionType === 'item_fault' ? restoreInventory : undefined,
      });
      onResolved();
      onDismiss();
    } catch (e) {
      setSnack(
        e instanceof Error
          ? e.message
          : t(
              'business.failedDeliveries.resolveError',
              'Could not resolve this failed delivery.'
            )
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    orderId,
    outcome,
    resolutionType,
    restoreInventory,
    onResolved,
    onDismiss,
    t,
  ]);

  const locale = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const fd = detail;
  const clientUser = fd?.order?.client?.user;
  const agentUser = fd?.order?.assigned_agent?.user;
  const reason =
    (locale.startsWith('fr')
      ? fd?.failure_reason?.reason_fr
      : fd?.failure_reason?.reason_en) ||
    fd?.failure_reason?.reason_en ||
    fd?.failure_reason?.reason_fr ||
    fd?.failure_reason_id ||
    '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={submitting ? undefined : onDismiss}
    >
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.pageBackground }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + spacing.sm,
              paddingHorizontal: spacing.md,
              paddingBottom: spacing.sm,
              borderBottomColor: colors.divider,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <Pressable
            onPress={submitting ? undefined : onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
          >
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={colors.text.primary}
            />
          </Pressable>
          <Text
            style={[typography.subheading, { flex: 1, color: colors.text.primary }]}
            numberOfLines={1}
          >
            {t('business.failedDeliveries.resolveTitle', 'Resolve failed delivery')}
          </Text>
        </View>

        {loadingDetail && !fd ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary.main} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={{
              padding: spacing.md,
              paddingBottom: spacing.lg,
              maxHeight: undefined,
              minHeight: screenHeight * 0.4,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {fd ? (
              <>
                <SummaryBlock
                  orderNumber={fd.order.order_number}
                  amount={formatCurrency(
                    fd.order.total_amount,
                    fd.order.currency,
                    locale
                  )}
                  reason={reason}
                  notes={fd.notes}
                  createdAt={formatDate(fd.created_at, 'datetime', locale)}
                />

                <SectionTitle
                  label={t('business.failedDeliveries.contacts', 'Contacts')}
                />
                <ContactCard
                  title={t('business.failedDeliveries.client', 'Client')}
                  contact={{
                    name: failedDeliveryPersonName(clientUser) || null,
                    phone: clientUser?.phone_number,
                    email: clientUser?.email,
                  }}
                />
                <View style={{ height: spacing.sm }} />
                <ContactCard
                  title={t('business.failedDeliveries.agent', 'Agent')}
                  contact={{
                    name: failedDeliveryPersonName(agentUser) || null,
                    phone: agentUser?.phone_number,
                    email: agentUser?.email,
                  }}
                />
                {fd.order.delivery_address ? (
                  <>
                    <View style={{ height: spacing.sm }} />
                    <AddressCard
                      title={t(
                        'business.failedDeliveries.deliveryAddress',
                        'Delivery address'
                      )}
                      address={fd.order.delivery_address}
                    />
                  </>
                ) : null}

                <SectionTitle
                  label={t('business.failedDeliveries.messages', 'Messages')}
                />
                <View
                  style={[
                    styles.messagesWrap,
                    shadows.sm,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.divider,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <ScrollView
                    nestedScrollEnabled
                    style={{ maxHeight: 360 }}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ padding: spacing.sm }}
                  >
                    <OrderMessageComposer
                      key={activeOrderId}
                      // Keep the 10 most recent (hook returns newest-first),
                      // then reverse for chat-style oldest-to-newest display.
                      messages={messages.slice(0, 10).reverse()}
                      loading={msgLoading}
                      error={msgError}
                      mentionableParticipants={mentionableParticipants}
                      onSend={sendMessage}
                      formatDate={(iso) => formatDate(iso, 'datetime', locale)}
                      onRefresh={() => void refetchMsgs()}
                      refreshing={msgLoading}
                      orderId={activeOrderId}
                      orderStatus={fd.order.current_status}
                      onQuickMessageError={(message) => setSnack(message)}
                      onQuickMessageSuccess={(message) => setSnack(message)}
                      emptyHint={t(
                        'business.failedDeliveries.messagesEmpty',
                        'No messages yet between client and agent.'
                      )}
                    />
                  </ScrollView>
                </View>

                <SectionTitle
                  label={t(
                    'business.failedDeliveries.selectResolutionType',
                    'Who is at fault?'
                  )}
                />
                {RESOLUTION_TYPES.map((type) => (
                  <ResolutionTypeCard
                    key={type}
                    type={type}
                    selected={resolutionType === type}
                    onSelect={() => setResolutionType(type)}
                  />
                ))}

                {resolutionType === 'item_fault' ? (
                  <Pressable
                    onPress={() => setRestoreInventory((v) => !v)}
                    style={[styles.checkboxRow, { marginTop: spacing.sm }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: restoreInventory }}
                  >
                    <View pointerEvents="none">
                      <Checkbox
                        status={restoreInventory ? 'checked' : 'unchecked'}
                      />
                    </View>
                    <Text style={{ flex: 1, color: colors.text.primary }}>
                      {t(
                        'business.failedDeliveries.restoreInventory',
                        'Restore inventory for this order'
                      )}
                    </Text>
                  </Pressable>
                ) : null}

                <SectionTitle
                  label={t(
                    'business.failedDeliveries.resolutionNotes',
                    'Resolution notes'
                  )}
                />
                <Text
                  style={[
                    typography.caption,
                    { color: colors.text.secondary, marginBottom: spacing.xs },
                  ]}
                >
                  {t(
                    'business.failedDeliveries.resolutionNotesHelper',
                    'Required. Describe what you decided and why (for your records). This does not change money handling — the fault type above does.'
                  )}
                </Text>
                <TextInput
                  mode="outlined"
                  multiline
                  numberOfLines={4}
                  value={outcome}
                  onChangeText={setOutcome}
                  onFocus={handleNotesFocus}
                  onBlur={handleNotesBlur}
                  onContentSizeChange={handleNotesContentSizeChange}
                  placeholder={t(
                    'business.failedDeliveries.resolutionNotesPlaceholder',
                    'e.g. Customer confirmed wrong address; refunded and closed.'
                  )}
                  style={{ minHeight: 100, backgroundColor: colors.surface }}
                />
              </>
            ) : null}
          </ScrollView>
        )}

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md),
              paddingHorizontal: spacing.md,
              paddingTop: spacing.sm,
              borderTopColor: colors.divider,
              backgroundColor: colors.surface,
              ...shadows.large,
            },
          ]}
        >
          <Button mode="text" onPress={onDismiss} disabled={submitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            mode="contained"
            onPress={() => void submit()}
            loading={submitting}
            disabled={submitting || !outcome.trim() || !fd}
            style={{ flex: 1, marginLeft: spacing.sm }}
          >
            {t('business.failedDeliveries.submitResolution', 'Submit resolution')}
          </Button>
        </View>

        <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
          {snack}
        </Snackbar>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SectionTitle({ label }: { label: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Text
      style={[
        typography.subheading,
        {
          color: colors.text.primary,
          marginTop: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      {label}
    </Text>
  );
}

function SummaryBlock({
  orderNumber,
  amount,
  reason,
  notes,
  createdAt,
}: {
  orderNumber: string;
  amount: string;
  reason: string;
  notes?: string | null;
  createdAt: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  return (
    <View
      style={[
        shadows.sm,
        {
          backgroundColor: colors.primaryTint,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          gap: spacing.xxs,
          borderWidth: 1,
          borderColor: colors.primary.main + '33',
        },
      ]}
    >
      <Text style={[typography.subheading, { color: colors.primary.main }]}>
        #{orderNumber}
      </Text>
      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {createdAt}
      </Text>
      <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{amount}</Text>
      <Text style={{ color: colors.error.dark }}>
        {t('business.failedDeliveries.failureReason', 'Failure reason')}: {reason}
      </Text>
      {notes?.trim() ? (
        <Text style={{ color: colors.text.secondary }}>
          {t('business.failedDeliveries.agentNotes', 'Agent notes')}: {notes.trim()}
        </Text>
      ) : null}
    </View>
  );
}

function ResolutionTypeCard({
  type,
  selected,
  onSelect,
}: {
  type: FailedDeliveryResolutionType;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const title = t(
    `business.failedDeliveries.resolutionType.${type}`,
    type === 'agent_fault'
      ? 'Agent fault'
      : type === 'client_fault'
        ? 'Client fault'
        : 'Item fault'
  );
  const description = t(
    `business.failedDeliveries.resolutionDescription.${type}`,
    type === 'agent_fault'
      ? 'Client is refunded. Agent hold is released to the agent.'
      : type === 'client_fault'
        ? 'Client and agent holds are released. Client is charged the failed-delivery fee (split with the agent).'
        : 'Client and agent are refunded. You can restore inventory.'
  );

  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.resolutionCard,
        {
          borderColor: selected ? colors.primary.main : colors.divider,
          backgroundColor: selected ? colors.primaryTint : colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={styles.resolutionHeader}>
        <MaterialCommunityIcons
          name={selected ? 'radiobox-marked' : 'radiobox-blank'}
          size={22}
          color={selected ? colors.primary.main : colors.text.secondary}
        />
        <Text
          style={[
            typography.subheading,
            { color: colors.text.primary, flex: 1, marginLeft: spacing.sm },
          ]}
        >
          {title}
        </Text>
      </View>
      <Text
        style={[
          typography.caption,
          { color: colors.text.secondary, marginTop: spacing.xs, marginLeft: 30 },
        ]}
      >
        {description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesWrap: {
    borderWidth: 1,
    minHeight: 180,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resolutionCard: {
    borderWidth: 1.5,
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
