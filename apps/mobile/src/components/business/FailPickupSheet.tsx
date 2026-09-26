import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Button,
  Chip,
  Modal,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { businessApi } from '../../services/businessApi';
import type { BusinessOrder } from '../../types/business/orders';

type PickupFailureReason = {
  id: string;
  reason_key: string;
  reason: string;
};

type Props = {
  visible: boolean;
  order: BusinessOrder;
  onDismiss: () => void;
  onSuccess: () => void;
};

export function FailPickupSheet({
  visible,
  order,
  onDismiss,
  onSuccess,
}: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const [reasons, setReasons] = useState<PickupFailureReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReasons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
      const res = await businessApi.failedPickups.reasons(lang);
      setReasons(res.reasons ?? []);
    } catch (e: any) {
      setError(
        e?.message ??
          t('orders.failPickup.loadReasonsError', 'Failed to load reasons')
      );
    } finally {
      setLoading(false);
    }
  }, [i18n.language, t]);

  useEffect(() => {
    if (!visible) {
      setSelectedId(null);
      setNotes('');
      setError(null);
      return;
    }
    void loadReasons();
  }, [visible, loadReasons]);

  const selected = reasons.find((r) => r.id === selectedId);
  const needsNotes = selected?.reason_key === 'other';
  const canSubmit =
    !!selectedId && (!needsNotes || notes.trim().length > 0) && !submitting;

  const handleConfirm = async () => {
    if (!canSubmit || !selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      await businessApi.failedPickups.fail(order.id, selectedId, notes.trim() || undefined);
      onSuccess();
    } catch (e: any) {
      setError(
        e?.message ??
          t('orders.failPickup.error', 'Failed to mark pickup as failed')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={submitting ? undefined : onDismiss}
        contentContainerStyle={[
          styles.modal,
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: borderRadius.lg,
            borderTopRightRadius: borderRadius.lg,
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="titleLarge" style={{ marginBottom: spacing.sm }}>
            {t('orders.failPickup.title', 'Mark pickup as failed')}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {order.order_number}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginTop: spacing.xs }}
          >
            {t(
              'orders.failPickup.feeNote',
              'The client receives a partial refund after the standard cancellation fee is retained.'
            )}
          </Text>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: spacing.lg }} />
          ) : (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Text variant="titleSmall">
                {t('orders.failPickup.reasonLabel', 'Why did the pickup fail?')}
              </Text>
              <View style={styles.chips}>
                {reasons.map((reason) => (
                  <Chip
                    key={reason.id}
                    selected={selectedId === reason.id}
                    onPress={() => setSelectedId(reason.id)}
                    style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
                  >
                    {reason.reason}
                  </Chip>
                ))}
              </View>
              <TextInput
                mode="outlined"
                label={
                  needsNotes
                    ? t(
                        'orders.failPickup.notesLabel',
                        'Please describe the reason'
                      )
                    : t('orders.failPickup.notesOptional', 'Notes (optional)')
                }
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          {error ? (
            <Text
              variant="bodySmall"
              style={{ color: colors.error.main, marginTop: spacing.sm }}
            >
              {error}
            </Text>
          ) : null}

          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            <Button
              mode="contained"
              buttonColor={colors.error.main}
              onPress={() => void handleConfirm()}
              disabled={!canSubmit}
            >
              {t('orders.failPickup.confirm', 'Mark as failed')}
            </Button>
            <Button mode="outlined" onPress={onDismiss} disabled={submitting}>
              {t('common.close', 'Close')}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '85%',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
