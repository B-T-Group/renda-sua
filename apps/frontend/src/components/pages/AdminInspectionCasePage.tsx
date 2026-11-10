import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useApiClient } from '../../hooks/useApiClient';
import { usePermission } from '../../hooks/usePermissions';

interface Photo { id: string; role: string; url?: string }
interface Unit {
  unitId: string;
  displayLabel: string;
  condition: string;
  wear: string;
  photos: Photo[];
}
interface Stage {
  status: string;
  versionNo?: number | null;
  correctionReason?: string | null;
  units: Unit[];
}
interface Dispute {
  id: string;
  status: string;
  reason?: string | null;
  decision?: string | null;
  decision_reason?: string | null;
  damage_amount?: number | string | null;
}
interface CaseBody {
  booking: {
    bookingNumber: string;
    status: string;
    currency: string;
    itemName: string | null;
    settlementAttention: string | null;
    returnResolution: string | null;
    paymentStatus: string | null;
    returnHandedBackAt: string | null;
  };
  pickup: Stage;
  returnReport: Stage;
  disputes: Dispute[];
}

const AdminInspectionCasePage: React.FC = () => {
  const { t } = useTranslation();
  const { bookingId = '' } = useParams<{ bookingId: string }>();
  const allowed = usePermission(PlatformPermissions.MODERATE_RENTALS);
  const api = useApiClient();
  const [row, setRow] = useState<CaseBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'no_damage' | 'damage_upheld' | 'damage_rejected'>('no_damage');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [handbackReason, setHandbackReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CaseBody>(`/admin/rentals/bookings/${bookingId}/inspection-case`);
      setRow(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('rentalInspection.loadFailed', 'Could not load the inspection.'));
    } finally {
      setLoading(false);
    }
  }, [api, bookingId, t]);

  useEffect(() => {
    if (allowed && bookingId) void load();
  }, [allowed, bookingId, load]);

  const decide = async () => {
    if (!reason.trim()) return;
    if (outcome === 'damage_upheld' && !(Number(amount) > 0)) return;
    setBusy(true);
    try {
      await api.post(`/admin/rentals/bookings/${bookingId}/inspection-decision`, {
        outcome,
        reason: reason.trim(),
        damageAmount: outcome === 'damage_upheld' ? Number(amount) : undefined,
      });
      setReason('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('rentalInspection.adminSaveFailed', 'Could not save the decision.'));
    } finally {
      setBusy(false);
    }
  };

  const handback = async () => {
    if (!handbackReason.trim()) return;
    setBusy(true);
    try {
      await api.post(`/admin/rentals/bookings/${bookingId}/inspection-handback`, { reason: handbackReason.trim() });
      setHandbackReason('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('rentalInspection.adminSaveFailed', 'Could not save the decision.'));
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography color="error">{t('rentalInspection.adminDenied', 'Access denied')}</Typography>
      </Container>
    );
  }

  if (loading || !row) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {error ? <Typography color="error">{error}</Typography> : <CircularProgress />}
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button component={RouterLink} to="/admin/rental-inspections" sx={{ mb: 2, minHeight: 48 }}>
        {t('rentalInspection.adminBack', 'Inspection disputes')}
      </Button>
      <Typography variant="h4">{row.booking.itemName || row.booking.bookingNumber}</Typography>
      <Stack direction="row" spacing={1} sx={{ my: 1, flexWrap: 'wrap' }}>
        <Chip label={row.booking.status} />
        <Chip label={row.booking.bookingNumber} />
        {row.booking.settlementAttention ? <Chip color="warning" label={row.booking.settlementAttention} /> : null}
        {row.booking.returnResolution ? <Chip label={row.booking.returnResolution} /> : null}
      </Stack>
      {row.booking.settlementAttention === 'stripe_auth_expired' ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('rentalInspection.adminStripeExpired', 'The card authorization expired. Settlement needs attention before any deposit can be used.')}
        </Alert>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Report title={t('rentalInspection.pickupTitle', 'Pickup condition')} stage={row.pickup} />
      <Report title={t('rentalInspection.returnTitle', 'Return condition')} stage={row.returnReport} />
      <Typography variant="h6" sx={{ mt: 2 }}>{t('rentalInspection.adminDisputes', 'Disputes')}</Typography>
      {row.disputes.map((dispute) => (
        <Typography key={dispute.id}>
          {`${dispute.status} · ${dispute.reason || '—'} · ${dispute.decision || ''}`}
        </Typography>
      ))}
      <Stack spacing={1.5} sx={{ mt: 3, maxWidth: 520 }}>
        <Typography variant="h6">{t('rentalInspection.adminDecision', 'Decision')}</Typography>
        <TextField select label={t('rentalInspection.adminOutcome', 'Outcome')} value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)}>
          <MenuItem value="no_damage">{t('rentalInspection.outcomeNoDamage', 'No damage')}</MenuItem>
          <MenuItem value="damage_upheld">{t('rentalInspection.outcomeUpheld', 'Damage upheld')}</MenuItem>
          <MenuItem value="damage_rejected">{t('rentalInspection.outcomeRejected', 'Damage rejected')}</MenuItem>
        </TextField>
        {outcome === 'damage_upheld' ? (
          <TextField label={t('rentalInspection.adminAmount', 'Amount from the deposit')} value={amount} onChange={(event) => setAmount(event.target.value)} helperText={row.booking.currency} />
        ) : null}
        <TextField label={t('rentalInspection.adminReason', 'Reason')} value={reason} onChange={(event) => setReason(event.target.value)} required multiline />
        <Button variant="contained" sx={{ minHeight: 48 }} disabled={busy || !reason.trim()} onClick={() => void decide()}>
          {t('rentalInspection.adminSaveDecision', 'Save decision')}
        </Button>
        <Typography variant="h6">{t('rentalInspection.adminHandback', 'Record handback')}</Typography>
        <TextField label={t('rentalInspection.adminReason', 'Reason')} value={handbackReason} onChange={(event) => setHandbackReason(event.target.value)} required />
        <Button variant="outlined" sx={{ minHeight: 48 }} disabled={busy || !handbackReason.trim() || !!row.booking.returnHandedBackAt} onClick={() => void handback()}>
          {t('rentalInspection.confirmHandback', 'Confirm physical handback')}
        </Button>
      </Stack>
    </Container>
  );
};

function Report({ title, stage }: { title: string; stage: Stage }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <Typography variant="h6">
        {title}
        {stage.versionNo != null ? ` · ${t('rentalInspection.version', 'v{{version}}', { version: stage.versionNo })}` : ''}
      </Typography>
      <Typography color="text.secondary">{stage.status}</Typography>
      {stage.correctionReason ? <Alert severity="warning">{stage.correctionReason}</Alert> : null}
      {stage.units.map((unit) => (
        <Box key={unit.unitId} sx={{ mt: 1 }}>
          <Typography>{`${unit.displayLabel} · ${unit.condition || '—'} · ${unit.wear || '—'}`}</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {unit.photos.map((photo) =>
              photo.url ? (
                <Box key={photo.id} component="img" src={photo.url} alt={photo.role} sx={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 1 }} />
              ) : (
                <Typography key={photo.id}>{photo.role}</Typography>
              )
            )}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

export default AdminInspectionCasePage;
