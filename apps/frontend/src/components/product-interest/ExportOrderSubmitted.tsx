import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExportOrderIllustration } from './ExportOrderIllustration';

const STEPS = [
  { key: 'review', title: 'We review your request', body: 'Our export team checks the item, quantity and destination. We may ask you for changes.' },
  { key: 'proforma', title: 'You receive a proforma', body: 'We confirm the manufacturer quote and send you a proforma invoice to approve.' },
  { key: 'deposit', title: 'Approve and pay the deposit', body: 'Once you approve the proforma, pay the deposit to start production.' },
  { key: 'delivery', title: 'Pay the balance and receive your goods', body: 'After production you settle the balance and we ship your order to you.' },
] as const;

interface ExportOrderSubmittedProps {
  bcNumber?: string | null;
}

export const ExportOrderSubmitted: React.FC<ExportOrderSubmittedProps> = ({ bcNumber }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Stack spacing={2.5} data-testid="export-order-submitted">
      <Stack spacing={1} alignItems="center" textAlign="center">
        <ExportOrderIllustration label={t('exportOrders.submitted.illustration', 'Purchase order received')} />
        <Typography variant="h6" fontWeight={800} component="h2">
          {t('exportOrders.submitted.title', 'Request received')}
        </Typography>
        {bcNumber ? (
          <Typography variant="subtitle2" color="primary" data-testid="export-order-bc">
            {t('exportOrders.submitted.bcLabel', 'Purchase order {{bc}}', { bc: bcNumber })}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {t('exportOrders.submitted.intro', 'We issued your purchase order. Here is what happens next.')}
        </Typography>
      </Stack>
      <Stack
        spacing={1.5}
        sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.04) }}
      >
        {STEPS.map((step, i) => (
          <Box key={step.key} data-testid={`export-step-${step.key}`}>
            <Typography variant="subtitle2" fontWeight={700}>
              {`${i + 1}. ${t(`exportOrders.submitted.steps.${step.key}.title`, step.title)}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(`exportOrders.submitted.steps.${step.key}.body`, step.body)}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
};
