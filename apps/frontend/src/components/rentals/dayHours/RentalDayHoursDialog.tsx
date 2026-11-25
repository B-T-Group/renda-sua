import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
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
} from '../../../utils/rentalDayHoursPicker';
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
} from '../../../utils/rentalDayHoursCopy';
import type { SelectionRange } from '../rentalRequestScheduleUtils';

const BLUE = '#0A4FB5';
const TINT = '#D6E4F7';
const SOFT = '#EAF1FB';
const CELL_FREE = '#EEF3FB';
const CELL_PAST = '#ECEAE6';
const HATCH = '#E2DCCF';
const AMBER = '#B45309';
const RED = '#C62828';
const MUTED = '#6B7280';
const FAINT = '#B8BEC8';

export interface RentalDayHoursDialogProps {
  open: boolean;
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
}

type Notes = Record<string, BlockNote | null>;

/** Web day-and-hours picker (rentals_day_hours_picker_enabled). Calendar left, days right. */
export const RentalDayHoursDialog: React.FC<RentalDayHoursDialogProps> = (props) => {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      fullScreen={narrow}
      maxWidth={false}
      PaperProps={{ sx: { width: narrow ? '100%' : 736, maxWidth: '100%', borderRadius: narrow ? 0 : '20px', overflow: 'hidden' } }}
    >
      {props.open ? <DialogBody {...props} narrow={narrow} /> : null}
    </Dialog>
  );
};

