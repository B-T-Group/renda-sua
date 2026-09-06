import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Button,
  Divider,
  Modal,
  Portal,
  RadioButton,
  Text,
  TextInput,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { agentApi } from '../../services/agentApi';
import type { CancellationPreview, CancellationReason, Order, RefundType } from '../../types/agent';
import { useCancellationPreview } from '../../hooks/useCancellationPreview';
import { ActionLoadingDialog } from '../feedback/ActionLoadingDialog';
import { trackCancellationEvent } from '../../utils/cancellationAnalytics';

interface Props {
  visible: boolean;
  order: Order;
  onDismiss: () => void;
  onSuccess: () => void;
}

export function CancellationConfirmSheet({ visible, order, onDismiss, onSuccess }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { preview, loading: previewLoading, error: previewError, refetch } = useCancellationPreview(
    visible ? order.id : null
  );

  const [selectedReasonId, setSelectedReasonId] = useState<number | null>(null);
  const [otherText, setOtherText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedReason = preview?.availableCancellationReasons.find(
    (r) => r.id === selectedReasonId
  );
  const isOther = selectedReason?.value === 'other';
  const canConfirm =
    !!preview?.canCancel &&
    selectedReasonId !== null &&
    (!isOther || otherText.trim().length > 0);

  const handleDismiss = useCallback(() => {
    if (submitting) return;
    trackCancellationEvent('cancellation_abandoned', {
      orderId: order.id,
      reasonSelected: selectedReasonId !== null,
    });
    setSelectedReasonId(null);
    setOtherText('');
    setSubmitError(null);
    onDismiss();
  }, [submitting, order.id, selectedReasonId, onDismiss]);

  const handleConfirm = useCallback(async () => {
    if (!canConfirm || !preview) return;
    setSubmitting(true);
    setSubmitError(null);
    trackCancellationEvent('cancellation_confirmed', {
      orderId: order.id,
      reasonId: selectedReasonId,
      hasNotes: isOther && otherText.trim().length > 0,
    });
    try {
      const notes = isOther ? otherText.trim() : selectedReason?.display;
      const res = await agentApi.orders.cancel({
        orderId: order.id,
        cancellationReasonId: selectedReasonId ?? undefined,
        notes: notes,
      });
      if (res.success) {
        setSelectedReasonId(null);
        setOtherText('');
        onSuccess();
      } else {
        setSubmitError(res.message ?? t('orderActions.cancelFailed', 'Could not cancel order.'));
      }
    } catch (e: any) {
      setSubmitError(e?.message ?? t('orderActions.cancelFailed', 'Could not cancel order.'));
    } finally {
      setSubmitting(false);
    }
  }, [canConfirm, preview, order.id, selectedReasonId, isOther, otherText, selectedReason, t, onSuccess]);

  if (!visible) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={[
          styles.modal,
          {
            width,
            maxHeight: height - insets.top - 32,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.surface,
            borderTopLeftRadius: borderRadius.lg,
            borderTopRightRadius: borderRadius.lg,
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Text variant="titleLarge" style={{ marginBottom: spacing.sm }}>
            {t('cancellation.preview.title', 'Cancel order?')}
          </Text>

          {/* Order summary */}
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.pageBackground,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.md,
              },
            ]}
          >
            <Text variant="titleSmall" style={{ color: colors.text.primary }}>
              {order.order_number}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
              {(order as any).business?.name ?? ''}
            </Text>
            <Text variant="bodyMedium" style={{ marginTop: spacing.xs, fontWeight: '600' }}>
              {order.total_amount?.toLocaleString()} {order.currency}
            </Text>
          </View>

          {previewLoading && (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <ActivityIndicator />
              <Text
                variant="bodySmall"
                style={{ color: colors.text.secondary, marginTop: spacing.sm }}
              >
                {t('cancellation.preview.loading', 'Checking cancellation policy…')}
              </Text>
            </View>
          )}

          {previewError && !previewLoading && (
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Text variant="bodyMedium" style={{ color: colors.error.main, textAlign: 'center' }}>
                {t('cancellation.preview.loadError', 'Unable to load cancellation info. Try again.')}
              </Text>
              <Button onPress={refetch} style={{ marginTop: spacing.sm }}>
                {t('common.retry', 'Retry')}
              </Button>
            </View>
          )}

          {preview && !previewLoading && (
            <>
              {preview.canCancel ? (
                <CancellationDetails
                  preview={preview}
                  colors={colors}
                  spacing={spacing}
                  borderRadius={borderRadius}
                  t={t}
                />
              ) : (
                <BlockedState
                  reason={preview.reasonIfBlocked ?? 'blocked.terminalStatus'}
                  colors={colors}
                  spacing={spacing}
                  t={t}
                />
              )}

              {preview.canCancel && (
                <>
                  <Divider style={{ marginVertical: spacing.md }} />
                  <ReasonSelector
                    reasons={preview.availableCancellationReasons}
                    selectedId={selectedReasonId}
                    onSelect={(id) => {
                      setSelectedReasonId(id);
                      trackCancellationEvent('cancellation_reason_selected', {
                        orderId: order.id,
                        reasonValue:
                          preview.availableCancellationReasons.find((r) => r.id === id)?.value ?? '',
                      });
                    }}
                    otherText={otherText}
                    onOtherTextChange={setOtherText}
                    isOther={isOther}
                    colors={colors}
                    spacing={spacing}
                    t={t}
                  />
                </>
              )}
            </>
          )}

          {submitError && (
            <Text
              variant="bodySmall"
              style={{ color: colors.error.main, marginTop: spacing.sm, textAlign: 'center' }}
            >
              {submitError}
            </Text>
          )}

          {/* Action buttons */}
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            {preview?.canCancel && (
              <Button
                mode="contained"
                buttonColor={colors.error.main}
                onPress={() => void handleConfirm()}
                disabled={!canConfirm || submitting}
              >
                {t('cancellation.actions.cancelOrder', 'Cancel Order')}
              </Button>
            )}
            <Button mode="outlined" onPress={handleDismiss} disabled={submitting}>
              {preview?.canCancel
                ? t('cancellation.actions.keepOrder', 'Keep Order')
                : t('common.close', 'Close')}
            </Button>
          </View>
        </ScrollView>
      </Modal>

      <ActionLoadingDialog
        visible={submitting}
        action="cancel_order"
        message={t('cancellation.actions.cancelling', 'Cancelling…')}
      />
    </Portal>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CancellationDetails({
  preview,
  colors,
  spacing,
  borderRadius,
  t,
}: {
  preview: CancellationPreview;
  colors: any;
  spacing: any;
  borderRadius: any;
  t: (key: string, fallback: string, opts?: object) => string;
}) {
  return (
    <View>
      <RefundBadge refundType={preview.refundType} colors={colors} spacing={spacing} t={t} />

      {preview.cancellationFee > 0 && (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: spacing.xs }}
        >
          {t('cancellation.refund.feeDeducted', 'Cancellation fee: {{amount}} {{currency}}', {
            amount: preview.cancellationFee.toLocaleString(),
            currency: preview.refundCurrency,
          })}
        </Text>
      )}

      {preview.refundAmount > 0 &&
        preview.refundType !== 'none' &&
        preview.refundType !== 'authorization_release' && (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: spacing.xs }}
        >
          {t('cancellation.refund.netRefund', 'Net refund: {{amount}} {{currency}}', {
            amount: preview.refundAmount.toLocaleString(),
            currency: preview.refundCurrency,
          })}
        </Text>
      )}

      {preview.estimatedRefundProcessingTime ? (
        <ProcessingTimeNote
          key_={preview.estimatedRefundProcessingTime}
          colors={colors}
          spacing={spacing}
          t={t}
        />
      ) : null}

      {preview.cancellationConsequences.length > 0 && (
        <View
          style={{
            marginTop: spacing.md,
            backgroundColor: colors.pageBackground,
            borderRadius: borderRadius.md,
            padding: spacing.sm,
            gap: spacing.xs,
          }}
        >
          {preview.cancellationConsequences.map((key) => (
            <ConsequenceRow key={key} i18nKey={key} colors={colors} spacing={spacing} t={t} />
          ))}
        </View>
      )}
    </View>
  );
}

