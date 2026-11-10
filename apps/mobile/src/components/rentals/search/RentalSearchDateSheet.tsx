import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { AppModal } from '../../common/AppModal';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  formatRangeDates,
  todayRange,
  weekRange,
  weekendRange,
  type RentalDateRange,
} from '../../../utils/rentals/rentalSearchDates';

export function RentalSearchDateSheet({
  visible,
  value,
  onChange,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: RentalDateRange | null;
  onChange: (range: RentalDateRange) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const picks = [
    { id: 'today', label: t('rentals.searchFirst.today', 'Today'), range: todayRange() },
    { id: 'weekend', label: t('rentals.searchFirst.weekend', 'This weekend'), range: weekendRange() },
    { id: 'week', label: t('rentals.searchFirst.oneWeek', '1 week'), range: weekRange() },
  ];
  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          testID="rental-search-date-sheet"
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: borderRadius.xl,
              borderTopRightRadius: borderRadius.xl,
              padding: spacing.md,
            },
          ]}
        >
          <Text variant="titleLarge" style={{ color: colors.text.primary }}>
            {t('rentals.searchFirst.datesSheetTitle', 'When do you need it?')}
          </Text>
          {value ? (
            <Text style={{ color: colors.primary.main, marginTop: spacing.sm, fontWeight: '700' }}>
              {formatRangeDates(value, i18n.language)} · {value.dayCount}
            </Text>
          ) : (
            <Text testID="rental-search-dates-blank" style={{ color: colors.text.secondary, marginTop: spacing.sm }}>
              {t('rentals.searchFirst.datesBlank', 'Choose a start and end, or a shortcut.')}
            </Text>
          )}
          <View style={styles.picks}>
            {picks.map((pick) => (
              <Button
                key={pick.id}
                mode={value?.startDate === pick.range.startDate && value.endDate === pick.range.endDate ? 'contained' : 'outlined'}
                buttonColor={colors.primary.main}
                onPress={() => onChange(pick.range)}
                testID={`rental-search-quick-${pick.id}`}
              >
                {pick.label}
              </Button>
            ))}
          </View>
          <Button mode="contained" buttonColor={colors.primary.main} disabled={!value} onPress={onApply} testID="rental-search-apply-dates">
            {t('rentals.searchFirst.apply', 'Apply')}
          </Button>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { gap: 8 },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
});
