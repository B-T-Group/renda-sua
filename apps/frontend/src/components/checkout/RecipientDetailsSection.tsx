import { Lock } from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RecipientDraft } from '../../utils/diasporaCheckout';
import PhoneInput from '../common/PhoneInput';

interface RecipientDetailsSectionProps {
  recipient: RecipientDraft;
  onChange: (recipient: RecipientDraft) => void;
  /** Delivery country, used to default the phone country selector. */
  fulfillmentCountry?: string | null;
  /** Server-side blocker for the recipient block, when preflight rejected it. */
  errorMessage?: string | null;
  disabled?: boolean;
}

/**
 * Collects the local recipient. Their phone is the only channel they have —
 * they never sign in — so it is required and the copy says why.
 */
const RecipientDetailsSection: React.FC<RecipientDetailsSectionProps> = ({
  recipient,
  onChange,
  fulfillmentCountry,
  errorMessage,
  disabled,
}) => {
  const { t } = useTranslation();
  const nameMissing = !recipient.name.trim();
  const phoneMissing = !recipient.phone.trim();

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
          {t('checkout.recipient.title', 'Who is receiving this order?')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'checkout.recipient.subtitle',
            'They get tracking updates and the delivery code by text — no Rendasua account needed.'
          )}
        </Typography>

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        <Stack spacing={2}>
          <TextField
            fullWidth
            required
            label={t('checkout.recipient.name', 'Recipient full name')}
            value={recipient.name}
            disabled={disabled}
            onChange={(e) => onChange({ ...recipient, name: e.target.value })}
            error={nameMissing}
            helperText={
              nameMissing
                ? t(
                    'checkout.recipient.nameRequired',
                    'The agent needs a name to hand the order to.'
                  )
                : undefined
            }
          />

          <Box>
            <PhoneInput
              required
              value={recipient.phone}
              onChange={(value) => onChange({ ...recipient, phone: value || '' })}
              label={t('checkout.recipient.phone', 'Recipient phone number')}
              defaultCountry={fulfillmentCountry?.trim().toUpperCase() || 'GA'}
              disabled={disabled}
              error={phoneMissing}
              helperText={
                phoneMissing
                  ? t(
                      'checkout.recipient.phoneRequired',
                      'A local number in the delivery country is required.'
                    )
                  : t(
                      'checkout.recipient.phoneHelp',
                      'Updates and the delivery code are sent to this number.'
                    )
              }
            />
          </Box>

          <FormControlLabel
            sx={{ alignItems: 'flex-start' }}
            control={
              <Switch
                checked={recipient.notifyWhatsapp}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...recipient, notifyWhatsapp: e.target.checked })
                }
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {t(
                    'checkout.recipient.whatsapp',
                    'Send their updates on WhatsApp'
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'checkout.recipient.whatsappHelp',
                    'We fall back to SMS if WhatsApp cannot be delivered.'
                  )}
                </Typography>
              </Box>
            }
          />
        </Stack>

        <Alert severity="info" icon={<Lock fontSize="inherit" />} sx={{ mt: 2 }}>
          {t(
            'checkout.recipient.pinNotice',
            'The recipient receives their own delivery code and gives it to the agent at handover. You can still see it in your order.'
          )}
        </Alert>
      </CardContent>
    </Card>
  );
};

export default RecipientDetailsSection;
