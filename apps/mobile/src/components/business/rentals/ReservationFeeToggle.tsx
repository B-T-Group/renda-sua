import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';

/** Listing setting: ask renters for a reservation fee (off by default). */
export function ReservationFeeToggle({ listingId, currency, value, onChange }: { listingId: string; currency?: string | null; value: boolean; onChange: (value: boolean) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const fcfa = currency?.toUpperCase() === 'XAF' || currency?.toUpperCase() === 'XOF';
  return (
    <View testID={`reservation-fee-${listingId}`} style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text>{t('business.rentals.reservationFee.label', 'Ask for a reservation fee')}</Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {fcfa
            ? t('business.rentals.reservationFee.helpFcfa', '10% of the rental, at least 150 FCFA. It counts toward the total. You keep it if the renter cancels on the pickup day or doesn’t come.')
            : t('business.rentals.reservationFee.help', '10% of the rental, at least $2.00. It counts toward the total. You keep it if the renter cancels on the pickup day or doesn’t come.')}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
});
