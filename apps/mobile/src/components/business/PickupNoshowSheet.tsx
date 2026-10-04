import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { businessApi } from '../../services/businessApi';
import type { BusinessOrder } from '../../types/business/orders';

type Reason = { id: string; reason: string };
type Preview = {
  canCancel: boolean;
  hours: number;
  cancellationFee: number;
  cancellationFeePercent: number;
  merchantShare: number;
  refundAmount: number;
  currency: string;
};

type Props = {
  visible: boolean;
  order: BusinessOrder;
  onDismiss: () => void;
  onSuccess: () => void;
};

export function PickupNoshowSheet({ visible, order, onDismiss, onSuccess }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [reasonId, setReasonId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
    Promise.all([
      businessApi.pickupNoshow.preview(order.id),
      businessApi.failedPickups.reasons(lang),
    ])
      .then(([next, reasonRes]) => {
        if (cancelled) return;
        setPreview(next);
        setReasons(reasonRes.reasons ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(t('orders.pickupNoshow.loadError', 'Could not load pickup options'));
      });
    return () => {
      cancelled = true;
    };
  }, [visible, order.id, i18n.language, t]);

  const remind = async () => {
    setBusy(true);
    setError(null);
    try {
      await businessApi.pickupNoshow.remind(order.id);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || t('orders.pickupNoshow.remindError', 'Could not send the reminder'));
    } finally {
      setBusy(false);
    }
  };

  const cancelPickup = async () => {
    if (!reasonId) {
      setError(t('orders.failPickup.selectReasonRequired', 'Please select a failure reason'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await businessApi.pickupNoshow.cancel(order.id, reasonId, notes.trim() || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || t('orders.pickupNoshow.cancelError', 'Could not cancel this pickup'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }} onPress={onDismiss}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: colors.background.paper,
            borderTopLeftRadius: borderRadius.xl,
            borderTopRightRadius: borderRadius.xl,
            padding: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            maxHeight: '85%',
          }}
        >
          <ScrollView>
            <Text variant="titleLarge">{t('orders.pickupNoshow.title', 'Client pickup')}</Text>
            <Text variant="bodyMedium" style={{ marginTop: spacing.sm }}>
              {t(
                'orders.pickupNoshow.remindBody',
                'Order #{{orderNumber}} is ready. Send a reminder to come and collect it.',
                { orderNumber: order.order_number }
              )}
            </Text>
            <Button mode="contained" onPress={remind} loading={busy} style={{ marginTop: spacing.md }}>
              {t('orders.pickupNoshow.remind', 'Remind client')}
            </Button>
            {preview?.canCancel ? (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <Text variant="bodySmall">
                  {t(
                    'orders.pickupNoshow.feeLine',
                    'Fee {{fee}} {{currency}} ({{percent}}% of the items). You receive {{share}} {{currency}}. The client gets back {{refund}} {{currency}}.',
                    {
                      fee: preview.cancellationFee.toLocaleString(),
                      share: preview.merchantShare.toLocaleString(),
                      refund: preview.refundAmount.toLocaleString(),
                      currency: preview.currency,
                      percent: preview.cancellationFeePercent,
                    }
                  )}
                </Text>
                {reasons.map((reason) => (
                  <Button
                    key={reason.id}
                    mode={reasonId === reason.id ? 'contained' : 'outlined'}
                    onPress={() => setReasonId(reason.id)}
                  >
                    {reason.reason}
                  </Button>
                ))}
                <TextInput
                  mode="outlined"
                  label={t('orders.failPickup.notesOptional', 'Notes (optional)')}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            ) : preview ? (
              <Text variant="bodySmall" style={{ marginTop: spacing.md, color: colors.text.secondary }}>
                {t(
                  'orders.pickupNoshow.wait',
                  'You can cancel for a no-show after the order has been ready for {{hours}} hours.',
                  { hours: preview.hours }
                )}
              </Text>
            ) : null}
            {error ? (
              <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: spacing.sm }}>
                {error}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.md, gap: spacing.sm }}>
              <Button onPress={onDismiss}>{t('common.close', 'Close')}</Button>
              {preview?.canCancel ? (
                <Button mode="contained" buttonColor={colors.error.main} onPress={cancelPickup} loading={busy}>
                  {t('orders.pickupNoshow.cancel', 'Cancel — client did not pick up')}
                </Button>
              ) : null}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
