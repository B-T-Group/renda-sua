import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  usePaymentScheduleDetail,
  type ScheduleAssignmentDetail,
} from '../../hooks/usePaymentScheduleDetail';
import { PaymentPlanOfferIllustration } from '../common/PaymentPlanOfferIllustration';

const REJECT_REASONS = [
  'too_aggressive',
  'not_ready_now',
  'targets_unclear',
  'other',
] as const;

export function PaymentScheduleDetailPage() {
  const { assignmentId = '' } = useParams<{ assignmentId: string }>();
  const { t } = useTranslation();
  const { detail, loading, error, accept, defer, reject } =
    usePaymentScheduleDetail(assignmentId);
  const [reason, setReason] = useState<(typeof REJECT_REASONS)[number]>('not_ready_now');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(ok);
    } catch (err: any) {
      setMessage(err?.message || t('accounts.schedules.actionFailed', 'Action failed'));
    } finally {
      setBusy(false);
    }
  }

  const awaiting =
    detail && ['pending', 'deferred'].includes(detail.decision);

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Button component={RouterLink} to="/accounts/schedules" sx={{ mb: 2 }}>
        {t('accounts.schedules.back', 'All schedules')}
      </Button>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {detail && (
        <Stack spacing={2}>
          {awaiting && (
            <Box sx={{ textAlign: 'center' }}>
              <PaymentPlanOfferIllustration />
            </Box>
          )}
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                {detail.schedule.name}
              </Typography>
              <Typography>
                {detail.amount} {detail.currency} · {detail.schedule.frequency}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('accounts.schedules.status', 'Status')}: {detail.status} ·{' '}
                {t('accounts.schedules.decision', 'Decision')}: {detail.decision}
              </Typography>
            </CardContent>
          </Card>
          <ObjectivesCard detail={detail} />
          {awaiting && (
            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => accept(),
                        t('accounts.schedules.accepted', 'Payment plan accepted')
                      )
                    }
                  >
                    {t('accounts.schedules.accept', 'Accept')}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => defer(),
                        t('accounts.schedules.deferred', 'You can decide later')
                      )
                    }
                  >
                    {t('accounts.schedules.defer', 'Decide later')}
                  </Button>
                  <TextField
                    select
                    label={t('accounts.schedules.rejectReason', 'Reject reason')}
                    value={reason}
                    onChange={(e) =>
                      setReason(e.target.value as (typeof REJECT_REASONS)[number])
                    }
                  >
                    {REJECT_REASONS.map((code) => (
                      <MenuItem key={code} value={code}>
                        {t(`accounts.schedules.reasons.${code}`, reasonLabel(code))}
                      </MenuItem>
                    ))}
                  </TextField>
                  {reason === 'other' && (
                    <TextField
                      label={t('accounts.schedules.rejectNote', 'Tell us more')}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      multiline
                      minRows={2}
                    />
                  )}
                  <Button
                    color="warning"
                    disabled={busy || (reason === 'other' && !note.trim())}
                    onClick={() =>
                      void run(
                        () => reject(reason, note),
                        t('accounts.schedules.rejected', 'Payment plan rejected')
                      )
                    }
                  >
                    {t('accounts.schedules.reject', 'Reject')}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}
          {message && <Alert severity="info">{message}</Alert>}
          {(detail.runs || []).length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('accounts.schedules.history', 'Payment history')}
                </Typography>
                {detail.runs.map((run) => (
                  <Typography key={run.id} variant="body2">
                    {run.periodStart.slice(0, 10)} · {run.amount} · {run.status}
                  </Typography>
                ))}
              </CardContent>
            </Card>
          )}
        </Stack>
      )}
    </Container>
  );
}

function ObjectivesCard({ detail }: { detail: ScheduleAssignmentDetail }) {
  const { t } = useTranslation();
  const rows = objectiveRows(detail, t);
  if (!rows.length) {
    return (
      <Alert severity="info">
        {t('accounts.schedules.noObjectives', 'This plan has no attached objectives.')}
      </Alert>
    );
  }
  const percent = detail.progress.completionPercent;
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t('accounts.schedules.objectives', 'Objectives')}
        </Typography>
        {percent != null && detail.decision === 'accepted' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {t('accounts.schedules.salesCompletion', 'Sales completion')}: {percent}%
            </Typography>
            <LinearProgress variant="determinate" value={percent} />
          </Box>
        )}
        <Stack spacing={1}>
          {rows.map((row) => (
            <Typography key={row.label} variant="body2">
              {row.label}: {row.value}
            </Typography>
          ))}
        </Stack>
        {detail.decision !== 'accepted' && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {t(
              'accounts.schedules.progressAfterAccept',
              'Live progress starts after you accept.'
            )}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function objectiveRows(
  detail: ScheduleAssignmentDetail,
  t: (key: string, fallback: string) => string
) {
  const { targets, progress, currency } = detail;
  const rows: Array<{ label: string; value: string }> = [];
  if (targets.agentRecruitments != null) {
    rows.push({
      label: t('accounts.schedules.agentRecruitments', 'Agent recruitments'),
      value: `${progress.agentRecruitments.actual} / ${targets.agentRecruitments}`,
    });
  }
  if (targets.clientSignups != null) {
    rows.push({
      label: t('accounts.schedules.clientSignups', 'Client signups'),
      value: `${progress.clientSignups.actual} / ${targets.clientSignups}`,
    });
  }
  if (targets.merchantRecruitments != null) {
    rows.push({
      label: t('accounts.schedules.merchantRecruitments', 'Merchant recruitments'),
      value: `${progress.merchantRecruitments.actual} / ${targets.merchantRecruitments}`,
    });
  }
  if (targets.itemSalesAmount != null) {
    rows.push({
      label: t('accounts.schedules.itemSales', 'Item sales'),
      value: `${progress.itemSales.actual} / ${targets.itemSalesAmount} ${currency}`,
    });
  }
  if (targets.rentalAmount != null) {
    rows.push({
      label: t('accounts.schedules.rentals', 'Rentals'),
      value: `${progress.rentals.actual} / ${targets.rentalAmount} ${currency}`,
    });
  }
  return rows;
}

function reasonLabel(code: string) {
  switch (code) {
    case 'too_aggressive':
      return 'Too aggressive';
    case 'not_ready_now':
      return 'Not ready to accept now';
    case 'targets_unclear':
      return 'Targets are unclear';
    default:
      return 'Other';
  }
}
