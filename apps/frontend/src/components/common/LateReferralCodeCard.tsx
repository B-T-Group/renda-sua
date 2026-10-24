import HandshakeIcon from '@mui/icons-material/Handshake';
import LockIcon from '@mui/icons-material/Lock';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLateReferral } from '../../hooks/useLateReferral';

const LateReferralCodeCard: React.FC = () => {
  const { t } = useTranslation();
  const { status, loading, lookup, apply } = useLateReferral();
  const [code, setCode] = useState('');
  const [maskedName, setMaskedName] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const normalized = useMemo(
    () => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
    [code]
  );

  useEffect(() => {
    if (normalized.length !== 6) {
      setMaskedName('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLookingUp(true);
        setError(null);
        const result = await lookup(normalized);
        if (!cancelled) setMaskedName(result.maskedName);
      } catch (err: any) {
        if (!cancelled) {
          setMaskedName('');
          setError(
            err?.response?.data?.error ||
              t('referrals.late.not_found', 'No user found with this code.')
          );
        }
      } finally {
        if (!cancelled) setLookingUp(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalized, lookup, t]);

  if (loading && !status) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!status || status.expired) return null;

  if (status.locked) {
    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center">
            <LockIcon fontSize="small" color="action" />
            <Typography>
              {t(
                'referrals.late.locked',
                'Referred by {{name}} · locked',
                { name: status.maskedReferrerName || '—' }
              )}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (!status.canEnter) return null;

  const onConfirm = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = await apply(normalized);
      setSuccess(t('referrals.late.success', 'Referral code saved.'));
      setConfirmOpen(false);
      setMaskedName(result.maskedName);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          t('referrals.late.error', 'Could not save referral code.')
      );
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <HandshakeIcon color="primary" />
            <Typography fontWeight={600}>
              {t('referrals.late.menu', 'Referral code')}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {t(
              'referrals.late.hint',
              'Enter the code of the person who invited you.'
            )}
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          {!success && (
            <>
              <TextField
                label={t('referrals.late.title', 'Who referred you?')}
                value={normalized}
                onChange={(e) => setCode(e.target.value)}
                inputProps={{ maxLength: 6 }}
                fullWidth
                InputProps={{
                  endAdornment: lookingUp ? (
                    <CircularProgress size={18} />
                  ) : null,
                }}
              />
              {maskedName && (
                <Alert severity="info">
                  {t('referrals.late.found', 'Referred by {{name}}', {
                    name: maskedName,
                  })}
                </Alert>
              )}
              <Button
                variant="contained"
                disabled={!maskedName || lookingUp}
                onClick={() => setConfirmOpen(true)}
              >
                {t('referrals.late.confirm', 'Confirm')}
              </Button>
            </>
          )}
        </Stack>
      </CardContent>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>
          {t('referrals.late.confirm_title', 'Confirm your referrer?')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t(
              'referrals.late.confirm_body',
              '{{name}} will be saved as your referrer. This can\'t be changed later.',
              { name: maskedName }
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={() => void onConfirm()}
          >
            {saving
              ? t('common.loading', 'Loading...')
              : t('referrals.late.confirm', 'Confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default LateReferralCodeCard;
