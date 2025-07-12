import {
  Cancel as CancelIcon,
  Edit as EditIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useMtnMomoTopUp } from '../../hooks/useMtnMomoTopUp';
import { useProfile } from '../../hooks/useProfile';
import TopUpModal from '../business/TopUpModal';
import AccountManager from '../common/AccountManager';
import AddressManager from '../common/AddressManager';
import PhoneInput from '../common/PhoneInput';

const Profile: React.FC = () => {
  const [editingProfile, setEditingProfile] = useState(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);

  // Form states
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
  });

  // Custom hooks
  const {
    userProfile,
    loading,
    error,
    successMessage,
    errorMessage,
    handleProfileUpdate,
    clearMessages,
  } = useProfile();

  const { requestTopUp, loading: topUpLoading } = useMtnMomoTopUp();

  // Get addresses from UserProfileContext
  const { profile: userProfileWithAddresses } = useUserProfileContext();

  // Update form when data loads
  useEffect(() => {
    if (userProfile) {
      setProfileForm({
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        phone_number: userProfile.phone_number || '',
      });
    }
  }, [userProfile]);

  const handleProfileSave = async () => {
    if (!userProfile) return;

    const success = await handleProfileUpdate(
      userProfile.id,
      profileForm.first_name,
      profileForm.last_name,
      profileForm.phone_number
    );

    if (success) {
      setEditingProfile(false);
    }
  };

  const capitalizeUserType = (userType: string) => {
    return userType.charAt(0).toUpperCase() + userType.slice(1);
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">Failed to load profile data: {error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Success/Error Messages */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={clearMessages}>
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearMessages}>
          {errorMessage}
        </Alert>
      )}

      <Typography variant="h4" gutterBottom>
        Profile Settings
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
        }}
      >
        {/* Profile Information */}
        <Card>
          <CardContent>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">Personal Information</Typography>
              <IconButton
                onClick={() => setEditingProfile(!editingProfile)}
                color="primary"
              >
                {editingProfile ? <CancelIcon /> : <EditIcon />}
              </IconButton>
            </Box>

            {editingProfile ? (
              <Box>
                <TextField
                  fullWidth
                  label="First Name"
                  value={profileForm.first_name}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      first_name: e.target.value,
                    }))
                  }
                  margin="normal"
                />
                <TextField
                  fullWidth
                  label="Last Name"
                  value={profileForm.last_name}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      last_name: e.target.value,
                    }))
                  }
                  margin="normal"
                />
                <PhoneInput
                  value={profileForm.phone_number}
                  onChange={(value) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      phone_number: value || '',
                    }))
                  }
                  label="Phone Number"
                  margin="normal"
                />
                <Box mt={2}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleProfileSave}
                  >
                    Save Changes
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box>
                <Typography variant="body1">
                  <strong>Name:</strong> {userProfile?.first_name}{' '}
                  {userProfile?.last_name}
                </Typography>
                <Typography variant="body1">
                  <strong>Email:</strong> {userProfile?.email}
                </Typography>
                <Typography variant="body1">
                  <strong>Phone:</strong> {userProfile?.phone_number}
                </Typography>
                <Typography variant="body1">
                  <strong>Member since:</strong>{' '}
                  {new Date(userProfile?.created_at || '').toLocaleDateString()}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Addresses */}
        {userProfileWithAddresses && (
          <AddressManager
            entityType={
              userProfileWithAddresses.user_type_id as
                | 'agent'
                | 'client'
                | 'business'
            }
            entityId={
              userProfileWithAddresses.user_type_id === 'agent'
                ? userProfileWithAddresses.agent?.id || ''
                : userProfileWithAddresses.user_type_id === 'client'
                ? userProfileWithAddresses.client?.id || ''
                : userProfileWithAddresses.business?.id || ''
            }
            title="Personal Addresses"
            showCoordinates={false}
          />
        )}
      </Box>

      {/* Accounts */}
      {userProfile && (
        <Box sx={{ mt: 3 }}>
          <AccountManager
            entityType={
              userProfile.user_type_id as 'agent' | 'client' | 'business'
            }
            entityId={userProfile.id}
            title="Account Overview"
            showTransactions={true}
            showTotalSummary={true}
            maxTransactions={10}
            emptyStateMessage="No accounts found. Accounts are automatically created when you make your first transaction."
          />
        </Box>
      )}

      {/* Top Up Modal */}
      {selectedAccount && (
        <TopUpModal
          open={topUpModalOpen}
          onClose={() => setTopUpModalOpen(false)}
          userPhoneNumber={userProfile?.phone_number || ''}
          currency={selectedAccount.currency}
          loading={topUpLoading}
          onConfirm={async (phone: string, amount: string) => {
            const ok = await requestTopUp({
              phoneNumber: phone,
              amount,
              currency: selectedAccount.currency,
            });
            return ok;
          }}
        />
      )}
    </Box>
  );
};

export default Profile;
