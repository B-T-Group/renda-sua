import { Button, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BusinessLocation } from '../../../hooks/useBusinessLocations';
import { buildLocationExpectations } from '../../../utils/locationExpectations';
import LocationExperienceIllustration from '../../illustrations/LocationExperienceIllustration';

interface LocationExpectationsCardProps {
  location: BusinessLocation;
  isStripeRail: boolean;
  hasVerifiedPhone: boolean;
  onAction?: (action: string) => void;
}

const LocationExpectationsCard: React.FC<LocationExpectationsCardProps> = ({
  location,
  isStripeRail,
  hasVerifiedPhone,
  onAction,
}) => {
  const { t } = useTranslation();
  const result = buildLocationExpectations(
    location,
    { isStripeRail, hasVerifiedPhone },
    (key, fallback) => t(key, fallback)
  );
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
        <LocationExperienceIllustration />
        <Typography variant="h6" component="h2">
          {t(
            'business.locations.expectations.title',
            'What your customers will experience'
          )}
        </Typography>
      </Stack>
      <Stack spacing={1}>
        {result.lines.map((line) => (
          <Stack key={line.id} spacing={0.5}>
            <Typography
              variant="body2"
              color={line.tone === 'warning' ? 'warning.dark' : 'text.primary'}
            >
              {line.text}
            </Typography>
            {line.action && onAction ? (
              <Button
                variant="text"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
                onClick={() => onAction(line.action as string)}
              >
                {actionLabel(line.action, t)}
              </Button>
            ) : null}
          </Stack>
        ))}
        {result.footnote ? (
          <Typography variant="caption" color="text.secondary">
            {result.footnote}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
};

function actionLabel(
  action: string,
  t: (key: string, fallback: string) => string
): string {
  if (action === 'showLocation') {
    return t('business.locations.expectations.showCta', 'Show this location');
  }
  if (action === 'verifyPhone') {
    return t('mobilePaymentPhone.verifyCta', 'Verify mobile money number');
  }
  if (action === 'addPhone') {
    return t('mobilePaymentPhone.addOrLinkCta', 'Add or link mobile money number');
  }
  return t('business.locations.manageItems', 'Manage items');
}

export default LocationExpectationsCard;
