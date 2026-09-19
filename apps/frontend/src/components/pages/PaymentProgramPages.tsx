import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePaymentPrograms } from '../../hooks/usePaymentPrograms';
import { WalletProgramsIllustration } from '../common/WalletProgramsIllustration';

function scopeLabel(
  applicability: string,
  businessName: string | undefined,
  t: (key: string, fallback: string) => string
): string {
  if (applicability === 'specific_business') {
    return businessName || t('accounts.purchaseCredits.onePartner', 'One partner store');
  }
  if (applicability === 'partner_businesses') {
    return t('accounts.purchaseCredits.allPartners', 'Rendasua partner stores');
  }
  return t('accounts.purchaseCredits.anyStore', 'Any store');
}

export function CashAdvancePage() {
  const { t } = useTranslation();
  const { data, loading, error, draw } = usePaymentPrograms();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const facility = data?.facilities.find((row) => row.status === 'active');
  const owed = Math.abs(Number(facility?.account?.cash_advance_balance ?? 0));
  const remaining = facility ? Number(facility.limit_amount) - owed : 0;

  async function submit() {
    if (!facility) return;
    setMessage(null);
    await draw(Number(amount), facility.currency);
    setAmount('');
    setMessage(t('accounts.cashAdvance.drawn', 'Cash advance added to your balance.'));
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t('accounts.cashAdvance.title', 'Cash advance')}
      </Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !facility && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <WalletProgramsIllustration />
          <Alert severity="info">
            {t('accounts.cashAdvance.empty', 'You do not have an open cash advance.')}
          </Alert>
        </Box>
      )}
      {facility && (
        <Card>
          <CardContent>
            <Typography variant="h6">{facility.program?.name}</Typography>
            <Typography>
              {t('accounts.cashAdvance.limit', 'Limit')}: {facility.limit_amount} {facility.currency}
            </Typography>
            <Typography>
              {t('accounts.cashAdvance.owed', 'Owed')}: {owed} {facility.currency}
            </Typography>
            <Typography sx={{ mb: 2 }}>
              {t('accounts.cashAdvance.remaining', 'Available to draw')}: {remaining} {facility.currency}
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                label={t('accounts.cashAdvance.amount', 'Amount')}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                type="number"
              />
              <Button variant="contained" onClick={() => void submit()} disabled={remaining <= 0}>
                {t('accounts.cashAdvance.draw', 'Draw')}
              </Button>
            </Stack>
            {message && <Alert sx={{ mt: 2 }}>{message}</Alert>}
            <Box sx={{ mt: 2 }}>
              {(facility.draws || []).map((drawRow) => (
                <Typography key={drawRow.id} variant="body2">
                  {drawRow.created_at.slice(0, 10)} · {drawRow.amount} {facility.currency}
                </Typography>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}

export function PurchaseCreditsPage() {
  const { t } = useTranslation();
  const { data, loading, error } = usePaymentPrograms();
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t('accounts.purchaseCredits.title', 'Purchase credits')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t('accounts.purchaseCredits.note', 'These credits cannot be withdrawn. They apply automatically at checkout.')}
      </Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && (data?.grants.length ?? 0) === 0 && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <WalletProgramsIllustration />
          <Alert severity="info">{t('accounts.purchaseCredits.empty', 'No purchase credits yet.')}</Alert>
        </Box>
      )}
      <Stack spacing={2}>
        {(data?.grants || []).map((grant) => (
          <Card key={grant.id}>
            <CardContent>
              <Typography variant="h6">
                {grant.remaining_amount} / {grant.amount} {grant.currency}
              </Typography>
              <Typography>
                {scopeLabel(grant.applicability, grant.business?.name, t)}
              </Typography>
              {grant.expires_at && (
                <Typography variant="body2">
                  {t('accounts.purchaseCredits.expires', 'Expires')} {grant.expires_at.slice(0, 10)}
                </Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}

export function PaymentSchedulesPage() {
  const { t } = useTranslation();
  const { data, loading, error } = usePaymentPrograms();
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t('accounts.schedules.title', 'Payment schedules')}
      </Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && (data?.assignments.length ?? 0) === 0 && (
        <Alert severity="info">{t('accounts.schedules.empty', 'No payment schedule is assigned to you.')}</Alert>
      )}
      <Stack spacing={2}>
        {(data?.assignments || []).map((row) => (
          <Card key={row.id}>
            <CardContent>
              <Typography variant="h6">{row.schedule?.name}</Typography>
              <Typography>
                {row.amount} {row.currency} · {row.schedule?.frequency} · {row.status}
              </Typography>
              {(row.runs || []).map((run) => (
                <Typography key={run.id} variant="body2">
                  {run.period_start.slice(0, 10)} · {run.amount} · {run.status}
                </Typography>
              ))}
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}