function DialogBody({
  listing,
  currency,
  language,
  timeZone,
  city,
  initialDays,
  nowMs,
  onClose,
  onContinue,
  narrow,
}: RentalDayHoursDialogProps & { narrow: boolean }) {
  const lang = pickerLang(language);
  const now = useMemo(() => listingNowMs(nowMs ?? Date.now(), timeZone), [nowMs, timeZone]);
  const todayKey = utcMsToKey(now);
  const [days, setDays] = useState<PickedDay[]>(initialDays ?? []);
  const [expanded, setExpanded] = useState<string | null>(() => lastHoursKey(initialDays ?? []));
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [notes, setNotes] = useState<Notes>({});
  const [shared, setShared] = useState(false);
  const [banner, setBanner] = useState<'notInARow' | 'notInARowRemove' | null>(null);
  const [month, setMonth] = useState(() => {
    const anchor = initialDays?.[0]?.key ?? todayKey;
    return { y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) - 1 };
  });

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

  function onDayTap(key: string) {
    const result = toggleDay(days, info(key), listing);
    if (result.kind === 'notInARow') {
      setBanner(days.some((d) => d.key === key) ? 'notInARowRemove' : 'notInARow');
      return;
    }
    if (result.kind === 'unpickable') return;
    setBanner(null);
    let next = result.days;
    if (sharedOn && result.kind === 'added' && days[0]) next = applySharedChoice(next, days[0]);
    setDays(next);
    setAwaitingEnd(false);
    if (result.kind === 'added') {
      const added = next.find((d) => d.key === key);
      if (added?.mode === 'hours') setExpanded(key);
    } else if (expanded === key) {
      setExpanded(null);
    }
    if (next.length < 2) setShared(false);
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
  return (
    <Box data-testid="day-hours-sheet" sx={{ display: 'flex', flexDirection: 'column', maxHeight: narrow ? '100%' : 'min(88vh, 720px)', height: narrow ? '100%' : undefined }}>
      <Box sx={{ px: 3, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1.25 }}>{pickerText(lang, 'title')}</Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.5 }}>{pickerText(lang, 'subtitle', { city: zoneCity })}</Typography>
          <PriceChips listing={listing} currency={currency} lang={lang} />
        </Box>
        <IconButton data-testid="day-hours-close" aria-label={pickerText(lang, 'close')} onClick={onClose} sx={{ bgcolor: '#F1F3F6' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3, pb: 2, display: 'flex', flexDirection: narrow ? 'column' : 'row', gap: 3 }}>
        <Box sx={{ width: narrow ? '100%' : 284, flexShrink: 0 }}>
          <Calendar lang={lang} month={month} todayKey={todayKey} picked={days.map((d) => d.key)} info={info} onMonth={setMonth} onDay={onDayTap} showPartial={listing.offersHourly} />
          {banner ? <Note icon="info" color={AMBER} text={pickerText(lang, banner)} testId="day-hours-banner" /> : null}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {days.length === 0 ? (
            <Box data-testid="day-hours-empty" sx={{ border: '1.5px dashed #CBD2DC', borderRadius: '12px', p: 2, display: 'flex', gap: 1.5, alignItems: 'center', color: MUTED, mt: 4 }}>
              <InfoOutlinedIcon fontSize="small" />
              <Typography sx={{ fontSize: 14 }}>{pickerText(lang, 'empty')}</Typography>
            </Box>
          ) : (
            <>
              <Stack direction="row" alignItems="center" sx={{ mb: 1, minHeight: 32 }}>
                <Typography sx={{ flex: 1, fontSize: 12, fontWeight: 700, letterSpacing: 0.6, color: MUTED }}>
                  {pickerText(lang, 'yourDays').toUpperCase()}
                </Typography>
                {days.length > 1 && both ? (
                  <ButtonBase data-testid="day-hours-same-for-all" role="switch" aria-checked={sharedOn} onClick={toggleShared} sx={{ gap: 0.75, borderRadius: '8px', px: 0.5 }}>
                    <ContentCopyIcon sx={{ fontSize: 16, color: BLUE }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: BLUE }}>{pickerText(lang, 'sameForAll')}</Typography>
                    <Toggle on={sharedOn} />
                  </ButtonBase>
                ) : null}
              </Stack>
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
                <Stack spacing={1}>
                  {days.map((d) => (
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
                  ))}
                </Stack>
              )}
            </>
          )}
        </Box>
      </Box>
      <Box sx={{ borderTop: '1px solid #E5E7EB', px: 3, py: 1.75, display: 'flex', alignItems: 'center', gap: 2.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography data-testid="day-hours-summary" sx={{ fontSize: 14, fontWeight: 700 }}>
            {days.length ? summaryLine(days, lang) : pickerText(lang, 'noDays')}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: MUTED }}>
            {!listing.offersHourly && days.length
              ? pickerText(lang, 'dailyOnly')
              : !listing.offersDaily && days.length
                ? pickerText(lang, 'hourlyOnly')
                : footerDetail(days, infos, lang, timeZone, { shared: sharedOn, todayKey, cityLabel: lang === 'fr' ? `heure de ${zoneCity}` : `${zoneCity} time` })}
          </Typography>
        </Box>
        {days.length ? (
          <Typography data-testid="day-hours-total" sx={{ fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap' }}>
            {pickerMoney(total, currency, lang)}
          </Typography>
        ) : null}
        <Button
          data-testid="day-hours-continue"
          variant="contained"
          disableElevation
          disabled={!canContinue}
          endIcon={<ArrowForwardIcon />}
          onClick={() => onContinue(toSelectionRanges(days, infos) as SelectionRange[], days)}
          sx={{ bgcolor: BLUE, borderRadius: '12px', px: 6, py: 1.4, fontSize: 15, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#083F91' } }}
        >
          {pickerText(lang, 'continue')}
        </Button>
      </Box>
    </Box>
  );
}

function lastHoursKey(days: PickedDay[]): string | null {
  if (days.length === 1) return days[0].key;
  const hours = days.filter((d) => d.mode === 'hours');
  return hours.length ? hours[hours.length - 1].key : null;
}

/** Same track as the mobile toggle: #D5DCE6 off, blue on, white knob. */
function Toggle({ on }: { on: boolean }) {
  return (
    <Box sx={{ width: 38, height: 22, borderRadius: '11px', p: '2px', bgcolor: on ? BLUE : '#D5DCE6', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background-color 120ms' }}>
      <Box sx={{ width: 18, height: 18, borderRadius: '9px', bgcolor: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.25)' }} />
    </Box>
  );
}

function PriceChips({ listing, currency, lang }: { listing: DayHoursListing; currency: string; lang: PickerLang }) {
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap', rowGap: 1 }}>
      {listing.offersDaily ? (
        <Chip icon={<WbSunnyOutlinedIcon sx={{ fontSize: 14 }} />} text={pickerText(lang, 'perDay', { amount: pickerMoney(listing.dayRate, currency, lang) })} />
      ) : null}
      {listing.offersHourly ? (
        <Chip icon={<AccessTimeIcon sx={{ fontSize: 14 }} />} text={pickerText(lang, 'perHour', { amount: pickerMoney(listing.hourRate, currency, lang) })} />
      ) : null}
      {listing.offersHourly && listing.minHours > 1 ? <Chip text={pickerText(lang, 'minHours', { count: listing.minHours })} muted /> : null}
    </Stack>
  );
}

function Chip({ icon, text, muted }: { icon?: React.ReactNode; text: string; muted?: boolean }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5, borderRadius: '999px', bgcolor: muted ? '#F1F3F6' : SOFT, color: muted ? MUTED : BLUE }}>
      {icon}
      <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{text}</Typography>
    </Box>
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
  const cells = monthGrid(month.y, month.m, weekStart(lang));
  while (cells.length % 7) cells.push(null);
  const atStart = month.y === Number(todayKey.slice(0, 4)) && month.m === Number(todayKey.slice(5, 7)) - 1;
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(month.y, month.m + delta, 1));
    onMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  return (
    <Box data-testid="day-hours-calendar">
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <IconButton aria-label={pickerText(lang, 'prevMonth')} disabled={atStart} onClick={() => shift(-1)} sx={{ color: BLUE }}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography sx={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 16 }}>{monthTitle(month.y, month.m, lang)}</Typography>
        <IconButton data-testid="day-hours-next-month" aria-label={pickerText(lang, 'nextMonth')} onClick={() => shift(1)} sx={{ color: BLUE }}>
          <ChevronRightIcon />
        </IconButton>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 0.5 }}>
        {weekdayHeads(lang).map((h, i) => (
          <Typography key={`${h}${i}`} sx={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: MUTED, pb: 0.75 }}>
            {h}
          </Typography>
        ))}
        {cells.map((key, i) => {
          if (!key) return <Box key={`e${i}`} />;
          const d = info(key);
          const isPicked = picked.includes(key);
          const pickable = d.status === 'free' || d.status === 'partial';
          const struck = d.status === 'unavailable';
          const isToday = key === todayKey;
          return (
            <ButtonBase
              key={key}
              data-testid={`day-hours-day-${key}`}
              aria-label={dayLabel(key, lang)}
              aria-pressed={isPicked}
              disabled={!pickable && !isPicked}
              onClick={() => onDay(key)}
              sx={{ flexDirection: 'column', height: 44, borderRadius: '8px' }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isPicked ? BLUE : 'transparent',
                  border: !isPicked && isToday ? `1.5px solid ${BLUE}` : 'none',
                }}
              >
                <Typography
                  sx={{
                    fontSize: 14,
                    fontWeight: pickable || isPicked ? 700 : 400,
                    color: isPicked ? '#fff' : pickable ? '#111827' : FAINT,
                    textDecoration: struck ? 'line-through' : 'none',
                  }}
                >
                  {Number(key.slice(8, 10))}
                </Typography>
              </Box>
              <Box sx={{ width: 5, height: 5, mt: '2px', borderRadius: '50%', bgcolor: showPartial && d.status === 'partial' ? AMBER : 'transparent' }} />
            </ButtonBase>
          );
        })}
      </Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1, color: MUTED }}>
        {showPartial ? (
          <>
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: AMBER }} />
            <Typography sx={{ fontSize: 11.5 }}>{pickerText(lang, 'someBooked')}</Typography>
          </>
        ) : null}
        <Typography sx={{ fontSize: 11.5, color: FAINT, textDecoration: 'line-through', pl: showPartial ? 1 : 0 }}>26</Typography>
        <Typography sx={{ fontSize: 11.5 }}>{pickerText(lang, 'unavailable')}</Typography>
      </Stack>
    </Box>
  );
}

