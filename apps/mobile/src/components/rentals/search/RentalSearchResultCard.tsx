import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatSearchMoney } from '../../../utils/rentals';
import { formatSingleDate } from '../../../utils/rentals/rentalSearchDates';

export interface RentalSearchCardModel {
  id: string;
  name: string;
  imageUrl?: string | null;
  pricePerDay: number;
  currency: string;
  available: boolean | null;
  totalForDates: number | null;
  /** Daily total can differ from the booking quote, so the card says est. */
  totalIsEstimate: boolean;
  dayCount: number | null;
  nextAvailableDate: string | null;
  rangeLabel: string | null;
}

export function RentalSearchResultCard({
  card,
  onRent,
  onSeeDates,
}: {
  card: RentalSearchCardModel;
  onRent: (id: string) => void;
  onSeeDates: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const daily = formatSearchMoney(card.pricePerDay, card.currency, i18n.language);
  const showAvailability = card.available != null && card.rangeLabel;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={[styles.photo, { backgroundColor: colors.disabled }]}>
        {card.imageUrl ? (
          <Image source={{ uri: card.imageUrl }} style={styles.photo} resizeMode="cover" />
        ) : (
          <MaterialCommunityIcons name="camera" size={28} color={colors.text.secondary} />
        )}
      </View>
      <View style={styles.body}>
        <Text variant="titleMedium" style={{ color: colors.text.primary }} numberOfLines={2}>
          {card.name}
        </Text>
        {showAvailability && card.available ? (
          <Text style={[styles.badge, { backgroundColor: colors.cta.soft, color: colors.cta.dark }]}>
            {t('rentals.searchFirst.freeFor', 'Free {{range}}', { range: card.rangeLabel })}
          </Text>
        ) : null}
        {showAvailability && card.available === false ? (
          <Text style={[styles.badge, { backgroundColor: '#FEF3C7', color: colors.warning.dark }]}>
            {t('rentals.searchFirst.availableFrom', 'Available from {{date}}', {
              date: formatSingleDate(card.nextAvailableDate ?? '', i18n.language),
            })}
          </Text>
        ) : null}
        <Text style={{ color: colors.text.primary, fontWeight: '700', marginTop: 6 }}>
          {daily} {t('rentals.searchFirst.perDay', '/ day')}
        </Text>
        {card.available && card.totalForDates != null && card.dayCount ? (
          <Text style={{ color: colors.text.secondary }} testID={`rental-search-total-${card.id}`}>
            {card.totalIsEstimate
              ? t('rentals.searchFirst.totalEstimate', 'Est. {{amount}} for {{count}} days', {
                  amount: formatSearchMoney(card.totalForDates, card.currency, i18n.language),
                  count: card.dayCount,
                })
              : t('rentals.searchFirst.totalFor', 'Total · {{amount}} for {{count}} days', {
                  amount: formatSearchMoney(card.totalForDates, card.currency, i18n.language),
                  count: card.dayCount,
                })}
          </Text>
        ) : null}
        {!card.rangeLabel ? (
          <Text style={{ color: colors.text.secondary, marginTop: 4 }}>
            {t('rentals.searchFirst.totalsAfterDates', 'Totals appear once you add dates')}
          </Text>
        ) : null}
        {card.available === false ? (
          <Button
            mode="outlined"
            icon="calendar"
            onPress={() => onSeeDates(card.id)}
            style={styles.action}
            testID={`rental-search-see-dates-${card.id}`}
          >
            {t('rentals.searchFirst.seeDates', 'See dates')}
          </Button>
        ) : (
          <Button
            mode="contained"
            icon="key-variant"
            buttonColor={colors.primary.main}
            onPress={() => onRent(card.id)}
            style={styles.action}
            testID={`rental-search-rent-${card.id}`}
          >
            {t('rentals.searchFirst.rent', 'Rent')}
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: 1, padding: 10, gap: 12 },
  photo: { width: 92, height: 92, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  badge: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 8, marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, fontWeight: '600' },
  action: { alignSelf: 'flex-start', marginTop: 8 },
});
