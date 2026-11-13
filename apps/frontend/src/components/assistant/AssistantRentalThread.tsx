import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAssistantChat } from '../../contexts/AssistantChatContext';
import { useTrackSiteEvent, SITE_EVENT_ASSISTANT_DEEPLINK_SHOWN, SITE_EVENT_ASSISTANT_DEEPLINK_TAP } from '../../hooks/useTrackSiteEvent';
import { rememberRentalCardTap } from '../../utils/rentalAssistantAttribution';
import type { AssistantRentalMeta, AssistantResultCard } from './assistantResultCards';

const NBSP = '\u00A0';

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
    <Stack spacing={1.5} sx={{ width: '100%' }}>
      {rental?.dates ? (
        <Chip label={formatRange(rental.dates, i18n.language)} onClick={onEditDates} variant="outlined" sx={{ alignSelf: 'flex-start', height: 40 }} />
      ) : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 1.5, minWidth: 0 }}>
        {rentalCards.map((card) => (
          <RentalCard
            key={card.id}
            card={card}
            onOpen={() => card.href && navigate(card.href)}
            onRequest={() => {
              rememberRentalCardTap(card.rental?.listingId || card.id, threadId);
              void trackSiteEvent({
                eventType: SITE_EVENT_ASSISTANT_DEEPLINK_TAP,
                metadata: { type: 'rental', target_id: card.rental?.listingId, availability: card.rental?.availability },
              });
              if (card.href) navigate(card.href);
            }}
            onShift={() => onChip(formatShift(card.rental!, i18n.language), { startDate: card.rental?.shiftStart, endDate: card.rental?.shiftEnd })}
          />
        ))}
      </Box>
      {rental?.footnote === 'estimate' ? (
        <Typography variant="caption" color="text.secondary">
          {t('assistant.rental.estimateFootnote', 'Est. price. The business confirms the final price when it accepts your request.')}
        </Typography>
      ) : null}
      {rental?.showAllCount ? (
        <Button variant="text" onClick={() => rental.showAllHref && navigate(rental.showAllHref)} sx={{ alignSelf: 'flex-start' }}>
          {t('assistant.rental.showAll', 'Show all {{count}} results', { count: rental.showAllCount })}
        </Button>
      ) : null}
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {(rental?.chips || []).map((chip) => (
          <Chip
            key={chip.id}
            label={chip.label}
            variant="outlined"
            onClick={() => (chip.action === 'calendar' ? onEditDates() : onChip(chip.message || chip.label, chip))}
            sx={{ height: 40 }}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function RentalCard({
  card,
  onOpen,
  onRequest,
  onShift,
}: {
  card: AssistantResultCard;
  onOpen: () => void;
  onRequest: () => void;
  onShift: () => void;
}) {
  const { t, i18n } = useTranslation();
  const rental = card.rental!;
  const booked = rental.availability === 'unavailable' && rental.cta === 'shift';
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 0, overflow: 'hidden' }}>
      <Stack direction="row" spacing={1.5}>
        <Box sx={{ width: 64, height: 64, borderRadius: 1.5, bgcolor: 'action.hover', overflow: 'hidden' }}>
          {card.imageUrl ? <Box component="img" src={card.imageUrl} alt="" sx={{ width: 64, height: 64, objectFit: 'cover' }} /> : null}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <Typography variant="subtitle2" noWrap sx={{ display: 'block' }}>{card.title}</Typography>
          {rental.businessName ? <Typography variant="caption" color="text.secondary" display="block">{rental.businessName}</Typography> : null}
          {rental.city ? <Typography variant="caption" color="text.secondary" display="block">{rental.city}</Typography> : null}
          <Typography variant="caption" color={booked ? 'warning.main' : 'success.main'} display="block">
            {booked && rental.nextAvailableDate
              ? t('assistant.rental.freeFrom', 'Free from {{date}}', { date: shortDate(rental.nextAvailableDate, i18n.language) })
              : rental.availability === 'no_dates'
                ? t('assistant.rental.pickDates', 'Pick your dates')
                : t('assistant.rental.available', 'Available')}
          </Typography>
          <Typography variant="body2" fontWeight={700}>{priceLine(rental, i18n.language, booked)}</Typography>
          {rental.deposit ? (
            <Typography variant="caption" color="text.secondary">
              {t('assistant.rental.deposit', 'Deposit {{amount}}', { amount: money(rental.deposit, rental.currency) })}
            </Typography>
          ) : null}
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Button
          fullWidth
          variant={booked ? 'outlined' : 'contained'}
          onClick={() => (booked ? onShift() : onRequest())}
          sx={{ minHeight: 44, textTransform: 'none' }}
        >
          {booked
            ? formatShift(rental, i18n.language)
            : rental.cta === 'sign_in'
              ? t('assistant.rental.signIn', 'Sign in to request')
              : t('assistant.rental.request', 'Request rental')}
        </Button>
        <Button variant="outlined" onClick={onOpen} aria-label={t('assistant.rental.details', 'Listing details')} sx={{ minWidth: 44, minHeight: 44 }}>
          i
        </Button>
      </Stack>
    </Paper>
  );
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
  return `${shortDate(rental.shiftStart, locale)} – ${shortDate(rental.shiftEnd, locale)}`;
}

function formatRange(dates: { startDate: string; endDate: string; dayCount: number }, locale: string) {
  const unit = dates.dayCount === 1 ? (locale.startsWith('fr') ? 'jour' : 'day') : locale.startsWith('fr') ? 'jours' : 'days';
  return `${shortDate(dates.startDate, locale)} → ${shortDate(dates.endDate, locale)} · ${dates.dayCount} ${unit}`;
}

function shortDate(iso: string, locale: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1)).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function money(amount: number, currency?: string) {
  const groups = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const code = currency === 'XAF' || currency === 'XOF' || !currency ? 'FCFA' : currency;
  return `${groups}${NBSP}${code}`;
}
