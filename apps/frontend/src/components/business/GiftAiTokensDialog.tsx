import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import {
  Alert,
  Box,
  Button,
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
import { useBusinessTokenGifts } from '../../hooks/useBusinessTokenGifts';

type Step = 'code' | 'amount' | 'confirm' | 'success';

type Props = {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
};

const QUICK_AMOUNTS = [10, 50, 100];

const GiftAiTokensDialog: React.FC<Props> = ({ open, onClose, onSent }) => {
  const { t } = useTranslation();
  const { giftable, nongiftable, lookup, sendGift, refreshBalanceDetails } =
    useBusinessTokenGifts();
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [maskedName, setMaskedName] = useState('');
  const [amount, setAmount] = useState(10);
  const [lookingUp, setLookingUp] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep('code');
    setCode('');
    setMaskedName('');
    setAmount(10);
    setError(null);
    setIdempotencyKey(
      `gift-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`
    );
    void refreshBalanceDetails();
  }, [open, refreshBalanceDetails]);

  const normalizedCode = useMemo(
    () => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
    [code]
  );

  useEffect(() => {
    if (normalizedCode.length !== 6) {
      setMaskedName('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLookingUp(true);
        setError(null);
        const result = await lookup(normalizedCode);
        if (!cancelled) {
          setMaskedName(result.maskedName);
        }
      } catch (err: any) {
        if (!cancelled) {
          setMaskedName('');
          setError(
            err?.response?.data?.error ||
              err?.message ||
              t(
                'business.tokens.gift.code_not_found',
                'No user found with this code.'
              )
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
  }, [normalizedCode, lookup, t]);

  const amountError = useMemo(() => {
    if (!Number.isInteger(amount) || amount < 10) {
      return t('business.tokens.gift.min', 'Minimum {{min}} tokens.', {
        min: 10,
      });
    }
    if (amount > 5000) {
      return t(
        'business.tokens.gift.max',
        'Maximum {{max}} tokens per transfer.',
        { max: 5000 }
      );
    }
    if (amount > giftable) {
      return t(
        'business.tokens.gift.insufficient',
        'Not enough transferable tokens.'
      );
    }
    return null;
  }, [amount, giftable, t]);

  const handleSend = async () => {
    try {
      setSending(true);
      setError(null);
      await sendGift({
        code: normalizedCode,
        amount,
        idempotencyKey,
      });
      setStep('success');
      onSent();
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          t(
            'business.tokens.gift.generic_error',
            'Transfer failed. No tokens were deducted.'
          )
      );
      setStep('amount');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CardGiftcardIcon color="primary" />
        {t('business.tokens.gift.title', 'Gift AI tokens')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {step === 'code' && (
            <>
              <TextField
                label={t(
                  'business.tokens.gift.code_label',
                  "Recipient's referral code"
                )}
                value={normalizedCode}
                onChange={(e) => setCode(e.target.value)}
                inputProps={{ maxLength: 6 }}
                autoFocus
                fullWidth
                InputProps={{
                  endAdornment: lookingUp ? (
                    <CircularProgress size={18} />
                  ) : null,
                }}
              />
              {maskedName && (
                <Alert severity="success">
                  {t('business.tokens.gift.code_found', 'Sending to {{name}}', {
                    name: maskedName,
                  })}
                </Alert>
              )}
            </>
          )}
          {step === 'amount' && (
            <>
              <Typography>
                {t('business.tokens.gift.code_found', 'Sending to {{name}}', {
                  name: maskedName,
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'business.tokens.gift.transferable',
                  'Transferable: {{n}} tokens',
                  { n: giftable }
                )}
              </Typography>
              {nongiftable > 0 && (
                <Alert severity="info">
                  {t(
                    'business.tokens.gift.free_info',
                    "Free and promo tokens can't be gifted."
                  )}
                </Alert>
              )}
              <TextField
                type="number"
                label={t('business.tokens.gift.amount_label', 'Amount')}
                value={amount}
                onChange={(e) =>
                  setAmount(Number.parseInt(e.target.value, 10) || 0)
                }
                error={!!amountError}
                helperText={amountError}
                fullWidth
                inputProps={{ min: 10, max: Math.min(5000, giftable) }}
              />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {QUICK_AMOUNTS.map((n) => (
                  <Button
                    key={n}
                    size="small"
                    variant="outlined"
                    disabled={n > giftable}
                    onClick={() => setAmount(n)}
                  >
                    {n}
                  </Button>
                ))}
                <Button
                  size="small"
                  variant="outlined"
                  disabled={giftable < 10}
                  onClick={() => setAmount(Math.min(5000, giftable))}
                >
                  {t('business.tokens.gift.maxChip', 'Max')}
                </Button>
              </Box>
            </>
          )}
          {step === 'confirm' && (
            <Alert severity="warning" icon={<CardGiftcardIcon />}>
              <Typography fontWeight={600}>
                {t(
                  'business.tokens.gift.confirm_title',
                  'Send {{n}} tokens to {{name}}?',
                  { n: amount, name: maskedName }
                )}
              </Typography>
              <Typography variant="body2">
                {t(
                  'business.tokens.gift.confirm_body',
                  "Transfers are final and can't be reversed."
                )}
              </Typography>
            </Alert>
          )}
          {step === 'success' && (
            <Alert severity="success">
              {t(
                'business.tokens.gift.success',
                '{{n}} tokens sent to {{name}}.',
                { n: amount, name: maskedName }
              )}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {step !== 'success' && (
          <Button onClick={onClose}>
            {t('business.tokens.gift.cancel', 'Cancel')}
          </Button>
        )}
        {step === 'code' && (
          <Button
            variant="contained"
            disabled={!maskedName || lookingUp}
            onClick={() => setStep('amount')}
          >
            {t('common.continue', 'Continue')}
          </Button>
        )}
        {step === 'amount' && (
          <Button
            variant="contained"
            disabled={!!amountError}
            onClick={() => setStep('confirm')}
          >
            {t('common.continue', 'Continue')}
          </Button>
        )}
        {step === 'confirm' && (
          <Button
            variant="contained"
            disabled={sending}
            onClick={() => void handleSend()}
          >
            {sending
              ? t('common.loading', 'Loading...')
              : t('business.tokens.gift.send', 'Send')}
          </Button>
        )}
        {step === 'success' && (
          <Button variant="contained" onClick={onClose}>
            {t('common.done', 'Done')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default GiftAiTokensDialog;
