import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBusinessVerification } from '../../hooks/useBusinessVerification';
import StripeConnectOnboardingCard from './StripeConnectOnboardingCard';

export const BusinessVerificationBanner: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, loading } = useBusinessVerification();

  if (loading || !status || status.is_verified || status.nextAction === 'complete') {
    return null;
  }

  const isStripe = status.paymentRail === 'stripe';
  const secondStepAction = isStripe ? 'setup_stripe_connect' : 'upload_id';
  const activeStep =
    status.nextAction === 'sign_agreement'
      ? 0
      : status.nextAction === secondStepAction
        ? 1
        : 2;

  return (
    <Alert severity="warning" sx={{ mb: 3 }}>
      <AlertTitle>
        {t('business.verification.noticeTitle', 'Account verification required')}
      </AlertTitle>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {t(
          'business.verification.notice',
          'Your business account must be verified before your items are visible to customers. Complete the steps below.'
        )}
      </Typography>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 2 }}>
        <Step>
          <StepLabel>{t('business.verification.stepAgreement', 'Agreement')}</StepLabel>
        </Step>
        <Step>
          <StepLabel>
            {isStripe
              ? t('business.verification.stepPayouts', 'Payouts')
              : t('business.verification.stepIdentity', 'ID document')}
          </StepLabel>
        </Step>
        <Step>
          <StepLabel>
            {isStripe
              ? t('business.verification.stepActive', 'Active')
              : t('business.verification.stepReview', 'Review')}
          </StepLabel>
        </Step>
      </Stepper>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        {status.nextAction === 'sign_agreement' ? (
          <Button
            variant="contained"
            color="warning"
            onClick={() => navigate('/business/merchant-agreement')}
          >
            {t('business.verification.signAgreement', 'Sign merchant agreement')}
          </Button>
        ) : null}
        {status.nextAction === 'upload_id' ? (
          <Button variant="contained" color="warning" onClick={() => navigate('/documents')}>
            {t('business.verification.uploadId', 'Upload identification')}
          </Button>
        ) : null}
        {status.nextAction === 'pending_review' ? (
          <Typography variant="body2">
            {t(
              'business.verification.pendingReview',
              'Documents submitted. Rendasua head office will review your account shortly.'
            )}
          </Typography>
        ) : null}
      </Stack>
      {status.nextAction === 'setup_stripe_connect' ? (
        <Box sx={{ mt: 2 }}>
          <StripeConnectOnboardingCard />
        </Box>
      ) : null}
    </Alert>
  );
};
