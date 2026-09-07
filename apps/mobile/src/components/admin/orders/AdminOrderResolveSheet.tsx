import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

export type CreditContactChannel = 'in_app_message' | 'call' | 'email';
export type CreditOrderResult =
  | 'order_cancelled'
  | 'confirmed'
  | 'system_cancelled';

export interface ResolveEscalationPayload {
  contact_channel: CreditContactChannel;
  order_result: CreditOrderResult;
  notes: string;
}

export interface AdminOrderResolveSheetProps {
  visible: boolean;
  submitting: boolean;
  onDismiss: () => void;
  onSubmit: (payload: ResolveEscalationPayload) => Promise<void>;
}

const CHANNELS: CreditContactChannel[] = ['call', 'in_app_message', 'email'];
const RESULTS: CreditOrderResult[] = [
  'confirmed',
  'order_cancelled',
  'system_cancelled',
];

export function AdminOrderResolveSheet({
  visible,
  submitting,
  onDismiss,
  onSubmit,
}: AdminOrderResolveSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [channel, setChannel] = useState<CreditContactChannel>('call');
  const [result, setResult] = useState<CreditOrderResult>('confirmed');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setChannel('call');
    setResult('confirmed');
    setNotes('');
    setError(null);
  }, [visible]);

  const canSubmit = !submitting && notes.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await onSubmit({
        contact_channel: channel,
        order_result: result,
        notes: notes.trim(),
      });
      setNotes('');
      onDismiss();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.orders.actionFailed', 'Action failed')
      );
    }
  };

  const channelLabel = (value: CreditContactChannel) => {
    if (value === 'call') return t('admin.credits.channel.call', 'Call');
    if (value === 'email') return t('admin.credits.channel.email', 'Email');
    return t('admin.credits.channel.inApp', 'In-app message');
  };

  const resultLabel = (value: CreditOrderResult) => {
    if (value === 'confirmed') {
      return t('admin.credits.result.confirmed', 'Confirmed');
    }
    if (value === 'order_cancelled') {
      return t('admin.credits.result.cancelled', 'Order cancelled');
    }
    return t('admin.credits.result.systemCancelled', 'System cancelled');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={onDismiss}
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
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              gap: spacing.sm,
              padding: spacing.md,
            }}
          >
            <Text variant="titleLarge">
              {t('admin.credits.resolveTitle', 'Record how you handled this')}
            </Text>
            <Text style={[typography.body2, { color: colors.text.secondary }]}>
              {t(
                'admin.credits.resolveHint',
                'This records the outcome. It does not change the order status by itself.'
              )}
            </Text>

            <Text variant="titleSmall">
              {t('admin.credits.contactChannel', 'How you reached them')}
            </Text>
            <View style={[styles.rowWrap, { gap: spacing.xs }]}>
              {CHANNELS.map((value) => (
                <Button
                  key={value}
                  mode={channel === value ? 'contained' : 'outlined'}
                  compact
                  onPress={() => setChannel(value)}
                  style={{ minHeight: 44 }}
                >
                  {channelLabel(value)}
                </Button>
              ))}
            </View>

            <Text variant="titleSmall">
              {t('admin.credits.orderResult', 'What happened')}
            </Text>
            <View style={[styles.rowWrap, { gap: spacing.xs }]}>
              {RESULTS.map((value) => (
                <Button
                  key={value}
                  mode={result === value ? 'contained' : 'outlined'}
                  compact
                  onPress={() => setResult(value)}
                  style={{ minHeight: 44 }}
                >
                  {resultLabel(value)}
                </Button>
              ))}
            </View>

            <TextInput
              mode="outlined"
              label={t('admin.credits.comments', 'Comments')}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
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
                {t('admin.credits.resolveSubmit', 'Resolve')}
              </Button>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});
