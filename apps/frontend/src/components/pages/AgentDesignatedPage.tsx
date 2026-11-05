import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDesignatedFirst } from '../../hooks/useDesignatedFirst';
import {
  apiErrorMessage,
  DESIGNATED_DECLINE_REASONS,
  formatDateTime,
  formatKmShort,
  formatWindow,
  isFreeRelease,
  type DesignatedDeclineReason,
  type DesignatedOffer,
  type DesignatedUpcoming,
} from '../../utils/designatedFirst';

const REASON_DEFAULTS: Record<DesignatedDeclineReason, string> = {
  too_far: 'Too far',
  busy: "I'm busy",
  not_enough_balance: 'Not enough balance',
  other: 'Other',
};

function ReasonSelect({ value, onChange }: { value: DesignatedDeclineReason; onChange: (r: DesignatedDeclineReason) => void }) {
  const { t } = useTranslation();
  return (
    <TextField
      select
      size="small"
      label={t('designatedFirst.reason', 'Reason')}
      value={value}
      onChange={(e) => onChange(e.target.value as DesignatedDeclineReason)}
      sx={{ minWidth: 200 }}
    >
      {DESIGNATED_DECLINE_REASONS.map((r) => (
        <MenuItem key={r} value={r}>
          {t(`designatedFirst.reasons.${r}`, REASON_DEFAULTS[r])}
        </MenuItem>
      ))}
    </TextField>
  );
}

type Run = (fn: () => Promise<unknown>, ok?: string) => Promise<void>;

function OfferCard({ offer, run, busy, onAccept, onDecline, onOpen }: {
  offer: DesignatedOffer;
  run: Run;
  busy: boolean;
  onAccept: (id: string) => Promise<unknown>;
  onDecline: (id: string, r: DesignatedDeclineReason) => Promise<unknown>;
  onOpen: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<DesignatedDeclineReason>('busy');
  const d = offer.details;
  const earnings = offer.estimatedEarnings ?? d?.commission ?? null;
  return (
    <Card variant="outlined" data-testid={`designated-offer-${offer.orderId}`}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Chip size="small" color="primary" label={t('designatedFirst.list.offerBadge', 'Offer')} />
          <Typography variant="subtitle1">{d?.businessName ?? t('designatedFirst.offer.title', 'Your designated delivery')}</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t('designatedFirst.offer.acceptBefore', {
            defaultValue: 'Accept before {{time}}. After that it goes to other agents.',
            time: formatDateTime(offer.expiresAt, i18n.language),
          })}
        </Typography>
        {d ? (
          <>
            <Typography variant="body2">
              {t('designatedFirst.offer.slot', { defaultValue: 'Slot: {{date}} {{window}}', date: d.date ?? '', window: formatWindow(d.windowStart, d.windowEnd) })}
            </Typography>
            <Typography variant="body2">
              {t('designatedFirst.offer.pickup', { defaultValue: 'Pickup: {{store}}, {{area}} {{km}}', store: d.businessName, area: d.pickupArea, km: formatKmShort(d.pickupKm) })}
            </Typography>
            <Typography variant="body2">
              {t('designatedFirst.offer.dropoff', { defaultValue: 'Drop-off area: {{area}} {{km}}', area: d.dropoffArea, km: formatKmShort(d.dropoffKm) })}
            </Typography>
          </>
        ) : null}
        {earnings != null ? (
          <Typography variant="body2" fontWeight={600}>
            {t('designatedFirst.offer.earnings', { defaultValue: 'Earnings: {{amount}} {{currency}}', amount: Math.round(earnings), currency: offer.currency ?? d?.currency ?? '' })}
          </Typography>
        ) : null}
        {declining ? (
          <Box sx={{ mt: 1.5 }}>
            <ReasonSelect value={reason} onChange={setReason} />
          </Box>
        ) : null}
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
        {declining ? (
          <>
            <Button onClick={() => setDeclining(false)} disabled={busy}>{t('common.cancel', 'Cancel')}</Button>
            <Button color="error" variant="contained" disabled={busy} onClick={() => void run(() => onDecline(offer.orderId, reason))}>
              {t('designatedFirst.offer.declineConfirm', 'Decline')}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => onOpen(offer.orderId)}>{t('designatedFirst.open', 'View order')}</Button>
            <Button color="error" variant="outlined" disabled={busy} onClick={() => setDeclining(true)}>
              {t('designatedFirst.offer.decline', 'Decline')}
            </Button>
            <Button variant="contained" disabled={busy} onClick={() => void run(() => onAccept(offer.orderId), t('designatedFirst.offer.accepted', 'Accepted. It is yours for this slot.'))}>
              {t('designatedFirst.offer.accept', 'Accept')}
            </Button>
          </>
        )}
      </CardActions>
    </Card>
  );
}

