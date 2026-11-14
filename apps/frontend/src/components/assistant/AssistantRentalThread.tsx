import { Box, Button, Chip, IconButton, Paper, Stack, Typography } from '@mui/material';
import CalendarToday from '@mui/icons-material/CalendarToday';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Edit from '@mui/icons-material/Edit';
import Event from '@mui/icons-material/Event';
import EventAvailable from '@mui/icons-material/EventAvailable';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';
import Place from '@mui/icons-material/Place';
import Shield from '@mui/icons-material/Shield';
import Storefront from '@mui/icons-material/Storefront';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';
import { useAssistantChat } from '../../contexts/AssistantChatContext';
import { useTrackSiteEvent, SITE_EVENT_ASSISTANT_DEEPLINK_SHOWN, SITE_EVENT_ASSISTANT_DEEPLINK_TAP } from '../../hooks/useTrackSiteEvent';
import { rememberRentalCardTap } from '../../utils/rentalAssistantAttribution';
import { formatRentalDay } from '../../utils/rentalRequestFormat';
import { AssistantEntityCards } from './AssistantEntityCards';
import type { AssistantRentalChip, AssistantRentalMeta, AssistantResultCard } from './assistantResultCards';

const NBSP = '\u00A0';
const EN_DASH = '\u2013';

export function AssistantRentalThread({
  cards,
  rental,
  onChip,
  onEditDates,
}: {
  cards: AssistantResultCard[];
  rental?: AssistantRentalMeta;
  onChip: (message: string, dates?: { startDate?: string; endDate?: string }) => void;
  onEditDates: () => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { threadId } = useAssistantChat();
  const { trackSiteEvent } = useTrackSiteEvent();
  const rentalCards = cards.filter((card) => card.rental);
  const buyCards = cards.filter((card) => !card.rental);
  const shownKey = rentalCards.map((card) => card.id).join('|');
  useEffect(() => {
    rentalCards.forEach((card, position) => {
      void trackSiteEvent({
        eventType: SITE_EVENT_ASSISTANT_DEEPLINK_SHOWN,
        metadata: { type: 'rental', position, target_id: card.rental?.listingId, availability: card.rental?.availability },
      });
    });
    // shownKey is the card identity; trackSiteEvent is stable per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey, trackSiteEvent]);
  return (
    <ThreadBody
      rental={rental}
      rentalCards={rentalCards}
      buyCards={buyCards}
      locale={i18n.language}
      onEditDates={onEditDates}
      onChip={onChip}
      onOpen={(card) => card.href && navigate(card.href)}
      onRequest={(card) => requestCard(card, threadId, trackSiteEvent, navigate)}
      onShowAll={() => rental?.showAllHref && navigate(rental.showAllHref)}
      otherLabel={t('assistant.rental.otherRentals', 'Other things you can rent')}
      showAllLabel={t('assistant.rental.showAll', 'Show all {{count}} results', { count: rental?.showAllCount })}
      footnote={t('assistant.rental.estimateFootnote', 'Est. price. The business confirms the final price when it accepts your request.')}
    />
  );
}

function ThreadBody({
  rental,
  rentalCards,
  buyCards,
  locale,
  onEditDates,
  onChip,
  onOpen,
  onRequest,
  onShowAll,
  otherLabel,
  showAllLabel,
  footnote,
}: {
  rental?: AssistantRentalMeta;
  rentalCards: AssistantResultCard[];
  buyCards: AssistantResultCard[];
  locale: string;
  onEditDates: () => void;
  onChip: (message: string, dates?: { startDate?: string; endDate?: string }) => void;
  onOpen: (card: AssistantResultCard) => void;
  onRequest: (card: AssistantResultCard) => void;
  onShowAll: () => void;
  otherLabel: string;
  showAllLabel: string;
  footnote: string;
}) {
  const related = relatedChips(rental?.chips);
  return (
    <Stack spacing={1.5} sx={{ width: '100%' }}>
      {rental?.dates ? <DateChip label={formatRange(rental.dates, locale)} onEdit={onEditDates} /> : null}
      <RentalGrid cards={rentalCards} locale={locale} onOpen={onOpen} onRequest={onRequest} onShift={(card) => shiftCard(card, locale, onChip)} />
      {buyCards.length ? <AssistantEntityCards cards={buyCards} /> : null}
      {rental?.footnote === 'estimate' ? <Typography variant="caption" color="text.secondary">{footnote}</Typography> : null}
      {rental?.showAllCount ? <Button variant="text" onClick={onShowAll} sx={{ alignSelf: 'flex-start' }}>{showAllLabel}</Button> : null}
      {related.length ? <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{otherLabel}</Typography> : null}
      {rental?.suggestionNote ? <Typography variant="body2" sx={{ fontSize: 15, lineHeight: '22px' }}>{rental.suggestionNote}</Typography> : null}
      <ChipRow chips={rental?.chips || []} locale={locale} onEditDates={onEditDates} onChip={onChip} />
    </Stack>
  );
}

function RentalGrid({
  cards,
  locale,
  onOpen,
  onRequest,
  onShift,
}: {
  cards: AssistantResultCard[];
  locale: string;
  onOpen: (card: AssistantResultCard) => void;
  onRequest: (card: AssistantResultCard) => void;
  onShift: (card: AssistantResultCard) => void;
}) {
  if (!cards.length) return null;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 1.5, minWidth: 0 }}>
      {cards.map((card) => (
        <RentalCard key={card.id} card={card} locale={locale} onOpen={() => onOpen(card)} onRequest={() => onRequest(card)} onShift={() => onShift(card)} />
      ))}
    </Box>
  );
}

