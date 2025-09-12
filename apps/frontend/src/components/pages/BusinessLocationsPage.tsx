import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import { useUserProfile } from '../../hooks/useUserProfile';
import LocationModal from '../business/LocationModal';
import SEOHead from '../seo/SEOHead';

const BusinessLocationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfile();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<any>(null);

  const {
    locations,
    loading: locationsLoading,
    error: locationsError,
    addLocation,
    updateLocation,
    deleteLocation,
    fetchLocations,
  } = useBusinessLocations(profile?.business?.id);

  // Fetch locations when component mounts or business ID changes
  useEffect(() => {
    if (profile?.business?.id) {
      fetchLocations();
    }
  }, [profile?.business?.id, fetchLocations]);

  // Debug logging
  useEffect(() => {
    console.log('BusinessLocationsPage - Profile:', profile);
    console.log('BusinessLocationsPage - Business ID:', profile?.business?.id);
    console.log('BusinessLocationsPage - Locations:', locations);
    console.log('BusinessLocationsPage - Loading:', locationsLoading);
    console.log('BusinessLocationsPage - Error:', locationsError);
  }, [profile, locations, locationsLoading, locationsError]);

  const handleAddLocation = () => {
    setEditingLocation(null);
    setShowLocationModal(true);
  };

  const handleEditLocation = (location: any) => {
    setEditingLocation(location);
    setShowLocationModal(true);
  };

  const handleDeleteLocation = (location: any) => {
    setLocationToDelete(location);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!locationToDelete) return;

    try {
      await deleteLocation(locationToDelete.id);
      enqueueSnackbar(t('business.locations.locationDeleted'), {
        variant: 'success',
      });
      setShowDeleteConfirm(false);
      setLocationToDelete(null);
    } catch (error) {
      enqueueSnackbar(t('business.locations.deleteError'), {
        variant: 'error',
      });
    }
  };

  const handleSaveLocation = async (data: any) => {
    console.log('BusinessLocationsPage: handleSaveLocation called');
    console.log('BusinessLocationsPage: editingLocation:', editingLocation);
    console.log('BusinessLocationsPage: data:', data);

    try {
      if (editingLocation) {
        console.log(
          'BusinessLocationsPage: Updating location with ID:',
          editingLocation.id
        );
        await updateLocation(editingLocation.id, data);
        enqueueSnackbar(t('business.locations.locationUpdated'), {
          variant: 'success',
        });
      } else {
        console.log('BusinessLocationsPage: Adding new location');
        await addLocation(data);
        enqueueSnackbar(t('business.locations.locationAdded'), {
          variant: 'success',
        });
      }
      setShowLocationModal(false);
      setEditingLocation(null);
    } catch (error) {
      console.error('BusinessLocationsPage: Error saving location:', error);
      enqueueSnackbar(t('business.locations.saveError'), { variant: 'error' });
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return '';
    return `${address.address_line_1}, ${address.city}, ${address.state} ${address.postal_code}`;
  };

  if (!profile?.business) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {t('business.dashboard.noBusinessProfile')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('seo.business-locations.title')}
        description={t('seo.business-locations.description')}
        keywords={t('seo.business-locations.keywords')}
      />

      <Typography variant="h4" gutterBottom>
        {t('business.locations.title')}
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">{t('business.locations.title')}</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddLocation}
          >
            {t('business.locations.addLocation')}
          </Button>
        </Box>

        {locationsLoading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <Typography>{t('common.loading')}</Typography>
          </Box>
        ) : locationsError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {locationsError}
          </Alert>
        ) : locations.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('business.locations.noLocations')}
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {locations.map((location) => (
              <Grid item xs={12} sm={6} md={4} key={location.id}>
                <Card>
                  <CardContent>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      mb={2}
                    >
                      <Typography variant="h6" component="div">
                        {location.name}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteLocation(location)}
                        disabled={location.is_primary}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>

                    <Box mb={2}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        display="flex"
                        alignItems="center"
                        mb={1}
                      >
                        <LocationIcon sx={{ mr: 1, fontSize: 16 }} />
                        {formatAddress(location.address)}
                      </Typography>
                      {location.phone && (
                        <Typography variant="body2" color="text.secondary">
                          📞 {location.phone}
                        </Typography>
                      )}
                      {location.email && (
                        <Typography variant="body2" color="text.secondary">
                          ✉️ {location.email}
                        </Typography>
                      )}
                    </Box>

                    <Box>
                      {location.is_primary && (
                        <Chip
                          label={t('business.locations.primary')}
                          color="primary"
                          size="small"
                          sx={{ mb: 1 }}
                        />
                      )}
                    </Box>

                    <Box sx={{ mt: 2 }}>
                      <Chip
                        label={t(
                          `business.locations.${location.location_type}`
                        )}
                        color="secondary"
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      <Chip
                        label={
                          location.is_active
                            ? t('business.locations.active')
                            : t('business.locations.inactive')
                        }
                        color={location.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleEditLocation(location)}
                    >
                      {t('business.locations.editLocation')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() =>
                        updateLocation(location.id, {
                          is_active: !location.is_active,
                        })
                      }
                    >
                      {location.is_active
                        ? t('business.locations.deactivate')
                        : t('business.locations.activate')}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

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
      >
        <DialogTitle>{t('business.locations.deleteLocation')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {locationToDelete?.is_primary
              ? t('business.locations.primaryLocationWarning')
              : t('business.locations.deleteConfirm')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={locationToDelete?.is_primary}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BusinessLocationsPage;
