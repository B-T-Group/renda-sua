import {
  Cancel as CancelIcon,
  CameraAlt as CameraAltIcon,
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
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useApiClient } from '../../hooks/useApiClient';

import AccountManager, { AccountManagerRef } from '../common/AccountManager';
import AddressManager from '../common/AddressManager';
import PhoneInput from '../common/PhoneInput';

const PROFILE_PICTURE_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp';
const PROFILE_PICTURE_MAX_SIZE = 5 * 1024 * 1024; // 5MB

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
  } = useUserProfileContext();

  const apiClient = useApiClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profilePictureUploading, setProfilePictureUploading] = useState(false);

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

  return (
    <Container
      maxWidth="lg"
      sx={{
        py: { xs: 2, sm: 3 },
        px: { xs: 1.5, sm: 2, md: 3 },
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

      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{ fontWeight: 600, mb: 2, fontSize: { xs: '1.5rem', sm: '2rem' } }}
      >
        {t('profile.title')}
      </Typography>

      <Grid container spacing={2} sx={{ width: '100%', margin: 0 }}>
        {/* Profile Information */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              {/* Profile picture */}
              <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                <Box sx={{ position: 'relative' }}>
                  <Avatar
                    src={profile?.profile_picture_url}
                    sx={{ width: 80, height: 80 }}
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
                      minWidth: 44,
                      minHeight: 44,
                      bgcolor: 'background.paper',
                      boxShadow: 1,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={profilePictureUploading}
                    aria-label={t('profile.changePhoto', 'Change photo')}
                  >
                    {profilePictureUploading ? (
                      <CircularProgress size={20} />
                    ) : (
                      <CameraAltIcon fontSize="small" />
                    )}
                  </IconButton>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      'profile.profilePictureHint',
                      'JPG, PNG or WebP. Max 5MB.'
                    )}
                  </Typography>
                </Box>
              </Stack>

              {profile?.user_type_id === 'agent' && !profile?.profile_picture_url && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {t(
                    'profile.agentProfilePictureNote',
                    'Add a profile picture so clients can see who is delivering their order. It helps build trust and makes handoffs smoother.'
                  )}
                </Alert>
              )}

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mb={2}
              >
                <Typography variant="h6" fontWeight={600}>
                  {t('profile.personalInformation')}
                </Typography>
                <IconButton
                  onClick={() => setEditingProfile(!editingProfile)}
                  color="primary"
                  aria-label={editingProfile ? 'Cancel' : 'Edit'}
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  {editingProfile ? <CancelIcon /> : <EditIcon />}
                </IconButton>
              </Stack>

              {editingProfile ? (
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label={t('profile.firstName')}
                    value={profileForm.first_name}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        first_name: e.target.value,
                      }))
                    }
                    size="small"
                  />
                  <TextField
                    fullWidth
                    label={t('profile.lastName')}
                    value={profileForm.last_name}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        last_name: e.target.value,
                      }))
                    }
                    size="small"
                  />
                  <PhoneInput
                    value={profileForm.phone_number}
                    onChange={(value) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        phone_number: value || '',
                      }))
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
                <Stack spacing={1.5}>
                  <Typography variant="body1">
                    <strong>{t('profile.name')}:</strong> {profile?.first_name}{' '}
                    {profile?.last_name}
                  </Typography>
                  <Typography variant="body1">
                    <strong>{t('profile.email')}:</strong> {profile?.email}
                  </Typography>
                  <Typography variant="body1">
                    <strong>{t('profile.phone')}:</strong> {profile?.phone_number}
                  </Typography>
                  <Typography variant="body1">
                    <strong>{t('profile.memberSince')}:</strong>{' '}
                    {new Date(profile?.created_at || '').toLocaleDateString()}
                  </Typography>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Manage Documents - link card (same style as Personal Addresses) */}
        <Grid size={{ xs: 12 }}>
          <Card
            component={RouterLink}
            to="/documents"
            sx={{
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              alignItems: 'center',
              p: { xs: 1.5, sm: 2 },
              minHeight: 56,
              transition: 'background-color 0.2s',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <DescriptionIcon
              sx={{
                mr: { xs: 1.5, sm: 2 },
                color: 'primary.main',
                fontSize: { xs: 28, sm: 32 },
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ fontSize: { xs: '0.9375rem', sm: '1rem' } }}
              >
                {t('profile.manageDocuments', 'Manage Documents')}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
              >
                {t(
                  'profile.manageDocumentsDescription',
                  'Upload and manage your verification documents'
                )}
              </Typography>
            </Box>
            <Typography
              variant="body2"
              color="primary.main"
              sx={{ flexShrink: 0, ml: 1, fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
            >
              {t('common.view', 'View')} →
            </Typography>
          </Card>
        </Grid>

        {/* Personal Addresses - card with same header style, content below */}
        {profile && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: { xs: 1.5, sm: 2 },
                  pb: 0,
                }}
              >
                <LocationOnIcon
                  sx={{
                    mr: { xs: 1.5, sm: 2 },
                    color: 'primary.main',
                    fontSize: { xs: 28, sm: 32 },
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    sx={{ fontSize: { xs: '0.9375rem', sm: '1rem' } }}
                  >
                    {t('profile.personalAddresses', 'Personal Addresses')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
                  >
                    {t(
                      'profile.personalAddressesDescription',
                      'Add and manage your delivery and billing addresses'
                    )}
                  </Typography>
                </Box>
              </Box>
              <CardContent sx={{ pt: 1, px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 } }}>
                <AddressManager
                  entityType={profile.user_type_id as 'agent' | 'client' | 'business'}
                  entityId={
                    profile.user_type_id === 'agent'
                      ? profile.agent?.id || ''
                      : profile.user_type_id === 'client'
                        ? profile.client?.id || ''
                        : profile.business?.id || ''
                  }
                  showCoordinates={false}
                  onAccountCreated={handleAccountCreated}
                  embedded
                />
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Accounts */}
      {profile && (
        <Box sx={{ mt: { xs: 3, sm: 4 } }}>
          <AccountManager
            ref={accountManagerRef}
            entityType={profile.user_type_id as 'agent' | 'client' | 'business'}
            entityId={profile.id}
            title={t('profile.accountOverview')}
            showTransactions={true}
            showTotalSummary={true}
            maxTransactions={10}
            compactView={false}
            emptyStateMessage={t('profile.noAccountsMessage')}
          />
        </Box>
      )}
    </Container>
  );
};

export default Profile;
