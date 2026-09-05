import { Alert, AlertTitle, Button, Stack, Typography } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { BusinessVerificationStatus } from '../../hooks/useBusinessVerification';
import {
  isVerifiedBadgeTipDismissed,
  markVerifiedBadgeTipDismissed,
  shouldShowVerifiedBadgeTip,
} from '../../utils/verifiedBadgeTip';
import StripeConnectOnboardingCard from './StripeConnectOnboardingCard';

interface VerifiedBadgeTipProps {
  status: BusinessVerificationStatus;
  businessId: string | undefined;
}

export const VerifiedBadgeTip: React.FC<VerifiedBadgeTipProps> = ({
  status,
  businessId,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() =>
    businessId ? isVerifiedBadgeTipDismissed(businessId) : false
  );

  const visible = useMemo(
    () => shouldShowVerifiedBadgeTip(status, businessId, dismissed),
    [status, businessId, dismissed]
  );

  if (!visible || !businessId) return null;

  const isStripe = status.paymentRail === 'stripe';

  const handleSkip = () => {
    markVerifiedBadgeTipDismissed(businessId);
    setDismissed(true);
  };

  return (
    <Alert severity="info" sx={{ mb: 3 }}>
      <AlertTitle>
        {t('business.verifiedBadgeTip.title', 'Get a Verified badge')}
      </AlertTitle>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {isStripe
          ? t(
              'business.verifiedBadgeTip.bodyStripe',
              'Connect payouts to earn a Verified badge on your store. It helps customers trust your business.'
            )
          : t(
              'business.verifiedBadgeTip.bodyMm',
              'Upload an ID that matches the name on your profile to earn a Verified badge on your store. It gives clients more confidence.'
            )}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        {isStripe ? null : (
          <Button
            variant="contained"
            color="info"
            onClick={() => navigate('/documents')}
          >
            {t('business.verifiedBadgeTip.uploadId', 'Upload ID')}
          </Button>
        )}
        <Button variant="text" color="inherit" onClick={handleSkip}>
          {t('business.verifiedBadgeTip.skip', 'Skip for now')}
        </Button>
      </Stack>
      {isStripe ? (
        <Stack sx={{ mt: 2 }}>
          <StripeConnectOnboardingCard />
        </Stack>
      ) : null}
    </Alert>
  );
};
