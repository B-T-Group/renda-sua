import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Checkbox, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal } from '../common/AppModal';
import { useTheme } from '../../contexts/ThemeContext';
import { useCreateRentalRequest } from '../../hooks/useCreateRentalRequest';
import type { ClientRootStackParamList, GuestRootStackParamList } from '../../navigation/types';
import type { RentalTakenWindow } from '../../types/rentals';
import { RentalTimeOptionSheet } from './RentalTimeOptionSheet';
import {
  bookedSegmentsForLocalDay,
  dayHasRemainingCapacity,
  estimateTotalFromSelectionRanges,
  formatRentalMoney,
  formatSelectionLabel,
  freeSlotEndsLocal,
  freeSlotStartsLocal,
  listingDayBoundsLocal,
  localPickerInstantToRequestParts,
  maximalFreeHourRangesLocal,
  mergeRangeIntoSelections,
  remainingUnitsInRange,
  requestedSlotUtcIso,
  totalBillableHours,
  type SelectionRange,
  type WeeklyRow,
} from '../../utils/rentals';

const RENTAL_MIN_START_BUFFER_MS = 2 * 60 * 60 * 1000;
const DAY_OPTIONS = 14;

function parseDateInputLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

function todayDateInputValue(): string {
  const n = new Date();
  const mo = String(n.getMonth() + 1).padStart(2, '0');
  const da = String(n.getDate()).padStart(2, '0');
  return `${n.getFullYear()}-${mo}-${da}`;
}