function DateChip({ label, onEdit }: { label: string; onEdit: () => void }) {
  return (
    <Button variant="outlined" onClick={onEdit} startIcon={<CalendarToday />} endIcon={<Edit />} aria-label={label} sx={{ alignSelf: 'flex-start', borderRadius: 2, textTransform: 'none', minHeight: 40, color: 'text.primary' }}>
      {label}
    </Button>
  );
}

function ChipRow({
  chips,
  locale,
  onEditDates,
  onChip,
}: {
  chips: AssistantRentalChip[];
  locale: string;
  onEditDates: () => void;
  onChip: (message: string, dates?: { startDate?: string; endDate?: string }) => void;
}) {
  if (!chips.length) return null;
  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {chips.map((chip) => {
        const label = chipLabel(chip, locale);
        return <Chip key={chip.id} label={label} variant="outlined" onClick={() => (chip.action === 'calendar' ? onEditDates() : onChip(label, chip))} sx={{ height: 40 }} />;
      })}
    </Stack>
  );
}

function chipLabel(chip: AssistantRentalChip, locale: string): string {
  if (chip.id !== 'suggested-range' || !chip.startDate || !chip.endDate) return chip.label;
  return formatRange({ startDate: chip.startDate, endDate: chip.endDate, dayCount: stayDays(chip.startDate, chip.endDate) }, locale);
}

