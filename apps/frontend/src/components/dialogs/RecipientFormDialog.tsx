import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
  Box,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PhoneInput from '../common/PhoneInput';
import type { SavedRecipient, CreateRecipientDto, UpdateRecipientDto } from '../../hooks/useRecipients';

interface RecipientFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateRecipientDto | UpdateRecipientDto) => void;
  recipient?: SavedRecipient | null;
  loading?: boolean;
}

const SUPPORTED_COUNTRIES = [
  { code: 'GA', name: 'Gabon' },
  { code: 'CM', name: 'Cameroon' },
];

const RecipientFormDialog: React.FC<RecipientFormDialogProps> = ({
  open,
  onClose,
  onSave,
  recipient,
  loading,
}) => {
  const { t } = useTranslation();
  const [country, setCountry] = useState('GA');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);

  useEffect(() => {
    if (recipient) {
      setCountry(recipient.country);
      setName(recipient.name);
      setPhone(recipient.phone);
      setNotifyWhatsapp(recipient.notify_whatsapp);
    } else {
      setCountry('GA');
      setName('');
      setPhone('');
      setNotifyWhatsapp(false);
    }
  }, [recipient, open]);

  const handleSave = () => {
    if (recipient) {
      onSave({
        name: name.trim(),
        phone: phone.trim(),
        notify_whatsapp: notifyWhatsapp,
      } as UpdateRecipientDto);
    } else {
      onSave({
        country,
        name: name.trim(),
        phone: phone.trim(),
        notify_whatsapp: notifyWhatsapp,
      } as CreateRecipientDto);
    }
  };

  const isValid = name.trim() && phone.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {recipient
          ? t('recipients.editTitle', 'Edit Recipient')
          : t('recipients.addTitle', 'Add New Recipient')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {!recipient && (
            <FormControl fullWidth>
              <InputLabel>{t('recipients.country', 'Country')}</InputLabel>
              <Select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                label={t('recipients.country', 'Country')}
              >
                {SUPPORTED_COUNTRIES.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            fullWidth
            required
            label={t('recipients.name', 'Full Name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />

          <PhoneInput
            required
            value={phone}
            onChange={(value) => setPhone(value || '')}
            label={t('recipients.phone', 'Phone Number')}
            defaultCountry={country}
            disabled={loading || !!recipient}
          />

          <FormControlLabel
            control={
              <Switch
                checked={notifyWhatsapp}
                onChange={(e) => setNotifyWhatsapp(e.target.checked)}
                disabled={loading}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {t('recipients.whatsapp', 'Send updates on WhatsApp')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'recipients.whatsappHelp',
                    'Only if they agreed to receive Rendasua WhatsApp messages about this delivery. Falls back to SMS if needed.'
                  )}
                </Typography>
              </Box>
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!isValid || loading}
        >
          {t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecipientFormDialog;