function Segment({ lang, mode, fullLocked, onMode, testPrefix }: { lang: PickerLang; mode: DayMode; fullLocked: boolean; onMode: (m: DayMode) => void; testPrefix: string }) {
  const option = (value: DayMode, icon: React.ReactNode, label: string, disabled: boolean) => {
    const active = mode === value;
    return (
      <ButtonBase
        data-testid={`${testPrefix}-${value}`}
        aria-pressed={active}
        disabled={disabled}
        onClick={() => onMode(value)}
        sx={{
          gap: 0.5,
          px: 1.25,
          py: 0.6,
          borderRadius: '8px',
          bgcolor: active ? '#fff' : 'transparent',
          boxShadow: active ? '0 1px 3px rgba(15,23,42,0.15)' : 'none',
          border: active ? `1px solid ${TINT}` : '1px solid transparent',
          color: disabled ? FAINT : active ? BLUE : MUTED,
          cursor: disabled ? 'not-allowed' : 'pointer',
          '&.Mui-disabled': { color: FAINT, opacity: 1 },
        }}
      >
        {disabled ? <LockOutlinedIcon sx={{ fontSize: 15 }} /> : icon}
        <Typography color="inherit" sx={{ fontSize: 13, fontWeight: active ? 700 : 600, textDecoration: disabled ? 'none' : undefined }}>
          {label}
        </Typography>
      </ButtonBase>
    );
  };
  return (
    <Box sx={{ display: 'inline-flex', p: '3px', borderRadius: '10px', bgcolor: '#F1F3F6' }}>
      {option('full', <WbSunnyOutlinedIcon sx={{ fontSize: 15 }} />, pickerText(lang, 'fullDay'), fullLocked)}
      {option('hours', <AccessTimeIcon sx={{ fontSize: 15 }} />, pickerText(lang, 'hours'), false)}
    </Box>
  );
}

