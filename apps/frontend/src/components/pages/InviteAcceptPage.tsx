import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { usePublicInvite } from '../../hooks/usePublicInvite';
import Logo from '../common/Logo';
import LoadingPage from '../common/LoadingPage';

/**
 * Public landing for location-delegation invites at `/invite/:token`.
 */
const InviteAcceptPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { preview, loading, error, accepting, accept } = usePublicInvite(token);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleAccept = async () => {
    setFormError(null);
    if (preview?.needs_name && (!firstName.trim() || !lastName.trim())) {
      setFormError(
        t('delegation.invite.nameRequired', 'Please enter your first and last name')
      );
      return;
    }
    try {
      const result = await accept(
        preview?.needs_name
          ? { first_name: firstName.trim(), last_name: lastName.trim() }
          : undefined
      );
      if (result.already_authenticated) {
        navigate('/select-persona', { replace: true });
        return;
      }
      sessionStorage.setItem('pendingLoginEmail', result.email);
      sessionStorage.setItem(
        'pendingLoginOtpExpiresAtMs',
        String(Date.now() + 5 * 60 * 1000)
      );
      navigate(
        `/auth/otp?email=${encodeURIComponent(result.email)}&invite=1`,
        { replace: true }
      );
    } catch (err: any) {
      setFormError(
        err?.response?.data?.error ||
          err?.message ||
          t('delegation.invite.acceptFailed', 'Could not accept this invite')
      );
    }
  };

  if (loading) {
    return (
      <LoadingPage
        message={t('delegation.invite.loading', 'Loading invite')}
        subtitle={t('delegation.invite.loadingSubtitle', 'Please wait')}
        showProgress
      />
    );
  }

  if (error || !preview) {
    return (
      <Container maxWidth="sm" sx={{ py: 5 }}>
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Logo variant="default" size="medium" />
            <Alert severity="error">
              {error ||
                t('delegation.invite.invalid', 'This invite is invalid or expired')}
            </Alert>
            <Button onClick={() => navigate('/')}>
              {t('auth.otp.backToHome', 'Back to home')}
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Logo variant="default" size="medium" />
          <Typography variant="overline" color="text.secondary" fontWeight={700}>
            {t('delegation.invite.kicker', 'Team invite')}
          </Typography>
          <Typography variant="h4" fontWeight={800}>
            {t('delegation.invite.title', 'Join {{business}}', {
              business: preview.business_name,
            })}
          </Typography>
          <Typography color="text.secondary">
            {t(
              'delegation.invite.subtitle',
              '{{inviter}} invited you as {{role}} at {{location}}.',
              {
                inviter: preview.inviter_first_name || t('delegation.invite.someone', 'Someone'),
                role: preview.role_name,
                location: preview.location_name,
              }
            )}
          </Typography>
          {(formError) && <Alert severity="error">{formError}</Alert>}
          {preview.needs_name && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <TextField
                label={t('common.firstName', 'First name')}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
              <TextField
                label={t('common.lastName', 'Last name')}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </Box>
          )}
          <Button
            variant="contained"
            size="large"
            onClick={() => void handleAccept()}
            disabled={accepting}
            startIcon={accepting ? <CircularProgress size={18} /> : undefined}
          >
            {accepting
              ? t('delegation.invite.accepting', 'Accepting…')
              : t('delegation.invite.accept', 'Accept invite')}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default InviteAcceptPage;
