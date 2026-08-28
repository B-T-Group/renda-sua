import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type CreditContactChannel = 'in_app_message' | 'call' | 'email';
export type CreditOrderResult =
  | 'order_cancelled'
  | 'confirmed'
  | 'system_cancelled';

export interface ResolveEscalationPayload {
  contact_channel: CreditContactChannel;
  order_result: CreditOrderResult;
  notes: string;
}

interface ResolveEscalationDialogProps {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: ResolveEscalationPayload) => void | Promise<void>;
}

export const ResolveEscalationDialog: React.FC<
  ResolveEscalationDialogProps
> = ({ open, submitting, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [channel, setChannel] = useState<CreditContactChannel>('call');
  const [result, setResult] = useState<CreditOrderResult>('confirmed');
  const [notes, setNotes] = useState('');

  const canSubmit = notes.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      contact_channel: channel,
      order_result: result,
      notes: notes.trim(),
    });
    setNotes('');
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        {t('admin.credits.resolveTitle', 'Record how you handled this')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <FormControl>
            <FormLabel>
              {t('admin.credits.contactChannel', 'How you reached them')}
            </FormLabel>
            <RadioGroup
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as CreditContactChannel)
              }
            >
              <FormControlLabel
                value="call"
                control={<Radio />}
                label={t('admin.credits.channel.call', 'Call')}
              />
              <FormControlLabel
                value="in_app_message"
                control={<Radio />}
                label={t('admin.credits.channel.inApp', 'In-app message')}
              />
              <FormControlLabel
                value="email"
                control={<Radio />}
                label={t('admin.credits.channel.email', 'Email')}
              />
            </RadioGroup>
          </FormControl>

          <FormControl>
            <FormLabel>
              {t('admin.credits.orderResult', 'What happened')}
            </FormLabel>
            <RadioGroup
              value={result}
              onChange={(e) => setResult(e.target.value as CreditOrderResult)}
            >
              <FormControlLabel
                value="confirmed"
                control={<Radio />}
                label={t('admin.credits.result.confirmed', 'Confirmed')}
              />
              <FormControlLabel
                value="order_cancelled"
                control={<Radio />}
                label={t('admin.credits.result.cancelled', 'Order cancelled')}
              />
              <FormControlLabel
                value="system_cancelled"
                control={<Radio />}
                label={t(
                  'admin.credits.result.systemCancelled',
                  'System cancelled'
                )}
              />
            </RadioGroup>
          </FormControl>

          <TextField
            label={t('admin.credits.comments', 'Comments')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={3}
            required
            fullWidth
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={onClose} disabled={!!submitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {t('admin.credits.resolveSubmit', 'Resolve')}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
