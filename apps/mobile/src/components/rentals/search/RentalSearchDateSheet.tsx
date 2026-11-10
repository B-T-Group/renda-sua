import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { AppModal } from '../../common/AppModal';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  describeRentalDateRange,
  formatIsoDate,
  formatRangeDates,
  MAX_RENTAL_SEARCH_DAYS,
  parseIsoLocal,
  startOfLocalDay,
  todayRange,
  weekRange,
  weekendRange,
  type RentalDateRange,
} from '../../../utils/rentals/rentalSearchDates';

export function RentalSearchDateSheet({
  visible,
  value,
  now = new Date(),
  onChange,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: RentalDateRange | null;
  now?: Date;
  onChange: (range: RentalDateRange | null) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const [cursor, setCursor] = useState(() => startOfLocalDay(now));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [tooLong, setTooLong] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStart(value?.startDate ?? null);
    setEnd(value?.endDate ?? null);
    setTooLong(null);
    const anchor = value ? parseIsoLocal(value.startDate) : startOfLocalDay(now);
    if (anchor) setCursor(anchor);
    // Reset only when the sheet opens. A too-long tap clears `value` and must keep the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const picks = [
    { id: 'today', label: t('rentals.searchFirst.today', 'Today'), range: todayRange(now) },
    { id: 'weekend', label: t('rentals.searchFirst.weekend', 'This weekend'), range: weekendRange(now) },
    { id: 'week', label: t('rentals.searchFirst.oneWeek', '1 week'), range: weekRange(now) },
  ];
  const canApply = Boolean(value) && tooLong == null && (value?.dayCount ?? 0) <= MAX_RENTAL_SEARCH_DAYS;
  const monthLabel = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(cursor);
  const cells = monthCells(cursor.getFullYear(), cursor.getMonth());

  function choose(range: RentalDateRange) {
    setStart(range.startDate);
    setEnd(range.endDate);
    setTooLong(null);
    const anchor = parseIsoLocal(range.startDate);
    if (anchor) setCursor(anchor);
    onChange(range);
  }

  function onDay(iso: string) {
    if (!start || end) {
      setStart(iso);
      setEnd(null);
      setTooLong(null);
      onChange(null);
      return;
    }
    if (iso === start) return;
    const [from, to] = iso < start ? [iso, start] : [start, iso];
    const fromDate = parseIsoLocal(from);
    const toDate = parseIsoLocal(to);
    if (!fromDate || !toDate) return;
    const described = describeRentalDateRange(fromDate, toDate);
    setStart(from);
    setEnd(to);
    if (described.status === 'too_long') {
      setTooLong(described.dayCount);
      onChange(null);
      return;
    }
    setTooLong(null);
    onChange(described.status === 'ok' ? described.range : null);
  }

  const summary =
    tooLong != null && start && end
      ? formatRangeDates({ startDate: start, endDate: end, dayCount: tooLong }, i18n.language)
      : value
        ? `${formatRangeDates(value, i18n.language)} · ${value.dayCount}`
        : null;

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
          {summary ? (
            <Text style={{ color: colors.primary.main, marginTop: spacing.sm, fontWeight: '700' }}>
              {summary}
            </Text>
          ) : start ? (
            <Text testID="rental-search-dates-pick-end" style={{ color: colors.text.secondary, marginTop: spacing.sm }}>
              {t('rentals.searchFirst.datesPickEnd', 'Now choose the end date.')}
            </Text>
          ) : (
            <Text testID="rental-search-dates-blank" style={{ color: colors.text.secondary, marginTop: spacing.sm }}>
              {t('rentals.searchFirst.datesBlank', 'Choose a start and end, or a shortcut.')}
            </Text>
          )}
          {tooLong != null ? (
            <Text testID="rental-search-dates-too-long" style={{ color: colors.error.main, marginTop: spacing.xs }}>
              {t('rentals.searchFirst.datesTooLong', 'This range is {{count}} days. Choose 30 days or fewer.', {
                count: tooLong,
              })}
            </Text>
          ) : null}
          <View style={styles.monthRow}>
            <Pressable onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} testID="rental-search-cal-prev" accessibilityRole="button">
              <Text style={{ color: colors.primary.main, fontWeight: '700' }}>‹</Text>
            </Pressable>
            <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{monthLabel}</Text>
            <Pressable onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} testID="rental-search-cal-next" accessibilityRole="button">
              <Text style={{ color: colors.primary.main, fontWeight: '700' }}>›</Text>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {cells.map((day, index) => {
              if (!day) return <View key={`pad-${index}`} style={styles.day} />;
              const iso = formatIsoDate(day);
              const selected = iso === start || iso === end;
              const inside = Boolean(start && end && iso > start && iso < end);
              return (
                <Pressable
                  key={iso}
                  testID={`rental-search-day-${iso}`}
                  onPress={() => onDay(iso)}
                  style={[
                    styles.day,
                    {
                      backgroundColor: selected ? colors.primary.main : inside ? colors.primary.main + '22' : 'transparent',
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                >
                  <Text style={{ color: selected ? colors.primary.contrast : colors.text.primary, fontSize: 13 }}>
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.picks}>
            {picks.map((pick) => (
              <Button
                key={pick.id}
                mode={value?.startDate === pick.range.startDate && value.endDate === pick.range.endDate ? 'contained' : 'outlined'}
                buttonColor={colors.primary.main}
                onPress={() => choose(pick.range)}
                testID={`rental-search-quick-${pick.id}`}
              >
                {pick.label}
              </Button>
            ))}
          </View>
          <Button
            mode="contained"
            buttonColor={colors.primary.main}
            disabled={!canApply}
            onPress={() => {
              if (!canApply) return;
              onApply();
            }}
            testID="rental-search-apply-dates"
          >
            {t('rentals.searchFirst.apply', 'Apply')}
          </Button>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

function monthCells(year: number, month: number): Array<Date | null> {
  const first = new Date(year, month, 1);
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= count; day += 1) cells.push(new Date(year, month, day));
  return cells;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { gap: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
});
