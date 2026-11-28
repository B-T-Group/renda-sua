import { Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  exportOrderIsStopped,
  exportOrderNextStepHint,
} from '../../utils/exportOrders/exportOrderProgress';
import { exportOrderNeedsAction } from '../../utils/exportOrders/exportOrderStatus';

interface ExportOrderNextStepCardProps {
  status: string;
  children?: React.ReactNode;
}

export const ExportOrderNextStepCard: React.FC<ExportOrderNextStepCardProps> = ({
  status,
  children,
}) => {
  const { t } = useTranslation();
  const hint = exportOrderNextStepHint(status);
  if (!hint) return <>{children}</>;
  const tone = exportOrderIsStopped(status)
    ? 'error'
    : exportOrderNeedsAction(status)
    ? 'warning'
    : 'primary';

  return (
    <Paper
      variant="outlined"
      data-testid="export-next-step"
      sx={{
        p: 2,
        mb: 3,
        borderLeft: 4,
        borderLeftColor: `${tone}.main`,
        bgcolor: (theme) => theme.palette[tone].main + '14',
      }}
    >
      <Stack spacing={1.5}>
        <Typography
          variant="overline"
          color={`${tone}.main`}
          sx={{ fontWeight: 700, lineHeight: 1.2 }}
        >
          {t('exportOrders.nextStep', 'What happens next')}
        </Typography>
        <Typography variant="h6">
          {t(`exportOrders.next.${status}.title`, hint.title)}
        </Typography>
        <Typography color="text.secondary">
          {t(`exportOrders.next.${status}.body`, hint.body)}
        </Typography>
        {children}
      </Stack>
    </Paper>
  );
};
