import {
  Add as AddIcon,
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
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Country } from 'country-state-city';
import React, { useEffect, useState } from 'react';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useMtnMomoTopUp } from '../../hooks/useMtnMomoTopUp';
import { useProfile } from '../../hooks/useProfile';
import TopUpModal from '../business/TopUpModal';
import AddressManager from '../common/AddressManager';
import PhoneInput from '../common/PhoneInput';

const Profile: React.FC = () => {
  const [editingProfile, setEditingProfile] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);

  // Form states
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
  });

  const [accountForm, setAccountForm] = useState({
    currency: '',
  });

  // Location data
  const [countries, setCountries] = useState<any[]>([]);

  // Custom hooks
  const {
    userProfile,
    accounts,
    loading,
    error,
    successMessage,
    errorMessage,
    handleProfileUpdate,
    handleAddressSave,
    handleAccountCreate,
    clearMessages,
  } = useProfile();

  const { requestTopUp, loading: topUpLoading } = useMtnMomoTopUp();

  // Get addresses from UserProfileContext
  const { profile: userProfileWithAddresses } = useUserProfileContext();
  const addresses = userProfileWithAddresses?.addresses || [];

  // Load countries on component mount
  useEffect(() => {
    setCountries(Country.getAllCountries());
  }, []);

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

  const handleAccountSave = async () => {
    if (!userProfile) return;

    const success = await handleAccountCreate(
      userProfile.id,
      userProfile.user_type_id,
      accountForm.currency
    );

    if (success) {
      setAccountDialogOpen(false);
      setAccountForm({
        currency: '',
      });
    }
  };

  const handleAddAccount = () => {
    setAccountForm({
      currency: '',
    });
    setAccountDialogOpen(true);
  };

  const getCurrencyForCountry = (countryCode: string) => {
    const country = Country.getCountryByCode(countryCode);
    return country?.currency || 'USD';
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
                  label="Phone Number"
                  value={profileForm.phone_number}
                  onChange={(value) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      phone_number: value || '',
                    }))
                  }
                  defaultCountry="CM"
                  fullWidth
                  required
                  error={false}
                  margin="normal"
                  placeholder="Enter phone number"
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
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6">Accounts</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddAccount}
            >
              Add Account
            </Button>
          </Box>

          {accounts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No accounts created yet.
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)',
                },
                gap: 2,
              }}
            >
              {accounts.map((account) => (
                <Card key={account.id} variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {account.currency} Account
                    </Typography>
                    <Typography variant="h4">
                      ${account.available_balance.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Available Balance
                    </Typography>
                    <Typography variant="body2">
                      Total: ${account.total_balance.toFixed(2)}
                    </Typography>
                    <Chip
                      label={account.currency}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setSelectedAccount(account);
                        setTopUpModalOpen(true);
                      }}
                      sx={{ ml: 2 }}
                    >
                      Top Up
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Account Dialog */}
      <Dialog
        open={accountDialogOpen}
        onClose={() => setAccountDialogOpen(false)}
      >
        <DialogTitle>
          Add New{' '}
          {userProfile ? capitalizeUserType(userProfile.user_type_id) : 'User'}{' '}
          Account
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              This account will be created as a{' '}
              {userProfile
                ? capitalizeUserType(userProfile.user_type_id)
                : 'user'}{' '}
              account.
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Currency</InputLabel>
              <Select
                value={accountForm.currency}
                onChange={(e) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    currency: e.target.value,
                  }))
                }
                label="Currency"
              >
                {countries.map((country) => {
                  const currency = getCurrencyForCountry(country.isoCode);
                  return (
                    <MenuItem key={country.isoCode} value={currency}>
                      {currency} - {country.name}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccountDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAccountSave} variant="contained">
            Create Account
          </Button>
        </DialogActions>
      </Dialog>

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
