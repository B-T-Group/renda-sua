import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import type {
  CreditFeedbackAction,
  CreditsFeedbackOrderRow,
  OrderFeedbackCreditBody,
} from '@/types/adminCredits';

type ActionOption = [CreditFeedbackAction, string, string];

const SHARED_ACTIONS: ActionOption[] = [
  ['called_client', 'admin.credits.action.calledClient', 'Called client'],
  ['emailed_client', 'admin.credits.action.emailedClient', 'Emailed client'],
  [
    'spoke_in_person',
    'admin.credits.action.spokeInPerson',
    'Spoke in person',
  ],
  ['test_order', 'admin.credits.action.testOrder', 'Test order'],
  ['internal_order', 'admin.credits.action.internalOrder', 'Internal order'],
];

const CANCELLED_ACTIONS: ActionOption[] = [
  ['called_client', 'admin.credits.action.calledClient', 'Called client'],
  [
    'called_business',
    'admin.credits.action.calledBusiness',
    'Called business',
  ],
  ['emailed_client', 'admin.credits.action.emailedClient', 'Emailed client'],
  [
    'spoke_in_person',
    'admin.credits.action.spokeInPerson',
    'Spoke in person',
  ],
  ['test_order', 'admin.credits.action.testOrder', 'Test order'],
  ['internal_order', 'admin.credits.action.internalOrder', 'Internal order'],
];

type ContactUser = {
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  country?: string | null;
};

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function personName(user?: ContactUser | null, fallback?: string | null): string {
  const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  return name || fallback?.trim() || '—';
}

function fulfillmentLabel(
  method: string | null | undefined,
  t: (key: string, fallback: string) => string
): string {
  if (method === 'pickup') {
    return t('admin.credits.fulfillment.pickup', 'Pickup');
  }
  if (method === 'shipping') {
    return t('admin.credits.fulfillment.shipping', 'Shipping');
  }
  if (method === 'delivery') {
    return t('admin.credits.fulfillment.delivery', 'Delivery');
  }
  return method || t('admin.credits.fulfillment.unknown', 'Fulfillment unknown');
}

function cancelledByLabel(
  value: string | null | undefined,
  t: (key: string, fallback: string) => string
): string | null {
  if (!value) return null;
  if (value === 'client') {
    return t('admin.credits.briefing.cancelledByClient', 'Cancelled by client');
  }
  if (value === 'business') {
    return t(
      'admin.credits.briefing.cancelledByBusiness',
      'Cancelled by business'
    );
  }
  if (value === 'system') {
    return t('admin.credits.briefing.cancelledBySystem', 'Cancelled by system');
  }
  return value;
}

export interface AdminCreditsFeedbackSheetProps {
  visible: boolean;
  title: string;
  mode: 'cancelled' | 'first_order' | null;
  order: CreditsFeedbackOrderRow | null;
  submitting: boolean;
  onDismiss: () => void;
  onSubmit: (body: OrderFeedbackCreditBody) => Promise<void>;
}

