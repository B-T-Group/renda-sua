import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

/** Four-step reassurance for pay-after-the-store-confirms. */
export function PayAfterConfirmExplainer() {
  const { t } = useTranslation();
  const steps = [
    t('client.payAfter.step1', 'The store confirms it is available'),
    t('client.payAfter.step2', 'You get a payment request'),
    t('client.payAfter.step3', 'Pay within the time window'),
    t('client.payAfter.step4', 'The store prepares your order'),
  ];
  return (
    <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
      <Typography variant="h3">{t('client.payAfter.title', 'Pay after the store confirms')}</Typography>
      <Typography variant="body2" sx={{ mt: 0.5, mb: 1 }}>
        {t('client.payAfter.body', 'Nothing is charged until the store says it can fulfil this order.')}
      </Typography>
      {steps.map((step, index) => (
        <Typography key={step} variant="body1" sx={{ mt: 0.5 }}>
          {`${index + 1}. ${step}`}
        </Typography>
      ))}
    </Box>
  );
}
