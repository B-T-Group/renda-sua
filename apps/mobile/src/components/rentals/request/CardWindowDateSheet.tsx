import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import {
  calendarDay,
  cardDayBlocked,
  cardWindowNote,
  formatCardCutoff,
  monthCells,
  timezoneLine,
} from '../../../utils/rentals/cardWindow';

const BLUE = '#0A4FB5';
const NAVY = '#0F2744';
const PAGE = '#FAF9F7';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_FR = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

export interface CardWindowStay {
  startDate: string;
  endDate: string;
  dayCount: number;
}

export function CardWindowDateSheet(props: {
  visible: boolean;
  locale: string;
  timeZone: string;
  latestIso: string | null;
  momoAvailable: boolean;
  payingByCard: boolean;
  now?: Date;
  pickup?: string | null;
  onClose: () => void;
  onApply: (stay: CardWindowStay) => void;
  onPayWithMomo?: () => void;
}) {
  const now = props.now ?? new Date();
  const french = props.locale.toLowerCase().startsWith('fr');
  const today = calendarDay(now, props.timeZone);
  const [start, setStart] = useState(props.pickup ?? today);
  const [end, setEnd] = useState<string | null>(null);
  const month = useMemo(() => monthOf(start || today), [start, today]);
  const cells = monthCells(month.year, month.month);
  const cutoff = props.latestIso ? formatCardCutoff(props.latestIso, props.timeZone, props.locale) : '';
  const close = cutoff.split('·')[1]?.trim() || '';
  const canApply = Boolean(end && !cardDayBlocked(end, props.latestIso, props.timeZone) && end >= start);

  const pick = (day: string) => {
    if (day < today || cardDayBlocked(day, props.latestIso, props.timeZone)) return;
    if (!start || (start && end) || day < start) {
      setStart(day);
      setEnd(null);
      return;
    }
    setEnd(day);
  };

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <View style={styles.page}>
        <View style={styles.sheet}>
          <SheetHeader french={french} onClose={props.onClose} />
          <ScrollView contentContainerStyle={styles.body}>
            <RangeRow french={french} start={start} end={end} locale={props.locale} timeZone={props.timeZone} />
            <Text style={styles.month}>{monthTitle(month, props.locale)}</Text>
            <Weekdays french={french} />
            <DayGrid
              cells={cells}
              today={today}
              start={start}
              end={end}
              latestIso={props.latestIso}
              timeZone={props.timeZone}
              onPick={pick}
            />
            <Text style={styles.tz}>{timezoneLine(props.timeZone, props.locale, close)}</Text>
            {props.latestIso && props.payingByCard ? (
              <Note
                french={french}
                momo={props.momoAvailable}
                text={cardWindowNote(cutoff, props.locale)}
                onMomo={props.onPayWithMomo}
              />
            ) : null}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            disabled={!canApply}
            onPress={() => end && props.onApply(stayFrom(start, end))}
            style={[styles.apply, !canApply && styles.applyOff]}
          >
            <Text style={[styles.applyText, !canApply && styles.applyTextOff]}>
              {french ? 'Valider les dates' : 'Apply dates'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SheetHeader({ french, onClose }: { french: boolean; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{french ? 'Dates de location' : 'Rental dates'}</Text>
      <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
        <Text style={styles.close}>✕</Text>
      </Pressable>
    </View>
  );
}

function RangeRow(props: { french: boolean; start: string; end: string | null; locale: string; timeZone: string }) {
  return (
    <View style={styles.range}>
      <View>
        <Text style={styles.kicker}>{props.french ? 'RETRAIT' : 'PICKUP'}</Text>
        <Text style={styles.rangeValue}>{shortDay(props.start, props.locale)}</Text>
      </View>
      <Text style={styles.arrow}>→</Text>
      <View>
        <Text style={styles.kicker}>{props.french ? 'RETOUR' : 'RETURN'}</Text>
        <Text style={[styles.rangeValue, !props.end && styles.placeholder]}>
          {props.end ? shortDay(props.end, props.locale) : props.french ? 'Choisir' : 'Choose'}
        </Text>
      </View>
    </View>
  );
}

function Weekdays({ french }: { french: boolean }) {
  const labels = french ? WEEKDAYS_FR : WEEKDAYS;
  return (
    <View style={styles.week}>
      {labels.map((label) => (
        <Text key={label} style={styles.weekday}>{label}</Text>
      ))}
    </View>
  );
}

function DayGrid(props: {
  cells: Array<string | null>;
  today: string;
  start: string;
  end: string | null;
  latestIso: string | null;
  timeZone: string;
  onPick: (day: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {props.cells.map((day, index) => (
        <DayCell key={day ?? `e-${index}`} day={day} {...props} />
      ))}
    </View>
  );
}

function DayCell(props: {
  day: string | null;
  today: string;
  start: string;
  end: string | null;
  latestIso: string | null;
  timeZone: string;
  onPick: (day: string) => void;
}) {
  if (!props.day) return <View style={styles.cell} />;
  const past = props.day < props.today;
  const blocked = cardDayBlocked(props.day, props.latestIso, props.timeZone);
  const selected = props.day === props.start || props.day === props.end;
  return (
    <Pressable style={styles.cell} disabled={past || blocked} onPress={() => props.onPick(props.day!)}>
      <Text
        style={[
          styles.day,
          past && styles.past,
          blocked && styles.blocked,
          props.day === props.today && styles.today,
          selected && styles.selected,
        ]}
      >
        {Number(props.day.slice(8))}
      </Text>
    </Pressable>
  );
}

function Note(props: { french: boolean; momo: boolean; text: string; onMomo?: () => void }) {
  return (
    <View style={styles.note}>
      <Text style={styles.info}>i</Text>
      <View style={styles.noteBody}>
        <Text style={styles.payline}>
          {props.momo
            ? props.french
              ? 'Paiement : Carte · Mobile Money est aussi disponible'
              : 'Paying with Card · Mobile Money is also available'
            : props.french
              ? 'Paiement par carte'
              : 'Paying by card'}
        </Text>
        <Text style={styles.noteText}>{props.text}</Text>
        {props.momo ? (
          <Pressable accessibilityRole="button" onPress={props.onMomo} style={styles.momo}>
            <Text style={styles.info}>▣</Text>
            <Text style={styles.momoText}>
              {props.french ? 'Payer plutôt avec Mobile Money' : 'Pay with Mobile Money instead'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function stayFrom(start: string, endInclusive: string): CardWindowStay {
  const end = addIsoDay(endInclusive, 1);
  const dayCount = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
  return { startDate: start, endDate: end, dayCount };
}

function addIsoDay(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function monthOf(iso: string): { year: number; month: number } {
  const [year, month] = iso.split('-').map(Number);
  return { year, month };
}

function monthTitle(month: { year: number; month: number }, locale: string): string {
  const date = new Date(Date.UTC(month.year, month.month - 1, 1));
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('fr') ? 'fr' : 'en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function shortDay(iso: string, locale: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('fr') ? 'fr' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1E293B', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, minHeight: '78%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 18, fontWeight: '800', color: NAVY },
  close: { fontSize: 20, color: NAVY, fontWeight: '700' },
  arrow: { color: '#64748B', fontSize: 16, fontWeight: '700' },
  info: { color: BLUE, fontWeight: '800', fontSize: 16 },
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  range: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: PAGE, borderRadius: 12, padding: 12 },
  kicker: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  rangeValue: { fontSize: 15, fontWeight: '800', color: NAVY },
  placeholder: { color: '#94A3B8' },
  month: { fontWeight: '800', fontSize: 14, color: NAVY, textTransform: 'capitalize' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, color: '#64748B', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', height: 38, alignItems: 'center', justifyContent: 'center' },
  day: { fontSize: 14, fontWeight: '600', color: NAVY },
  past: { color: '#CBD5E1', fontWeight: '500' },
  blocked: { color: '#CBD5E1', textDecorationLine: 'line-through' },
  today: { fontWeight: '800', textDecorationLine: 'underline' },
  selected: { backgroundColor: BLUE, color: '#fff', overflow: 'hidden', borderRadius: 16, paddingHorizontal: 8, fontWeight: '800' },
  tz: { fontSize: 12, color: '#64748B' },
  note: { flexDirection: 'row', gap: 10, backgroundColor: '#E8F0FB', borderColor: '#C5D8F3', borderWidth: 1, borderRadius: 12, padding: 10 },
  noteBody: { flex: 1 },
  payline: { color: BLUE, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  noteText: { color: NAVY, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  momo: { marginTop: 8, height: 40, borderRadius: 12, borderWidth: 1.5, borderColor: BLUE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  momoText: { color: BLUE, fontWeight: '800', fontSize: 14 },
  apply: { margin: 16, height: 48, borderRadius: 12, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  applyOff: { backgroundColor: '#E7E5E4' },
  applyText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  applyTextOff: { color: '#A8A29E' },
});