function stayDays(start: string, end: string): number {
  const days = Math.round((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000);
  return days > 0 ? days : 1;
}

function RentalCard({
  card,
  locale,
  onOpen,
  onRequest,
  onShift,
}: {
  card: AssistantResultCard;
  locale: string;
  onOpen: () => void;
  onRequest: () => void;
  onShift: () => void;
}) {
  const { t } = useTranslation();
  const rental = card.rental!;
  const booked = rental.availability === 'unavailable' && rental.cta === 'shift';
  const blocked = rental.availability === 'unavailable' && !booked;
  const label = booked ? formatShift(rental, locale) : actionLabel(rental, blocked, t);
  return (
    <Paper variant="outlined" data-rental-card sx={{ p: 2, borderRadius: 2, minWidth: 0, overflow: 'hidden' }}>
      <Stack direction="row" spacing={1.5}>
        <CardPhoto url={card.imageUrl} title={card.title || ''} />
        <CardFacts card={card} locale={locale} booked={booked} />
      </Stack>
      <CardActions quiet={booked || blocked} label={label} onMain={() => (booked ? onShift() : blocked ? onOpen() : onRequest())} onOpen={onOpen} />
    </Paper>
  );
}

function actionLabel(rental: NonNullable<AssistantResultCard['rental']>, blocked: boolean, t: TFunction) {
  if (blocked) return t('assistant.rental.openListing', 'Open listing');
  if (rental.cta === 'sign_in') return t('assistant.rental.signIn', 'Sign in to request');
  return t('assistant.rental.request', 'Request rental');
}

function CardPhoto({ url, title }: { url?: string | null; title: string }) {
  return (
    <Box sx={{ width: 64, height: 64, borderRadius: 1.5, bgcolor: 'action.hover', overflow: 'hidden', flexShrink: 0 }}>
      {url ? <Box component="img" src={url} alt={title} sx={{ width: 64, height: 64, objectFit: 'cover' }} /> : null}
    </Box>
  );
}

function CardFacts({ card, locale, booked }: { card: AssistantResultCard; locale: string; booked: boolean }) {
  const { t } = useTranslation();
  const rental = card.rental!;
  const estimate = !booked && rental.quoteTotal != null && rental.dayCount;
  return (
    <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
      <Typography variant="body1" noWrap sx={{ display: 'block', fontWeight: 700, color: 'text.primary' }}>{card.title}</Typography>
      {rental.businessName ? <MetaLine icon={<Storefront sx={{ fontSize: 16 }} />} text={rental.businessName} /> : null}
      {rental.city ? <MetaLine icon={<Place sx={{ fontSize: 16 }} />} text={rental.city} /> : null}
      <StatusChip booked={booked} availability={rental.availability} label={statusLabel(rental, locale, t)} />
      <PriceLine text={priceLine(rental, locale, booked)} estimate={Boolean(estimate)} hint={t('assistant.rental.estimateFootnote', 'Est. price. The business confirms the final price when it accepts your request.')} />
      {rental.deposit ? <MetaLine icon={<Shield sx={{ fontSize: 16 }} />} text={t('assistant.rental.deposit', 'Deposit {{amount}}', { amount: money(rental.deposit, rental.currency) })} /> : null}
    </Box>
  );
}

function MetaLine({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary', minWidth: 0 }}>
      {icon}
      <Typography variant="caption" color="text.secondary" noWrap>{text}</Typography>
    </Stack>
  );
}

function StatusChip({ booked, availability, label }: { booked: boolean; availability?: string; label: string }) {
  if (availability === 'unavailable' && !booked) return <UnavailableStatus label={label} />;
  const warning = booked || availability === 'no_dates';
  const icon = warning ? <Event sx={{ fontSize: 14 }} /> : <CheckCircle sx={{ fontSize: 14 }} />;
  return (
    <Chip size="small" icon={icon} label={label} sx={{ alignSelf: 'flex-start', height: 24, my: 0.25, color: warning ? 'warning.dark' : 'success.dark', bgcolor: warning ? 'warning.light' : 'success.light', '& .MuiChip-icon': { color: warning ? 'warning.main' : 'success.main' } }} />
  );
}

function UnavailableStatus({ label }: { label: string }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ alignSelf: 'flex-start', my: 0.25, color: 'warning.main' }}>
      <Event sx={{ fontSize: 14, color: 'warning.main' }} />
      <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>{label}</Typography>
    </Stack>
  );
}

function PriceLine({ text, estimate, hint }: { text: string; estimate: boolean; hint: string }) {
  if (!text) return null;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{text}</Typography>
      {estimate ? <InfoOutlined aria-label={hint} sx={{ fontSize: 16, color: 'text.secondary' }} /> : null}
    </Stack>
  );
}

