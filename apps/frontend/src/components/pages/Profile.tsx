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
import { City, Country, State } from 'country-state-city';
import React, { useEffect, useState } from 'react';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useMtnMomoTopUp } from '../../hooks/useMtnMomoTopUp';
import { useProfile } from '../../hooks/useProfile';
import TopUpModal from '../business/TopUpModal';

interface AddressFormData {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  address_type: string;
  is_primary: boolean;
}

const Profile: React.FC = () => {
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);

  // Form states
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
  });

  const [addressForm, setAddressForm] = useState<AddressFormData>({
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    address_type: 'home',
    is_primary: false,
  });

  const [accountForm, setAccountForm] = useState({
    currency: '',
  });

  // Location data
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

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

  // Update states when country changes
  useEffect(() => {
    if (addressForm.country) {
      setStates(State.getStatesOfCountry(addressForm.country));
      setAddressForm((prev) => ({ ...prev, state: '', city: '' }));
    }
  }, [addressForm.country]);

  // Update cities when state changes
  useEffect(() => {
    if (addressForm.country && addressForm.state) {
      setCities(City.getCitiesOfState(addressForm.country, addressForm.state));
      setAddressForm((prev) => ({ ...prev, city: '' }));
    }
  }, [addressForm.country, addressForm.state]);

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

  const onAddressSave = async () => {
    if (!userProfile || !userProfileWithAddresses) return;

    // Get the correct profile ID based on user type
    let profileId: string | undefined;
    switch (userProfileWithAddresses.user_type_id) {
      case 'client':
        profileId = userProfileWithAddresses.client?.id;
        break;
      case 'agent':
        profileId = userProfileWithAddresses.agent?.id;
        break;
      case 'business':
        profileId = userProfileWithAddresses.business?.id;
        break;
    }

    if (!profileId) {
      console.error(
        'Profile ID not found for user type:',
        userProfileWithAddresses.user_type_id
      );
      return;
    }

    const success = await handleAddressSave(
      userProfile.id,
      addressForm,
      editingAddress || undefined,
      userProfileWithAddresses.user_type_id,
      profileId
    );

    if (success) {
      setAddressDialogOpen(false);
      setEditingAddress(null);
      setAddressForm({
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
        address_type: 'home',
        is_primary: false,
      });
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

  const handleEditAddress = (address: any) => {
    setAddressForm({
      address_line_1: address.address_line_1,
      address_line_2: address.address_line_2 || '',
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country,
      address_type: address.address_type,
      is_primary: address.is_primary,
    });
    setEditingAddress(address.id);
    setAddressDialogOpen(true);
  };

  const handleAddAddress = () => {
    setAddressForm({
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      address_type: 'home',
      is_primary: false,
    });
    setEditingAddress(null);
    setAddressDialogOpen(true);
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
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={profileForm.phone_number}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      phone_number: e.target.value,
                    }))
                  }
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
        <Card>
          <CardContent>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">Addresses</Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddAddress}
              >
                Add Address
              </Button>
            </Box>

            {addresses.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No addresses added yet.
              </Typography>
            ) : (
              <Box>
                {addresses.map((address) => (
                  <Box
                    key={address.id}
                    mb={2}
                    p={2}
                    border={1}
                    borderColor="divider"
                    borderRadius={1}
                  >
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="flex-start"
                    >
                      <Box flex={1}>
                        <Typography variant="subtitle2">
                          {address.address_type}{' '}
                          {address.is_primary && (
                            <Chip
                              label="Primary"
                              size="small"
                              color="primary"
                            />
                          )}
                        </Typography>
                        <Typography variant="body2">
                          {address.address_line_1}
                          {address.address_line_2 &&
                            `, ${address.address_line_2}`}
                        </Typography>
                        <Typography variant="body2">
                          {address.city}, {address.state} {address.postal_code}
                        </Typography>
                        <Typography variant="body2">
                          {address.country}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleEditAddress(address)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
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

      {/* Address Dialog */}
      <Dialog
        open={addressDialogOpen}
        onClose={() => setAddressDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingAddress ? 'Edit Address' : 'Add New Address'}
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
              mt: 1,
            }}
          >
            <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
              <TextField
                fullWidth
                label="Address Line 1"
                value={addressForm.address_line_1}
                onChange={(e) =>
                  setAddressForm((prev) => ({
                    ...prev,
                    address_line_1: e.target.value,
                  }))
                }
                required
              />
            </Box>
            <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
              <TextField
                fullWidth
                label="Address Line 2 (Optional)"
                value={addressForm.address_line_2}
                onChange={(e) =>
                  setAddressForm((prev) => ({
                    ...prev,
                    address_line_2: e.target.value,
                  }))
                }
              />
            </Box>
            <FormControl fullWidth required>
              <InputLabel>Country</InputLabel>
              <Select
                value={addressForm.country}
                onChange={(e) =>
                  setAddressForm((prev) => ({
                    ...prev,
                    country: e.target.value,
                  }))
                }
                label="Country"
              >
                {countries.map((country) => (
                  <MenuItem key={country.isoCode} value={country.isoCode}>
                    {country.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>State/Province</InputLabel>
              <Select
                value={addressForm.state}
                onChange={(e) =>
                  setAddressForm((prev) => ({ ...prev, state: e.target.value }))
                }
                label="State/Province"
                disabled={!addressForm.country}
              >
                {states.map((state) => (
                  <MenuItem key={state.isoCode} value={state.isoCode}>
                    {state.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>City</InputLabel>
              <Select
                value={addressForm.city}
                onChange={(e) =>
                  setAddressForm((prev) => ({ ...prev, city: e.target.value }))
                }
                label="City"
                disabled={!addressForm.state}
              >
                {cities.map((city) => (
                  <MenuItem key={city.name} value={city.name}>
                    {city.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Postal Code"
              value={addressForm.postal_code}
              onChange={(e) =>
                setAddressForm((prev) => ({
                  ...prev,
                  postal_code: e.target.value,
                }))
              }
              required
            />
            <FormControl fullWidth>
              <InputLabel>Address Type</InputLabel>
              <Select
                value={addressForm.address_type}
                onChange={(e) =>
                  setAddressForm((prev) => ({
                    ...prev,
                    address_type: e.target.value,
                  }))
                }
                label="Address Type"
              >
                <MenuItem value="home">Home</MenuItem>
                <MenuItem value="work">Work</MenuItem>
                <MenuItem value="delivery">Delivery</MenuItem>
                <MenuItem value="billing">Billing</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Primary Address</InputLabel>
              <Select
                value={addressForm.is_primary.toString()}
                onChange={(e) =>
                  setAddressForm((prev) => ({
                    ...prev,
                    is_primary: e.target.value === 'true',
                  }))
                }
                label="Primary Address"
              >
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddressDialogOpen(false)}>Cancel</Button>
          <Button onClick={onAddressSave} variant="contained">
            Save Address
          </Button>
        </DialogActions>
      </Dialog>

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
