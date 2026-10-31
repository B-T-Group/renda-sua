import { Image, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { DeliveryConfirmationState } from '../../types/deliveryConfirmation';
import { clientShowPendingAutoCompleteNotice } from '../../utils/deliveryConfirmationUi';

type Props = {
  state: DeliveryConfirmationState | null;
  busy?: boolean;
  onConfirm: () => void;
  onReportProblem: () => void;
};

export function ClientConfirmReceiptCard({
  state,
  busy,
  onConfirm,
  onReportProblem,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const hours = state?.autoCompleteHours ?? 2;
  const showNotice = clientShowPendingAutoCompleteNotice(state);
  const photo = state?.photos[0];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Text variant="titleMedium" style={{ color: colors.text.primary }}>
        {t('orders.clientConfirm.push.title', 'Your order has arrived')}
      </Text>
      {showNotice ? (
        <Text style={[{ color: colors.text.secondary }, typography.body2]}>
          {t('orders.clientConfirm.clientFallbackNotice', {
            defaultValue:
              'Your courier marked this order delivered with a photo. Confirm or report a problem within {{h}}h.',
            h: hours,
          })}
        </Text>
      ) : (
        <Text style={[{ color: colors.text.secondary }, typography.body2]}>
          {t('orders.clientConfirm.push.body', 'Tap to confirm you received it.')}
        </Text>
      )}
      {photo ? (
        <Image
          source={{ uri: photo.photoUrl }}
          style={styles.photo}
          resizeMode="cover"
          accessibilityRole="image"
          accessibilityLabel={t('orders.clientConfirm.proofPhoto', 'Delivery photo')}
        />
      ) : null}
      <Button mode="contained" onPress={onConfirm} loading={busy} disabled={busy}>
        {t('orders.clientConfirm.cta.confirm', 'Confirm receipt')}
      </Button>
      <Button mode="outlined" onPress={onReportProblem} disabled={busy}>
        {t('orders.clientConfirm.cta.problem', 'Report a problem')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  photo: { width: '100%', height: 180, borderRadius: 12 },
});
