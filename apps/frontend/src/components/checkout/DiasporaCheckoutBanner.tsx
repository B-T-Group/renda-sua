import { CardGiftcard, FlightTakeoff } from '@mui/icons-material';
import {
  Box,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { displayCountry } from '../../utils/diasporaCheckout';

interface DiasporaCheckoutBannerProps {
  payerCountry?: string | null;
  fulfillmentCountry?: string | null;
  /** Show the "Paying from X · Delivering to Y" chips. */
  crossBorder: boolean;
  sendingToSomeoneElse: boolean;
  onSendingToSomeoneElseChange: (value: boolean) => void;
  disabled?: boolean;
}

/**
 * Tells a payer abroad, in one line, where the money leaves from and where the
 * order lands, then offers the "someone else is receiving this" switch that
 * turns the rest of checkout into a two-person flow. The switch is always
 * available; the country chips only appear when the two markets differ.
 */
const DiasporaCheckoutBanner: React.FC<DiasporaCheckoutBannerProps> = ({
  payerCountry,
  fulfillmentCountry,
  crossBorder,
  sendingToSomeoneElse,
  onSendingToSomeoneElseChange,
  disabled,
}) => {
  const { t } = useTranslation();

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 3,
        borderColor: crossBorder ? 'primary.200' : 'divider',
        bgcolor: crossBorder ? 'primary.50' : 'background.paper',
      }}
    >
      {crossBorder && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <FlightTakeoff color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {t('checkout.diaspora.title', 'Sending an order home')}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ mt: 0.75 }}
              flexWrap="wrap"
              useFlexGap
            >
              <Chip
                size="small"
                label={t(
                  'checkout.diaspora.payingFrom',
                  'Paying from {{country}}',
                  { country: displayCountry(payerCountry) }
                )}
              />
              <Chip
                size="small"
                color="primary"
                icon={<CardGiftcard />}
                label={t(
                  'checkout.diaspora.deliveringTo',
                  'Delivering to {{country}}',
                  { country: displayCountry(fulfillmentCountry) }
                )}
              />
            </Stack>
          </Box>
        </Stack>
      )}

      <FormControlLabel
        sx={{ alignItems: 'flex-start', mt: crossBorder ? 1.5 : 0 }}
        control={
          <Switch
            checked={sendingToSomeoneElse}
            onChange={(e) => onSendingToSomeoneElseChange(e.target.checked)}
            disabled={disabled}
            color="primary"
          />
        }
        label={
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {t(
                'checkout.diaspora.sendingToSomeoneElse',
                'Someone else is receiving this order'
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t(
                'checkout.diaspora.sendingToSomeoneElseHelp',
                'We will collect their name and phone so they can follow the delivery themselves.'
              )}
            </Typography>
          </Box>
        }
      />
    </Paper>
  );
};

export default DiasporaCheckoutBanner;
