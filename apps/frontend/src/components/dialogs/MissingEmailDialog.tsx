import CloseRounded from '@mui/icons-material/CloseRounded';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { isValidEmailFormat, normalizeEmailInput } from '../../utils/emailValidation';

function getApiErrorMessage(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const response = (err as { response?: { data?: { error?: string; message?: string } } })
    .response;
  return response?.data?.error || response?.data?.message;
}

export interface MissingEmailDialogProps {
  open: boolean;
  /** User chose not to add email (also used for backdrop / Escape) */
  onSkip: () => void;
  /** Email was saved successfully */
  onSaved: () => void;
}

const MissingEmailDialog: React.FC<MissingEmailDialogProps> = ({
  open,
  onSkip,
  onSaved,
}) => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setError(null);
      setSaving(false);
      setTouched(false);
    }
  }, [open]);

  const normalized = useMemo(() => normalizeEmailInput(email), [email]);
  const isEmailOk = useMemo(() => isValidEmailFormat(normalized), [normalized]);
  const showInvalidEmail = touched && email.length > 0 && !isEmailOk;

  const handleSkip = useCallback(() => {
    if (saving) return;
    onSkip();
  }, [onSkip, saving]);

  const handleSave = useCallback(async () => {
    if (!apiClient || saving) return;
    if (!isEmailOk) {
      setTouched(true);
      setError(
        t('signupPage.emailInvalid', 'Please enter a valid email.')
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/users/me/update-email', { email: normalized });
      onSaved();
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err) ||
          t(
            'orders.optionalEmail.saveFailed',
            'Could not save your email. Please try again.'
          )
      );
    } finally {
      setSaving(false);
    }
  }, [apiClient, isEmailOk, normalized, onSaved, saving, t]);

  const handleClose = useCallback(
    (_event: unknown, reason?: 'backdropClick' | 'escapeKeyDown') => {
      if (saving) return;
      if (reason === 'backdropClick') return;
      if (reason === 'escapeKeyDown') {
        handleSkip();
      }
    },
    [handleSkip, saving]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void handleSave();
      }
    },
    [handleSave]
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="missing-email-title"
      aria-describedby="missing-email-description"
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.50',
              color: 'primary.main',
              mt: 0.25,
            }}
          >
            <EmailOutlined fontSize="small" />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography id="missing-email-title" variant="h6">
                {t('orders.optionalEmail.dialogTitle', 'Add your email')}
              </Typography>
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={t('orders.optionalEmail.optionalBadge', 'Optional')}
              />
            </Stack>

            <Typography
              id="missing-email-description"
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.75 }}
            >
              {t(
                'orders.optionalEmail.dialogIntro',
                'Adding an email is recommended so we can send receipts and order status updates. You can skip this step anytime.'
              )}
            </Typography>
          </Box>

          <IconButton
            aria-label={t('orders.optionalEmail.closeAria', 'Close')}
            onClick={handleSkip}
            size="small"
            disabled={saving}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 0.5 }}>
        <Stack spacing={1.5}>
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            autoFocus
            label={t('public.items.checkoutDialog.emailLabel', 'Email address')}
            placeholder={t('orders.optionalEmail.emailPlaceholder', 'name@example.com')}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            onBlur={() => setTouched(true)}
            onKeyDown={handleKeyDown}
            autoComplete="email"
            disabled={saving}
            error={showInvalidEmail}
            helperText={
              showInvalidEmail
                ? t('signupPage.emailInvalid', 'Please enter a valid email.')
                : t(
                    'orders.optionalEmail.privacyHint',
                    'We only use your email for receipts and order updates.'
                  )
            }
            FormHelperTextProps={{ sx: { minHeight: 22 } }}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, gap: 1 }}>
        <Button onClick={handleSkip} disabled={saving} color="inherit">
          {t('orders.optionalEmail.skipForNow', 'Skip for now')}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saving || !isEmailOk}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {saving
            ? t('orders.optionalEmail.saving', 'Saving...')
            : t('orders.optionalEmail.saveAndContinue', 'Save and continue')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MissingEmailDialog;
