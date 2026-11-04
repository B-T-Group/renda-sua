import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useApiClient } from '../../hooks/useApiClient';
import { useTrackSiteEvent } from '../../hooks/useTrackSiteEvent';
import {
  confirmActions,
  deliveryConfirmSource,
  minutesLeft,
  personaPlan,
  secondsSinceDelivered,
  type WebPersona,
} from '../../utils/deliveryConfirmWeb';

type Variant = 'not_delivered_yet' | 'awaiting' | 'disputed' | 'completed_can_report' | 'completed' | 'closed';

interface ConfirmState {
  orderId: string;
  accessible: true;
  serverNow?: string;
  deliveredAt?: string | null;
  completedAt?: string | null;
  autoCompleteHours?: number;
  autoCompleteDeadlineAt?: string | null;
  reportWindowEndsAt?: string | null;
  canComplete?: boolean;
  canReport?: boolean;
  canReportAfterCompletion?: boolean;
  confirmVariant?: Variant;
  market?: { reportWindowHours?: number };
}
type Forbidden = { orderId: string; accessible: false };

const ISSUE = ['missing_items', 'wrong_items', 'damaged', 'other'];
const FAILED = ['courier_didnt_come', 'not_received', 'other'];

function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

function fmt(iso: string | null | undefined, lang: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(lang.startsWith('fr') ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/** /orders/:orderId/confirm?persona=client — client Delivered → Complete (MoMo). */
const DeliveryConfirmPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { orderId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const { trackSiteEvent } = useTrackSiteEvent();
  const { enqueueSnackbar } = useSnackbar();
  const profile = useUserProfileContext();
  const { logout } = useSessionAuth();
  const online = useOnline();
  const source = deliveryConfirmSource(params.get('src'));

  const plan = personaPlan({
    requested: params.get('persona'),
    active: (profile.userType as WebPersona | null) ?? null,
    personas: (profile.personas ?? []) as WebPersona[],
  });
  const switchedFrom = useRef<WebPersona | null>(null);
  const switching = useRef(false);

  const [state, setState] = useState<ConfirmState | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [report, setReport] = useState<'issue' | 'delivery_failed' | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [how, setHow] = useState(false);
  const opened = useRef(false);

  // P2/P5: switch persona before rendering any order data.
  useEffect(() => {
    if (plan !== 'switch' || switching.current) return;
    switching.current = true;
    switchedFrom.current = profile.userType as WebPersona;
    void profile.setActivePersona('client');
  }, [plan, profile]);

  const load = useCallback(async () => {
    if (!apiClient || plan !== 'render') return;
    try {
      const res = await apiClient.get<ConfirmState | Forbidden>(`/orders/${orderId}/delivery-confirmation`);
      if (res.data.accessible === false) {
        setForbidden(true);
        return;
      }
      setState(res.data as ConfirmState);
      setFetchedAt(Date.now());
    } catch {
      setError(t('deliveryConfirm.error', 'Something went wrong. Please try again.'));
    }
  }, [apiClient, orderId, plan, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (plan !== 'render' || opened.current || !apiClient) return;
    opened.current = true;
    const from = switchedFrom.current;
    void trackSiteEvent({
      eventType: 'delivery_confirm_opened',
      subjectType: 'order',
      subjectId: orderId,
      metadata: { source, persona_switched: !!from, platform: 'web' },
    });
    if (from) {
      const label = t(`persona.${from}`, from);
      enqueueSnackbar(t('personaSwitch.nowClient', "You're now in your shopper account."), {
        autoHideDuration: 5000,
        preventDuplicate: true,
        action: (
          <Button color="inherit" size="small" onClick={() => void profile.setActivePersona(from)}>
            {t('personaSwitch.backTo', { persona: label, defaultValue: 'Back to {{persona}}' })}
          </Button>
        ),
      });
    }
  }, [plan, apiClient, orderId, source, trackSiteEvent, enqueueSnackbar, t, profile]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const actions = confirmActions(state, !online);
  const variant: Variant = state?.confirmVariant ?? 'awaiting';
  const hours = state?.autoCompleteHours ?? 2;
  const reportHours = state?.market?.reportWindowHours ?? 24;
  const left = minutesLeft(state?.autoCompleteDeadlineAt, state?.serverNow, fetchedAt, now);

  const countdown = useMemo(() => {
    if (left == null || variant !== 'awaiting') return null;
    if (left === 0) return t('deliveryConfirm.countdownSoon', 'Completing automatically…');
    const h = Math.floor(left / 60);
    const m = left % 60;
    return h > 0
      ? t('deliveryConfirm.countdown', { h, m, defaultValue: 'Completes automatically in {{h}} h {{m}} min' })
      : t('deliveryConfirm.countdownMinutes', { m, defaultValue: 'Completes automatically in {{m}} min' });
  }, [left, variant, t]);

  const track = (action: string) =>
    void trackSiteEvent({
      eventType: 'delivery_confirm_action',
      subjectType: 'order',
      subjectId: orderId,
      metadata: { action, seconds_since_delivered: secondsSinceDelivered(state?.deliveredAt, Date.now()), platform: 'web' },
    });

  const complete = async () => {
    if (!apiClient) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/orders/${orderId}/confirm-receipt`, {});
      track('complete');
      setDone(t('buyerProtection.success', 'Thanks! Your order is complete.'));
    } catch {
      setError(t('deliveryConfirm.error', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
      await load();
    }
  };

  const submitReport = async () => {
    if (!apiClient || !report || !reason) return;
    if (reason === 'other' && !note.trim()) {
      setError(t('deliveryConfirm.noteRequired', 'Please add a few details.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/orders/${orderId}/report-delivery-problem`, {
        type: report,
        reason,
        note: note.trim() || undefined,
      });
      track(report === 'issue' ? 'report_issue' : 'delivery_failed');
      setDone(t('deliveryConfirm.reported', 'Thanks. Our team is looking into it.'));
      setReport(null);
      setReason(null);
      setNote('');
    } catch {
      setError(t('deliveryConfirm.error', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
      await load();
    }
  };

  if (plan === 'wrong_account' || forbidden) {
    return (
      <Container maxWidth="sm" sx={{ py: 6, textAlign: 'center' }} data-testid="delivery-confirm-unavailable">
        <Typography variant="h5" gutterBottom>
          {t('deliveryConfirm.unavailable.title', 'This order belongs to another account')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t('deliveryConfirm.unavailable.body', 'Sign in with the account that placed this order to confirm it.')}
        </Typography>
        <Button variant="contained" onClick={() => void logout()}>
          {t('deliveryConfirm.unavailable.switch', 'Switch account')}
        </Button>
      </Container>
    );
  }

  if (plan !== 'render' || !state) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }} data-testid="delivery-confirm-skeleton">
        {plan === 'switch' ? (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t('personaSwitch.client', 'Switching to your shopper account…')}
          </Typography>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Skeleton variant="rounded" height={180} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={48} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={48} />
      </Container>
    );
  }

  const statusLine =
    variant === 'disputed'
      ? t('deliveryConfirm.state.disputed')
      : variant === 'completed_can_report'
        ? t('deliveryConfirm.state.completedCanReport', { time: fmt(state.reportWindowEndsAt, i18n.language) })
        : variant === 'completed'
          ? t('deliveryConfirm.state.completed', { time: fmt(state.completedAt, i18n.language) })
          : variant === 'closed'
            ? t('deliveryConfirm.state.closed')
            : variant === 'not_delivered_yet'
              ? t('deliveryConfirm.notDeliveredYet')
              : null;

  return (
    <Container maxWidth="sm" sx={{ py: 4 }} data-testid="delivery-confirm-page">
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="overline" color="primary">
              {t('buyerProtection.badge', 'Delivery confirmed by you')}
            </Typography>
            <Typography variant="h5">{t('deliveryConfirm.title', 'Did you get your order?')}</Typography>
            {state.deliveredAt ? (
              <Typography color="text.secondary">
                {t('deliveryConfirm.deliveredAt', { time: fmt(state.deliveredAt, i18n.language) })}
              </Typography>
            ) : null}
            {countdown ? (
              <Typography variant="h6" data-testid="delivery-confirm-countdown">
                {countdown}
              </Typography>
            ) : null}
            {statusLine ? <Typography color="text.secondary">{statusLine}</Typography> : null}
            <Typography color="text.secondary">{t('buyerProtection.oneLiner', { hours })}</Typography>
            <Box>
              <Button size="small" onClick={() => setHow((v) => !v)}>
                {t('deliveryConfirm.howItWorks', 'How it works')}
              </Button>
            </Box>
            {how ? (
              <Box component="ol" sx={{ m: 0, pl: 3 }}>
                {['step1', 'step2', 'step3', 'step4'].map((k) => (
                  <li key={k}>
                    <Typography color="text.secondary">
                      {t(`buyerProtection.sheet.${k}`, { hours, reportHours })}
                    </Typography>
                  </li>
                ))}
              </Box>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {done ? <Alert severity="success" sx={{ mb: 2 }}>{done}</Alert> : null}
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {!online ? (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="delivery-confirm-offline">
          {t('deliveryConfirm.offline', "You're offline. Reconnect to confirm.")}
        </Alert>
      ) : null}

      {report ? (
        <Stack spacing={2}>
          <Typography variant="h6">
            {report === 'issue' ? t('deliveryConfirm.reportTitle') : t('deliveryConfirm.failedTitle')}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {(report === 'issue' ? ISSUE : FAILED).map((r) => (
              <Chip
                key={r}
                label={t(`deliveryConfirm.reason.${r}`)}
                color={reason === r ? 'primary' : 'default'}
                onClick={() => setReason(r)}
              />
            ))}
          </Stack>
          <TextField
            multiline
            minRows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('deliveryConfirm.notePlaceholder', 'Add details (optional)')}
          />
          <Typography variant="body2" color="text.secondary">
            {t('deliveryConfirm.reportNotice')}
          </Typography>
          <Button variant="contained" disabled={busy || !reason || !online} onClick={() => void submitReport()}>
            {t('deliveryConfirm.cta.submit', 'Send report')}
          </Button>
          <Button disabled={busy} onClick={() => setReport(null)}>
            {t('deliveryConfirm.cta.cancel', 'Back')}
          </Button>
        </Stack>
      ) : (
        <Stack spacing={1}>
          {variant === 'awaiting' || variant === 'not_delivered_yet' ? (
            <Button
              variant="contained"
              size="large"
              disabled={busy || !actions.complete}
              onClick={() => void complete()}
              data-testid="delivery-confirm-complete"
            >
              {t('deliveryConfirm.cta.complete', 'Complete')}
            </Button>
          ) : null}
          {actions.report || variant === 'awaiting' ? (
            <>
              <Button variant="outlined" disabled={busy || !actions.report} onClick={() => setReport('issue')}>
                {t('deliveryConfirm.cta.report', 'Report an issue')}
              </Button>
              <Button disabled={busy || !actions.failed} onClick={() => setReport('delivery_failed')}>
                {t('deliveryConfirm.cta.failed', 'Delivery failed')}
              </Button>
            </>
          ) : null}
          <Button onClick={() => navigate(`/orders/${orderId}`)}>
            {t('deliveryConfirm.openOrder', 'View order')}
          </Button>
        </Stack>
      )}
    </Container>
  );
};

export default DeliveryConfirmPage;
