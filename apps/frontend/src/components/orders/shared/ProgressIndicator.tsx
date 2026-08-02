import TimelineIcon from '@mui/icons-material/Timeline';
import {
  Box,
  Card,
  CardContent,
  LinearProgress,
  Step,
  StepConnector,
  StepLabel,
  Stepper,
  Typography,
  stepConnectorClasses,
  styled,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { orderProgressSteps } from '../../../utils/orderPhase';

const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: { top: 22 },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage:
        'linear-gradient(95deg,rgb(25,118,210) 0%,rgb(33,150,243) 50%,rgb(66,165,245) 100%)',
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage:
        'linear-gradient(95deg,rgb(25,118,210) 0%,rgb(33,150,243) 50%,rgb(66,165,245) 100%)',
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: theme.palette.grey[300],
    borderRadius: 1,
  },
}));

export interface ProgressIndicatorProps {
  status: string;
  fulfillmentMethod?: string | null;
  activeStep: number;
  hide?: boolean;
}

export function resolveProgressStep(
  status: string,
  fulfillmentMethod?: string | null
): number {
  const stepKeys = orderProgressSteps(fulfillmentMethod);
  const statusMap: Record<string, string> = {
    pending: 'pending',
    pending_payment: 'pending',
    confirmed: 'confirmed',
    preparing: 'confirmed',
    ready_for_pickup: 'ready_for_pickup',
    assigned_to_agent: 'assigned_to_agent',
    picked_up: 'assigned_to_agent',
    in_transit: 'assigned_to_agent',
    out_for_delivery: 'out_for_delivery',
    delivered: 'complete',
    complete: 'complete',
  };
  if (['cancelled', 'failed'].includes(status)) {
    return Math.max(stepKeys.length - 1, 0);
  }
  const key = statusMap[status] ?? status;
  const idx = stepKeys.indexOf(key);
  return idx >= 0 ? idx : 0;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  status,
  fulfillmentMethod,
  activeStep,
  hide = false,
}) => {
  const { t } = useTranslation();
  if (hide || ['cancelled', 'failed'].includes(status)) return null;

  const stepKeys = orderProgressSteps(fulfillmentMethod);
  const progressMax = Math.max(stepKeys.length - 1, 1);

  return (
    <Card sx={{ mb: 3, overflow: 'visible' }}>
      <CardContent sx={{ p: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <TimelineIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" fontWeight="bold">
            {t('orders.orderProgress', 'Order Progress')}
          </Typography>
        </Box>
        <Stepper
          alternativeLabel
          activeStep={activeStep}
          connector={<ColorlibConnector />}
          sx={{ display: { xs: 'none', md: 'flex' } }}
        >
          {stepKeys.map((stepKey) => (
            <Step key={stepKey}>
              <StepLabel>
                {t(`common.orderStatus.${stepKey}`, stepKey)}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('orders.progress', 'Progress')}:{' '}
            {Math.round((activeStep / progressMax) * 100)}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(activeStep / progressMax) * 100}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProgressIndicator;