export function AdminCreditsFeedbackSheet({
  visible,
  title,
  mode,
  order,
  submitting,
  onDismiss,
  onSubmit,
}: AdminCreditsFeedbackSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [action, setAction] = useState<CreditFeedbackAction>('called_client');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const actions = mode === 'cancelled' ? CANCELLED_ACTIONS : SHARED_ACTIONS;

  useEffect(() => {
    if (!visible) return;
    setAction('called_client');
    setNotes('');
    setError(null);
  }, [visible, order?.id, mode]);

  const canSubmit = !submitting && notes.trim().length > 0 && !!action;
  const isSkip = action === 'test_order' || action === 'internal_order';

  const hint = useMemo(() => {
    if (isSkip) {
      return t(
        'admin.credits.skipCreditHint',
        'Explain why this is not a real follow-up. No points will be awarded.'
      );
    }
    if (mode === 'cancelled') {
      return t(
        'admin.credits.cancelledFeedbackHint',
        'Call the client or business (whoever cancelled) and record what they shared.'
      );
    }
    return t(
      'admin.credits.feedbackHint',
      'Call the client and record what they shared.'
    );
  }, [isSkip, mode, t]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await onSubmit({ action, notes: notes.trim() });
      setNotes('');
      onDismiss();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.credits.actionFailed', 'Action failed')
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={submitting ? undefined : onDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <Pressable
          style={styles.scrim}
          onPress={submitting ? undefined : onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel', 'Cancel')}
        >
          <Pressable
            style={[
              styles.sheet,
              shadows.md ?? {},
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadius.xl,
                paddingBottom: Math.max(insets.bottom, spacing.md),
                maxHeight: screenHeight * 0.9,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ gap: spacing.sm, padding: spacing.md }}
            >
              <Text variant="titleLarge">{title}</Text>
              {order ? <OrderBriefing order={order} mode={mode} /> : null}
              <Text
                style={[typography.body2, { color: colors.text.secondary }]}
              >
                {t('admin.credits.actionTaken', 'Action taken')}
              </Text>
              <View style={{ gap: spacing.xs }}>
                {actions.map(([value, key, fallback]) => {
                  const selected = action === value;
                  return (
                    <Button
                      key={value}
                      mode={selected ? 'contained' : 'outlined'}
                      compact
                      onPress={() => setAction(value)}
                      style={{ minHeight: 40 }}
                      contentStyle={{ justifyContent: 'flex-start' }}
                      labelStyle={{ textAlign: 'left' }}
                    >
                      {t(key, fallback)}
                    </Button>
                  );
                })}
              </View>
              <Text
                style={[typography.body2, { color: colors.text.secondary }]}
              >
                {hint}
              </Text>
              <TextInput
                mode="outlined"
                label={t('admin.credits.feedbackNotes', 'Feedback notes')}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
              />
              {error ? (
                <Text style={{ color: colors.error.main }}>{error}</Text>
              ) : null}
              <View style={[styles.actions, { gap: spacing.xs }]}>
                <Button mode="text" onPress={onDismiss} disabled={submitting}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  mode="contained"
                  onPress={() => void handleSubmit()}
                  disabled={!canSubmit}
                  loading={submitting}
                >
                  {t('admin.credits.saveFeedback', 'Save feedback')}
                </Button>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ContactBlock({
  label,
  user,
  fallbackName,
  showCountry,
}: {
  label: string;
  user?: ContactUser | null;
  fallbackName?: string | null;
  showCountry?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const phone = user?.phone_number?.trim() || '';
  const email = user?.email?.trim() || '';
  return (
    <View style={{ gap: 4 }}>
      <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
        {label}: {personName(user, fallbackName)}
      </Text>
      {showCountry ? (
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {t('admin.credits.briefing.country', 'Country')}:{' '}
          {user?.country?.toUpperCase() || '—'}
        </Text>
      ) : null}
      <View style={styles.contactRow}>
        <Text
          style={[
            typography.caption,
            { color: colors.text.secondary, flex: 1, minWidth: 0 },
          ]}
        >
          {t('admin.credits.briefing.phone', 'Phone')}: {phone || '—'}
        </Text>
        {phone ? (
          <Button
            mode="outlined"
            compact
            icon="phone"
            onPress={() => void Linking.openURL(telHref(phone))}
            style={{ minHeight: 40 }}
          >
            {t('admin.credits.quickCall', 'Call')}
          </Button>
        ) : null}
      </View>
      <View style={styles.contactRow}>
        <Text
          style={[
            typography.caption,
            { color: colors.text.secondary, flex: 1, minWidth: 0 },
          ]}
          numberOfLines={2}
        >
          {t('admin.credits.briefing.email', 'Email')}: {email || '—'}
        </Text>
        {email ? (
          <Button
            mode="outlined"
            compact
            icon="email"
            onPress={() => void Linking.openURL(`mailto:${email}`)}
            style={{ minHeight: 40 }}
          >
            {t('admin.credits.quickEmail', 'Email')}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

function OrderBriefing({
  order,
  mode,
}: {
  order: CreditsFeedbackOrderRow;
  mode: 'cancelled' | 'first_order' | null;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();
  const when =
    mode === 'cancelled' ? order.cancelled_at : order.completed_at;
  const items = (order.order_items ?? []).slice(0, 10);
  const cancelledBy = cancelledByLabel(order.cancelled_by, t);

  return (
    <View
      style={{
        backgroundColor: colors.background.default,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        gap: spacing.sm,
      }}
    >
      <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
        {mode === 'cancelled'
          ? t('admin.credits.briefing.titleCancelled', 'Who to contact')
          : t('admin.credits.briefing.title', 'Client & order')}
      </Text>

      <ContactBlock
        label={t('admin.credits.briefing.client', 'Client')}
        user={order.client?.user}
        showCountry
      />

      {mode === 'cancelled' ? (
        <ContactBlock
          label={t('admin.credits.briefing.business', 'Business')}
          user={order.business?.user}
          fallbackName={order.business?.name}
        />
      ) : null}

      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {t('admin.credits.briefing.order', 'Order')}: #{order.order_number} ·{' '}
        {order.current_status}
        {mode !== 'cancelled' && order.business?.name
          ? ` · ${order.business.name}`
          : ''}
      </Text>
      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {t('admin.credits.briefing.fulfillment', 'Fulfillment')}:{' '}
        {fulfillmentLabel(order.fulfillment_method, t)}
      </Text>
      {when ? (
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {mode === 'cancelled'
            ? t('admin.credits.briefing.cancelledAt', 'Cancelled')
            : t('admin.credits.briefing.completedAt', 'Completed')}
          : {new Date(when).toLocaleString()}
          {cancelledBy ? ` · ${cancelledBy}` : ''}
        </Text>
      ) : null}
      {order.cancellation_notes ? (
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {t('admin.credits.briefing.cancelNotes', 'Cancel notes')}:{' '}
          {order.cancellation_notes}
        </Text>
      ) : null}

      {items.length ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
            {t('admin.credits.briefing.items', 'Items')}
          </Text>
          {items.map((item, index) => {
            const label = [item.item_name, item.variant_name]
              .filter(Boolean)
              .join(' · ');
            return (
              <View
                key={`${label}-${index}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: borderRadius.sm,
                      backgroundColor: colors.divider,
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: borderRadius.sm,
                      backgroundColor: colors.divider,
                    }}
                  />
                )}
                <Text
                  style={[
                    typography.caption,
                    { color: colors.text.secondary, flex: 1, minWidth: 0 },
                  ]}
                  numberOfLines={2}
                >
                  {item.quantity}× {label || '—'}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
