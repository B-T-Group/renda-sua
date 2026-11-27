import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { AppModal } from '../../common/AppModal';
import { RentalDayHoursSheet } from '../dayHours/RentalDayHoursSheet';
import { useTheme } from '../../../contexts/ThemeContext';
import { MAX_RENTAL_SEARCH_DAYS, type RentalDateRange } from '../../../utils/rentals/rentalSearchDates';
import {
  ANY_TIME_LISTING,
  formatSearchWindowLine,
  pickedDaysFromRange,
  rangeFromPickedDays,
  todayWindow,
  weekendWindow,
  weekWindow,
} from '../../../utils/rentals/rentalSearchWindow';

const SAME_WINDOW = (a: RentalDateRange | null, b: RentalDateRange) =>
  a?.startDate === b.startDate && a?.endDate === b.endDate && a?.startTime === b.startTime && a?.endTime === b.endTime;

export function RentalSearchDateSheet({
  visible,
  value,
  now = new Date(),
  timeZone,
  onChange,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: RentalDateRange | null;
  now?: Date;
  /** Market zone. Shortcut times and the picker's "past" follow this clock. */
  timeZone?: string;
  onChange: (range: RentalDateRange | null) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tooLong, setTooLong] = useState<number | null>(null);
  const nowMs = now.getTime();
  const picks = [
    { id: 'today', label: t('rentals.searchFirst.today', 'Today'), range: todayWindow(nowMs, timeZone) },
    { id: 'weekend', label: t('rentals.searchFirst.weekend', 'This weekend'), range: weekendWindow(nowMs, timeZone) },
    { id: 'week', label: t('rentals.searchFirst.oneWeek', '1 week'), range: weekWindow(nowMs, timeZone) },
  ];
  const canApply = Boolean(value) && tooLong == null && (value?.dayCount ?? 0) <= MAX_RENTAL_SEARCH_DAYS;
  const dayLabel = (count: number) => t('rentals.searchFirst.dayCount', '{{count}} days', { count });

  function choose(range: RentalDateRange) {
    setTooLong(null);
    onChange(range);
  }

  function onPicked(days: Parameters<typeof rangeFromPickedDays>[0]) {
    setPickerOpen(false);
    const range = rangeFromPickedDays(days);
    if (range && range.dayCount > MAX_RENTAL_SEARCH_DAYS) {
      setTooLong(range.dayCount);
      onChange(null);
      return;
    }
    setTooLong(null);
    onChange(range);
  }

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          testID="rental-search-date-sheet"
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.md },
          ]}
        >
          <Text variant="titleLarge" style={{ color: colors.text.primary }}>
            {t('rentals.searchFirst.datesSheetTitle', 'When do you need it?')}
          </Text>
          {value ? (
            <Text testID="rental-search-dates-summary" style={{ color: colors.primary.main, fontWeight: '700' }}>
              {formatSearchWindowLine(value, i18n.language, dayLabel)}
            </Text>
          ) : (
            <Text testID="rental-search-dates-blank" style={{ color: colors.text.secondary }}>
              {t('rentals.searchFirst.datesBlank', 'Pick your days and hours, or choose a shortcut.')}
            </Text>
          )}
          {tooLong != null ? (
            <Text testID="rental-search-dates-too-long" style={{ color: colors.error.main }}>
              {t('rentals.searchFirst.datesTooLong', 'This range is {{count}} days. Choose 30 days or fewer.', { count: tooLong })}
            </Text>
          ) : null}
          <Pressable
            testID="rental-search-choose-times"
            accessibilityRole="button"
            onPress={() => setPickerOpen(true)}
            style={[styles.choose, { borderColor: colors.primary.main, borderRadius: borderRadius.md }]}
          >
            <MaterialCommunityIcons name="calendar-clock" size={22} color={colors.primary.main} />
            <Text style={{ color: colors.primary.main, fontWeight: '700', flex: 1 }}>
              {value
                ? t('rentals.searchFirst.changeDatesTimes', 'Change days and hours')
                : t('rentals.searchFirst.chooseDatesTimes', 'Choose days and hours')}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary.main} />
          </Pressable>
          <View style={styles.picks}>
            {picks.map((pick) => (
              <ShortcutChip key={pick.id} id={pick.id} label={pick.label} selected={SAME_WINDOW(value, pick.range)} onPress={() => choose(pick.range)} />
            ))}
          </View>
          <Button
            mode="contained"
            buttonColor={colors.primary.main}
            disabled={!canApply}
            onPress={() => {
              if (canApply) onApply();
            }}
            testID="rental-search-apply-dates"
          >
            {t('rentals.searchFirst.apply', 'Apply')}
          </Button>
        </Pressable>
        <RentalDayHoursSheet
          visible={pickerOpen}
          listing={ANY_TIME_LISTING}
          currency="XAF"
          language={i18n.language}
          timeZone={timeZone}
          nowMs={nowMs}
          initialDays={value ? pickedDaysFromRange(value) : []}
          onClose={() => setPickerOpen(false)}
          onContinue={(_rows, days) => onPicked(days)}
        />
      </Pressable>
    </AppModal>
  );
}

function ShortcutChip({ id, label, selected, onPress }: { id: string; label: string; selected: boolean; onPress: () => void }) {
  const { colors, borderRadius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      testID={`rental-search-quick-${id}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.pick,
        { backgroundColor: selected ? colors.primary.main : colors.surface, borderColor: colors.primary.main, borderRadius: borderRadius.md },
      ]}
    >
      <Text style={{ color: selected ? colors.primary.contrast : colors.primary.main, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { gap: 12 },
  choose: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, paddingHorizontal: 12, minHeight: 48 },
  picks: { flexDirection: 'row', gap: 8 },
  pick: { flex: 1, borderWidth: 1, minHeight: 40, paddingHorizontal: 6, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
});
