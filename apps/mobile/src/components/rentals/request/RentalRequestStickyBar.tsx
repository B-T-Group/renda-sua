import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';

export interface RentalRequestStickyBarProps {
  totalAmount: string;
  sendLabel: string;
  sendIcon: string;
  sendDisabled: boolean;
  sending: boolean;
  onSend: () => void;
}

export function RentalRequestStickyBar({
  totalAmount,
  sendLabel,
  sendIcon,
  sendDisabled,
  sending,
  onSend,
}: RentalRequestStickyBarProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="rental-request-sticky"
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      <View style={styles.totalRow}>
        <Text style={[styles.totalLabel, { color: colors.text.secondary }]}>
          {t('rentals.requestForm.total', 'Total')}
        </Text>
        <Text testID="rental-request-total" style={[styles.totalValue, { color: colors.primary.main }]}>
          {totalAmount}
        </Text>
      </View>
      <Text style={[styles.legal, { color: colors.text.secondary }]}>
        {t('rentals.searchFirst.nothingCharged', 'Nothing is charged until the business accepts.')}
      </Text>
      <Button
        mode="contained"
        icon={sendIcon}
        onPress={onSend}
        disabled={sendDisabled}
        loading={sending}
        testID="rental-request-send"
        contentStyle={styles.sendContent}
        labelStyle={styles.sendLabel}
        style={{ borderRadius: 12 }}
      >
        {sendLabel}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1, gap: 8 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalLabel: { fontSize: 13, fontWeight: '700' },
  totalValue: { fontSize: 20, fontWeight: '800' },
  legal: { fontSize: 12, lineHeight: 16 },
  sendContent: { height: 48 },
  sendLabel: { fontSize: 15, fontWeight: '700' },
});
