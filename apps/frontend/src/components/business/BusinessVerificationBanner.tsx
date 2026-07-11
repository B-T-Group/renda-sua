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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import { useBusinessVerification } from '../../hooks/useBusinessVerification';
import StripeConnectOnboardingCard from './StripeConnectOnboardingCard';

export const BusinessVerificationBanner: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const { status, loading, refresh } = useBusinessVerification();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiClient.post('/business-contracts/refresh');
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

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
        <Box sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            {t('common.refresh', 'Refresh')}
          </Button>
        </Box>
      </Alert>
    );
  }

  const isStripe = status.paymentRail === 'stripe';
  const agreementDone = status.steps.agreement?.complete === true;
  const payoutsDone = status.steps.stripeConnect?.complete === true;
  const catalogDone = status.steps.catalog?.complete === true;
  const identityDone = status.steps.identity?.complete === true;

  const activeStep = isStripe
    ? status.nextAction === 'sign_agreement'
      ? 0
      : status.nextAction === 'setup_stripe_connect'
        ? 1
        : status.nextAction === 'publish_catalog'
          ? 2
          : 3
    : status.nextAction === 'sign_agreement'
      ? 0
      : status.nextAction === 'upload_id'
        ? 1
        : 2;

  const stepIcon = (complete: boolean) =>
    complete ? (
      <CheckCircleIcon color="success" fontSize="small" />
    ) : (
      <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
    );

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
        <Step completed={agreementDone}>
          <StepLabel icon={stepIcon(agreementDone)}>
            {t('business.verification.stepAgreement', 'Agreement')}
          </StepLabel>
        </Step>
        <Step completed={isStripe ? payoutsDone : identityDone}>
          <StepLabel icon={stepIcon(isStripe ? payoutsDone : identityDone)}>
            {isStripe
              ? t('business.verification.stepPayouts', 'Payouts')
              : t('business.verification.stepIdentity', 'ID document')}
          </StepLabel>
        </Step>
        <Step completed={isStripe ? catalogDone : status.nextAction === 'complete'}>
          <StepLabel
            icon={stepIcon(isStripe ? catalogDone : status.nextAction === 'complete')}
          >
            {isStripe
              ? t('business.verification.stepCatalog', 'Product')
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
        {status.nextAction === 'publish_catalog' && !status.steps.catalog?.hasPendingItem ? (
          <Button
            variant="contained"
            color="warning"
            onClick={() => navigate('/business/items')}
          >
            {t('business.verification.addProduct', 'Add a product')}
          </Button>
        ) : null}
        <Button
          variant="outlined"
          color="warning"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          {t('common.refresh', 'Refresh')}
        </Button>
      </Stack>
      {status.nextAction === 'setup_stripe_connect' ? (
        <Box sx={{ mt: 2 }}>
          <StripeConnectOnboardingCard />
        </Box>
      ) : null}
      {status.nextAction === 'publish_catalog' && status.steps.catalog?.hasPendingItem ? (
        <Typography variant="body2" sx={{ mt: 2 }}>
          {t(
            'business.verification.catalogPendingNotice',
            'Your product is awaiting review. Once approved, this step will complete.'
          )}
        </Typography>
      ) : null}
    </Alert>
  );
};
