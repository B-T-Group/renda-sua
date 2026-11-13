import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import {
  calendarDay,
  cardDayBlocked,
  cardWindowNote,
  formatCardCutoff,
  monthCells,
  timezoneLine,
  type CardWindowFields,
} from '../../utils/rentals/cardWindow';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_FR = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

export function CardWindowCalendar(props: {
  fields: CardWindowFields;
  payingByCard: boolean;
  locale: string;
  now?: Date;
  onPayWithMomo?: () => void;
  onSelectEnd?: (day: string) => void;
  pickup?: string | null;
}) {
  const now = props.now ?? new Date();
  const zone = props.fields.timezone || 'Africa/Douala';
  const latest = props.payingByCard ? props.fields.latest_card_end_at ?? null : null;
  const today = calendarDay(now, zone);
  const [start, setStart] = useState(props.pickup || addIsoDay(today, 1));
  const [end, setEnd] = useState<string | null>(null);
  const [year, month] = (start || today).split('-').map(Number);
  const cells = monthCells(year, month);
  const french = props.locale.toLowerCase().startsWith('fr');
  const cutoff = latest ? formatCardCutoff(latest, zone, props.locale) : '';
  const close = cutoff.split('·')[1]?.trim() || '';
  const labels = french ? WEEK_FR : WEEK;
  const pick = (day: string) => {
    if (day < today || cardDayBlocked(day, latest, zone)) return;
    if (!start || end || day < start) {
      setStart(day);
      setEnd(null);
      return;
    }
    setEnd(day);
    props.onSelectEnd?.(day);
  };

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
        {labels.map((label) => (
          <Typography key={label} variant="caption" color="text.secondary">{label}</Typography>
        ))}
        {cells.map((day, index) => (
          <Day key={day ?? `e-${index}`} day={day} today={today} start={start} end={end} latest={latest} zone={zone} onSelect={pick} />
        ))}
      </Box>
      {close ? <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{timezoneLine(zone, props.locale, close)}</Typography> : null}
      {latest ? (
        <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: '#E8F0FB', border: '1px solid #C5D8F3', display: 'flex', gap: 1 }}>
          <InfoOutlinedIcon sx={{ color: '#0A4FB5', fontSize: 18 }} />
          <Box>
            <Typography variant="caption" sx={{ color: '#0A4FB5', fontWeight: 700, display: 'block' }}>
              {props.fields.momo_available
                ? french ? 'Paiement : Carte · Mobile Money est aussi disponible' : 'Paying with Card · Mobile Money is also available'
                : french ? 'Paiement par carte' : 'Paying by card'}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F2744' }}>{cardWindowNote(cutoff, props.locale)}</Typography>
            {props.fields.momo_available && props.onPayWithMomo ? (
              <Button variant="outlined" startIcon={<PhoneIphoneIcon />} onClick={props.onPayWithMomo} sx={{ mt: 1, borderRadius: 1.5, fontWeight: 800 }}>
                {french ? 'Payer plutôt avec Mobile Money' : 'Pay with Mobile Money instead'}
              </Button>
            ) : null}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

function addIsoDay(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function Day(props: {
  day: string | null;
  today: string;
  start: string;
  end: string | null;
  latest: string | null;
  zone: string;
  onSelect?: (day: string) => void;
}) {
  if (!props.day) return <Box sx={{ height: 38 }} />;
  const past = props.day < props.today;
  const blocked = cardDayBlocked(props.day, props.latest, props.zone);
  const selected = props.day === props.start || props.day === props.end;
  return (
    <Button
      disabled={past || blocked}
      onClick={() => props.onSelect?.(props.day!)}
      sx={{
        minWidth: 36,
        width: 36,
        height: 36,
        justifySelf: 'center',
        borderRadius: '50%',
        color: past || blocked ? '#CBD5E1' : selected ? '#fff' : '#0F2744',
        textDecoration: blocked ? 'line-through' : props.day === props.today && !selected ? 'underline' : 'none',
        bgcolor: selected ? '#0A4FB5' : 'transparent',
        fontWeight: 700,
      }}
    >
      {Number(props.day.slice(8))}
    </Button>
  );
}

export function CardWindowBanner(props: {
  tone: 'warn' | 'error';
  title?: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  const warn = props.tone === 'warn';
  return (
    <Box sx={{ p: 1.25, borderRadius: 1.5, display: 'flex', gap: 1, bgcolor: warn ? '#FEF3C7' : '#FEE2E2', border: `1px solid ${warn ? '#F5D38A' : '#FECACA'}` }}>
      <WarningAmberIcon sx={{ color: warn ? '#B45309' : '#B91C1C', fontSize: 18 }} />
      <Box>
        {props.title ? <Typography sx={{ fontWeight: 800, color: warn ? '#7C3D0A' : '#7F1D1D' }}>{props.title}</Typography> : null}
        <Typography variant="body2" sx={{ fontWeight: 600, color: warn ? '#7C3D0A' : '#7F1D1D' }}>{props.body}</Typography>
        <Button onClick={props.onAction} sx={{ px: 0, fontWeight: 800, color: '#0A4FB5' }}>{props.action}</Button>
      </Box>
    </Box>
  );
}