function UpcomingCard({ up, run, busy, onConfirm, onRelease, onOpen }: {
  up: DesignatedUpcoming;
  run: Run;
  busy: boolean;
  onConfirm: (id: string) => Promise<unknown>;
  onRelease: (id: string, r: DesignatedDeclineReason) => Promise<unknown>;
  onOpen: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [releasing, setReleasing] = useState(false);
  const [reason, setReason] = useState<DesignatedDeclineReason>('busy');
  const free = isFreeRelease(up);
  return (
    <Card variant="outlined" data-testid={`designated-upcoming-${up.orderId}`}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Chip size="small" color="success" label={t('designatedFirst.list.assignedBadge', 'Assigned')} />
          <Typography variant="subtitle1">#{up.orderNumber} {up.storeName ?? ''}</Typography>
        </Stack>
        <Typography variant="body2">
          {t('designatedFirst.offer.slot', { defaultValue: 'Slot: {{date}} {{window}}', date: up.date ?? '', window: formatWindow(up.windowStart, up.windowEnd) })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {up.confirmedAt
            ? t('designatedFirst.upcoming.confirmed', "You confirmed you're still on it.")
            : t('designatedFirst.upcoming.notConfirmed', "Let us know you're still on it.")}
        </Typography>
        <Typography variant="body2" color={free ? 'text.secondary' : 'warning.main'}>
          {free
            ? t('designatedFirst.upcoming.freeUntil', { defaultValue: 'You can hand it back without penalty until {{time}}.', time: formatDateTime(up.releaseCutoffAt, i18n.language) })
            : t('designatedFirst.upcoming.lateWarning', 'Handing it back now counts as a strike (no fee).')}
        </Typography>
        {releasing ? (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {free
                ? t('designatedFirst.upcoming.releaseConfirmFree', 'Hand this order back? It goes to other agents. No penalty.')
                : t('designatedFirst.upcoming.releaseConfirmLate', 'Hand this order back? This counts as a strike.')}
            </Typography>
            <ReasonSelect value={reason} onChange={setReason} />
          </Box>
        ) : null}
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
        {releasing ? (
          <>
            <Button onClick={() => setReleasing(false)} disabled={busy}>{t('common.cancel', 'Cancel')}</Button>
            <Button color="error" variant="contained" disabled={busy} onClick={() => void run(() => onRelease(up.orderId, reason))}>
              {t('designatedFirst.upcoming.releaseButton', 'Hand it back')}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => onOpen(up.orderId)}>{t('designatedFirst.open', 'View order')}</Button>
            <Button color="error" variant="outlined" disabled={busy} onClick={() => setReleasing(true)}>
              {t('designatedFirst.upcoming.cantMakeIt', "Can't make it")}
            </Button>
            {!up.confirmedAt ? (
              <Button variant="contained" disabled={busy} onClick={() => void run(() => onConfirm(up.orderId))}>
                {t('designatedFirst.upcoming.stillOnIt', 'Still on it')}
              </Button>
            ) : null}
          </>
        )}
      </CardActions>
    </Card>
  );
}

/** Web agent screen: designated early offers (accept before the gate) and upcoming designated orders. */
const AgentDesignatedPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { offers, upcoming, loading, refetch, accept, decline, confirm, release } = useDesignatedFirst();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  const run: Run = async (fn, ok) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      if (ok) setNotice({ severity: 'success', text: ok });
    } catch (err) {
      setNotice({ severity: 'error', text: apiErrorMessage(err) ?? t('designatedFirst.error', 'Could not update. Try again.') });
    } finally {
      setBusy(false);
      await refetch();
    }
  };
  const open = (id: string) => navigate(`/orders/${id}`);

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {t('designatedFirst.list.title', 'My designated deliveries')}
      </Typography>
      {notice ? (
        <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      ) : null}
      {loading && !offers.length && !upcoming.length ? (
        <CircularProgress />
      ) : !offers.length && !upcoming.length ? (
        <Typography color="text.secondary">{t('designatedFirst.list.empty', 'No designated deliveries right now.')}</Typography>
      ) : (
        <Stack spacing={2}>
          {offers.map((o) => (
            <OfferCard key={`o-${o.orderId}`} offer={o} run={run} busy={busy} onAccept={accept} onDecline={decline} onOpen={open} />
          ))}
          {upcoming.map((u) => (
            <UpcomingCard key={`u-${u.orderId}`} up={u} run={run} busy={busy} onConfirm={confirm} onRelease={release} onOpen={open} />
          ))}
        </Stack>
      )}
    </Container>
  );
};

export default AgentDesignatedPage;
