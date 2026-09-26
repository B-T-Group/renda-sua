import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActionLoadingDialog } from '../feedback/ActionLoadingDialog';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessOrder } from '../../types/business/orders';
import type { ConfirmOrderPayload } from '../../types/business/orders';
import type { BusinessRootStackParamList } from '@/navigation/types';

const PRESETS = [15, 30, 45, 60] as const;
const MIN_CUSTOM = 5;
const MAX_CUSTOM = 180;

type ConfirmResponse = {
  success: boolean;
  message?: string;
  pay_after_merchant_confirm?: boolean;
};

interface Props {
  visible: boolean;
  order: BusinessOrder | null;
  onDismiss: () => void;
  onConfirm: (payload: ConfirmOrderPayload) => Promise<ConfirmResponse>;
}

function ReadyClock({ color }: { color: string }) {
  return (
    <Svg width={96} height={96} viewBox="0 0 120 120" accessibilityLabel="Ready time">
      <Circle cx="60" cy="60" r="48" stroke={color} strokeWidth={4} fill="none" opacity={0.25} />
      <Circle cx="60" cy="60" r="6" fill={color} />
      <Line x1="60" y1="60" x2="60" y2="28" stroke={color} strokeWidth={4} strokeLinecap="round" />
      <Line x1="60" y1="60" x2="82" y2="72" stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
    </Svg>
  );
}

export function CookedFoodConfirmOrderDialog({
  visible,
  order,
  onDismiss,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<number | 'custom'>(30);
  const [customMinutes, setCustomMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setSelected(30);
    setCustomMinutes('');
    setError(null);
  }, [visible, order?.id]);

  const resolveMinutes = useCallback((): number | null => {
    if (selected !== 'custom') return selected;
    const parsed = Number.parseInt(customMinutes, 10);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < MIN_CUSTOM || parsed > MAX_CUSTOM) return null;
    return parsed;
  }, [customMinutes, selected]);

  const handleSubmit = async () => {
    if (!order) return;
    const readyInMinutes = resolveMinutes();
    if (readyInMinutes == null) {
      setError(
        t(
          'orders.cookedFood.invalidReadyMinutes',
          'Enter a ready time between {{min}} and {{max}} minutes.',
          { min: MIN_CUSTOM, max: MAX_CUSTOM }
        )
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await onConfirm({ orderId: order.id, ready_in_minutes: readyInMinutes });
      if (result.pay_after_merchant_confirm) {
        setStep(2);
      } else {
        onDismiss();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('business.orders.confirmFailed', 'Failed to confirm'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <>
      <Portal>
        <Modal
          visible={visible && !submitting}
          onDismiss={onDismiss}
          contentContainerStyle={[
            styles.sheet,
            {
              width,
              height,
              backgroundColor: colors.surface,
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <Text variant="titleLarge" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
            {step === 1
              ? t('orders.cookedFood.confirmTitle', 'When will it be ready?')
              : t('orders.cookedFood.waitPaymentTitle', 'Waiting for payment')}
            {' · '}
            #{order.order_number}
          </Text>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            {step === 1 ? (
              <View style={{ alignItems: 'center', gap: spacing.md }}>
                <ReadyClock color={colors.primary.main} />
                <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center' }}>
                  {t(
                    'orders.cookedFood.readyHint',
                    'Choose how long you need to prepare this cooked-food pickup order.'
                  )}
                </Text>
                <View style={styles.chips}>
                  {PRESETS.map((m) => (
                    <Chip
                      key={m}
                      selected={selected === m}
                      onPress={() => setSelected(m)}
                      disabled={submitting}
                    >
                      {t('orders.cookedFood.minutesChip', '{{m}} min', { m })}
                    </Chip>
                  ))}
                  <Chip
                    selected={selected === 'custom'}
                    onPress={() => setSelected('custom')}
                    disabled={submitting}
                  >
                    {t('orders.cookedFood.customChip', 'Custom')}
                  </Chip>
                </View>
                {selected === 'custom' ? (
                  <TextInput
                    mode="outlined"
                    label={t('orders.cookedFood.customMinutes', 'Minutes until ready')}
                    value={customMinutes}
                    onChangeText={(v) => setCustomMinutes(v.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    disabled={submitting}
                  />
                ) : null}
                {error ? (
                  <Text style={{ color: colors.error.main }} variant="bodySmall">
                    {error}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
                {t(
                  'orders.cookedFood.waitPaymentBody',
                  'We sent the client a mobile money payment request. Wait until you receive a payment notification before you start cooking.'
                )}
              </Text>
            )}
          </ScrollView>
          <View style={[styles.actions, { paddingHorizontal: spacing.lg, gap: spacing.sm }]}>
            {step === 1 ? (
              <>
                <Button onPress={onDismiss} disabled={submitting}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button mode="contained" loading={submitting} onPress={() => void handleSubmit()}>
                  {t('orders.cookedFood.confirmReady', 'Confirm ready time')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  mode="contained"
                  onPress={() => {
                    onDismiss();
                    navigation.navigate('BusinessDashboard');
                  }}
                >
                  {t('orders.cookedFood.returnDashboard', 'Return to dashboard')}
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => {
                    onDismiss();
                    navigation.navigate('BusinessOrdersList');
                  }}
                >
                  {t('orders.cookedFood.viewOrdersToCook', 'View orders to cook')}
                </Button>
              </>
            )}
          </View>
        </Modal>
      </Portal>
      <ActionLoadingDialog visible={submitting} action="confirm_order" />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { margin: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  actions: { marginTop: 'auto' },
});
