import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Button,
  RadioButton,
  Text,
  TextInput,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionLoadingDialog } from '../feedback/ActionLoadingDialog';
import { AppModal } from '../common/AppModal';
import { useTheme } from '../../contexts/ThemeContext';
import {
  fetchBusinessCancellationReasons,
  type CancellationReason,
} from '../../services/businessCancellationReasons';
import type { BusinessOrder } from '../../types/business/orders';
import { businessMayCancelOrder } from '../../utils/businessOrderUtils';

interface Props {
  visible: boolean;
  order: BusinessOrder | null;
  onDismiss: () => void;
  onSubmit: (notes: string) => Promise<void>;
}

export function BusinessCancelOrderDialog({ visible, order, onDismiss, onSubmit }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const otherFocusedRef = useRef(false);
  const [reasons, setReasons] = useState<CancellationReason[]>([]);
  const [loadingReasons, setLoadingReasons] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [otherText, setOtherText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedReason = useMemo(
    () => reasons.find((r) => r.id === selectedId),
    [reasons, selectedId]
  );
  const isOther = selectedReason?.value === 'other';
  const canCancel = order ? businessMayCancelOrder(order) : false;

  const loadReasons = useCallback(() => {
    setLoadingReasons(true);
    setLoadFailed(false);
    void fetchBusinessCancellationReasons()
      .then((list) => {
        setReasons(list);
        setLoadFailed(list.length === 0);
      })
      .catch(() => {
        setReasons([]);
        setLoadFailed(true);
      })
      .finally(() => setLoadingReasons(false));
  }, []);

  useEffect(() => {
    if (!visible) return;
    setSelectedId(null);
    setOtherText('');
    setError(null);
    loadReasons();
  }, [visible, loadReasons]);

  const scrollOtherIntoView = useCallback(() => {
    setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      Platform.OS === 'ios' ? 300 : 150
    );
  }, []);

  const handleOtherFocus = useCallback(() => {
    otherFocusedRef.current = true;
    scrollOtherIntoView();
  }, [scrollOtherIntoView]);

  const handleOtherBlur = useCallback(() => {
    otherFocusedRef.current = false;
  }, []);

  const handleOtherContentSizeChange = useCallback(() => {
    if (otherFocusedRef.current) scrollOtherIntoView();
  }, [scrollOtherIntoView]);

  const handleSelectReason = useCallback((id: number, value: string) => {
    setSelectedId(id);
    setError(null);
    if (value !== 'other') {
      setOtherText('');
      return;
    }
    scrollOtherIntoView();
  }, [scrollOtherIntoView]);

  const canSubmit = useMemo(() => {
    if (!canCancel || !selectedId) return false;
    if (isOther) return otherText.trim().length > 0;
    return true;
  }, [canCancel, selectedId, isOther, otherText]);

  const handleSubmit = useCallback(async () => {
    if (!order) return;
    if (!canCancel) {
      setError(
        t(
          'orders.cannotCancelOrder',
          'This order cannot be cancelled as it has already been picked up by a delivery agent.'
        )
      );
      return;
    }
    if (!selectedId) {
      setError(t('orders.selectCancellationReason', 'Please select a cancellation reason'));
      return;
    }
    if (isOther && !otherText.trim()) {
      setError(t('orders.provideOtherReason', 'Please provide a reason for cancellation'));
      return;
    }
    let notes = selectedReason?.display ?? '';
    if (isOther && otherText.trim()) {
      notes = `other: ${otherText.trim()}`;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(notes);
      onDismiss();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('orders.cancelFailed', 'Failed to cancel order'));
    } finally {
      setSubmitting(false);
    }
  }, [canCancel, isOther, onDismiss, onSubmit, order, otherText, selectedId, selectedReason, t]);

  if (!order) return null;

  return (
    <>
      <AppModal
        visible={visible && !submitting}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onDismiss}
      >
        <KeyboardAvoidingView
          style={[styles.flex, { backgroundColor: colors.pageBackground }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              onPress={onDismiss}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', 'Close')}
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.text.primary} />
            </Pressable>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={24}
              color={colors.warning.main}
            />
            <Text variant="titleLarge" style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>
              {t('business.orders.cancelModalTitle', 'Cancel order')}
            </Text>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={{
              padding: spacing.md,
              paddingBottom: isOther ? spacing.xxl : spacing.lg,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.orderCard,
                {
                  borderRadius: borderRadius.md,
                  borderColor: colors.divider,
                  backgroundColor: colors.pageBackground,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <Text
                variant="labelSmall"
                style={{ color: colors.text.secondary, textTransform: 'uppercase' }}
              >
                {t('business.orders.cancelOrderLabel', 'Order')}
              </Text>
              <Text variant="titleMedium" style={{ fontWeight: '700', marginTop: spacing.xxs }}>
                #{order.order_number}
              </Text>
            </View>

            {!canCancel ? (
              <View
                style={[
                  styles.alertBox,
                  {
                    backgroundColor: colors.errorTint,
                    borderColor: colors.error.light,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    marginBottom: spacing.md,
                  },
                ]}
              >
                <Text variant="bodyMedium" style={{ color: colors.error.main }}>
                  {t(
                    'orders.cannotCancelOrder',
                    'This order cannot be cancelled as it has already been picked up by a delivery agent.'
                  )}
                </Text>
              </View>
            ) : (
              <Text
                variant="bodyMedium"
                style={{ color: colors.text.secondary, marginBottom: spacing.md, lineHeight: 22 }}
              >
                {t(
                  'orders.cancelOrderBusinessDescription',
                  'Please select a reason for canceling this order. The customer will be notified.'
                )}
              </Text>
            )}

            {loadingReasons ? (
              <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.primary.main} />
            ) : null}

            {!loadingReasons && loadFailed ? (
              <View style={{ marginBottom: spacing.md }}>
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
                >
                  {t(
                    'orders.noCancellationReasons',
                    'No cancellation reasons available at this time'
                  )}
                </Text>
                <Button mode="outlined" compact onPress={loadReasons}>
                  {t('common.retry', 'Retry')}
                </Button>
              </View>
            ) : null}

            {!loadingReasons && reasons.length > 0 && canCancel ? (
              <Text
                variant="labelSmall"
                style={{
                  color: colors.text.secondary,
                  marginBottom: spacing.sm,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                {t('business.orders.cancelReasonLabel', 'Cancellation reason')}
              </Text>
            ) : null}

            {!loadingReasons && canCancel && reasons.length > 0 ? (
              <RadioButton.Group
                onValueChange={(v) => {
                  const r = reasons.find((x) => x.id === Number(v));
                  if (r) handleSelectReason(r.id, r.value);
                }}
                value={selectedId != null ? String(selectedId) : ''}
              >
                {reasons.map((r) => {
                  const selected = selectedId === r.id;
                  const showOtherField = r.value === 'other' && selected;
                  return (
                    <View key={r.id} style={{ marginBottom: spacing.sm }}>
                      <Pressable
                        onPress={() => handleSelectReason(r.id, r.value)}
                        style={[
                          styles.reasonCard,
                          {
                            borderRadius: borderRadius.md,
                            borderColor: selected ? colors.primary.light : colors.border,
                            backgroundColor: selected ? colors.primaryTint : colors.surface,
                            paddingVertical: spacing.xs,
                            paddingRight: spacing.sm,
                          },
                        ]}
                      >
                        <RadioButton
                          value={String(r.id)}
                          status={selected ? 'checked' : 'unchecked'}
                          color={colors.primary.main}
                        />
                        <Text
                          variant="bodyLarge"
                          style={{
                            flex: 1,
                            paddingTop: 10,
                            fontWeight: selected ? '600' : '400',
                            color: colors.text.primary,
                          }}
                        >
                          {t(`business.orders.cancellationReasons.${r.value}`, r.display)}
                        </Text>
                      </Pressable>
                      {showOtherField ? (
                        <TextInput
                          mode="outlined"
                          label={t('orders.pleaseSpecify', 'Please specify the reason')}
                          placeholder={t(
                            'orders.otherReasonPlaceholder',
                            'Enter your reason for canceling this order…'
                          )}
                          value={otherText}
                          onChangeText={(text) => {
                            setOtherText(text);
                            setError(null);
                          }}
                          onFocus={handleOtherFocus}
                          onBlur={handleOtherBlur}
                          onContentSizeChange={handleOtherContentSizeChange}
                          multiline
                          numberOfLines={4}
                          style={{ marginTop: spacing.sm, marginLeft: spacing.xs }}
                          disabled={submitting}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </RadioButton.Group>
            ) : null}

            {error ? (
              <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: spacing.md }}>
                {error}
              </Text>
            ) : null}
          </ScrollView>

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
            <Button onPress={onDismiss} disabled={submitting} style={styles.actionBtn}>
              {t('business.orders.keepOrder', 'Keep order')}
            </Button>
            <Button
              mode="contained"
              buttonColor={colors.error.main}
              textColor={colors.onDark}
              loading={submitting}
              disabled={!canSubmit || submitting}
              onPress={() => void handleSubmit()}
              style={styles.actionBtn}
            >
              {submitting
                ? t('orders.cancelling', 'Cancelling…')
                : t('orderActions.cancelOrder', 'Cancel order')}
            </Button>
          </View>
        </KeyboardAvoidingView>
      </AppModal>
      <ActionLoadingDialog visible={submitting} action="cancel_order" />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  orderCard: { borderWidth: StyleSheet.hairlineWidth },
  alertBox: { borderWidth: 1 },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: { minWidth: 120 },
});
