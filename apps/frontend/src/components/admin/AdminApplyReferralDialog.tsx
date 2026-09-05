import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AgentReferralCodeField from '../common/AgentReferralCodeField';

export interface AdminApplyReferralDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (code: string) => Promise<void>;
}

export const AdminApplyReferralDialog: React.FC<
  AdminApplyReferralDialogProps
> = ({ open, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (submitting) return;
    setCode('');
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setCode('');
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          t('admin.referrals.applyError', 'Could not apply this referral code')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {t('admin.referrals.applyTitle', 'Apply referral code')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <AgentReferralCodeField
            value={code}
            onChange={setCode}
            labelKey="admin.referrals.code"
            labelDefault="Referral code"
            helpKey="admin.referrals.applyHelp"
            helpDefault="Enter the 6-character code they forgot at signup."
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={handleClose} disabled={submitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleConfirm()}
              disabled={submitting || code.trim().length !== 6}
            >
              {submitting ? (
                <CircularProgress size={18} />
              ) : (
                t('admin.referrals.applyConfirm', 'Apply')
              )}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
