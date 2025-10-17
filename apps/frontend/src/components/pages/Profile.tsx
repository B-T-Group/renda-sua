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
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useDocumentManagement } from '../../hooks/useDocumentManagement';

import AccountManager, { AccountManagerRef } from '../common/AccountManager';
import AddressManager from '../common/AddressManager';
import PhoneInput from '../common/PhoneInput';
import { SimpleDocumentUpload } from '../common/SimpleDocumentUpload';

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
    clearMessages,
    refetch,
  } = useUserProfileContext();

  // Document management
  const { documentTypes } = useDocumentManagement();

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
        {t('profile.title')}
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
              <Typography variant="h6">
                {t('profile.personalInformation')}
              </Typography>
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
                  label={t('profile.firstName')}
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
                  label={t('profile.lastName')}
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
                  label={t('profile.phoneNumber')}
                  helperText={t('profile.phoneNumberHelper')}
                  margin="normal"
                />
                <Box mt={2}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleProfileSave}
                  >
                    {t('common.save')}
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box>
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
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Addresses */}
        {profile && (
          <AddressManager
            entityType={profile.user_type_id as 'agent' | 'client' | 'business'}
            entityId={
              profile.user_type_id === 'agent'
                ? profile.agent?.id || ''
                : profile.user_type_id === 'client'
                ? profile.client?.id || ''
                : profile.business?.id || ''
            }
            title={t('profile.personalAddresses')}
            showCoordinates={false}
            onAccountCreated={handleAccountCreated}
          />
        )}

        {/* Document Upload */}
        {documentTypes.length > 0 && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('profile.uploadDocuments')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('profile.uploadDocumentsDescription')}
              </Typography>
              <SimpleDocumentUpload
                documentTypes={documentTypes}
                compact={true}
                showNote={true}
                onUploadSuccess={(document) => {
                  console.log('Document uploaded:', document);
                }}
                onUploadError={(error) => {
                  console.error('Upload failed:', error);
                }}
              />
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Accounts */}
      {profile && (
        <Box sx={{ mt: 3 }}>
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
    </Box>
  );
};

export default Profile;
