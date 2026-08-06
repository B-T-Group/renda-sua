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
import { SUPPORT_EMAIL, supportMailto } from '../../constants/support';
import { useApiClient } from '../../hooks/useApiClient';
import {
  useBusinessVerification,
  type BusinessVerificationStatus,
} from '../../hooks/useBusinessVerification';
import { suspendedReasonMessage } from '../../utils/suspendedReasonMessage';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import StripeConnectOnboardingCard from './StripeConnectOnboardingCard';

function needsMobilePaymentPhone(status: BusinessVerificationStatus): boolean {
  if (status.paymentRail !== 'mobile_money') return false;
  if (status.can_accept_orders !== true) return false;
  const phone = status.steps.mobilePaymentPhone;
  const needing =
    phone?.locationsWithItemsNeedingPhone ?? phone?.locationCountNeedingPhone ?? 0;
  return needing > 0;
}

export const BusinessVerificationBanner: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const { profile } = useUserProfileContext();
  const { status, loading, refresh } = useBusinessVerification();
  const [refreshing, setRefreshing] = useState(false);
  const mainInterest = profile?.business?.main_interest ?? 'sell_items';
  const itemsListPath =
    mainInterest === 'rent_items'
      ? '/business/rentals/catalog'
      : '/business/items';
  const viewItemsLabel =
    mainInterest === 'rent_items'
      ? t('business.setup.ctaViewRentals', 'View rentals')
      : t('business.setup.ctaViewItems', 'View items');

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiClient.post('/business-contracts/refresh');
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading || !status) {
    return null;
  }

  const phoneCta = needsMobilePaymentPhone(status) ? (
    <Alert severity="warning" sx={{ mb: 3 }}>
      <AlertTitle>
        {t('mobilePaymentPhone.confirmCta', 'Confirm mobile money number')}
      </AlertTitle>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {t(
          'mobilePaymentPhone.businessDashboardCtaConfirmWithItems',
          'You have products at a location. Confirm that the phone number can receive Mobile Money before clients can place orders.'
        )}
      </Typography>
      <Button
        variant="contained"
        color="warning"
        onClick={() => navigate('/business/locations')}
      >
        {t('mobilePaymentPhone.confirmCta', 'Confirm mobile money number')}
      </Button>
    </Alert>
  ) : null;

  if (status.can_accept_orders) {
    return phoneCta;
  }

  if (status.lifecycle_status === 'suspended') {
    const reasonText = suspendedReasonMessage(status.suspension?.code, t);
    const mailto = supportMailto(
      t(
        'business.lifecycle.suspendedEmailSubject',
        'Store suspension appeal'
      ),
      t(
        'business.lifecycle.suspendedEmailBody',
        'Hello,\n\nMy store appears to be suspended. Please review my account.\n\nThank you.'
      )
    );
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <AlertTitle>
          {t('business.lifecycle.suspendedTitle', 'Store suspended')}
        </AlertTitle>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {reasonText}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          {t(
            'business.lifecycle.suspendedNotice',
            'Your store is hidden and cannot accept orders. Email {{email}} if you believe this is a mistake.',
            { email: SUPPORT_EMAIL }
          )}
        </Typography>
        <Button variant="contained" color="error" href={mailto} component="a">
          {t('business.lifecycle.emailSupport', 'Email {{email}}', {
            email: SUPPORT_EMAIL,
          })}
        </Button>
      </Alert>
    );
  }

  const isStripe = status.paymentRail === 'stripe';
  const agreementDone = status.steps.agreement?.complete === true;
  const payoutsDone = status.steps.stripeConnect?.complete === true;
  const identityDone = status.steps.identity?.status === 'approved';
  const reviewDone =
    status.nextAction === 'complete' ||
    status.is_verified === true ||
    status.steps.identity?.status === 'approved';

  const activeStep = resolveActiveStep(status, isStripe);

  const stepIcon = (complete: boolean) =>
    complete ? (
      <CheckCircleIcon color="success" fontSize="small" />
    ) : (
      <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
    );

  return (
    <>
      {phoneCta}
      <Alert severity="warning" sx={{ mb: 3 }}>
        <AlertTitle>
          {t('business.lifecycle.setupTitle', 'Finish setting up your store')}
        </AlertTitle>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {isStripe
            ? t(
                'business.lifecycle.setupNotice',
                'Sign the merchant agreement and connect payouts to go live.'
              )
            : t(
                'business.lifecycle.setupNoticeMobileMoney',
                'Sign the merchant agreement and upload a valid ID. We review it before your account can accept orders.'
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
          {isStripe ? null : (
            <Step completed={reviewDone}>
              <StepLabel icon={stepIcon(reviewDone)}>
                {t('business.verification.stepReview', 'Review')}
              </StepLabel>
            </Step>
          )}
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
                : t(
                    'business.verification.signAgreement',
                    'Sign merchant agreement'
                  )}
            </Button>
          ) : null}
          {status.nextAction === 'upload_id' ? (
            <Button
              variant="contained"
              color="warning"
              onClick={() => navigate('/documents')}
            >
              {t('business.verification.uploadId', 'Upload identification')}
            </Button>
          ) : null}
          {status.steps.catalog?.hasPendingItem ||
          status.steps.catalog?.hasApprovedItem ||
          status.steps.catalog?.hasPendingRental ||
          status.steps.catalog?.hasApprovedRental ? (
            <Button
              variant="outlined"
              color="warning"
              onClick={() => navigate(itemsListPath)}
            >
              {viewItemsLabel}
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
      </Alert>
    </>
  );
};

function resolveActiveStep(
  status: BusinessVerificationStatus,
  isStripe: boolean
): number {
  if (isStripe) {
    if (status.nextAction === 'sign_agreement') return 0;
    if (status.nextAction === 'setup_stripe_connect') return 1;
    return 2;
  }
  if (status.nextAction === 'sign_agreement') return 0;
  if (status.nextAction === 'upload_id') return 1;
  return 2;
}
