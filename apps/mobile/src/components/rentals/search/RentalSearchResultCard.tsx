import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatSearchMoney } from '../../../utils/rentals';
import { formatCatalogMoney } from '../../../utils/rentals/rentalRequestFormat';
import { formatRentalDay } from '../../../utils/rentals/rentalRequestFormat';
import { fromHourlyPrice, pickerLang } from '../../../utils/rentals/dayHoursCopy';

export interface RentalSearchCardModel {
  id: string;
  name: string;
  imageUrl?: string | null;
  pricePerDay: number;
  /** Hourly-only listings show "from 3 000 FCFA / h" and no day total. */
  hourlyOnly?: boolean;
  pricePerHour?: number;
  currency: string;
  available: boolean | null;
  totalForDates: number | null;
  /** Daily total can differ from the booking quote, so the card says est. */
  totalIsEstimate: boolean;
  dayCount: number | null;
  nextAvailableDate: string | null;
  rangeLabel: string | null;
  business?: string;
  city?: string;
  inspection?: boolean;
  catalog?: boolean;
}

export function RentalSearchResultCard({
  card,
  onOpen,
  onSeeDates,
}: {
  card: RentalSearchCardModel;
  /** Opens the listing's details page; renting starts there. */
  onOpen: (id: string) => void;
  onSeeDates: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const formatMoney = card.catalog ? formatCatalogMoney : formatSearchMoney;
  const daily = formatMoney(card.pricePerDay, card.currency, i18n.language);
  const place = [card.business, card.city].filter(Boolean).join(', ');
  const showAvailability = card.available != null && card.rangeLabel;
  return (
    <Pressable
      onPress={() => onOpen(card.id)}
      accessibilityRole="button"
      accessibilityLabel={t('rentals.searchFirst.viewDetailsFor', 'View details for {{name}}', { name: card.name })}
      testID={`rental-search-card-${card.id}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          marginBottom: spacing.sm,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.photo, { backgroundColor: colors.disabled }]}>
        {card.imageUrl ? (
          <Image source={{ uri: card.imageUrl }} style={styles.photoImage} resizeMode="cover" />
        ) : (
          <MaterialCommunityIcons name="camera" size={28} color={colors.text.secondary} />
        )}
        {card.inspection ? (
          <View style={styles.inspect} testID={`rental-search-inspection-${card.id}`}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={12} color="#fff" />
            <Text style={styles.inspectText}>{t('rentals.searchFirst.inspection', 'Inspection')}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text variant="titleMedium" style={{ color: colors.text.primary }} numberOfLines={2}>
          {card.name}
        </Text>
        {place ? <Text style={{ color: colors.text.secondary }}>{place}</Text> : null}
        {showAvailability && card.available ? (
          <Text style={[styles.badge, { backgroundColor: colors.cta.soft, color: colors.cta.dark }]}>
            {t('rentals.searchFirst.freeFor', 'Free {{range}}', { range: card.rangeLabel })}
          </Text>
        ) : null}
        {showAvailability && card.available === false ? (
          <Text style={[styles.badge, { backgroundColor: '#FEF3C7', color: colors.warning.dark }]}>
            {t('rentals.searchFirst.availableFrom', 'Available from {{date}}', {
              date: formatRentalDay(card.nextAvailableDate ?? '', i18n.language),
            })}
          </Text>
        ) : null}
        <Text testID={`rental-search-price-${card.id}`} style={{ color: colors.text.primary, fontWeight: '700', marginTop: 6 }}>
          {card.hourlyOnly ? fromHourlyPrice(card.pricePerHour ?? 0, card.currency, pickerLang(i18n.language)) : daily}
          {card.hourlyOnly ? null : ' '}
          {card.hourlyOnly ? null : t('rentals.searchFirst.perDay', '/ day')}
        </Text>
        {!card.hourlyOnly && card.available && card.totalForDates != null && card.dayCount ? (
          <Text style={{ color: colors.text.secondary }} testID={`rental-search-total-${card.id}`}>
            {card.totalIsEstimate
              ? t('rentals.searchFirst.totalEstimate', 'Est. {{amount}} for {{count}} days', {
                  amount: formatMoney(card.totalForDates, card.currency, i18n.language),
                  count: card.dayCount,
                })
              : t('rentals.searchFirst.totalFor', 'Total · {{amount}} for {{count}} days', {
                  amount: formatMoney(card.totalForDates, card.currency, i18n.language),
                  count: card.dayCount,
                })}
          </Text>
        ) : null}
        {!card.rangeLabel && !card.catalog && !card.hourlyOnly ? (
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
            mode="outlined"
            icon="eye-outline"
            textColor={colors.primary.main}
            onPress={() => onOpen(card.id)}
            style={[styles.action, { borderColor: colors.primary.main }]}
            testID={`rental-search-view-${card.id}`}
          >
            {t('rentals.searchFirst.viewDetails', 'View details')}
          </Button>
        )}
      </View>
      <View style={styles.chevron}>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text.secondary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: 1, padding: 10, gap: 12 },
  photo: { width: 92, height: 92, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photoImage: { width: '100%', height: '100%' },
  inspect: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  inspectText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  body: { flex: 1, minWidth: 0 },
  badge: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 8, marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, fontWeight: '600' },
  action: { alignSelf: 'flex-start', marginTop: 8 },
  chevron: { alignSelf: 'center', marginLeft: -4 },
});
