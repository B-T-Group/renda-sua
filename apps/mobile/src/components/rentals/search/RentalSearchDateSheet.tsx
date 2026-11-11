import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { AppModal } from '../../common/AppModal';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  calendarDateInTimeZone,
  describeRentalDateRange,
  formatIsoDate,
  formatRangeDates,
  MAX_RENTAL_SEARCH_DAYS,
  parseIsoLocal,
  todayRange,
  weekRange,
  weekendRange,
  type RentalDateRange,
} from '../../../utils/rentals/rentalSearchDates';

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
  /** Market zone. Past days and the opening month follow this clock. */
  timeZone?: string;
  onChange: (range: RentalDateRange | null) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const today = calendarDateInTimeZone(now, timeZone);
  const marketNow = new Date(today.year, today.month - 1, today.day, 12);
  const [cursor, setCursor] = useState(() => new Date(today.year, today.month - 1, 1));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [tooLong, setTooLong] = useState<number | null>(null);
  const [daySize, setDaySize] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setStart(value?.startDate ?? null);
    setEnd(value?.endDate ?? null);
    setTooLong(null);
    const opened = calendarDateInTimeZone(now, timeZone);
    const anchor = value && value.startDate >= opened.iso ? parseIsoLocal(value.startDate) : null;
    setCursor(anchor ?? new Date(opened.year, opened.month - 1, 1));
    // Reset only when the sheet opens. A too-long tap clears `value` and must keep the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const picks = [
    { id: 'today', label: t('rentals.searchFirst.today', 'Today'), range: todayRange(marketNow) },
    { id: 'weekend', label: t('rentals.searchFirst.weekend', 'This weekend'), range: weekendRange(marketNow) },
    { id: 'week', label: t('rentals.searchFirst.oneWeek', '1 week'), range: weekRange(marketNow) },
  ];
  const canApply = Boolean(value) && tooLong == null && (value?.dayCount ?? 0) <= MAX_RENTAL_SEARCH_DAYS;
  const atCurrentMonth = cursor.getFullYear() === today.year && cursor.getMonth() === today.month - 1;
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
    if (iso < today.iso) return;
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
            <Pressable
              onPress={() => {
                if (atCurrentMonth) return;
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
              }}
              testID="rental-search-cal-prev"
              accessibilityRole="button"
              accessibilityState={{ disabled: atCurrentMonth }}
            >
              <Text style={{ color: atCurrentMonth ? colors.text.disabled : colors.primary.main, fontWeight: '700' }}>‹</Text>
            </Pressable>
            <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{monthLabel}</Text>
            <Pressable onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} testID="rental-search-cal-next" accessibilityRole="button">
              <Text style={{ color: colors.primary.main, fontWeight: '700' }}>›</Text>
            </Pressable>
          </View>
          <View
            style={styles.grid}
            onLayout={(event) => {
              const next = event.nativeEvent.layout.width / 7;
              setDaySize((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
            }}
          >
            {cells.map((day, index) => {
              if (!day) return <View key={`pad-${index}`} style={[styles.day, dayFrame(daySize)]} />;
              const iso = formatIsoDate(day);
              const past = iso < today.iso;
              const selected = !past && (iso === start || iso === end);
              const inside = !past && Boolean(start && end && iso > start && iso < end);
              return (
                <Pressable
                  key={iso}
                  testID={`rental-search-day-${iso}`}
                  onPress={() => onDay(iso)}
                  disabled={past}
                  accessibilityState={{ disabled: past }}
                  style={[
                    styles.day,
                    dayFrame(daySize),
                    {
                      backgroundColor: selected ? colors.primary.main : inside ? colors.primary.main + '22' : 'transparent',
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                >
                  <DayNumber
                    label={day.getDate()}
                    color={past ? colors.text.disabled : selected ? colors.primary.contrast : colors.text.primary}
                  />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.picks}>
            {picks.map((pick) => {
              const selected = value?.startDate === pick.range.startDate && value?.endDate === pick.range.endDate;
              return (
                <Pressable
                  key={pick.id}
                  onPress={() => choose(pick.range)}
                  testID={`rental-search-quick-${pick.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.pick,
                    {
                      backgroundColor: selected ? colors.primary.main : colors.surface,
                      borderColor: colors.primary.main,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? colors.primary.contrast : colors.primary.main,
                      fontWeight: '700',
                      textAlign: 'center',
                    }}
                  >
                    {pick.label}
                  </Text>
                </Pressable>
              );
            })}
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

function dayFrame(size: number): { width: number; height: number } | null {
  if (size <= 0) return null;
  return { width: size, height: size };
}

function DayNumber({ label, color }: { label: number; color: string }) {
  return (
    <View pointerEvents="none" style={styles.dayNumberWrap}>
      <Text style={[styles.dayNumber, { color }]}>{label}</Text>
    </View>
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
  day: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberWrap: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 13,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    margin: 0,
    padding: 0,
    paddingTop: 0,
  },
  picks: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  pick: { flex: 1, borderWidth: 1, minHeight: 40, paddingHorizontal: 6, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
});
