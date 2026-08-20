import {
  Alert,
  AlertTitle,
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
import { VerifiedBadgeTip } from './VerifiedBadgeTip';

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
  const businessId = profile?.business?.id;
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
    return (
      <>
        {phoneCta}
        <VerifiedBadgeTip status={status} businessId={businessId} />
      </>
    );
  }

  if (status.lifecycle_status === 'suspended') {
    return <SuspendedBanner status={status} t={t} />;
  }

  const agreementDone = status.steps.agreement?.complete === true;
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
          {t(
            'business.lifecycle.setupNotice',
            'Sign the merchant agreement to go live and start accepting orders.'
          )}
        </Typography>
        <Stepper activeStep={agreementDone ? 1 : 0} alternativeLabel sx={{ mb: 2 }}>
          <Step completed={agreementDone}>
            <StepLabel icon={stepIcon(agreementDone)}>
              {t('business.verification.stepAgreement', 'Agreement')}
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
                : t(
                    'business.verification.signAgreement',
                    'Sign merchant agreement'
                  )}
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
      </Alert>
    </>
  );
};

function SuspendedBanner({
  status,
  t,
}: {
  status: BusinessVerificationStatus;
  t: (key: string, defaultValue: string, options?: Record<string, string>) => string;
}) {
  const reasonText = suspendedReasonMessage(status.suspension?.code, t);
  const mailto = supportMailto(
    t('business.lifecycle.suspendedEmailSubject', 'Store suspension appeal'),
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
