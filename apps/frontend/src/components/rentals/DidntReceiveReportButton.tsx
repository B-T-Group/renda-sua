import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useClientFlags } from '../../hooks/useClientFlags';
import { useRentalApi } from '../../hooks/useRentalApi';
import { notReceivedErrorKey } from '../../utils/rentalInspection';

type Step = 'confirm' | 'success' | 'error';

function codeOf(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const data = (error as { response?: { data?: { code?: string } } }).response?.data;
  return data?.code;
}

export function DidntReceiveReportButton({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { flags, loaded } = useClientFlags();
  const { reportNotReceived } = useRentalApi();
  const [step, setStep] = useState<Step | null>(null);
  const [errorKey, setErrorKey] = useState('rentalInspection.didntReceiveFailed');
  const [sending, setSending] = useState(false);
  const enabled = loaded && flags.rentals_not_received_report_enabled;

  const close = () => {
    if (sending) return;
    setStep(null);
  };

  const send = async () => {
    setSending(true);
    try {
      await reportNotReceived(bookingId);
      setStep('success');
    } catch (error: unknown) {
      setErrorKey(notReceivedErrorKey(codeOf(error)));
      setStep('error');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => (enabled ? setStep('confirm') : navigate('/support'))}
        sx={{ alignSelf: 'flex-start', minHeight: 48 }}
      >
        {t('rentalInspection.didntReceive', "Didn't receive the item? Tell us")}
      </Button>
      <Dialog open={step != null} onClose={close} fullWidth maxWidth="xs">
        <DialogTitle>
          {step === 'success'
            ? t('rentalInspection.didntReceiveSuccessTitle', 'Support and the business were notified')
            : step === 'error'
              ? t('rentalInspection.didntReceiveErrorTitle', "Couldn't send the report")
              : t('rentalInspection.didntReceiveConfirmTitle', "Didn't receive the item?")}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {step === 'success'
              ? t(
                  'rentalInspection.didntReceiveSuccessBody',
                  'They will follow up. This rental stays as it is.'
                )
              : step === 'error'
                ? t(errorKey, "We couldn't send that. Try again.")
                : t(
                    'rentalInspection.didntReceiveConfirmBody',
                    "We'll tell support and the business. Nothing is cancelled or refunded."
                  )}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          {step === 'success' ? (
            <Button variant="contained" onClick={close} sx={{ minHeight: 48 }}>
              {t('rentalInspection.didntReceiveDone', 'Done')}
            </Button>
          ) : (
            <>
              <Button onClick={close} disabled={sending} sx={{ minHeight: 48 }}>
                {t('rentalInspection.sheetCancel', 'Cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={() => void send()}
                disabled={sending}
                sx={{ minHeight: 48 }}
              >
                {sending
                  ? t('rentalInspection.didntReceiveSending', 'Sending…')
                  : step === 'error'
                    ? t('rentalInspection.didntReceiveRetry', 'Try again')
                    : t(
                        'rentalInspection.didntReceiveConfirm',
                        'Notify support and the business'
                      )}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
