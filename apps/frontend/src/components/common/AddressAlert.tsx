import { LocationOn } from '@mui/icons-material';
import { Alert, AlertTitle, Button, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';

interface AddressAlertProps {
  show?: boolean;
  variant?: 'standard' | 'filled' | 'outlined';
  severity?: 'warning' | 'info' | 'error';
  sx?: any;
}

const AddressAlert: React.FC<AddressAlertProps> = ({
  show = true,
  variant = 'standard',
  severity = 'warning',
  sx = {},
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();

  // Don't show if explicitly disabled
  if (!show) return null;

  // Don't show if user has addresses
  const hasAddresses = profile?.addresses && profile.addresses.length > 0;
  if (hasAddresses) return null;

  const handleAddAddress = () => {
    navigate('/profile');
  };

  return (
    <Alert
      severity={severity}
      variant={variant}
      icon={<LocationOn />}
      action={
        <Button
          color="inherit"
          size="small"
          onClick={handleAddAddress}
          sx={{ fontWeight: 600 }}
        >
          {t('addresses.addAddress')}
        </Button>
      }
      sx={{
        mb: 3,
        '& .MuiAlert-message': {
          width: '100%',
        },
        ...sx,
      }}
    >
      <AlertTitle sx={{ fontWeight: 600 }}>
        {t('addresses.missingAddressTitle')}
      </AlertTitle>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {t('addresses.missingAddressMessage')}
      </Typography>
    </Alert>
  );
};

export default AddressAlert;
