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

  if (loading || !status || status.can_accept_orders) {
    return null;
  }

  if (status.lifecycle_status === 'suspended') {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <AlertTitle>
          {t('business.lifecycle.suspendedTitle', 'Store suspended')}
        </AlertTitle>
        <Typography variant="body2">
          {t(
            'business.lifecycle.suspendedNotice',
            'Your store is hidden and cannot accept orders. Contact support if you believe this is a mistake.'
          )}
        </Typography>
      </Alert>
    );
  }

  if (status.is_storefront_visible) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>
          {t('business.lifecycle.storeLiveTitle', 'Your store is live')}
        </AlertTitle>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t(
            'business.lifecycle.storeLiveNotice',
            'Customers can discover your products. Complete payment setup to start accepting orders.'
          )}
        </Typography>
        {status.nextAction === 'setup_stripe_connect' ? (
          <Box sx={{ mt: 1 }}>
            <StripeConnectOnboardingCard />
          </Box>
        ) : null}
        {status.nextAction === 'upload_id' ? (
          <Button variant="contained" onClick={() => navigate('/documents')}>
            {t('business.verification.uploadId', 'Upload identification')}
          </Button>
        ) : null}
        {status.nextAction === 'pending_review' ? (
          <Typography variant="body2">
            {t(
              'business.lifecycle.paymentReviewPending',
              'Payment details submitted. We will notify you when you can accept orders.'
            )}
          </Typography>
        ) : null}
      </Alert>
    );
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
        {t('business.lifecycle.setupTitle', 'Finish setting up your store')}
      </AlertTitle>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {t(
          'business.lifecycle.setupNotice',
          'Complete your profile, sign the merchant agreement, and publish at least one product to go live.'
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
            {status.contract?.boldSignEnabled
              ? t('business.contract.viewStatus', 'View signing status')
              : t('business.verification.signAgreement', 'Sign merchant agreement')}
          </Button>
        ) : null}
        {status.nextAction === 'upload_id' ? (
          <Button variant="contained" color="warning" onClick={() => navigate('/documents')}>
            {t('business.verification.uploadId', 'Upload identification')}
          </Button>
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