function addDaysKey(base: string, offset: number): string {
  const d = parseDateInputLocal(base);
  d.setDate(d.getDate() + offset);
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mo}-${da}`;
}

function formatSlotTime(ms: number, locale?: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(ms)
    );
  } catch {
    return new Date(ms).toLocaleTimeString();
  }
}

export interface RentalSlotPickerProps {
  listingId: string;
  isAuthenticated: boolean;
  bookedWindows: RentalTakenWindow[];
  minRentalHours?: number;
  maxRentalHours?: number | null;
  unitsAvailable?: number;
  weeklyAvailability?: WeeklyRow[];
  basePricePerHour?: number;
  basePricePerDay?: number;
  currency?: string;
  onLoginRequired?: () => void;
  onSubmitted?: (requestId: string) => void;
  /** When true, omits outer card chrome (for bottom sheets). */
  embedded?: boolean;
}

export function RentalSlotPicker({
  listingId,
  isAuthenticated,
  bookedWindows,
  minRentalHours = 1,
  maxRentalHours = null,
  unitsAvailable = 1,
  weeklyAvailability = [],
  basePricePerHour = 0,
  basePricePerDay = 0,
  currency = 'XAF',
  onLoginRequired,
  onSubmitted,
  embedded = false,
}: RentalSlotPickerProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const navigation = useNavigation();
  const { submit, loading: submitting } = useCreateRentalRequest();

  const [dateStr, setDateStr] = useState(todayDateInputValue());
  const [startMs, setStartMs] = useState<number | ''>('');
  const [endMs, setEndMs] = useState<number | ''>('');
  const [allDayChecked, setAllDayChecked] = useState(false);
  const [selections, setSelections] = useState<SelectionRange[]>([]);
  const [showAdvancedRanges, setShowAdvancedRanges] = useState(false);
  const [unitsRequested, setUnitsRequested] = useState(1);
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [timePicker, setTimePicker] = useState<'start' | 'end' | null>(null);

  const stock = Math.max(1, Math.floor(Number(unitsAvailable)) || 1);

  const dayKeys = useMemo(
    () => Array.from({ length: DAY_OPTIONS }, (_, i) => addDaysKey(todayDateInputValue(), i)),
    []
  );

  const dayAnchor = useMemo(() => parseDateInputLocal(dateStr), [dateStr]);
  const dayBounds = useMemo(
    () => listingDayBoundsLocal(dayAnchor, weeklyAvailability),
    [dayAnchor, weeklyAvailability]
  );

  const dayStartEnd = useMemo(() => {
    const start = new Date(dayAnchor);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }, [dayAnchor]);

  const bookedSegs = useMemo(
    () => bookedSegmentsForLocalDay(dayStartEnd.start, dayStartEnd.end, bookedWindows),
    [bookedWindows, dayStartEnd.end, dayStartEnd.start]
  );

  const minStartMs = useMemo(
    () => Date.now() + RENTAL_MIN_START_BUFFER_MS,
    [listingId]
  );
  const slotStarts = useMemo(() => {
    if (!dayBounds) return [];
    return freeSlotStartsLocal(dayBounds.open, dayBounds.close, bookedSegs, minStartMs, stock);
  }, [bookedSegs, dayBounds, minStartMs, stock]);

  const slotEnds = useMemo(() => {
    if (!dayBounds || startMs === '') return [];
    return freeSlotEndsLocal(Number(startMs), dayBounds.close, bookedSegs, stock);
  }, [bookedSegs, dayBounds, startMs, stock]);

  const startOptions = useMemo(
    () =>
      slotStarts.map((d) => ({
        valueMs: d.getTime(),
        label: formatSlotTime(d.getTime(), i18n.language),
      })),
    [i18n.language, slotStarts]
  );

  const endOptions = useMemo(
    () =>
      slotEnds.map((d) => ({
        valueMs: d.getTime(),
        label: formatSlotTime(d.getTime(), i18n.language),
      })),
    [i18n.language, slotEnds]
  );

  const selectTime = (valueMs: number) => {
    if (timePicker === 'start') {
      setStartMs(valueMs);
      setEndMs('');
    } else if (timePicker === 'end') {
      setEndMs(valueMs);
    }
    setTimePicker(null);
  };

  const canAllDay =
    !!dayBounds &&
    dayHasRemainingCapacity(dayBounds.open, dayBounds.close, bookedWindows, stock, 1);

  const remainingForSelection = useMemo(() => {
    if (selections.length === 0) return stock;
    let minRem = stock;
    for (const r of selections) {
      const rem = remainingUnitsInRange(r.startMs, r.endMs, bookedWindows, stock);
      if (rem < minRem) minRem = rem;
    }
    return minRem;
  }, [bookedWindows, selections, stock]);

  useEffect(() => {
    setUnitsRequested((prev) => Math.min(Math.max(1, prev), Math.max(1, remainingForSelection)));
  }, [remainingForSelection]);

  useEffect(() => {
    if (!showAdvancedRanges) return;
    setStartMs('');
    setEndMs('');
    setAllDayChecked(false);
  }, [showAdvancedRanges]);

  useEffect(() => {
    if (showAdvancedRanges) return;
    setAllDayChecked(false);
    if (!dayBounds) {
      setStartMs('');
      setEndMs('');
      return;
    }
    const starts = freeSlotStartsLocal(
      dayBounds.open,
      dayBounds.close,
      bookedSegs,
      minStartMs,
      stock
    );
    if (starts.length === 0) {
      setStartMs('');
      setEndMs('');
      return;
    }
    const first = starts[0].getTime();
    const minEndMs = first + minRentalHours * 3600000;
    const ends = freeSlotEndsLocal(first, dayBounds.close, bookedSegs, stock);
    const validEnd = ends.find((slot) => slot.getTime() >= minEndMs)?.getTime();
    setStartMs(first);
    setEndMs(validEnd ?? '');
  }, [bookedSegs, dateStr, dayBounds, minRentalHours, minStartMs, showAdvancedRanges, stock]);

  const buildCurrentRange = useCallback((): SelectionRange | null => {
    if (allDayChecked) {
      if (!dayBounds || !canAllDay) return null;
      const openMs = dayBounds.open.getTime();
      if (openMs <= minStartMs) {
        const ranges = maximalFreeHourRangesLocal(
          dayBounds.open,
          dayBounds.close,
          bookedSegs,
          minStartMs,
          stock
        );
        if (ranges.length === 0) return null;
        const first = ranges[0];
        return {
          id: `draft-${first.startMs}`,
          startMs: first.startMs,
          endMs: first.endMs,
          billing: 'hourly',
        };
      }
      return {
        id: `draft-all-${dateStr}`,
        startMs: openMs,
        endMs: dayBounds.close.getTime(),
        billing: 'all_day',
        calendarDate: dateStr,
      };
    }
    if (startMs === '' || endMs === '') return null;
    const s = Number(startMs);
    const e = Number(endMs);
    if (!(e > s)) return null;
    return { id: `draft-${s}`, startMs: s, endMs: e, billing: 'hourly' };
  }, [
    allDayChecked,
    bookedSegs,
    canAllDay,
    dateStr,
    dayBounds,
    endMs,
    minStartMs,
    startMs,
    stock,
  ]);

  const effectiveSelections = useMemo(() => {
    if (showAdvancedRanges) return selections;
    if (selections.length > 0) return selections;
    const draft = buildCurrentRange();
    return draft ? [draft] : [];
  }, [buildCurrentRange, selections, showAdvancedRanges]);

  const addRange = useCallback(() => {
    setMsg(null);
    if (allDayChecked) {
      if (!dayBounds || !canAllDay) return;
      const openMs = dayBounds.open.getTime();
      if (openMs > minStartMs) {
        setSelections((prev) =>
          mergeRangeIntoSelections(prev, openMs, dayBounds.close.getTime(), {
            billing: 'all_day',
            calendarDate: dateStr,
          })
        );
      } else {
        const ranges = maximalFreeHourRangesLocal(
          dayBounds.open,
          dayBounds.close,
          bookedSegs,
          minStartMs,
          stock
        );
        if (ranges.length === 0) return;
        setSelections((prev) => {
          let next = prev;
          for (const r of ranges) {
            next = mergeRangeIntoSelections(next, r.startMs, r.endMs, { billing: 'hourly' });
          }
          return next;
        });
      }
      setStartMs('');
      setEndMs('');
      setAllDayChecked(false);
      return;
    }
    if (!dayBounds || startMs === '' || endMs === '') {
      setMsg(t('rentals.requestForm.pickStartEnd', 'Choose a start and end time.'));
      return;
    }
    const s = Number(startMs);
    const e = Number(endMs);
    if (!(e > s)) {
      setMsg(t('rentals.requestForm.endAfterStart', 'End must be after start.'));
      return;
    }
    if (s < minStartMs) {
      setMsg(t('rentals.requestForm.startMustBeFuture', 'Start must be in the future.'));
      return;
    }
    if (remainingUnitsInRange(s, e, bookedWindows, stock) < 1) {
      setMsg(t('rentals.requestForm.noUnitsLeft', 'No units left for that time.'));
      return;
    }
    setSelections((prev) => mergeRangeIntoSelections(prev, s, e, { billing: 'hourly' }));
    setStartMs('');
    setEndMs('');
  }, [
    allDayChecked,
    bookedSegs,
    bookedWindows,
    canAllDay,
    dateStr,
    dayBounds,
    endMs,
    minStartMs,
    startMs,
    stock,
    t,
  ]);

  const hoursTotal = useMemo(() => totalBillableHours(effectiveSelections), [effectiveSelections]);
  const { lines: estimateLines, total: estimatedTotal } = useMemo(
    () =>
      estimateTotalFromSelectionRanges(
        effectiveSelections,
        basePricePerHour,
        basePricePerDay,
        unitsRequested
      ),
    [basePricePerDay, basePricePerHour, effectiveSelections, unitsRequested]
  );

  const validateBeforeSubmit = useCallback((): string | null => {
    if (effectiveSelections.length === 0) {
      return t('rentals.requestForm.addOneRange', 'Add at least one time range.');
    }
    if (hoursTotal < minRentalHours) {
      return t('rentals.requestForm.belowMinHours', 'Selected time is below minimum hours.');
    }
    if (maxRentalHours != null && hoursTotal > maxRentalHours) {
      return t('rentals.requestForm.aboveMaxHours', 'Selected time exceeds maximum hours.');
    }
    if (unitsRequested < 1 || unitsRequested > remainingForSelection) {
      return t(
        'rentals.requestForm.unitsUnavailable',
        'Not enough units available for the selected times.'
      );
    }
    for (const r of effectiveSelections) {
      if (r.startMs < minStartMs) {
        return t('rentals.requestForm.startMustBeFuture', 'Start must be in the future.');
      }
      if (remainingUnitsInRange(r.startMs, r.endMs, bookedWindows, stock) < unitsRequested) {
        return t(
          'rentals.requestForm.unitsUnavailable',
          'Not enough units available for the selected times.'
        );
      }
    }
    return null;
  }, [
    bookedWindows,
    effectiveSelections,
    hoursTotal,
    maxRentalHours,
    minRentalHours,
    minStartMs,
    remainingForSelection,
    stock,
    t,
    unitsRequested,
  ]);

  const openConfirm = () => {
    setMsg(null);
    const err = validateBeforeSubmit();
    if (err) {
      setMsg(err);
      return;
    }
    setConfirmOpen(true);
  };

  const submitRequest = async () => {
    const err = validateBeforeSubmit();
    if (err) {
      setMsg(err);
      setConfirmOpen(false);
      return;
    }
    const windows = effectiveSelections.map((r) => {
      const s = localPickerInstantToRequestParts(r.startMs);
      const e = localPickerInstantToRequestParts(r.endMs);
      const base = {
        requestedStartAt: requestedSlotUtcIso(s.dateKey, s.hour, s.minute),
        requestedEndAt: requestedSlotUtcIso(e.dateKey, e.hour, e.minute),
      };
      if (r.billing === 'all_day' && r.calendarDate) {
        return { ...base, billing: 'all_day' as const, calendarDate: r.calendarDate };
      }
      return base;
    });
    const starts = effectiveSelections.map((r) => r.startMs);
    const ends = effectiveSelections.map((r) => r.endMs);
    const envS = localPickerInstantToRequestParts(Math.min(...starts));
    const envE = localPickerInstantToRequestParts(Math.max(...ends));
    try {
      const res = await submit({
        rentalLocationListingId: listingId,
        requestedStartAt: requestedSlotUtcIso(envS.dateKey, envS.hour, envS.minute),
        requestedEndAt: requestedSlotUtcIso(envE.dateKey, envE.hour, envE.minute),
        windows,
        unitsRequested,
        clientRequestNote: notes.trim() || undefined,
      });
      setConfirmOpen(false);
      if (onSubmitted) {
        onSubmitted(res.requestId);
        return;
      }
      (
        navigation as unknown as NativeStackNavigationProp<ClientRootStackParamList>
      ).navigate('RentalRequestSubmitted', { requestId: res.requestId });
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'));
      setConfirmOpen(false);
    }
  };

  const cardStyle = embedded
    ? undefined
    : [
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ];

  if (!isAuthenticated) {
    return (
      <View style={cardStyle}>
        {!embedded ? (
          <>
            <Text style={[typography.subtitle1, { color: colors.text.primary }]}>
              {t('rentals.requestRental', 'Request this rental')}
            </Text>
            <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.xs }]}>
              {t('rentals.detail.requestSubtitle', 'Choose your dates. The business will confirm availability.')}
            </Text>
          </>
        ) : (
          <Text style={[typography.body2, { color: colors.text.secondary }]}>
            {t('rentals.detail.requestSubtitle', 'Choose your dates. The business will confirm availability.')}
          </Text>
        )}
        <Button
          mode="contained"
          style={{ marginTop: spacing.md }}
          onPress={() => {
            if (onLoginRequired) {
              onLoginRequired();
              return;
            }
            (
              navigation as unknown as NativeStackNavigationProp<GuestRootStackParamList>
            ).navigate('GuestTabs', { screen: 'GuestAuth', params: { screen: 'Login' } });
          }}
        >
          {t('client.rentals.loginToRequest', 'Sign in to request a rental')}
        </Button>
      </View>
    );
  }

  return (
    <View style={cardStyle}>
      {!embedded ? (
        <>
          <Text style={[typography.subtitle1, { color: colors.text.primary }]}>
            {t('rentals.requestRental', 'Request this rental')}
          </Text>
          <Text style={[typography.body2, { color: colors.text.secondary, marginTop: 4 }]}>
            {showAdvancedRanges
              ? t(
                  'rentals.requestForm.slotSubtitle',
                  'Pick a day, choose times within open hours, then add each range to your request.'
                )
              : t(
                  'rentals.requestForm.simpleSubtitle',
                  'Pick a day and time — we pre-select the next available slot.'
                )}
          </Text>
        </>
      ) : null}

      <Text style={[typography.caption, { color: colors.text.secondary, marginTop: embedded ? 0 : spacing.md }]}>
        {t('rentals.requestForm.pickDay', 'Date')}
      </Text>
      <Text style={[typography.caption, { color: colors.text.disabled, marginTop: 2 }]}>
        {t(
          'rentals.requestForm.leadTimeHint',
          'Bookings must start at least 2 hours from now.'
        )}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.xs, paddingVertical: spacing.xs }}
      >
        {dayKeys.map((key) => {
          const selected = key === dateStr;
          const label = parseDateInputLocal(key).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
          return (
            <Pressable
              key={key}
              onPress={() => setDateStr(key)}
              style={[
                styles.dayChip,
                {
                  borderColor: colors.divider,
                  backgroundColor: selected ? colors.primary.main : colors.pageBackground,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.primary.contrast : colors.text.secondary,
                  fontWeight: '600',
                  fontSize: 12,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!dayBounds ? (
        <Text style={[typography.body2, { color: colors.warning.dark, marginTop: spacing.sm }]}>
          {t('rentals.requestForm.closedDay', 'The business is closed on this day. Pick another date.')}
        </Text>
      ) : (
        <>
          <View style={[styles.row, { marginTop: spacing.sm, gap: spacing.sm }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Button
                mode="outlined"
                onPress={() => setTimePicker('start')}
                disabled={allDayChecked || slotStarts.length === 0}
                style={{ borderColor: colors.divider }}
              >
                {startMs === ''
                  ? t('rentals.requestForm.slotStart', 'Start time')
                  : formatSlotTime(Number(startMs), i18n.language)}
              </Button>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Button
                mode="outlined"
                onPress={() => setTimePicker('end')}
                disabled={allDayChecked || startMs === '' || slotEnds.length === 0}
                style={{ borderColor: colors.divider }}
              >
                {endMs === ''
                  ? t('rentals.requestForm.slotEnd', 'End time')
                  : formatSlotTime(Number(endMs), i18n.language)}
              </Button>
            </View>
          </View>

          <Pressable
            onPress={() => canAllDay && setAllDayChecked((v) => !v)}
            style={[styles.row, { marginTop: spacing.sm, opacity: canAllDay ? 1 : 0.5 }]}
            disabled={!canAllDay}
          >
            <Checkbox
              status={allDayChecked ? 'checked' : 'unchecked'}
              onPress={() => canAllDay && setAllDayChecked((v) => !v)}
              disabled={!canAllDay}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.body2, { color: colors.text.primary }]}>
                {t('rentals.requestForm.addFullDayRate', 'Add full day (daily rate)')}
              </Text>
              {!canAllDay ? (
                <Text style={[typography.caption, { color: colors.text.secondary }]}>
                  {t(
                    'rentals.requestForm.allDayDisabledHint',
                    'Add all available hours is disabled when any time that day is already booked.'
                  )}
                </Text>
              ) : null}
            </View>
          </Pressable>

          {slotStarts.length === 0 && !allDayChecked ? (
            <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.xs }]}>
              {t(
                'rentals.requestForm.noBookableSlotsHint',
                'No bookable hours left on this day. Try another date.'
              )}
            </Text>
          ) : null}

          {!showAdvancedRanges && startMs !== '' && endMs === '' && !allDayChecked ? (
            <Text style={[typography.caption, { color: colors.warning.dark, marginTop: spacing.xs }]}>
              {t(
                'rentals.requestForm.minHoursSlotHint',
                'No open slot meets the {{h}}h minimum on this day. Try another date or tap Add another time.',
                { h: minRentalHours }
              )}
            </Text>
          ) : null}

          {showAdvancedRanges ? (
            <Button mode="contained-tonal" style={{ marginTop: spacing.sm }} onPress={addRange}>
              {t('rentals.requestForm.addRange', 'Add to request')}
            </Button>
          ) : null}
        </>
      )}

      {!showAdvancedRanges ? (
        <Button
          mode="text"
          compact
          style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}
          onPress={() => setShowAdvancedRanges(true)}
        >
          {t('rentals.requestForm.addAnotherTime', 'Add another time')}
        </Button>
      ) : null}

      {showAdvancedRanges && selections.length > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[typography.caption, { color: colors.text.secondary, fontWeight: '700' }]}>
            {t('rentals.requestForm.yourRanges', 'Your selected times')}
          </Text>
          {selections.map((r) => (
            <View key={r.id} style={[styles.selectionRow, { borderBottomColor: colors.divider }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.body2, { color: colors.text.primary }]} numberOfLines={2}>
                  {r.billing === 'all_day'
                    ? t('rentals.requestForm.allDayLabel', 'All day') +
                      (r.calendarDate ? ` · ${r.calendarDate}` : '')
                    : formatSelectionLabel(r.startMs, r.endMs, i18n.language)}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelections((prev) => prev.filter((x) => x.id !== r.id))}
                hitSlop={8}
                accessibilityLabel={t('common.delete', 'Delete')}
              >
                <MaterialCommunityIcons name="delete-outline" size={22} color={colors.error.main} />
              </Pressable>
            </View>
          ))}
          <TextInput
            mode="outlined"
            keyboardType="number-pad"
            value={String(unitsRequested)}
            onChangeText={(text) => {
              const n = Math.floor(Number(text));
              if (!Number.isFinite(n)) return;
              setUnitsRequested(Math.min(Math.max(1, n), Math.max(1, remainingForSelection)));
            }}
            label={t('rentals.requestForm.units', 'Quantity')}
            style={{ marginTop: spacing.sm, maxWidth: 200 }}
          />
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>
            {t(
              'rentals.requestForm.unitsRemaining',
              '{{remaining}} of {{total}} available for your selected times',
              { remaining: remainingForSelection, total: stock }
            )}
          </Text>
          <Text style={[typography.body2, { color: colors.text.primary, marginTop: spacing.sm }]}>
            {t('rentals.requestForm.runningTotal', 'Estimated total')}:{' '}
            <Text style={{ fontWeight: '700' }}>
              {formatRentalMoney(estimatedTotal, currency)}
            </Text>
          </Text>
          <Text style={[typography.caption, { color: colors.text.secondary }]}>
            {t('rentals.requestForm.totalHoursLineShort', '{{h}} billable hours total', {
              h: hoursTotal,
            })}
          </Text>
        </View>
      ) : effectiveSelections.length > 0 && !showAdvancedRanges ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[typography.body2, { color: colors.text.primary }]}>
            {t('rentals.requestForm.runningTotal', 'Estimated total')}:{' '}
            <Text style={{ fontWeight: '700' }}>
              {formatRentalMoney(estimatedTotal, currency)}
            </Text>
          </Text>
          <Text style={[typography.caption, { color: colors.text.secondary }]}>
            {t('rentals.requestForm.totalHoursLineShort', '{{h}} billable hours total', {
              h: hoursTotal,
            })}
          </Text>
        </View>
      ) : null}

      <TextInput
        mode="outlined"
        multiline
        numberOfLines={3}
        value={notes}
        onChangeText={setNotes}
        maxLength={2000}
        label={t('rentals.requestForm.optionalNotes', 'Optional notes for the business')}
        placeholder={t(
          'rentals.requestForm.optionalNotesPlaceholder',
          'Special requirements, access details, questions…'
        )}
        style={{ marginTop: spacing.md }}
      />

      {msg ? (
        <Text style={[typography.body2, { color: colors.error.main, marginTop: spacing.sm }]}>
          {msg}
        </Text>
      ) : null}

      <Button
        mode="contained"
        style={{ marginTop: spacing.md }}
        onPress={openConfirm}
        disabled={effectiveSelections.length === 0}
      >
        {t('rentals.submitRequest', 'Submit request')}
      </Button>

      <AppModal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.scrim} onPress={() => setConfirmOpen(false)}>
          <Pressable
            style={[
              styles.confirmSheet,
              shadows.md,
              {
                maxHeight: screenHeight * 0.75,
                borderRadius: borderRadius.xl,
                backgroundColor: colors.surface,
                paddingBottom: insets.bottom + spacing.md,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text variant="titleLarge" style={{ color: colors.text.primary }}>
              {t('rentals.requestForm.confirmTitle', 'Confirm your request')}
            </Text>
            <ScrollView style={{ maxHeight: screenHeight * 0.4, marginTop: spacing.sm }}>
              <Text style={[typography.body2, { color: colors.text.secondary }]}>
                {t(
                  'rentals.requestForm.confirmIntro',
                  'Review your selected times and estimated price before sending.'
                )}
              </Text>
              {estimateLines.map((line, idx) => (
                <Text
                  key={idx}
                  style={[typography.body2, { color: colors.text.primary, marginTop: spacing.xs }]}
                >
                  {line.kind === 'all_day'
                    ? t('rentals.requestForm.lineAllDay', 'Full day {{date}}', {
                        date: line.calendarDate,
                      })
                    : t('rentals.requestForm.lineHourly', '{{h}} h × {{rate}}', {
                        h: line.billableHours,
                        rate: formatRentalMoney(line.ratePerHour, currency),
                      })}
                  {': '}
                  {formatRentalMoney(line.subtotal, currency)}
                </Text>
              ))}
              <Text style={[typography.subtitle2, { color: colors.text.primary, marginTop: spacing.sm }]}>
                {t('rentals.requestForm.confirmUnits', 'Quantity')}: {unitsRequested}
              </Text>
              <Text style={[typography.subtitle2, { color: colors.text.primary, marginTop: spacing.xs }]}>
                {t('rentals.requestForm.confirmPrice', 'Estimated price')}:{' '}
                {formatRentalMoney(estimatedTotal, currency)}
              </Text>
              <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>
                {t(
                  'rentals.requestForm.confirmPriceNote',
                  'Final price is confirmed when the business accepts your request.'
                )}
              </Text>
            </ScrollView>
            <View style={[styles.confirmActions, { marginTop: spacing.md, gap: spacing.sm }]}>
              <Button mode="text" onPress={() => setConfirmOpen(false)} style={{ flex: 1 }}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button loading={submitting} mode="contained" onPress={() => void submitRequest()} style={{ flex: 1 }}>
                {t('rentals.requestForm.confirmSend', 'Send request')}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </AppModal>
      <RentalTimeOptionSheet
        visible={timePicker !== null}
        title={
          timePicker === 'end'
            ? t('rentals.requestForm.slotEnd', 'End time')
            : t('rentals.requestForm.slotStart', 'Start time')
        }
        options={timePicker === 'end' ? endOptions : startOptions}
        selectedMs={timePicker === 'end' ? endMs : startMs}
        onSelect={selectTime}
        onDismiss={() => setTimePicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dayChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  confirmSheet: {
    padding: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