function RefundBadge({
  refundType,
  colors,
  spacing,
  t,
}: {
  refundType: RefundType;
  colors: any;
  spacing: any;
  t: (key: string, fallback: string) => string;
}) {
  const configs: Record<RefundType, { label: string; bg: string; text: string }> = {
    full: {
      label: t('cancellation.refund.full', 'You will receive a full refund.'),
      bg: colors.success.main + '20',
      text: colors.success.dark,
    },
    partial: {
      label: t('cancellation.refund.partial', 'You will receive a partial refund.'),
      bg: colors.warning.main + '20',
      text: colors.warning.dark,
    },
    none: {
      label: t('cancellation.refund.none', 'This order is not eligible for a refund.'),
      bg: colors.error.main + '15',
      text: colors.error.dark,
    },
    wallet_credit: {
      label: t('cancellation.refund.walletCredit', 'Your balance will be credited to your wallet.'),
      bg: colors.info.main + '20',
      text: colors.info.dark,
    },
    authorization_release: {
      label: t(
        'cancellation.refund.authorizationRelease',
        'Your card authorization will be released. You will not be charged.'
      ),
      bg: colors.info.main + '20',
      text: colors.info.dark,
    },
  };
  const cfg = configs[refundType] ?? configs.none;
  return (
    <View
      style={{
        backgroundColor: cfg.bg,
        borderRadius: 8,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        alignSelf: 'flex-start',
        marginBottom: spacing.xs,
      }}
    >
      <Text variant="bodyMedium" style={{ color: cfg.text, fontWeight: '600' }}>
        {cfg.label}
      </Text>
    </View>
  );
}

