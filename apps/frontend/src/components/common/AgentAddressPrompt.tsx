import {
  Add as AddIcon,
  LocationOn as LocationIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import AddressDialog, { AddressFormData } from '../dialogs/AddressDialog';

interface AgentAddressPromptProps {
  onAddressAdded?: () => void;
  showAsCard?: boolean;
}

const AgentAddressPrompt: React.FC<AgentAddressPromptProps> = ({
  onAddressAdded,
  showAsCard = true,
}) => {
  const { t } = useTranslation();
  const { profile, addAddress, refetch } = useUserProfileContext();
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressFormData>({
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    address_type: 'home',
    is_primary: true,
  });

  // Check if agent has any addresses from profile context
  const hasAddresses = profile?.addresses && profile.addresses.length > 0;

  // If agent has addresses, don't show the prompt
  if (hasAddresses) {
    return null;
  }

  const handleAddAddress = () => {
    setAddressForm({
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      address_type: 'home',
      is_primary: true,
    });
    setAddressDialogOpen(true);
  };

  const handleAddressChange = (address: AddressFormData) => {
    setAddressForm(address);
  };

  const handleSaveAddress = async () => {
    if (!profile?.agent?.id) {
      return;
    }

    setSaving(true);
    try {
      // Ensure required fields are set
      const addressData = {
        ...addressForm,
        address_type: addressForm.address_type || 'home',
        is_primary: addressForm.is_primary ?? true,
      };

      const success = await addAddress(addressData, 'agent', profile.agent.id);

      if (success) {
        setAddressDialogOpen(false);
        await refetch(); // Update context with new address data
        onAddressAdded?.();
      }
      // If save fails, error is handled by context and dialog stays open
    } catch (error) {
      // Error is handled by context
      console.error('Error saving address:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setAddressDialogOpen(false);
  };

  const content = (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      <LocationIcon
        color="warning"
        sx={{ fontSize: 64, mb: 2, opacity: 0.7 }}
      />
      <Typography variant="h5" gutterBottom color="text.primary">
        {t('agent.addressPrompt.title', 'Add Your Address')}
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}
      >
        {t(
          'agent.addressPrompt.description',
          'To see and accept open delivery orders, you need to add your primary address. The system will only show you orders in your vicinity (same country and state) to ensure efficient deliveries.'
        )}
      </Typography>

      <Alert
        severity="info"
        icon={<WarningIcon />}
        sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}
      >
        <Typography variant="body2">
          {t(
            'agent.addressPrompt.benefits',
            'Adding your primary address will:'
          )}
        </Typography>
        <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2, textAlign: 'left' }}>
          <li>
            {t(
              'agent.addressPrompt.benefit1',
              'Show you only orders in your area (same country and state)'
            )}
          </li>
          <li>
            {t(
              'agent.addressPrompt.benefit2',
              'Enable you to see and accept open delivery orders'
            )}
          </li>
          <li>
            {t(
              'agent.addressPrompt.benefit3',
              'Reduce travel time and improve delivery efficiency'
            )}
          </li>
          <li>
            {t(
              'agent.addressPrompt.benefit4',
              'Help calculate accurate delivery routes and fees'
            )}
          </li>
        </Box>
      </Alert>

      <Button
        variant="contained"
        size="large"
        startIcon={<AddIcon />}
        onClick={handleAddAddress}
        sx={{ minWidth: 200 }}
      >
        {t('agent.addressPrompt.addAddress', 'Add Address')}
      </Button>
    </Box>
  );

  return (
    <>
      {showAsCard ? (
        <Card sx={{ mb: 3 }}>
          <CardContent>{content}</CardContent>
        </Card>
      ) : (
        content
      )}

      {/* Address Dialog */}
      <AddressDialog
        open={addressDialogOpen}
        title={t('agent.addressPrompt.addAddress', 'Add Address')}
        addressData={addressForm}
        loading={saving}
        showAddressType={true}
        showIsPrimary={true}
        onClose={handleCloseDialog}
        onSave={handleSaveAddress}
        onAddressChange={handleAddressChange}
      />
    </>
  );
};

export default AgentAddressPrompt;