function CardActions({ quiet, label, onMain, onOpen }: { quiet: boolean; label: string; onMain: () => void; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} alignItems="center">
      <Button fullWidth variant={quiet ? 'outlined' : 'contained'} onClick={onMain} startIcon={quiet ? <CalendarToday /> : <EventAvailable />} sx={{ minHeight: 44, textTransform: 'none', px: 1.25, whiteSpace: 'nowrap' }}>
        {label}
      </Button>
      <IconButton onClick={onOpen} aria-label={t('assistant.rental.details', 'Listing details')} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, width: 44, height: 44 }}>
        <InfoOutlined />
      </IconButton>
      <IconButton onClick={onOpen} aria-label={t('assistant.rental.openListing', 'Open listing')} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, width: 44, height: 44 }}>
        <OpenInNew />
      </IconButton>
    </Stack>
  );
}

function statusLabel(rental: NonNullable<AssistantResultCard['rental']>, locale: string, t: TFunction) {
  if (rental.availability === 'unavailable' && rental.nextAvailableDate) {
    return t('assistant.rental.freeFrom', 'Free from {{date}}', { date: formatRentalDay(rental.nextAvailableDate, locale) });
  }
  if (rental.availability === 'unavailable') return t('assistant.rental.unavailable', 'Not available for these dates');
  if (rental.availability === 'no_dates') return t('assistant.rental.pickDates', 'Pick your dates');
  if (rental.availability === 'own_listing') return t('assistant.rental.ownListing', 'Your listing');
  return t('assistant.rental.available', 'Available');
}

function priceLine(rental: NonNullable<AssistantResultCard['rental']>, locale: string, booked: boolean) {
  if (!booked && rental.quoteTotal != null && rental.dayCount) {
    const prefix = locale.startsWith('fr') ? 'Env.' : 'Est.';
    const unit = rental.dayCount === 1 ? (locale.startsWith('fr') ? 'jour' : 'day') : locale.startsWith('fr') ? 'jours' : 'days';
    return `${prefix} ${money(rental.quoteTotal, rental.currency)} · ${rental.dayCount} ${unit}`;
  }
  return rental.perDay != null ? `${money(rental.perDay, rental.currency)}/${locale.startsWith('fr') ? 'jour' : 'day'}` : '';
}

function formatShift(rental: NonNullable<AssistantResultCard['rental']>, locale: string) {
  if (!rental.shiftStart || !rental.shiftEnd) return '';
  return `${formatRentalDay(rental.shiftStart, locale)} ${EN_DASH} ${formatRentalDay(rental.shiftEnd, locale)}`;
}

function formatRange(dates: { startDate: string; endDate: string; dayCount: number }, locale: string) {
  const unit = dates.dayCount === 1 ? (locale.startsWith('fr') ? 'jour' : 'day') : locale.startsWith('fr') ? 'jours' : 'days';
  return `${formatRentalDay(dates.startDate, locale)} → ${formatRentalDay(dates.endDate, locale)} · ${dates.dayCount} ${unit}`;
}

function money(amount: number, currency?: string) {
  const groups = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const code = currency === 'XAF' || currency === 'XOF' || !currency ? 'FCFA' : currency;
  return `${groups}${NBSP}${code}`;
}

function relatedChips(chips?: AssistantRentalChip[]) {
  return (chips || []).filter((chip) => chip.action === 'category' && chip.id !== 'similar');
}

function shiftCard(card: AssistantResultCard, locale: string, onChip: (message: string, dates?: { startDate?: string; endDate?: string }) => void) {
  onChip(formatShift(card.rental!, locale), { startDate: card.rental?.shiftStart, endDate: card.rental?.shiftEnd });
}

function requestCard(
  card: AssistantResultCard,
  threadId: string | null,
  trackSiteEvent: (event: { eventType: typeof SITE_EVENT_ASSISTANT_DEEPLINK_TAP; metadata?: Record<string, unknown> }) => void,
  navigate: (href: string) => void,
) {
  rememberRentalCardTap(card.rental?.listingId || card.id, threadId || undefined);
  void trackSiteEvent({
    eventType: SITE_EVENT_ASSISTANT_DEEPLINK_TAP,
    metadata: { type: 'rental', target_id: card.rental?.listingId, availability: card.rental?.availability },
  });
  if (card.href) navigate(card.href);
}
