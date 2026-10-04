import { ArrowForward, Star } from '@mui/icons-material';
import {
  Box,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { brandTokens } from '../../theme/brandTokens';
import { displayCountry } from '../../utils/diasporaCheckout';
import { DiasporaGiftIllustration } from './DiasporaGiftIllustration';

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
 * Frames checkout as a gift: where the money leaves from, where the order
 * lands, and whether someone else is receiving it.
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
  const theme = useTheme();
  const gold = theme.palette.warning.main;
  const cream = brandTokens.warning.soft;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        mb: 3,
        borderRadius: 3,
        border: '1px solid',
        borderColor: alpha(gold, sendingToSomeoneElse ? 0.55 : 0.32),
        background: `linear-gradient(145deg, ${cream} 0%, ${theme.palette.background.paper} 58%)`,
        boxShadow: `0 10px 28px ${alpha(gold, 0.12)}`,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <DiasporaGiftIllustration
          label={t(
            'checkout.diaspora.illustrationLabel',
            'A gift for someone special'
          )}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Star sx={{ fontSize: 16, color: gold }} />
            <Typography
              variant="caption"
              sx={{ color: theme.palette.warning.dark, fontWeight: 700, letterSpacing: 0.4 }}
            >
              {t('checkout.diaspora.eyebrow', 'For someone special')}
            </Typography>
          </Stack>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 0.25, lineHeight: 1.3 }}>
            {crossBorder
              ? t('checkout.diaspora.title', 'Sending an order home')
              : t('checkout.diaspora.localTitle', 'Send this order as a gift')}
          </Typography>
          {crossBorder ? (
            <CountryRoute
              payerCountry={payerCountry}
              fulfillmentCountry={fulfillmentCountry}
            />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t(
                'checkout.diaspora.localLine',
                'A personal delivery, handed over in their name.'
              )}
            </Typography>
          )}
        </Box>
      </Stack>

      <GiftToggle
        checked={sendingToSomeoneElse}
        disabled={disabled}
        onChange={onSendingToSomeoneElseChange}
      />
    </Paper>
  );
};

function CountryRoute({
  payerCountry,
  fulfillmentCountry,
}: {
  payerCountry?: string | null;
  fulfillmentCountry?: string | null;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      useFlexGap
      flexWrap="wrap"
      sx={{ mt: 1 }}
    >
      <Chip
        size="small"
        label={t('checkout.diaspora.payingFrom', 'Paying from {{country}}', {
          country: displayCountry(payerCountry),
        })}
        sx={{ bgcolor: 'background.paper', fontWeight: 600 }}
      />
      <ArrowForward sx={{ fontSize: 16, color: theme.palette.warning.dark }} />
      <Chip
        size="small"
        label={t('checkout.diaspora.deliveringTo', 'Delivering to {{country}}', {
          country: displayCountry(fulfillmentCountry),
        })}
        sx={{
          bgcolor: brandTokens.warning.soft,
          color: theme.palette.warning.dark,
          fontWeight: 700,
        }}
      />
    </Stack>
  );
}

function GiftToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const gold = theme.palette.warning.main;

  return (
    <FormControlLabel
      sx={{
        alignItems: 'flex-start',
        mt: 2,
        mx: 0,
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        bgcolor: checked ? alpha(gold, 0.14) : alpha(theme.palette.background.paper, 0.8),
        border: '1px solid',
        borderColor: alpha(gold, checked ? 0.45 : 0.2),
        width: '100%',
      }}
      control={
        <Switch
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          color="warning"
        />
      }
      label={
        <Box>
          <Typography variant="body2" fontWeight={700}>
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
  );
}

export default DiasporaCheckoutBanner;
