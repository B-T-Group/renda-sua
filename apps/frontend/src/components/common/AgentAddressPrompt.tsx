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
import { useAddressManager } from '../../hooks/useAddressManager';
import { useUserProfile } from '../../hooks/useUserProfile';
import AddressManager from './AddressManager';

interface AgentAddressPromptProps {
  onAddressAdded?: () => void;
  showAsCard?: boolean;
}

const AgentAddressPrompt: React.FC<AgentAddressPromptProps> = ({
  onAddressAdded,
  showAsCard = true,
}) => {
  const { t } = useTranslation();
  const { profile } = useUserProfile();
  const [showAddressManager, setShowAddressManager] = useState(false);

  // Get agent addresses using the address manager hook
  const { addresses } = useAddressManager({
    entityType: 'agent',
    entityId: profile?.agent?.id || '',
    autoFetch: true,
  });

  // Check if agent has any addresses
  const hasAddresses = addresses && addresses.length > 0;

  // If agent has addresses, don't show the prompt
  if (hasAddresses) {
    return null;
  }

  const handleAddAddress = () => {
    setShowAddressManager(true);
  };

  const handleAddressAdded = () => {
    setShowAddressManager(false);
    onAddressAdded?.();
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

      {/* Address Manager Dialog */}
      {showAddressManager && (
        <AddressManager
          entityType="agent"
          entityId={profile?.agent?.id || ''}
          title={t('agent.addressPrompt.addAddress', 'Add Address')}
          showAddressType={true}
          showIsPrimary={true}
          maxAddresses={5}
          allowDelete={true}
          emptyStateMessage={t(
            'agent.addressPrompt.noAddresses',
            'No addresses found. Add your primary address to see orders in your vicinity.'
          )}
          onAccountCreated={handleAddressAdded}
        />
      )}
    </>
  );
};

export default AgentAddressPrompt;
