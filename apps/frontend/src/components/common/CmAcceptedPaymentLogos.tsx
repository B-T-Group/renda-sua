import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import mtnMomoCm from '../../assets/payment-cm-mtn-momo.png';
import orangeMoneyCm from '../../assets/payment-cm-orange-money.png';

const imgSx = {
  objectFit: 'contain' as const,
  display: 'block' as const,
};

/**
 * Cameroon: accepted mobile-money partner marks for item detail and checkout context.
 */
export function CmAcceptedPaymentLogos() {
  const { t } = useTranslation();
  const title = t('items.detail.acceptedPaymentMethods', 'Accepted payment methods');
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        mt: 1,
        p: 1.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={600}
        display="block"
        textAlign="center"
        sx={{ mb: 0.75 }}
      >
        {title}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Box
          component="img"
          src={orangeMoneyCm}
          alt={t('items.detail.orangeMoneyAlt', 'Orange Money')}
          sx={{ ...imgSx, maxHeight: 44, maxWidth: 140, width: 'auto', height: 'auto' }}
        />
        <Box
          component="img"
          src={mtnMomoCm}
          alt={t('items.detail.mtnMomoAlt', 'MTN Mobile Money (Cameroon)')}
          sx={{ ...imgSx, maxHeight: 48, maxWidth: 220, width: 'auto', height: 'auto' }}
        />
      </Box>
    </Box>
  );
}
