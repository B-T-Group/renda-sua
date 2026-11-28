import { Box, Step, StepLabel, Stepper, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  EXPORT_PROGRESS_STEPS,
  exportOrderIsStopped,
  exportOrderProgressIndex,
} from '../../utils/exportOrders/exportOrderProgress';

const FINISHED_STATUSES = new Set(['DELIVERED', 'CLOSED', 'REVIEWED']);

interface ExportOrderProgressProps {
  status: string;
}

export const ExportOrderProgress: React.FC<ExportOrderProgressProps> = ({
  status,
}) => {
  const { t } = useTranslation();
  if (exportOrderIsStopped(status)) return null;
  const index = exportOrderProgressIndex(status);
  const activeStep = FINISHED_STATUSES.has(status)
    ? EXPORT_PROGRESS_STEPS.length
    : index;

  return (
    <Box data-testid="export-progress" sx={{ mb: 3 }}>
      <Typography fontWeight={600} sx={{ mb: 1 }}>
        {t('exportOrders.progress.title', 'Progress')}
      </Typography>
      <Stepper activeStep={activeStep} orientation="vertical">
        {EXPORT_PROGRESS_STEPS.map((step) => (
          <Step key={step.key} data-testid={`export-progress-${step.key}`}>
            <StepLabel>
              {t(`exportOrders.progress.${step.key}`, step.title)}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
};
