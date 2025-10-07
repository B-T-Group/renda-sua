import {
  Add as AddIcon,
  LocationOn as LocationOnIcon,
  Store as StoreIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  AddBusinessLocationData,
  BusinessLocation,
  UpdateBusinessLocationData,
  useBusinessLocations,
} from '../../hooks/useBusinessLocations';
import { useUserProfile } from '../../hooks/useUserProfile';
import LocationCard from '../business/LocationCard';
import LocationCardSkeleton from '../business/LocationCardSkeleton';
import LocationModal from '../business/LocationModal';
import SEOHead from '../seo/SEOHead';

const BusinessLocationsPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfile();
  const { refetch: refetchProfile } = useUserProfileContext();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] =
    useState<BusinessLocation | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [locationToDelete, setLocationToDelete] =
    useState<BusinessLocation | null>(null);

  const {
    locations,
    loading: locationsLoading,
    error: locationsError,
    addLocation,
    updateLocation,
    deleteLocation,
    fetchLocations,
  } = useBusinessLocations(profile?.business?.id, undefined, refetchProfile);

  // Fetch locations when component mounts or business ID changes
  useEffect(() => {
    if (profile?.business?.id) {
      fetchLocations();
    }
  }, [profile?.business?.id, fetchLocations]);

  const handleAddLocation = () => {
    setEditingLocation(null);
    setShowLocationModal(true);
  };

  const handleEditLocation = (location: BusinessLocation) => {
    setEditingLocation(location);
    setShowLocationModal(true);
  };

  const handleDeleteLocation = (location: BusinessLocation) => {
    setLocationToDelete(location);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!locationToDelete) return;

    try {
      await deleteLocation(locationToDelete.id);
      enqueueSnackbar(
        t(
          'business.locations.locationDeleted',
          'Location deleted successfully'
        ),
        {
          variant: 'success',
        }
      );
      setShowDeleteConfirm(false);
      setLocationToDelete(null);
    } catch (error: unknown) {
      console.error('Error deleting location:', error);
      enqueueSnackbar(
        t('business.locations.deleteError', 'Failed to delete location'),
        {
          variant: 'error',
        }
      );
    }
  };

  const handleSaveLocation = async (
    data: AddBusinessLocationData | UpdateBusinessLocationData
  ) => {
    try {
      if (editingLocation) {
        await updateLocation(
          editingLocation.id,
          data as UpdateBusinessLocationData
        );
        enqueueSnackbar(
          t(
            'business.locations.locationUpdated',
            'Location updated successfully'
          ),
          {
            variant: 'success',
          }
        );
      } else {
        await addLocation(data as AddBusinessLocationData);
        enqueueSnackbar(
          t('business.locations.locationAdded', 'Location added successfully'),
          {
            variant: 'success',
          }
        );
      }
      setShowLocationModal(false);
      fetchLocations();
      setEditingLocation(null);
    } catch (error) {
      console.error('BusinessLocationsPage: Error saving location:', error);
      enqueueSnackbar(
        t('business.locations.saveError', 'Failed to save location'),
        { variant: 'error' }
      );
    }
  };

  const handleToggleLocationStatus = async (location: BusinessLocation) => {
    try {
      await updateLocation(location.id, {
        is_active: !location.is_active,
      });

      const statusMessage = location.is_active
        ? t(
            'business.locations.locationDeactivated',
            'Location deactivated successfully'
          )
        : t(
            'business.locations.locationActivated',
            'Location activated successfully'
          );

      enqueueSnackbar(statusMessage, {
        variant: 'success',
      });

      // Refresh the locations list
      fetchLocations();
    } catch (error) {
      console.error(
        'BusinessLocationsPage: Error toggling location status:',
        error
      );
      enqueueSnackbar(
        t(
          'business.locations.statusUpdateError',
          'Failed to update location status'
        ),
        {
          variant: 'error',
        }
      );
    }
  };

  const activeLocations = locations.filter((location) => location.is_active);
  const inactiveLocations = locations.filter((location) => !location.is_active);

  if (!profile?.business) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Alert severity="error">
          {t(
            'business.dashboard.noBusinessProfile',
            'Business profile not found'
          )}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <SEOHead
        title={t('seo.business-locations.title', 'Business Locations')}
        description={t(
          'seo.business-locations.description',
          'Manage your business locations'
        )}
        keywords={t(
          'seo.business-locations.keywords',
          'business locations, manage locations'
        )}
      />

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
          mb={2}
        >
          <Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.75rem', md: '2.125rem' },
              }}
            >
              {t('business.locations.title', 'Business Locations')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t(
                'business.locations.description',
                'Manage all your business locations and their details'
              )}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddLocation}
            size={isMobile ? 'medium' : 'large'}
            sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
          >
            {t('business.locations.addLocation', 'Add Location')}
          </Button>
        </Stack>

        {/* Stats Summary */}
        {!locationsLoading && locations.length > 0 && (
          <Paper sx={{ p: 2, bgcolor: 'primary.50' }}>
            <Stack
              direction="row"
              spacing={3}
              alignItems="center"
              flexWrap="wrap"
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StoreIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {locations.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('business.locations.totalLocations', 'Total Locations')}
                </Typography>
              </Box>
              {activeLocations.length > 0 && (
                <>
                  <Divider orientation="vertical" flexItem />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOnIcon sx={{ color: 'success.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {activeLocations.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('business.locations.active', 'Active')}
                    </Typography>
                  </Box>
                </>
              )}
              {inactiveLocations.length > 0 && (
                <>
                  <Divider orientation="vertical" flexItem />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOnIcon sx={{ color: 'grey.400' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {inactiveLocations.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('business.locations.inactive', 'Inactive')}
                    </Typography>
                  </Box>
                </>
              )}
            </Stack>
          </Paper>
        )}
      </Box>

      {/* Error Display */}
      {locationsError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {locationsError}
        </Alert>
      )}

      {/* Loading State */}
      {locationsLoading && (
        <Grid container spacing={2}>
          {[1, 2, 3].map((index) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
              <LocationCardSkeleton />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Empty State */}
      {!locationsLoading && locations.length === 0 && (
        <Paper
          sx={{
            p: { xs: 4, md: 6 },
            textAlign: 'center',
            bgcolor: 'grey.50',
            border: '2px dashed',
            borderColor: 'grey.300',
            borderRadius: 2,
          }}
        >
          <StoreIcon sx={{ fontSize: 80, color: 'grey.400', mb: 2 }} />
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            {t('business.locations.noLocations', 'No Locations Yet')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {t(
              'business.locations.noLocationsMessage',
              'Add your first business location to start managing inventory and deliveries'
            )}
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={handleAddLocation}
          >
            {t('business.locations.addFirstLocation', 'Add First Location')}
          </Button>
        </Paper>
      )}

      {/* Locations Grid */}
      {!locationsLoading && locations.length > 0 && (
        <Box>
          {/* Active Locations */}
          {activeLocations.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ mb: 2 }}
              >
                <Chip
                  label={t('business.locations.active', 'Active')}
                  color="success"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t('business.locations.activeLocations', 'Active Locations')}
                </Typography>
                <Chip
                  label={activeLocations.length}
                  size="small"
                  variant="outlined"
                />
              </Stack>
              <Grid container spacing={2}>
                {activeLocations.map((location) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={location.id}>
                    <LocationCard
                      location={location}
                      onEdit={handleEditLocation}
                      onDelete={handleDeleteLocation}
                      onToggleStatus={handleToggleLocationStatus}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Inactive Locations */}
          {inactiveLocations.length > 0 && (
            <Box>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ mb: 2 }}
              >
                <Chip
                  label={t('business.locations.inactive', 'Inactive')}
                  color="default"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t(
                    'business.locations.inactiveLocations',
                    'Inactive Locations'
                  )}
                </Typography>
                <Chip
                  label={inactiveLocations.length}
                  size="small"
                  variant="outlined"
                />
              </Stack>
              <Grid container spacing={2}>
                {inactiveLocations.map((location) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={location.id}>
                    <LocationCard
                      location={location}
                      onEdit={handleEditLocation}
                      onDelete={handleDeleteLocation}
                      onToggleStatus={handleToggleLocationStatus}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}

      {/* Location Modal */}
      <LocationModal
        open={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSave={handleSaveLocation}
        location={editingLocation}
        loading={locationsLoading}
        error={locationsError}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {t('business.locations.deleteLocation', 'Delete Location')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {locationToDelete?.is_primary
              ? t(
                  'business.locations.primaryLocationWarning',
                  'Cannot delete the primary location. Please set another location as primary first.'
                )
              : t(
                  'business.locations.deleteConfirm',
                  'Are you sure you want to delete this location? This action cannot be undone.'
                )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowDeleteConfirm(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={locationToDelete?.is_primary}
          >
            {t('common.delete', 'Delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BusinessLocationsPage;
