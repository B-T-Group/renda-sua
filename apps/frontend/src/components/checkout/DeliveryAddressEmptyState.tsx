import { LocationOn, MyLocation } from '@mui/icons-material';
import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CurrentLocationAddressStatus } from '../../hooks/useCurrentLocationAddress';

interface DeliveryAddressEmptyStateProps {
  status: CurrentLocationAddressStatus;
  onUseCurrentLocation: () => void;
  onAddAddress: () => void;
  allowCurrentLocation?: boolean;
  title?: string;
  hint?: string;
  addLabel?: string;
}

export const DeliveryAddressEmptyState: React.FC<DeliveryAddressEmptyStateProps> = ({
  status,
  onUseCurrentLocation,
  onAddAddress,
  allowCurrentLocation = true,
  title,
  hint,
  addLabel,
}) => {
  const { t } = useTranslation();
  const resolving = status === 'resolving' && allowCurrentLocation;
  const denied = status === 'denied';
  const showCurrentLocation = allowCurrentLocation && !denied;

  return (
    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
      <LocationOn sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
      <Typography variant="subtitle1" gutterBottom>
        {title ??
          (denied
            ? t('orders.currentLocationDenied', 'Location access was denied')
            : t('orders.noAddresses', 'No delivery address found'))}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {hint ??
          (resolving
            ? t('orders.currentLocationResolving', 'Finding your current location…')
            : denied
              ? t(
                  'orders.currentLocationDeniedHint',
                  'Add a delivery address to continue.'
                )
              : t(
                  'orders.useCurrentLocationHint',
                  'Use your current location, or add an address.'
                ))}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
        {showCurrentLocation ? (
          <Button
            variant="contained"
            startIcon={resolving ? <CircularProgress size={16} color="inherit" /> : <MyLocation />}
            onClick={onUseCurrentLocation}
            disabled={resolving}
          >
            {t('orders.useCurrentLocation', 'Use my current location')}
          </Button>
        ) : null}
        <Button
          variant={showCurrentLocation ? 'outlined' : 'contained'}
          onClick={onAddAddress}
          disabled={resolving}
        >
          {addLabel ?? t('orders.addAddress', 'Add Delivery Address')}
        </Button>
      </Box>
    </Paper>
  );
};
