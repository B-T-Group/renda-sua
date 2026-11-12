import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useClientFlags } from '../../hooks/useClientFlags';
import { useRentalApi } from '../../hooks/useRentalApi';
import {
  notReceivedErrorKey,
  notReceivedFailure,
  showDidntReceiveLink,
} from '../../utils/rentalInspection';

type Step = 'confirm' | 'success' | 'retry' | 'terminal';

function codeOf(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const data = (error as { response?: { data?: { code?: string } } }).response?.data;
  return data?.code;
}

/** Re-checks the 30-minute window on a timer and when the tab becomes visible. */
export function useDidntReceiveWindow(
  enrolled: boolean,
  startedAt?: string | null
): boolean {
  const [now, setNow] = useState(() => Date.now());
  const refresh = useCallback(() => setNow(Date.now()), []);
  useEffect(() => {
    refresh();
    const started = startedAt ? new Date(startedAt).getTime() : Number.NaN;
    const delay = started + 30 * 60 * 1000 - Date.now();
    const timer =
      Number.isFinite(delay) && delay > 0 ? window.setTimeout(refresh, delay + 50) : undefined;
    const onVisible = () => {
      if (document.visibilityState !== 'hidden') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timer != null) window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [startedAt, refresh]);
  return showDidntReceiveLink({ enrolled, startedAt, now });
}

export function DidntReceiveReportButton({
  bookingId,
  reported = false,
  onReported,
  onWindowClosed,
}: {
  bookingId: string;
  reported?: boolean;
  onReported?: () => void;
  onWindowClosed?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { flags, loaded } = useClientFlags();
  const { reportNotReceived } = useRentalApi();
  const [step, setStep] = useState<Step | null>(null);
  const [errorKey, setErrorKey] = useState('rentalInspection.didntReceiveStopped');
  const [hideLinkOnClose, setHideLinkOnClose] = useState(false);
  const [sending, setSending] = useState(false);
  const enabled = loaded && flags.rentals_not_received_report_enabled;

  const close = () => {
    if (sending) return;
    if (hideLinkOnClose) onWindowClosed?.();
    setStep(null);
  };

  const contactSupport = () => {
    if (hideLinkOnClose) onWindowClosed?.();
    setStep(null);
    navigate('/support');
  };

  const send = async () => {
    setSending(true);
    try {
      const result = await reportNotReceived(bookingId);
      onReported?.();
      if (result.alreadyReported) {
        setErrorKey('rentalInspection.didntReceiveAlready');
        setStep('terminal');
      } else {
        setStep('success');
      }
    } catch (error: unknown) {
      const code = codeOf(error);
      if (code === 'RENTAL_NOT_RECEIVED_WINDOW_CLOSED') setHideLinkOnClose(true);
      if (notReceivedFailure(error) === 'retry') {
        setErrorKey('rentalInspection.didntReceiveFailed');
        setStep('retry');
      } else {
        setErrorKey(notReceivedErrorKey(code));
        setStep('terminal');
      }
    } finally {
      setSending(false);
    }
  };

  if (reported && step == null) {
    return (
      <Typography sx={{ alignSelf: 'flex-start' }}>
        {t('rentalInspection.didntReceiveReported', 'Reported · support will follow up')}
      </Typography>
    );
  }

  const title =
    step === 'success'
      ? t('rentalInspection.didntReceiveSuccessTitle', 'Support and the business were notified')
      : step === 'retry' || step === 'terminal'
        ? t('rentalInspection.didntReceiveErrorTitle', "Couldn't send the report")
        : t('rentalInspection.didntReceiveConfirmTitle', "Didn't receive the item?");
  const body =
    step === 'success'
      ? t('rentalInspection.didntReceiveSuccessBody', 'They will follow up. This rental stays as it is.')
      : step === 'retry'
        ? t(
            'rentalInspection.didntReceiveFailed',
            "Couldn't send the report. Check your connection and try again."
          )
        : step === 'terminal'
          ? t(errorKey, "Couldn't send the report.")
          : t(
              'rentalInspection.didntReceiveConfirmBody',
              "We'll tell support and the business. Nothing is cancelled or refunded."
            );

  return (
    <>
      <Button
        onClick={() => (enabled ? setStep('confirm') : navigate('/support'))}
        sx={{ alignSelf: 'flex-start', minHeight: 48 }}
      >
        {t('rentalInspection.didntReceive', "Didn't receive the item? Tell us")}
      </Button>
      <Dialog open={step != null} onClose={close} fullWidth maxWidth="xs">
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Typography>{body}</Typography>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            gap: 1,
            flexDirection: step === 'terminal' ? 'column' : 'row',
            alignItems: step === 'terminal' ? 'stretch' : 'center',
          }}
        >
          {step === 'success' ? (
            <Button variant="contained" color="primary" onClick={close} sx={{ minHeight: 48 }}>
              {t('rentalInspection.didntReceiveDone', 'Done')}
            </Button>
          ) : step === 'terminal' ? (
            <>
              <Button variant="contained" color="primary" onClick={close} sx={{ minHeight: 48 }}>
                {t('rentalInspection.didntReceiveOk', 'OK')}
              </Button>
              <Button onClick={contactSupport} sx={{ minHeight: 48 }}>
                {t('rentalInspection.didntReceiveContactSupport', 'Contact support')}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={close} disabled={sending} sx={{ minHeight: 48 }}>
                {t('rentalInspection.sheetCancel', 'Cancel')}
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => void send()}
                disabled={sending}
                sx={{ minHeight: 48 }}
              >
                {sending
                  ? t('rentalInspection.didntReceiveSending', 'Sending…')
                  : step === 'retry'
                    ? t('rentalInspection.didntReceiveRetry', 'Try again')
                    : t('rentalInspection.didntReceiveConfirm', 'Notify support and the business')}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
