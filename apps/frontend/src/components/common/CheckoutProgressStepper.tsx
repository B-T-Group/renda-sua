import { CheckCircle } from '@mui/icons-material';
import { Box, Step, StepLabel, Stepper } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface CheckoutProgressStepperProps {
  /** Current step: 0 = Cart, 1 = Checkout, 2 = Pay */
  activeStep: 0 | 1 | 2;
}

/**
 * Shared progress stepper for Cart → Checkout → Pay flow
 * Used in CartPage and CheckoutPage
 */
const CheckoutProgressStepper: React.FC<CheckoutProgressStepperProps> = ({
  activeStep,
}) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ mb: 4 }}>
      <Stepper activeStep={activeStep} alternativeLabel>
        <Step completed={activeStep > 0}>
          <StepLabel
            StepIconComponent={
              activeStep > 0
                ? () => (
                    <CheckCircle sx={{ color: 'success.main', fontSize: 24 }} />
                  )
                : undefined
            }
          >
            {t('cart.steps.cart', 'Cart')}
          </StepLabel>
        </Step>
        <Step completed={activeStep > 1}>
          <StepLabel
            StepIconComponent={
              activeStep > 1
                ? () => (
                    <CheckCircle sx={{ color: 'success.main', fontSize: 24 }} />
                  )
                : undefined
            }
          >
            {t('cart.steps.checkout', 'Checkout')}
          </StepLabel>
        </Step>
        <Step>
          <StepLabel>{t('cart.steps.pay', 'Pay')}</StepLabel>
        </Step>
      </Stepper>
    </Box>
  );
};

export default CheckoutProgressStepper;