function ProcessingTimeNote({
  key_,
  colors,
  spacing,
  t,
}: {
  key_: string;
  colors: any;
  spacing: any;
  t: (key: string, fallback: string) => string;
}) {
  const labelMap: Record<string, string> = {
    stripe_5_10_business_days: t(
      'cancellation.refund.stripe_timeline',
      'Refunds typically appear within 5–10 business days.'
    ),
    mobile_money_provider: t(
      'cancellation.refund.mobileMoney_timeline',
      'Refund processing depends on your mobile money provider.'
    ),
    wallet_immediate: t(
      'cancellation.refund.wallet_timeline',
      'Your wallet will be credited immediately.'
    ),
    authorization_release_immediate: t(
      'cancellation.refund.authorizationRelease_timeline',
      'The hold on your card is released immediately.'
    ),
  };
  const label = labelMap[key_] ?? '';
  if (!label) return null;
  return (
    <Text
      variant="bodySmall"
      style={{ color: colors.text.secondary, marginTop: spacing.xs, fontStyle: 'italic' }}
    >
      {label}
    </Text>
  );
}

function ConsequenceRow({
  i18nKey,
  colors,
  spacing,
  t,
}: {
  i18nKey: string;
  colors: any;
  spacing: any;
  t: (key: string, fallback: string) => string;
}) {
  const fallbacks: Record<string, string> = {
    'consequences.businessNotified': 'The business will be notified.',
    'consequences.clientNotified': 'The client will be notified.',
    'consequences.agentNotified': 'The assigned agent will be notified.',
    'consequences.cannotBeUndone': 'This action cannot be undone.',
    'consequences.orderHistoryRetained': 'Your order history will remain available.',
  };
  const label = t(`cancellation.${i18nKey}`, fallbacks[i18nKey] ?? i18nKey);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
      <MaterialCommunityIcons
        name="information-outline"
        size={14}
        color={colors.text.secondary}
        style={{ marginTop: 2 }}
      />
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, flex: 1, flexWrap: 'wrap' }}
      >
        {label}
      </Text>
    </View>
  );
}

function BlockedState({
  reason,
  colors,
  spacing,
  t,
}: {
  reason: string;
  colors: any;
  spacing: any;
  t: (key: string, fallback: string) => string;
}) {
  const fallbacks: Record<string, string> = {
    'blocked.agentAssigned': 'A delivery agent has already been assigned to this order.',
    'blocked.terminalStatus': 'This order can no longer be cancelled.',
    'blocked.alreadyCancelled': 'This order has already been cancelled.',
    'consequences.terminalStatus': 'This order can no longer be cancelled.',
    'consequences.notAuthorized': 'You are not authorized to cancel this order.',
  };
  const label = t(`cancellation.${reason}`, fallbacks[reason] ?? 'This order cannot be cancelled.');
  return (
    <View
      style={{
        backgroundColor: colors.error.main + '15',
        borderRadius: 8,
        padding: spacing.md,
        marginVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
      }}
    >
      <MaterialCommunityIcons name="cancel" size={20} color={colors.error.main} />
      <Text variant="bodyMedium" style={{ color: colors.error.dark, flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}

function ReasonSelector({
  reasons,
  selectedId,
  onSelect,
  otherText,
  onOtherTextChange,
  isOther,
  colors,
  spacing,
  t,
}: {
  reasons: CancellationReason[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  otherText: string;
  onOtherTextChange: (v: string) => void;
  isOther: boolean;
  colors: any;
  spacing: any;
  t: (key: string, fallback: string) => string;
}) {
  return (
    <View>
      <Text variant="titleSmall" style={{ marginBottom: spacing.sm }}>
        {t('cancellation.reasons.title', 'Why are you cancelling?')}
      </Text>
      <RadioButton.Group
        onValueChange={(val) => onSelect(Number(val))}
        value={selectedId !== null ? String(selectedId) : ''}
      >
        {reasons.map((reason) => (
          <RadioButton.Item
            key={reason.id}
            label={reason.display}
            value={String(reason.id)}
            mode="android"
            style={{ paddingVertical: 4 }}
          />
        ))}
      </RadioButton.Group>
      {isOther && (
        <TextInput
          mode="outlined"
          label={t('cancellation.reasons.otherPlaceholder', 'Please describe your reason…')}
          value={otherText}
          onChangeText={onOtherTextChange}
          multiline
          numberOfLines={3}
          style={{ marginTop: spacing.sm }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  summaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
});
