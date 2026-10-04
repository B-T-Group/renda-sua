import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrderRefunds, type RefundRequestReason } from '@/hooks/useOrderRefunds';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { BottomSheet } from '../common/BottomSheet';

const REASONS: RefundRequestReason[] = ['not_delivered', 'wrong_item', 'damaged', 'quality_issue', 'missing_parts', 'other'];

/** Asks for a refund through the existing order refund endpoint. */
export function ClientRefundRequestButton({ orderId }: { orderId: string }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { createRefundRequest, loading, error } = useOrderRefunds();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (reason: RefundRequestReason) => {
    try {
      await createRefundRequest(orderId, { reason });
      setDone(true);
      setOpen(false);
    } catch {
      /* error is stored on the hook */
    }
  };

  if (done) {
    return (
      <AppText role="bodySmall" color={colors.text.muted} style={{ marginBottom: spacing.md }}>
        {t('orders.refunds.requested', 'Your refund request was sent.')}
      </AppText>
    );
  }

  return (
    <View style={{ marginBottom: spacing.md }}>
      <AppButton
        label={t('orders.refunds.request', 'Request a refund')}
        variant="outline"
        size="medium"
        onPress={() => setOpen(true)}
      />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('orders.refunds.request', 'Request a refund')}>
        {REASONS.map((reason) => (
          <Pressable
            key={reason}
            disabled={loading}
            onPress={() => void submit(reason)}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <AppText role="body">{t(`orders.refunds.reasons.${reason}`, reasonLabel(reason))}</AppText>
          </Pressable>
        ))}
        {error ? (
          <AppText role="bodySmall" color={colors.error.main}>{error}</AppText>
        ) : null}
      </BottomSheet>
    </View>
  );
}

function reasonLabel(reason: RefundRequestReason): string {
  if (reason === 'not_delivered') return 'Not delivered';
  if (reason === 'wrong_item') return 'Wrong item';
  if (reason === 'damaged') return 'Damaged';
  if (reason === 'quality_issue') return 'Quality issue';
  if (reason === 'missing_parts') return 'Missing parts';
  return 'Something else';
}
