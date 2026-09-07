import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

export interface ShippingTrackingFields {
  tracking_number?: string;
  carrier?: string;
}

interface Props {
  visible: boolean;
  mode: 'ship' | 'update';
  initialTracking?: string;
  initialCarrier?: string;
  busy?: boolean;
  onDismiss: () => void;
  onSubmit: (fields: ShippingTrackingFields) => Promise<void>;
}

export function BusinessMarkShippedSheet({
  visible,
  mode,
  initialTracking = '',
  initialCarrier = '',
  busy = false,
  onDismiss,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [tracking, setTracking] = useState(initialTracking);
  const [carrier, setCarrier] = useState(initialCarrier);

  useEffect(() => {
    if (!visible) return;
    setTracking(initialTracking);
    setCarrier(initialCarrier);
  }, [visible, initialCarrier, initialTracking]);

  const submit = async () => {
    const fields: ShippingTrackingFields = {};
    const track = tracking.trim();
    const carry = carrier.trim();
    if (track) fields.tracking_number = track;
    if (carry) fields.carrier = carry;
    await onSubmit(fields);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              maxHeight: screenHeight * 0.85,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="titleLarge" style={{ padding: spacing.md, fontWeight: '700' }}>
            {mode === 'update'
              ? t('orders.shipping.updateTrackingTitle', 'Update tracking')
              : t('orders.shipping.markShippedTitle', 'Mark as shipped')}
          </Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
            <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
              {t(
                'orders.shipping.trackingOptional',
                'Tracking number and carrier are optional.'
              )}
            </Text>
            <TextInput
              mode="outlined"
              label={t('orders.shipping.trackingNumber', 'Tracking number')}
              value={tracking}
              onChangeText={setTracking}
            />
            <TextInput
              mode="outlined"
              label={t('orders.shipping.carrier', 'Carrier')}
              value={carrier}
              onChangeText={setCarrier}
            />
          </ScrollView>
          <View style={[styles.actions, { padding: spacing.md, gap: spacing.sm }]}>
            <Button mode="text" onPress={onDismiss} disabled={busy}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={() => void submit()}
              loading={busy}
              disabled={busy || (mode === 'update' && !tracking.trim())}
            >
              {mode === 'update'
                ? t('orders.shipping.saveTracking', 'Save tracking')
                : t('orders.shipping.markShipped', 'Mark as shipped')}
            </Button>
          </View>
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
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});
