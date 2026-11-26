import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatConfirmationMoney } from '../../../utils/rentals/confirmationFormat';
import { listingReservationFee } from '../../../utils/rentals/reservationFee';

/** Listing setting: ask renters for a flat reservation fee (off by default). On/off only, no amount. */
export function ReservationFeeToggle({ listingId, currency, value, onChange }: { listingId: string; currency?: string | null; value: boolean; onChange: (value: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const amount = formatConfirmationMoney(listingReservationFee(currency), currency || 'CAD', i18n.language);
  return (
    <View testID={`reservation-fee-${listingId}`} style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text>{t('business.rentals.reservationFee.label', 'Ask for a reservation fee')}</Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t('business.rentals.reservationFee.help', 'Ask for a {{amount}} reservation fee. It counts toward the total.', { amount })}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
});
