import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal } from '../../common/AppModal';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  applyToAll,
  blockHours,
  blockIsFree,
  canRemoveDay,
  dayInfo,
  dayPrice,
  defaultBlock,
  listingNowMs,
  monthGrid,
  sharedCells,
  showModeSwitch,
  tapHour,
  toSelectionRanges,
  toggleDay,
  totalPrice,
  utcMsToKey,
  type BlockNote,
  type DayCell,
  type DayHoursListing,
  type DayInfo,
  type DayMode,
  type PickedDay,
} from '../../../utils/rentals/dayHoursPicker';
import {
  cityName,
  dayLabel,
  footerDetail,
  hourLabel,
  lockReason,
  minuteLabel,
  monthTitle,
  noteText,
  pickerLang,
  pickerMoney,
  pickerText,
  rangeLabel,
  sharedLockReason,
  summaryLine,
  weekStart,
  weekdayHeads,
  type PickerLang,
} from '../../../utils/rentals/dayHoursCopy';
import type { SelectionRange } from '../../../utils/rentals';

const BLUE = '#0A4FB5';
const TINT = '#D6E4F7';
const CELL_FREE = '#EEF3FB';
const CELL_PAST = '#ECEAE6';
const HATCH = '#E2DCCF';
const AMBER = '#B45309';

export interface RentalDayHoursSheetProps {
  visible: boolean;
  listing: DayHoursListing;
  currency: string;
  language: string;
  timeZone?: string | null;
  city?: string | null;
  initialDays?: PickedDay[];
  /** Fixed clock for tests; defaults to Date.now(). */
  nowMs?: number;
  onClose: () => void;
  onContinue: (rows: SelectionRange[], days: PickedDay[]) => void;
  /** 'inline' renders the sheet without a Modal (render tests). */
  presentation?: 'modal' | 'inline';
}

type Notes = Record<string, BlockNote | null>;

export function RentalDayHoursSheet(props: RentalDayHoursSheetProps) {
  const { visible, onClose, presentation = 'modal' } = props;
  const body = <SheetBody {...props} />;
  if (presentation === 'inline') return visible ? body : null;
  return (
    <AppModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={pickerText(pickerLang(props.language), 'close')} />
        {body}
      </View>
    </AppModal>
  );
}

