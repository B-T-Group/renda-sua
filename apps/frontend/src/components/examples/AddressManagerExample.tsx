import { Box, Container, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import AddressManager from '../common/AddressManager';

/**
 * Example component demonstrating how to use the AddressManager
 * for different entity types (agent, client, business)
 */
const AddressManagerExample: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();

  if (!profile) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          Please log in to view address management examples
        </Typography>
      </Container>
    );
  }

  // Get the appropriate entity ID based on user type
  const getEntityId = () => {
    switch (profile.user_type_id) {
      case 'agent':
        return profile.agent?.id;
      case 'client':
        return profile.client?.id;
      case 'business':
        return profile.business?.id;
      default:
        return undefined;
    }
  };

  const entityId = getEntityId();

  if (!entityId) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          Profile not complete. Please complete your profile first.
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Address Manager Examples
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Examples of how to use the reusable AddressManager component for
            different entity types.
          </Typography>
        </Box>

        {/* Basic Usage */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Basic Usage
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Default configuration with all features enabled
          </Typography>
          <AddressManager
            entityType={profile.user_type_id as 'agent' | 'client' | 'business'}
            entityId={entityId}
          />
        </Box>

        {/* Custom Configuration */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Custom Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Limited to 2 addresses, no coordinates, custom title
          </Typography>
          <AddressManager
            entityType={profile.user_type_id as 'agent' | 'client' | 'business'}
            entityId={entityId}
            title="Delivery Addresses"
            maxAddresses={2}
            showCoordinates={false}
            addressTypeOptions={[
              { value: 'home', label: 'Home' },
              { value: 'work', label: 'Work' },
              { value: 'delivery', label: 'Delivery' },
            ]}
            emptyStateMessage="No delivery addresses configured yet."
          />
        </Box>

        {/* Business-Specific Usage */}
        {profile.user_type_id === 'business' && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Business-Specific Usage
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Business addresses with store/warehouse/office types
            </Typography>
            <AddressManager
              entityType="business"
              entityId={entityId}
              title="Business Locations"
              showCoordinates={true}
              addressTypeOptions={[
                { value: 'store', label: 'Store' },
                { value: 'warehouse', label: 'Warehouse' },
                { value: 'office', label: 'Office' },
              ]}
              emptyStateMessage="No business locations configured yet."
            />
          </Box>
        )}

        {/* Read-Only Usage */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Read-Only Usage
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            View-only mode with delete disabled
          </Typography>
          <AddressManager
            entityType={profile.user_type_id as 'agent' | 'client' | 'business'}
            entityId={entityId}
            title="View Addresses"
            allowDelete={false}
            emptyStateMessage="No addresses to display."
          />
        </Box>
      </Stack>
    </Container>
  );
};

export default AddressManagerExample;
