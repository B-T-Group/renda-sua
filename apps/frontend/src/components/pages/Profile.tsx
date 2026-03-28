import {
  Cancel as CancelIcon,
  CameraAlt as CameraAltIcon,
  ChevronRight as ChevronRightIcon,
  Description as DescriptionIcon,
  Edit as EditIcon,
  LocationOn as LocationOnIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import {
  type UserProfile,
  type UserType,
  useUserProfileContext,
} from '../../contexts/UserProfileContext';
import { useApiClient } from '../../hooks/useApiClient';
import { useVehicleTypes } from '../../hooks/useVehicleTypes';

import AccountManager, { AccountManagerRef } from '../common/AccountManager';
import AddressManager from '../common/AddressManager';
import PhoneInput from '../common/PhoneInput';

const PROFILE_PICTURE_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp';
const PROFILE_PICTURE_MAX_SIZE = 5 * 1024 * 1024; // 5MB

function resolveAddressEntity(
  profile: UserProfile,
  active: UserType | null
): { entityType: UserType; entityId: string } {
  if (active === 'agent' && profile.agent?.id) {
    return { entityType: 'agent', entityId: profile.agent.id };
  }
  if (active === 'business' && profile.business?.id) {
    return { entityType: 'business', entityId: profile.business.id };
  }
  if (active === 'client' && profile.client?.id) {
    return { entityType: 'client', entityId: profile.client.id };
  }
  if (profile.client?.id) return { entityType: 'client', entityId: profile.client.id };
  if (profile.agent?.id) return { entityType: 'agent', entityId: profile.agent.id };
  if (profile.business?.id) {
    return { entityType: 'business', entityId: profile.business.id };
  }
  return { entityType: 'client', entityId: '' };
}

function accountEntityTypeForProfile(
  profile: UserProfile,
  active: UserType | null
): UserType {
  if (active) return active;
  if (profile.client) return 'client';
  if (profile.agent) return 'agent';
  if (profile.business) return 'business';
  return 'client';
}

const PERSONA_CONFIRM_DEFAULTS: Record<
  UserType,
  { title: string; body: string }
> = {
  client: {
    title: 'Enable shopping as a client?',
    body:
      'You can browse items, place orders, save delivery addresses, and use your client wallet. You can switch between client, agent, and business modes anytime from your profile or the header.',
  },
  agent: {
    title: 'Become a delivery agent?',
    body:
      'You will see available orders and your active deliveries. On the next step you will choose a vehicle type. You may need to upload ID documents under Manage Documents before you can accept deliveries.',
  },
  business: {
    title: 'Open a business profile?',
    body:
      'You can run a store: catalog, orders, locations, and rentals depending on your focus. On the next step you will enter your business name and whether you mainly sell products or rent items.',
  },
};

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const [editingProfile, setEditingProfile] = useState(false);

  // Form states
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
  });

  // Get profile data from UserProfileContext
  const {
    profile,
    loading,
    error,
    successMessage,
    errorMessage,
    updateProfile,
    updateProfilePicture,
    clearMessages,
    refetch,
    personas,
    userType: activePersona,
  } = useUserProfileContext();

  const apiClient = useApiClient();
  const { vehicleTypes } = useVehicleTypes();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profilePictureUploading, setProfilePictureUploading] = useState(false);
  const [personaSubmitting, setPersonaSubmitting] = useState(false);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [businessDialogOpen, setBusinessDialogOpen] = useState(false);
  const [vehicleTypeId, setVehicleTypeId] = useState('other');
  const [businessName, setBusinessName] = useState('');
  const [businessMainInterest, setBusinessMainInterest] = useState<
    'sell_items' | 'rent_items'
  >('sell_items');
  const [personaConfirmTarget, setPersonaConfirmTarget] =
    useState<UserType | null>(null);

  // Ref to access AccountManager's refresh function
  const accountManagerRef = useRef<AccountManagerRef | null>(null);

  // Update form when data loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone_number: profile.phone_number || '',
      });
    }
  }, [profile]);

  const handleProfileSave = async () => {
    if (!profile) return;

    const success = await updateProfile(
      profile.id,
      profileForm.first_name,
      profileForm.last_name,
      profileForm.phone_number
    );

    if (success) {
      setEditingProfile(false);
    }
  };

  const handleProfilePictureChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !profile || !apiClient) return;
    if (file.size > PROFILE_PICTURE_MAX_SIZE) {
      return; // TODO: show error via context or snackbar
    }
    const acceptedTypes = PROFILE_PICTURE_ACCEPT.split(',');
    if (!acceptedTypes.includes(file.type)) return;

    setProfilePictureUploading(true);
    try {
      const { data } = await apiClient.post<{
        success: boolean;
        presigned_url?: string;
        final_url?: string;
        error?: string;
      }>('/users/profile-picture/presigned-url', {
        contentType: file.type,
        fileName: file.name,
        fileSize: file.size,
      });
      if (!data.success || !data.presigned_url || !data.final_url) {
        throw new Error(data.error || 'Failed to get upload URL');
      }
      await axios.put(data.presigned_url, file, {
        headers: { 'Content-Type': file.type },
      });
      const updated = await updateProfilePicture(profile.id, data.final_url);
      if (updated && fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Profile picture upload failed:', err);
    } finally {
      setProfilePictureUploading(false);
    }
  };

  // Handle account creation from address creation
  const postAddPersona = async (
    persona: UserType,
    body: Record<string, unknown> = {}
  ) => {
    if (!apiClient || !profile) return;
    setPersonaSubmitting(true);
    setPersonaError(null);
    try {
      await apiClient.post(`/users/me/personas/${persona}`, body);
      await refetch();
      setAgentDialogOpen(false);
      setBusinessDialogOpen(false);
      setBusinessName('');
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        t('profile.addPersonaError', 'Could not update your account modes.');
      setPersonaError(msg);
    } finally {
      setPersonaSubmitting(false);
    }
  };

  const closePersonaConfirm = () => setPersonaConfirmTarget(null);

  const handlePersonaConfirmContinue = () => {
    if (!personaConfirmTarget) return;
    const target = personaConfirmTarget;
    setPersonaConfirmTarget(null);
    if (target === 'client') {
      void postAddPersona('client', {});
      return;
    }
    if (target === 'agent') {
      setAgentDialogOpen(true);
      return;
    }
    setBusinessDialogOpen(true);
  };

  const handleConfirmAgentPersona = () =>
    postAddPersona('agent', { vehicle_type_id: vehicleTypeId || 'other' });

  const handleConfirmBusinessPersona = () => {
    const fallback =
      profile?.first_name?.trim() != null && profile.first_name.trim() !== ''
        ? `${profile.first_name.trim()}'s Business`
        : t('profile.defaultBusinessName', 'My business');
    const name = businessName.trim() || fallback;
    postAddPersona('business', {
      name,
      main_interest: businessMainInterest,
    });
  };

  const handleAccountCreated = async (account: {
    id: string;
    [key: string]: unknown;
  }) => {
    console.log('New account created:', account);
    // Refresh the accounts list
    if (accountManagerRef.current) {
      await accountManagerRef.current.fetchAccounts();
    }
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
        <Alert severity="error">
          {t('profile.failedToLoad', 'Failed to load profile data: {{error}}', {
            error,
          })}
        </Alert>
      </Box>
    );
  }

  const addressEntity =
    profile && resolveAddressEntity(profile, activePersona);
  const accountEntityType =
    profile && accountEntityTypeForProfile(profile, activePersona);

  return (
    <Container
      maxWidth="lg"
      sx={{
        py: { xs: 2, sm: 3 },
        px: { xs: 2, sm: 3 },
        width: '100%',
      }}
    >
      {/* Success/Error Messages */}
      {(successMessage || errorMessage) && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {successMessage && (
            <Alert severity="success" onClose={clearMessages}>
              {successMessage}
            </Alert>
          )}
          {errorMessage && (
            <Alert severity="error" onClose={clearMessages}>
              {errorMessage}
            </Alert>
          )}
        </Stack>
      )}

      {personaError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPersonaError(null)}>
          {personaError}
        </Alert>
      )}

      <Typography
        variant="h5"
        component="h1"
        sx={{
          fontWeight: 500,
          color: 'text.primary',
          mb: 3,
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
        }}
      >
        {t('profile.title')}
      </Typography>

      <Grid container spacing={3} sx={{ width: '100%' }}>
        {/* Profile card: avatar + personal info */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ overflow: 'hidden' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              {/* Avatar and name block */}
              <Stack alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                <Box sx={{ position: 'relative' }}>
                  <Avatar
                    src={profile?.profile_picture_url}
                    sx={{
                      width: 96,
                      height: 96,
                      bgcolor: 'grey.200',
                      color: 'grey.600',
                      fontSize: '1.75rem',
                    }}
                  >
                    {profile?.first_name?.[0]}
                    {profile?.last_name?.[0]}
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={PROFILE_PICTURE_ACCEPT}
                    onChange={handleProfilePictureChange}
                    style={{ display: 'none' }}
                  />
                  <IconButton
                    size="small"
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      minWidth: 40,
                      minHeight: 40,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={profilePictureUploading}
                    aria-label={t('profile.changePhoto', 'Change photo')}
                  >
                    {profilePictureUploading ? (
                      <CircularProgress size={20} />
                    ) : (
                      <CameraAltIcon sx={{ fontSize: 20 }} />
                    )}
                  </IconButton>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 500 }}>
                  {profile?.first_name} {profile?.last_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'profile.profilePictureHint',
                    'JPG, PNG or WebP. Max 5MB.'
                  )}
                </Typography>
              </Stack>

              {profile?.agent && !profile?.profile_picture_url && (
                <Alert severity="info" sx={{ mb: 2 }} icon={false}>
                  <Typography variant="body2">
                    {t(
                      'profile.agentProfilePictureNote',
                      'Add a profile picture so clients can see who is delivering their order. It helps build trust and makes handoffs smoother.'
                    )}
                  </Typography>
                </Alert>
              )}

              <Divider sx={{ mb: 2 }} />

              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('profile.personalInformation')}
                </Typography>
                <Button
                  size="small"
                  startIcon={editingProfile ? <CancelIcon /> : <EditIcon />}
                  onClick={() => setEditingProfile(!editingProfile)}
                  color={editingProfile ? 'inherit' : 'primary'}
                  sx={{ minHeight: 36 }}
                >
                  {editingProfile ? t('common.cancel') : t('common.edit')}
                </Button>
              </Stack>

              {editingProfile ? (
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label={t('profile.firstName')}
                    value={profileForm.first_name}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, first_name: e.target.value }))
                    }
                    size="small"
                  />
                  <TextField
                    fullWidth
                    label={t('profile.lastName')}
                    value={profileForm.last_name}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, last_name: e.target.value }))
                    }
                    size="small"
                  />
                  <PhoneInput
                    value={profileForm.phone_number}
                    onChange={(value) =>
                      setProfileForm((prev) => ({ ...prev, phone_number: value || '' }))
                    }
                    label={t('profile.phoneNumber')}
                    helperText={t('profile.phoneNumberHelper')}
                    margin="normal"
                    useDevPhoneDropdown
                  />
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleProfileSave}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {t('common.save')}
                  </Button>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('profile.email')}
                    </Typography>
                    <Typography variant="body2">{profile?.email || '—'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('profile.phone')}
                    </Typography>
                    <Typography variant="body2">{profile?.phone_number || '—'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('profile.memberSince')}
                    </Typography>
                    <Typography variant="body2">
                      {profile?.created_at
                        ? new Date(profile.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : '—'}
                    </Typography>
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick links: Documents and Addresses */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={2}>
            {profile && (
              <Card variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('profile.accountModesTitle', 'Account modes')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t(
                    'profile.accountModesHint',
                    'Add another role to shop, sell, rent, or deliver from the same login.'
                  )}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {!personas.includes('client') && (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={personaSubmitting}
                      onClick={() => setPersonaConfirmTarget('client')}
                    >
                      {t('profile.addClientMode', 'Create client account')}
                    </Button>
                  )}
                  {!personas.includes('agent') && (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={personaSubmitting}
                      onClick={() => setPersonaConfirmTarget('agent')}
                    >
                      {t('profile.addAgentMode', 'Become delivery agent')}
                    </Button>
                  )}
                  {!personas.includes('business') && (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={personaSubmitting}
                      onClick={() => setPersonaConfirmTarget('business')}
                    >
                      {t('profile.addBusinessMode', 'Become a business')}
                    </Button>
                  )}
                </Stack>
              </Card>
            )}
            {/* Manage Documents */}
            <Card
              component={RouterLink}
              to="/documents"
              variant="outlined"
              sx={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                p: 2,
                transition: 'border-color 0.2s, background-color 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  bgcolor: 'action.selected',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 2,
                }}
              >
                <DescriptionIcon sx={{ color: 'primary.main', fontSize: 22 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('profile.manageDocuments', 'Manage Documents')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'profile.manageDocumentsDescription',
                    'Upload and manage your verification documents'
                  )}
                </Typography>
              </Box>
              <ChevronRightIcon sx={{ color: 'text.secondary', fontSize: 24 }} />
            </Card>

            {/* Personal Addresses */}
            {profile && (
              <Card variant="outlined" sx={{ overflow: 'hidden' }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 2,
                    pb: 0,
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      bgcolor: 'action.selected',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                    }}
                  >
                    <LocationOnIcon sx={{ color: 'primary.main', fontSize: 22 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {t('profile.personalAddresses', 'Personal Addresses')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'profile.personalAddressesDescription',
                        'Add and manage your delivery and billing addresses'
                      )}
                    </Typography>
                  </Box>
                </Box>
                <CardContent sx={{ pt: 1.5, px: 2, pb: 2 }}>
                  <AddressManager
                    entityType={addressEntity?.entityType ?? 'client'}
                    entityId={addressEntity?.entityId ?? ''}
                    showCoordinates={false}
                    onAccountCreated={handleAccountCreated}
                    embedded
                  />
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>

      {/* Accounts section */}
      {profile && (
        <Box sx={{ mt: 4 }}>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              mb: 2,
              display: 'block',
            }}
          >
            {t('profile.accountOverview')}
          </Typography>
          <AccountManager
            ref={accountManagerRef}
            entityType={accountEntityType ?? 'client'}
            entityId={profile.id}
            showTransactions={true}
            showTotalSummary={true}
            maxTransactions={10}
            compactView={false}
            emptyStateMessage={t('profile.noAccountsMessage')}
          />
        </Box>
      )}

      <Dialog
        open={personaConfirmTarget !== null}
        onClose={closePersonaConfirm}
        fullWidth
        maxWidth="sm"
        aria-labelledby="persona-confirm-title"
        aria-describedby="persona-confirm-description"
        PaperProps={{ sx: { borderRadius: 0 } }}
      >
        {personaConfirmTarget ? (
          <>
            <DialogTitle id="persona-confirm-title">
              {t(
                `profile.personaConfirm.${personaConfirmTarget}.title`,
                PERSONA_CONFIRM_DEFAULTS[personaConfirmTarget].title
              )}
            </DialogTitle>
            <DialogContent>
              <DialogContentText
                id="persona-confirm-description"
                sx={{ color: 'text.secondary' }}
              >
                {t(
                  `profile.personaConfirm.${personaConfirmTarget}.body`,
                  PERSONA_CONFIRM_DEFAULTS[personaConfirmTarget].body
                )}
              </DialogContentText>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={closePersonaConfirm}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button variant="contained" onClick={handlePersonaConfirmContinue}>
                {t('profile.personaConfirm.continue', 'Continue')}
              </Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>

      <Dialog
        open={agentDialogOpen}
        onClose={() => !personaSubmitting && setAgentDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {t('profile.addAgentDialogTitle', 'Delivery agent setup')}
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }} size="small">
            <InputLabel>{t('profile.vehicleType', 'Vehicle type')}</InputLabel>
            <Select
              label={t('profile.vehicleType', 'Vehicle type')}
              value={vehicleTypeId}
              onChange={(e) => setVehicleTypeId(String(e.target.value))}
            >
              {(vehicleTypes.length > 0
                ? vehicleTypes
                : [{ id: 'other', comment: t('profile.vehicleOther', 'Other') }]
              ).map((vt) => (
                <MenuItem key={vt.id} value={vt.id}>
                  {vt.comment || vt.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
            {t(
              'profile.addAgentDialogHint',
              'Upload ID documents from Manage Documents when you are ready.'
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAgentDialogOpen(false)} disabled={personaSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmAgentPersona}
            disabled={personaSubmitting}
          >
            {t('profile.confirmAddAgent', 'Enable agent mode')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={businessDialogOpen}
        onClose={() => !personaSubmitting && setBusinessDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t('profile.addBusinessDialogTitle', 'Business profile')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label={t('completeProfile.businessNameLabel', 'Business name')}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={`${profile?.first_name ?? ''}'s Business`}
            />
            <FormControl fullWidth size="small">
              <InputLabel>{t('completeProfile.mainInterestLabel', 'Focus')}</InputLabel>
              <Select
                label={t('completeProfile.mainInterestLabel', 'Focus')}
                value={businessMainInterest}
                onChange={(e) =>
                  setBusinessMainInterest(e.target.value as 'sell_items' | 'rent_items')
                }
              >
                <MenuItem value="sell_items">
                  {t('completeProfile.mainInterest.sellItems', 'Selling products')}
                </MenuItem>
                <MenuItem value="rent_items">
                  {t('completeProfile.mainInterest.rentItems', 'Renting out items')}
                </MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBusinessDialogOpen(false)} disabled={personaSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmBusinessPersona}
            disabled={personaSubmitting}
          >
            {t('profile.confirmAddBusiness', 'Enable business mode')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Profile;