function HourBar({ cells, start, end, onHour, testPrefix, lang, timeZone }: { cells: DayCell[]; start: number; end: number; onHour: (h: number) => void; testPrefix: string; lang: PickerLang; timeZone?: string | null }) {
  if (!cells.length) return null;
  const labels = [...cells.map((c) => c.hour), cells[cells.length - 1].hour + 1];
  return (
    <Box data-testid={`${testPrefix}-bar`} sx={{ mt: 1.25 }}>
      <Box sx={{ display: 'flex', gap: '4px' }}>
        {cells.map((c) => {
          const on = c.hour >= start && c.hour < end;
          const booked = c.state === 'booked';
          return (
            <ButtonBase
              key={c.hour}
              data-testid={`${testPrefix}-h${c.hour}`}
              aria-label={hourLabel(c.hour, lang, timeZone)}
              aria-pressed={on}
              disabled={c.state !== 'free'}
              onClick={() => onHour(c.hour)}
              sx={{
                flex: 1,
                height: 30,
                borderRadius: '5px',
                border: '1px solid',
                borderColor: on ? BLUE : booked ? HATCH : c.state === 'past' ? CELL_PAST : TINT,
                bgcolor: on ? BLUE : booked ? '#F6F3EC' : c.state === 'past' ? CELL_PAST : CELL_FREE,
                backgroundImage: booked && !on ? `repeating-linear-gradient(135deg, ${HATCH} 0 2px, transparent 2px 8px)` : 'none',
              }}
            />
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', mt: 0.5 }}>
        {labels.map((h, i) => (
          <Typography key={h} sx={{ flex: i === labels.length - 1 ? 0 : 1, minWidth: 0, fontSize: 10.5, color: MUTED, transform: 'translateX(-3px)' }}>
            {String(h)}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

function TimeChip({ text, onClick, testId }: { text: string; onClick?: () => void; testId?: string }) {
  return (
    <ButtonBase data-testid={testId} onClick={onClick} disabled={!onClick} sx={{ gap: 0.5, px: 1.25, py: 0.4, borderRadius: '999px', border: `1.5px solid ${BLUE}`, color: BLUE }}>
      <AccessTimeIcon sx={{ fontSize: 15 }} />
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{text}</Typography>
    </ButtonBase>
  );
}

function Note({ icon, color, text, testId }: { icon: 'info' | 'alert' | 'lock'; color: string; text: string; testId?: string }) {
  const Icon = icon === 'lock' ? LockOutlinedIcon : icon === 'alert' ? WarningAmberOutlinedIcon : InfoOutlinedIcon;
  return (
    <Stack data-testid={testId} direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 1, color }}>
      <Icon sx={{ fontSize: 16, mt: '1px' }} />
      <Typography sx={{ fontSize: 12.5, color }}>{text}</Typography>
    </Stack>
  );
}

function RowShell({ children, active, testId }: { children: React.ReactNode; active: boolean; testId: string }) {
  return (
    <Box data-testid={testId} sx={{ border: '1px solid', borderColor: active ? '#B9CDEB' : '#E5E7EB', borderRadius: '12px', px: 1.75, py: 1.25, bgcolor: '#fff' }}>
      {children}
    </Box>
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
  onMode: (m: DayMode) => void;
  onHour: (h: number) => void;
  onRemove: () => void;
  /** False for middle days: removing one would break the run of days. */
  removable: boolean;
}) {
  const both = showModeSwitch(listing);
  const isHours = day.mode === 'hours';
  const open = isHours && (expanded || !listing.offersDaily);
  const prefix = `day-hours-row-${day.key}`;
  const sub = info.isToday && info.fromHour != null ? pickerText(lang, 'todayFrom', { time: hourLabel(info.fromHour, lang, timeZone) }) : null;
  const lockText = isHours && listing.offersDaily ? lockReason(info, lang, timeZone) : null;
  const hoursText = info.openMin != null && info.closeMin != null ? `${minuteLabel(info.openMin, lang, timeZone)} – ${minuteLabel(info.closeMin, lang, timeZone)}` : '';
  return (
    <RowShell testId={prefix} active={open}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0, cursor: isHours ? 'pointer' : 'default' }} onClick={isHours ? onExpand : undefined}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{dayLabel(day.key, lang)}</Typography>
          {sub ? <Typography sx={{ fontSize: 12, color: MUTED }}>{sub}</Typography> : null}
        </Box>
        {both ? (
          <Segment lang={lang} mode={day.mode} fullLocked={Boolean(info.fullDayLock)} onMode={onMode} testPrefix={prefix} />
        ) : !listing.offersHourly ? (
          <Chip icon={<WbSunnyOutlinedIcon sx={{ fontSize: 14 }} />} text={pickerText(lang, 'fullDay')} />
        ) : null}
        {removable ? (
          <IconButton data-testid={`${prefix}-remove`} aria-label={pickerText(lang, 'remove', { day: dayLabel(day.key, lang) })} onClick={onRemove} size="small">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        ) : (
          <Box sx={{ width: 34 }} />
        )}
      </Stack>
      {open ? <HourBar cells={info.cells} start={day.start} end={day.end} onHour={onHour} testPrefix={prefix} lang={lang} timeZone={timeZone} /> : null}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
        {isHours ? (
          <>
            <TimeChip testId={`${prefix}-chip`} text={rangeLabel(day.start, day.end, lang, timeZone)} onClick={open ? undefined : onExpand} />
            <Typography sx={{ fontSize: 13, color: MUTED }}>{blockHours(day)}{'\u00A0'}h</Typography>
          </>
        ) : (
          <Typography sx={{ fontSize: 13, color: MUTED }}>{hoursText}</Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{pickerMoney(dayPrice(day, listing), currency, lang)}</Typography>
      </Stack>
      {open && note ? (
        <Note testId={`${prefix}-note`} icon="alert" color={RED} text={noteText(note, lang, timeZone, listing.minHours, listing.maxHours)} />
      ) : open && lockText ? (
        <Note testId={`${prefix}-lock`} icon="lock" color={AMBER} text={lockText} />
      ) : open ? (
        <Note icon="info" color={MUTED} text={pickerText(lang, awaitingEnd ? 'tapEnd' : 'chooseHint')} />
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
  onMode: (m: DayMode) => void;
  onHour: (h: number) => void;
  onRemove: (key: string) => void;
}) {
  const first = days[0];
  const cells = sharedCells(infos);
  const locked = infos.some((i) => Boolean(i.fullDayLock));
  const isHours = first.mode === 'hours';
  const total = days.reduce((sum, d) => sum + dayPrice(d, listing), 0);
  return (
    <RowShell testId="day-hours-shared" active>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography sx={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{pickerText(lang, 'allDays', { count: days.length })}</Typography>
        <Segment lang={lang} mode={first.mode} fullLocked={locked} onMode={onMode} testPrefix="day-hours-shared" />
      </Stack>
      {isHours ? <HourBar cells={cells} start={first.start} end={first.end} onHour={onHour} testPrefix="day-hours-shared" lang={lang} timeZone={timeZone} /> : null}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
        {isHours ? (
          <>
            <TimeChip text={rangeLabel(first.start, first.end, lang, timeZone)} />
            <Typography sx={{ fontSize: 13, color: MUTED }}>{days.length} × {blockHours(first)}{'\u00A0'}h</Typography>
          </>
        ) : (
          <Typography sx={{ fontSize: 13, color: MUTED }}>{pickerText(lang, 'fullDays')}</Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{pickerMoney(total, currency, lang)}</Typography>
      </Stack>
      {note ? (
        <Note icon="alert" color={RED} text={noteText(note, lang, timeZone, listing.minHours, listing.maxHours)} />
      ) : locked && listing.offersDaily && sharedLockReason(infos, lang) ? (
        <Note testId="day-hours-shared-lock" icon="lock" color={AMBER} text={sharedLockReason(infos, lang) as string} />
      ) : (
        <Note icon="info" color={MUTED} text={pickerText(lang, isHours ? (awaitingEnd ? 'tapEnd' : 'sharedHint') : 'oneSetting')} />
      )}
      <Stack direction="row" sx={{ mt: 1.25, flexWrap: 'wrap', gap: 0.75 }}>
        {days.map((d) => (
          <Box key={d.key} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, pl: 1.25, pr: 0.25, borderRadius: '999px', bgcolor: SOFT }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: BLUE }}>{dayLabel(d.key, lang)}</Typography>
            {canRemoveDay(days, d.key) ? (
              <IconButton data-testid={`day-hours-shared-remove-${d.key}`} aria-label={pickerText(lang, 'remove', { day: dayLabel(d.key, lang) })} onClick={() => onRemove(d.key)} size="small">
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            ) : (
              <Box sx={{ width: 10, height: 30 }} />
            )}
          </Box>
        ))}
      </Stack>
    </RowShell>
  );
}
