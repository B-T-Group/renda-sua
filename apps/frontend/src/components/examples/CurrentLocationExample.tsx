import { LocationOn, MyLocation } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';

const CurrentLocationExample: React.FC = () => {
  const { t } = useTranslation();
  const { location, loading, error, getCurrentLocation, clearLocation } =
    useCurrentLocation();

  const handleGetLocation = async () => {
    try {
      await getCurrentLocation();
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  return (
    <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Current Location Example
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<MyLocation />}
            onClick={handleGetLocation}
            disabled={loading}
            sx={{ mr: 2 }}
          >
            {loading ? <CircularProgress size={20} /> : 'Get Current Location'}
          </Button>

          {location && (
            <Button
              variant="outlined"
              onClick={clearLocation}
              disabled={loading}
            >
              Clear Location
            </Button>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {location && (
          <Box>
            <Typography variant="h6" gutterBottom>
              <LocationOn sx={{ mr: 1, verticalAlign: 'middle' }} />
              Your Current Location
            </Typography>

            <Box sx={{ pl: 2 }}>
              <Typography variant="body1" gutterBottom>
                <strong>Coordinates:</strong> {location.latitude.toFixed(6)},{' '}
                {location.longitude.toFixed(6)}
              </Typography>

              {location.address && (
                <Typography variant="body1" gutterBottom>
                  <strong>Address:</strong> {location.address}
                </Typography>
              )}

              {location.city && (
                <Typography variant="body1" gutterBottom>
                  <strong>City:</strong> {location.city}
                </Typography>
              )}

              {location.state && (
                <Typography variant="body1" gutterBottom>
                  <strong>State:</strong> {location.state}
                </Typography>
              )}

              {location.country && (
                <Typography variant="body1" gutterBottom>
                  <strong>Country:</strong> {location.country}
                </Typography>
              )}

              {location.postalCode && (
                <Typography variant="body1" gutterBottom>
                  <strong>Postal Code:</strong> {location.postalCode}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {!location && !loading && !error && (
          <Typography variant="body2" color="text.secondary">
            Click "Get Current Location" to retrieve your current coordinates
            and address.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default CurrentLocationExample;
