import { Avatar, Button, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BusinessLocation } from '../../hooks/useBusinessLocations';
import { formatOperatingHoursSummary } from '../../utils/operatingHours';

interface LocationCardProps {
  location: BusinessLocation;
  isStripeRail?: boolean;
  railLoading?: boolean;
  onSettings: (location: BusinessLocation) => void;
  onHours: (location: BusinessLocation) => void;
  onViewItems?: (location: BusinessLocation) => void;
}

const LocationCard: React.FC<LocationCardProps> = ({
  location,
  isStripeRail = false,
  railLoading = false,
  onSettings,
  onHours,
  onViewItems,
}) => {
  const { t } = useTranslation();
  const address = [
    location.address?.address_line_1,
    location.address?.city,
  ]
    .filter(Boolean)
    .join(', ');
  const warning = cardWarning(location, isStripeRail || railLoading, t);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, height: '100%' }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Avatar src={location.logo_url || undefined} alt={location.name}>
            {location.name.slice(0, 1)}
          </Avatar>
          <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {location.name}
            </Typography>
            {address ? (
              <Typography variant="body2" color="text.secondary">
                {address}
              </Typography>
            ) : null}
            <Typography variant="body2" color={location.is_active ? 'success.main' : 'text.secondary'}>
              {location.is_active
                ? t('business.locations.card.open', 'Open for customers')
                : t('business.locations.card.hidden', 'Hidden from customers')}
            </Typography>
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {formatOperatingHoursSummary(location.operating_hours, t)}
          {!isStripeRail && location.pay_at_confirm
            ? ` · ${t('business.locations.payAfter.label', 'Ask customers to pay after you confirm')}`
            : ''}
        </Typography>
        {warning ? (
          <Typography variant="body2" color="warning.dark">
            {warning}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button variant="contained" onClick={() => onSettings(location)}>
            {t('business.locations.card.settings', 'Settings')}
          </Button>
          <Button variant="outlined" onClick={() => onHours(location)}>
            {t('business.locations.hours.setNow', 'Set hours')}
          </Button>
          {onViewItems ? (
            <Button variant="text" onClick={() => onViewItems(location)}>
              {t('business.locations.manageItems', 'Manage items')}
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
};

function cardWarning(
  location: BusinessLocation,
  isStripeRail: boolean,
  t: (key: string, fallback: string) => string
): string | null {
  if (isStripeRail) return null;
  const linked = location.mobile_payment_phone;
  if (!linked) {
    return t(
      'business.locations.card.addPhone',
      'Add a Mobile Money number'
    );
  }
  if (!linked.is_verified) {
    return t(
      'business.locations.card.verifyPhone',
      'Verify your mobile money number'
    );
  }
  return null;
}

export default LocationCard;