function SheetBody({
  visible,
  listing,
  currency,
  language,
  timeZone,
  city,
  initialDays,
  nowMs,
  onClose,
  onContinue,
}: RentalDayHoursSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const lang = pickerLang(language);
  const now = useMemo(() => listingNowMs(nowMs ?? Date.now(), timeZone), [nowMs, timeZone, visible]);
  const todayKey = utcMsToKey(now);
  const [days, setDays] = useState<PickedDay[]>(initialDays ?? []);
  const [expanded, setExpanded] = useState<string | null>(initialDays?.length === 1 ? initialDays[0].key : null);
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [notes, setNotes] = useState<Notes>({});
  const [shared, setShared] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState((initialDays?.length ?? 0) < 2);
  const [banner, setBanner] = useState<'notInARow' | 'notInARowRemove' | null>(null);
  const [month, setMonth] = useState(() => {
    const anchor = initialDays?.[0]?.key ?? todayKey;
    return { y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) - 1 };
  });

  useEffect(() => {
    if (!visible) return;
    setDays(initialDays ?? []);
    setExpanded(initialDays?.length === 1 ? initialDays[0].key : null);
    setCalendarOpen((initialDays?.length ?? 0) < 2);
    setShared(false);
    setNotes({});
    setBanner(null);
    // Reset only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const infoCache = useMemo(() => new Map<string, DayInfo>(), [listing, now]);
  const info = (key: string): DayInfo => {
    let hit = infoCache.get(key);
    if (!hit) {
      hit = dayInfo(key, listing, now);
      infoCache.set(key, hit);
    }
    return hit;
  };
  const infos: Record<string, DayInfo> = Object.fromEntries(days.map((d) => [d.key, info(d.key)]));
  const both = showModeSwitch(listing);
  const sharedOn = shared && days.length > 1;
  const total = totalPrice(days, listing);
  const zoneCity = cityName(city, timeZone);

  function onDayTap(key: string) {
    const result = toggleDay(days, info(key), listing);
    if (result.kind === 'notInARow') {
      setBanner(days.some((d) => d.key === key) ? 'notInARowRemove' : 'notInARow');
      return;
    }
    if (result.kind === 'unpickable') return;
    setBanner(null);
    let next = result.days;
    if (sharedOn && result.kind === 'added' && days[0]) {
      next = applySharedChoice(next, days[0]);
    }
    setDays(next);
    setAwaitingEnd(false);
    if (result.kind === 'added') {
      const added = next.find((d) => d.key === key);
      setExpanded(added?.mode === 'hours' ? key : null);
    } else if (expanded === key) {
      setExpanded(null);
    }
    if (next.length < 2) setShared(false);
  }

  function applySharedChoice(list: PickedDay[], choice: PickedDay): PickedDay[] {
    const allInfos = list.map((d) => info(d.key));
    const cells = sharedCells(allInfos);
    if (choice.mode === 'full' && allInfos.every((i) => !i.fullDayLock) && listing.offersDaily) {
      return applyToAll(list, choice);
    }
    if (listing.offersHourly) {
      const block = blockIsFree(cells, choice.start, choice.end)
        ? { start: choice.start, end: choice.end }
        : defaultBlock(cells, listing.minHours, listing.maxHours);
      if (block) return applyToAll(list, { mode: 'hours', ...block });
    }
    return list;
  }

  function setMode(key: string | null, mode: DayMode) {
    setAwaitingEnd(false);
    if (key == null) {
      const cells = sharedCells(days.map((d) => info(d.key)));
      if (mode === 'hours') {
        const first = days[0];
        const block = first && blockIsFree(cells, first.start, first.end) ? first : defaultBlock(cells, listing.minHours, listing.maxHours);
        if (block) setDays(applyToAll(days, { mode, start: block.start, end: block.end }));
      } else {
        setDays(days.map((d) => ({ ...d, mode })));
      }
      return;
    }
    setDays((prev) =>
      prev.map((d) => {
        if (d.key !== key) return d;
        if (mode === 'full') return { ...d, mode };
        const cells = info(key).cells;
        const block = blockIsFree(cells, d.start, d.end) ? d : defaultBlock(cells, listing.minHours, listing.maxHours) ?? d;
        return { ...d, mode, start: block.start, end: block.end };
      })
    );
    setExpanded(mode === 'hours' ? key : expanded === key ? null : expanded);
  }

  function onHour(key: string | null, hour: number) {
    const target = key == null ? days[0] : days.find((d) => d.key === key);
    if (!target) return;
    const cells = key == null ? sharedCells(days.map((d) => info(d.key))) : info(key).cells;
    const r = tapHour(target, hour, awaitingEnd, cells, listing.minHours, listing.maxHours);
    setAwaitingEnd(r.awaitingEnd);
    setNotes((prev) => ({ ...prev, [key ?? '*']: r.note }));
    if (key == null) setDays(applyToAll(days, { mode: 'hours', start: r.day.start, end: r.day.end }));
    else setDays((prev) => prev.map((d) => (d.key === key ? r.day : d)));
  }

  function toggleShared() {
    if (sharedOn) {
      setShared(false);
      return;
    }
    if (days[0]) setDays(applySharedChoice(days, days[0]));
    setShared(true);
    setAwaitingEnd(false);
  }

  const canContinue = days.length > 0;
  const sheet: ViewStyle = { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 12) };

  return (
    <View testID="day-hours-sheet" style={[styles.sheet, sheet]}>
      <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{pickerText(lang, 'title')}</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            {pickerText(lang, 'subtitle', { city: zoneCity })}
          </Text>
        </View>
        <Pressable testID="day-hours-close" accessibilityRole="button" accessibilityLabel={pickerText(lang, 'close')} onPress={onClose} style={[styles.close, { backgroundColor: colors.surfaceInput }]}>
          <MaterialCommunityIcons name="close" size={20} color={colors.text.primary} />
        </Pressable>
      </View>
      <PriceChips listing={listing} currency={currency} lang={lang} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {calendarOpen || days.length < 2 ? (
          <Calendar
            lang={lang}
            month={month}
            todayKey={todayKey}
            picked={days.map((d) => d.key)}
            info={info}
            onMonth={setMonth}
            onDay={onDayTap}
            showPartial={listing.offersHourly}
          />
        ) : (
          <FoldedDays lang={lang} days={days} onPress={() => setCalendarOpen(true)} />
        )}
        {banner ? <Banner icon="information-outline" color={AMBER} text={pickerText(lang, banner)} /> : null}
        {days.length === 0 ? (
          <View testID="day-hours-empty" style={[styles.empty, { borderColor: colors.borderStrong }]}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={20} color={colors.text.secondary} />
            <Text style={{ color: colors.text.secondary, flex: 1 }}>{pickerText(lang, 'empty')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.daysHead}>
              <Text style={[styles.kicker, { color: colors.text.secondary }]}>{pickerText(lang, 'yourDays').toUpperCase()}</Text>
              {days.length > 1 && both ? (
                <Pressable testID="day-hours-same-for-all" accessibilityRole="switch" accessibilityState={{ checked: sharedOn }} onPress={toggleShared} style={styles.sameRow}>
                  <MaterialCommunityIcons name="content-copy" size={16} color={BLUE} />
                  <Text style={styles.sameText}>{pickerText(lang, 'sameForAll')}</Text>
                  <Toggle on={sharedOn} />
                </Pressable>
              ) : null}
            </View>
            {sharedOn ? (
              <SharedCard
                lang={lang}
                days={days}
                infos={days.map((d) => info(d.key))}
                listing={listing}
                currency={currency}
                timeZone={timeZone}
                note={notes['*'] ?? null}
                awaitingEnd={awaitingEnd}
                onMode={(mode) => setMode(null, mode)}
                onHour={(h) => onHour(null, h)}
                onRemove={onDayTap}
              />
            ) : (
              days.map((d) => (
                <DayRow
                  key={d.key}
                  lang={lang}
                  day={d}
                  info={info(d.key)}
                  listing={listing}
                  currency={currency}
                  timeZone={timeZone}
                  expanded={expanded === d.key}
                  awaitingEnd={awaitingEnd && expanded === d.key}
                  note={notes[d.key] ?? null}
                  onExpand={() => {
                    setAwaitingEnd(false);
                    setExpanded(expanded === d.key ? null : d.key);
                  }}
                  onMode={(mode) => setMode(d.key, mode)}
                  onHour={(h) => onHour(d.key, h)}
                  onRemove={() => onDayTap(d.key)}
                  removable={canRemoveDay(days, d.key)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <View style={styles.footerRow}>
          <View style={styles.flex}>
            <Text testID="day-hours-summary" style={[styles.summary, { color: colors.text.primary }]}>
              {days.length ? summaryLine(days, lang) : pickerText(lang, 'noDays')}
            </Text>
            <Text style={[styles.detail, { color: colors.text.secondary }]} numberOfLines={2}>
              {!listing.offersHourly && days.length
                ? pickerText(lang, 'dailyOnly')
                : !listing.offersDaily && days.length
                  ? pickerText(lang, 'hourlyOnly')
                  : footerDetail(days, infos, lang, timeZone, { shared: sharedOn, todayKey })}
            </Text>
          </View>
          {days.length ? (
            <Text testID="day-hours-total" style={[styles.total, { color: colors.text.primary }]}>
              {pickerMoney(total, currency, lang)}
            </Text>
          ) : null}
        </View>
        <Pressable
          testID="day-hours-continue"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
          disabled={!canContinue}
          onPress={() => onContinue(toSelectionRanges(days, infos) as SelectionRange[], days)}
          style={[styles.cta, { backgroundColor: canContinue ? BLUE : colors.disabled }]}
        >
          <Text style={[styles.ctaText, { color: canContinue ? '#FFFFFF' : colors.disabledText }]}>{pickerText(lang, 'continue')}</Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color={canContinue ? '#FFFFFF' : colors.disabledText} />
        </Pressable>
      </View>
    </View>
  );
}

function PriceChips({ listing, currency, lang }: { listing: DayHoursListing; currency: string; lang: PickerLang }) {
  const { colors } = useTheme();
  return (
    <View style={styles.chips}>
      {listing.offersDaily ? (
        <Chip icon="white-balance-sunny" text={pickerText(lang, 'perDay', { amount: pickerMoney(listing.dayRate, currency, lang) })} />
      ) : null}
      {listing.offersHourly ? (
        <Chip icon="clock-outline" text={pickerText(lang, 'perHour', { amount: pickerMoney(listing.hourRate, currency, lang) })} />
      ) : null}
      {listing.offersHourly && listing.minHours > 1 ? (
        <View style={[styles.chip, { backgroundColor: colors.surfaceInput }]}>
          <Text style={[styles.chipText, { color: colors.text.secondary }]}>{pickerText(lang, 'minHours', { count: listing.minHours })}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Chip({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: '#EAF1FB' }]}>
      <MaterialCommunityIcons name={icon as never} size={14} color={BLUE} />
      <Text style={[styles.chipText, { color: BLUE }]}>{text}</Text>
    </View>
  );
}

function Calendar({
  lang,
  month,
  todayKey,
  picked,
  info,
  onMonth,
  onDay,
  showPartial,
}: {
  lang: PickerLang;
  month: { y: number; m: number };
  todayKey: string;
  picked: string[];
  info: (key: string) => DayInfo;
  onMonth: (next: { y: number; m: number }) => void;
  onDay: (key: string) => void;
  showPartial: boolean;
}) {
  const { colors } = useTheme();
  const cells = monthGrid(month.y, month.m, weekStart(lang));
  const atStart = month.y === Number(todayKey.slice(0, 4)) && month.m === Number(todayKey.slice(5, 7)) - 1;
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(month.y, month.m + delta, 1));
    onMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const rows: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const last = rows[rows.length - 1];
  while (last.length < 7) last.push(null);
  return (
    <View testID="day-hours-calendar">
      <View style={styles.monthRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={pickerText(lang, 'prevMonth')} disabled={atStart} onPress={() => shift(-1)} style={styles.monthBtn}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={atStart ? colors.divider : BLUE} />
        </Pressable>
        <Text style={[styles.monthTitle, { color: colors.text.primary }]}>{monthTitle(month.y, month.m, lang)}</Text>
        <Pressable testID="day-hours-next-month" accessibilityRole="button" accessibilityLabel={pickerText(lang, 'nextMonth')} onPress={() => shift(1)} style={styles.monthBtn}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={BLUE} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {weekdayHeads(lang).map((h, i) => (
          <Text key={`${h}${i}`} style={[styles.weekHead, { color: colors.text.secondary }]}>{h}</Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.week}>
          {row.map((key, ci) => {
            if (!key) return <View key={`e${ci}`} style={styles.dayCell} />;
            const d = info(key);
            const isPicked = picked.includes(key);
            const pickable = d.status === 'free' || d.status === 'partial';
            const struck = d.status === 'unavailable';
            const isToday = key === todayKey;
            const color = isPicked ? '#FFFFFF' : pickable ? colors.text.primary : colors.text.disabled;
            return (
              <Pressable
                key={key}
                testID={`day-hours-day-${key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isPicked, disabled: !pickable && !isPicked }}
                accessibilityLabel={dayLabel(key, lang)}
                disabled={!pickable && !isPicked}
                onPress={() => onDay(key)}
                style={styles.dayCell}
              >
                <View
                  style={[
                    styles.dayDot,
                    isPicked ? { backgroundColor: BLUE } : null,
                    !isPicked && isToday ? { borderWidth: 1.5, borderColor: BLUE } : null,
                  ]}
                >
                  <Text style={[styles.dayNum, { color, fontWeight: pickable || isPicked ? '700' : '400', textDecorationLine: struck ? 'line-through' : 'none' }]}>
                    {Number(key.slice(8, 10))}
                  </Text>
                </View>
                {showPartial && d.status === 'partial' ? <View style={styles.partialDot} /> : <View style={styles.partialSpace} />}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        {showPartial ? (
          <>
            <View style={[styles.partialDot, { marginTop: 0 }]} />
            <Text style={[styles.legendText, { color: colors.text.secondary }]}>{pickerText(lang, 'someBooked')}</Text>
          </>
        ) : null}
        <Text style={[styles.legendText, { color: colors.text.disabled, textDecorationLine: 'line-through', marginLeft: showPartial ? 12 : 0 }]}>26</Text>
        <Text style={[styles.legendText, { color: colors.text.secondary }]}>{pickerText(lang, 'unavailable')}</Text>
      </View>
    </View>
  );
}

function FoldedDays({ lang, days, onPress }: { lang: PickerLang; days: PickedDay[]; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable testID="day-hours-folded" accessibilityRole="button" accessibilityLabel={pickerText(lang, 'changeDays')} onPress={onPress} style={[styles.folded, { borderColor: BLUE }]}>
      <MaterialCommunityIcons name="calendar-blank-outline" size={22} color={BLUE} />
      <View style={styles.flex}>
        <Text style={[styles.foldedTitle, { color: colors.text.primary }]} numberOfLines={2}>
          {days.map((d) => dayLabel(d.key, lang)).join(', ')}
        </Text>
        <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{pickerText(lang, 'daysChanged', { count: days.length })}</Text>
      </View>
      <MaterialCommunityIcons name="pencil-outline" size={20} color={BLUE} />
    </Pressable>
  );
}

function Segment({
  lang,
  mode,
  fullLocked,
  onMode,
  testPrefix,
}: {
  lang: PickerLang;
  mode: DayMode;
  fullLocked: boolean;
  onMode: (mode: DayMode) => void;
  testPrefix: string;
}) {
  const { colors } = useTheme();
  const option = (value: DayMode, icon: string, label: string, disabled: boolean) => {
    const active = mode === value;
    const color = disabled ? colors.text.disabled : active ? BLUE : colors.text.secondary;
    return (
      <Pressable
        testID={`${testPrefix}-${value}`}
        accessibilityRole="button"
        accessibilityState={{ selected: active, disabled }}
        disabled={disabled}
        onPress={() => onMode(value)}
        style={[styles.segOption, active ? styles.segActive : null]}
      >
        <MaterialCommunityIcons name={(disabled ? 'lock-outline' : icon) as never} size={15} color={color} />
        <Text style={[styles.segText, { color }]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[styles.segment, { backgroundColor: colors.surfaceInput }]}>
      {option('full', 'white-balance-sunny', pickerText(lang, 'fullDay'), fullLocked)}
      {option('hours', 'clock-outline', pickerText(lang, 'hours'), false)}
    </View>
  );
}

function FullTag({ lang }: { lang: PickerLang }) {
  return (
    <View style={[styles.chip, { backgroundColor: '#EAF1FB' }]}>
      <MaterialCommunityIcons name="white-balance-sunny" size={14} color={BLUE} />
      <Text style={[styles.chipText, { color: BLUE }]}>{pickerText(lang, 'fullDay')}</Text>
    </View>
  );
}

function HourBar({
  cells,
  start,
  end,
  selected,
  onHour,
  testPrefix,
  lang,
  timeZone,
}: {
  cells: DayCell[];
  start: number;
  end: number;
  selected: boolean;
  onHour: (hour: number) => void;
  testPrefix: string;
  lang: PickerLang;
  timeZone?: string | null;
}) {
  if (!cells.length) return null;
  const labels = [...cells.map((c) => c.hour), cells[cells.length - 1].hour + 1];
  return (
    <View testID={`${testPrefix}-bar`}>
      <View style={styles.bar}>
        {cells.map((c) => {
          const on = selected && c.hour >= start && c.hour < end;
          return (
            <Pressable
              key={c.hour}
              testID={`${testPrefix}-h${c.hour}`}
              accessibilityRole="button"
              accessibilityLabel={hourLabel(c.hour, lang, timeZone)}
              accessibilityState={{ selected: on, disabled: c.state !== 'free' }}
              disabled={c.state !== 'free'}
              onPress={() => onHour(c.hour)}
              style={[
                styles.cell,
                c.state === 'free' && !on ? { backgroundColor: CELL_FREE, borderColor: TINT } : null,
                c.state === 'past' ? { backgroundColor: CELL_PAST, borderColor: CELL_PAST } : null,
                c.state === 'booked' ? { backgroundColor: '#F6F3EC', borderColor: HATCH } : null,
                on ? { backgroundColor: BLUE, borderColor: BLUE } : null,
              ]}
            >
              {c.state === 'booked' ? <Hatch /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.barLabels}>
        {labels.map((h) => (
          <Text key={h} style={styles.barLabel}>
            {String(h)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Hatch() {
  return (
    <View style={styles.hatchClip} pointerEvents="none">
      {[-3, -1, 1, 3, 5].map((i) => (
        <View key={i} style={[styles.hatchLine, { left: i * 9 }]} />
      ))}
    </View>
  );
}

function TimeChip({ text, onPress, testID }: { text: string; onPress?: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} style={[styles.timeChip, { borderColor: BLUE }]}>
      <MaterialCommunityIcons name="clock-outline" size={15} color={BLUE} />
      <Text style={styles.timeChipText}>{text}</Text>
    </Pressable>
  );
}

function Banner({ icon, color, text, testID }: { icon: string; color: string; text: string; testID?: string }) {
  return (
    <View testID={testID} style={styles.note}>
      <MaterialCommunityIcons name={icon as never} size={15} color={color} />
      <Text style={[styles.noteText, { color }]}>{text}</Text>
    </View>
  );
}

function RowShell({ children, active, testID }: { children: ReactNode; active: boolean; testID: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.row, { borderColor: active ? '#B9CDEB' : colors.divider, backgroundColor: colors.surface }]}>
      {children}
    </View>
  );
}

function DayRow({
  lang,
  day,
  info,
  listing,
  currency,
  timeZone,
  expanded,
  awaitingEnd,
  note,
  onExpand,
  onMode,
  onHour,
  onRemove,
  removable,
}: {
  lang: PickerLang;
  day: PickedDay;
  info: DayInfo;
  listing: DayHoursListing;
  currency: string;
  timeZone?: string | null;
  expanded: boolean;
  awaitingEnd: boolean;
  note: BlockNote | null;
  onExpand: () => void;
  onMode: (mode: DayMode) => void;
  onHour: (hour: number) => void;
  onRemove: () => void;
  /** False for middle days: removing one would break the run of days. */
  removable: boolean;
}) {
  const { colors } = useTheme();
  const both = showModeSwitch(listing);
  const hoursOnly = !listing.offersDaily;
  const isHours = day.mode === 'hours';
  const open = isHours && (expanded || hoursOnly);
  const sub = info.isToday && info.fromHour != null
    ? pickerText(lang, 'todayFrom', { time: hourLabel(info.fromHour, lang, timeZone) })
    : null;
  const prefix = `day-hours-row-${day.key}`;
  const lockText = isHours && listing.offersDaily ? lockReason(info, lang, timeZone) : null;
  return (
    <RowShell testID={prefix} active={open}>
      <View style={styles.rowHead}>
        <Pressable onPress={isHours ? onExpand : undefined} style={styles.flex}>
          <Text style={[styles.rowDay, { color: colors.text.primary }]}>{dayLabel(day.key, lang)}</Text>
          {sub ? <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{sub}</Text> : null}
          {!isHours && info.openMin != null && info.closeMin != null && !both ? (
            <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 2 }}>
              {minuteLabel(info.openMin, lang, timeZone)} – {minuteLabel(info.closeMin, lang, timeZone)}
            </Text>
          ) : null}
        </Pressable>
        {both ? (
          <Segment lang={lang} mode={day.mode} fullLocked={Boolean(info.fullDayLock)} onMode={onMode} testPrefix={prefix} />
        ) : !listing.offersHourly ? (
          <FullTag lang={lang} />
        ) : null}
        {removable ? (
          <Pressable testID={`${prefix}-remove`} accessibilityRole="button" accessibilityLabel={pickerText(lang, 'remove', { day: dayLabel(day.key, lang) })} onPress={onRemove} hitSlop={8} style={styles.bin}>
            <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.text.secondary} />
          </Pressable>
        ) : (
          <View style={styles.bin} />
        )}
      </View>
      {open ? (
        <HourBar cells={info.cells} start={day.start} end={day.end} selected onHour={onHour} testPrefix={prefix} lang={lang} timeZone={timeZone} />
      ) : null}
      <View style={styles.rowFoot}>
        {isHours ? (
          <>
            <TimeChip testID={`${prefix}-chip`} text={rangeLabel(day.start, day.end, lang, timeZone)} onPress={open ? undefined : onExpand} />
            <Text style={[styles.hours, { color: colors.text.secondary }]}>{blockHours(day)}{'\u00A0'}h</Text>
          </>
        ) : both && info.openMin != null && info.closeMin != null ? (
          <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
            {minuteLabel(info.openMin, lang, timeZone)} – {minuteLabel(info.closeMin, lang, timeZone)}
          </Text>
        ) : null}
        <View style={styles.flex} />
        <Text style={[styles.price, { color: colors.text.primary }]}>{pickerMoney(dayPrice(day, listing), currency, lang)}</Text>
      </View>
      {open && note ? (
        <Banner testID={`${prefix}-note`} icon={note.kind === 'tooShort' ? 'alert-outline' : 'alert-outline'} color={colors.error.main} text={noteText(note, lang, timeZone, listing.minHours, listing.maxHours)} />
      ) : open && lockText ? (
        <Banner testID={`${prefix}-lock`} icon="lock-outline" color={AMBER} text={lockText} />
      ) : open ? (
        <Banner icon="information-outline" color={colors.text.secondary} text={pickerText(lang, awaitingEnd ? 'tapEnd' : 'tapHint')} />
      ) : null}
    </RowShell>
  );
}

function SharedCard({
  lang,
  days,
  infos,
  listing,
  currency,
  timeZone,
  note,
  awaitingEnd,
  onMode,
  onHour,
  onRemove,
}: {
  lang: PickerLang;
  days: PickedDay[];
  infos: DayInfo[];
  listing: DayHoursListing;
  currency: string;
  timeZone?: string | null;
  note: BlockNote | null;
  awaitingEnd: boolean;
  onMode: (mode: DayMode) => void;
  onHour: (hour: number) => void;
  onRemove: (key: string) => void;
}) {
  const { colors } = useTheme();
  const first = days[0];
  const cells = sharedCells(infos);
  const locked = infos.some((i) => Boolean(i.fullDayLock));
  const isHours = first.mode === 'hours';
  return (
    <RowShell testID="day-hours-shared" active>
      <View style={styles.rowHead}>
        <View style={styles.flex}>
          <Text style={[styles.rowDay, { color: colors.text.primary }]}>{pickerText(lang, 'allDays', { count: days.length })}</Text>
          <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{pickerText(lang, 'oneSetting')}</Text>
        </View>
        <Segment lang={lang} mode={first.mode} fullLocked={locked} onMode={onMode} testPrefix="day-hours-shared" />
      </View>
      {isHours ? (
        <HourBar cells={cells} start={first.start} end={first.end} selected onHour={onHour} testPrefix="day-hours-shared" lang={lang} timeZone={timeZone} />
      ) : null}
      <View style={styles.rowFoot}>
        {isHours ? (
          <>
            <TimeChip text={rangeLabel(first.start, first.end, lang, timeZone)} />
            <Text style={[styles.hours, { color: colors.text.secondary }]}>{blockHours(first)}{'\u00A0'}h × {days.length}</Text>
          </>
        ) : null}
        <View style={styles.flex} />
        <Text style={[styles.price, { color: colors.text.primary }]}>{pickerMoney(totalPrice(days, listing), currency, lang)}</Text>
      </View>
      {note ? (
        <Banner icon="alert-outline" color={colors.error.main} text={noteText(note, lang, timeZone, listing.minHours, listing.maxHours)} />
      ) : locked && listing.offersDaily && sharedLockReason(infos, lang) ? (
        <Banner testID="day-hours-shared-lock" icon="lock-outline" color={AMBER} text={sharedLockReason(infos, lang) as string} />
      ) : (
        <Banner icon="information-outline" color={colors.text.secondary} text={pickerText(lang, isHours ? (awaitingEnd ? 'tapEnd' : 'sharedHint') : 'oneSetting')} />
      )}
      <View style={styles.dayChips}>
        {days.map((d) => (
          <View key={d.key} style={[styles.dayChip, { backgroundColor: '#EAF1FB' }]}>
            <Text style={[styles.dayChipText, { color: BLUE }]}>{dayLabel(d.key, lang)}</Text>
            {canRemoveDay(days, d.key) ? (
              <Pressable testID={`day-hours-shared-remove-${d.key}`} accessibilityRole="button" accessibilityLabel={pickerText(lang, 'remove', { day: dayLabel(d.key, lang) })} onPress={() => onRemove(d.key)} hitSlop={8} style={styles.dayChipX}>
                <MaterialCommunityIcons name="close" size={14} color={colors.text.secondary} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </RowShell>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[styles.toggle, { backgroundColor: on ? BLUE : '#D5DCE6' }]}>
      <View style={[styles.knob, on ? { alignSelf: 'flex-end' } : null]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  scrim: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '94%', minHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8 },
  handle: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 12, marginBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  chipText: { fontSize: 12, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingBottom: 16, gap: 10 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  monthBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 17, fontWeight: '800' },
  week: { flexDirection: 'row' },
  weekHead: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', paddingVertical: 4 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 1 },
  dayDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 16 },
  partialDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: AMBER, marginTop: 1 },
  partialSpace: { height: 5 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  legendText: { fontSize: 12 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, padding: 16, marginTop: 6 },
  daysHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  sameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sameText: { color: BLUE, fontWeight: '700', fontSize: 14 },
  toggle: { width: 38, height: 22, borderRadius: 11, padding: 2, justifyContent: 'center' },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
  folded: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 14, marginTop: 4 },
  foldedTitle: { fontSize: 15, fontWeight: '700' },
  row: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 10 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowDay: { fontSize: 16, fontWeight: '800' },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segOption: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  segActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 14, fontWeight: '700' },
  bin: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', gap: 3 },
  cell: { flex: 1, height: 40, borderRadius: 7, borderWidth: 1, overflow: 'hidden' },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginHorizontal: -4 },
  barLabel: { fontSize: 11, color: '#64748B', width: 16, textAlign: 'center' },
  hatchClip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  hatchLine: { position: 'absolute', top: -10, width: 3, height: 70, backgroundColor: HATCH, transform: [{ rotate: '35deg' }] },
  rowFoot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  timeChipText: { color: BLUE, fontWeight: '800', fontSize: 15 },
  hours: { fontSize: 15, fontWeight: '600' },
  price: { fontSize: 15, fontWeight: '800' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  noteText: { fontSize: 13, flex: 1 },
  dayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingLeft: 12, paddingRight: 6, paddingVertical: 6 },
  dayChipText: { fontWeight: '700', fontSize: 14 },
  dayChipX: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  footer: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  footerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  summary: { fontSize: 15, fontWeight: '800' },
  detail: { fontSize: 13, marginTop: 2 },
  total: { fontSize: 21, fontWeight: '800' },
  cta: { height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontSize: 17, fontWeight: '800' },
});
