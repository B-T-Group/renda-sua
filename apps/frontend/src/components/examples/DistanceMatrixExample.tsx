import { DirectionsCar } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import { useDistanceMatrix } from '../../hooks/useDistanceMatrix';

const DistanceMatrixExample: React.FC = () => {
  const { t } = useTranslation();
  const [originType, setOriginType] = useState<
    'address' | 'coordinates' | 'id'
  >('address');
  const [originAddress, setOriginAddress] = useState('');
  const [originCoordinates, setOriginCoordinates] = useState('');
  const [originAddressId, setOriginAddressId] = useState('');
  const [destinationIds, setDestinationIds] = useState('');

  const { data, loading, error, fetchDistanceMatrix, clearCache, clearData } =
    useDistanceMatrix();
  const { location, getCurrentLocation } = useCurrentLocation();

  const handleGetCurrentLocation = async () => {
    try {
      const currentLocation = await getCurrentLocation();
      const coords = `${currentLocation.latitude},${currentLocation.longitude}`;
      setOriginCoordinates(coords);
      setOriginType('coordinates');
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleCalculateDistance = async () => {
    try {
      const destinationIdsArray = destinationIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

      if (destinationIdsArray.length === 0) {
        alert('Please enter at least one destination address ID');
        return;
      }

      const payload: any = {
        destination_address_ids: destinationIdsArray,
      };

      switch (originType) {
        case 'address':
          if (!originAddress.trim()) {
            alert('Please enter an origin address');
            return;
          }
          payload.origin_address = originAddress.trim();
          break;
        case 'coordinates':
          if (!originCoordinates.trim()) {
            alert('Please enter origin coordinates');
            return;
          }
          payload.origin_address = originCoordinates.trim();
          break;
        case 'id':
          if (!originAddressId.trim()) {
            alert('Please enter an origin address ID');
            return;
          }
          payload.origin_address_id = originAddressId.trim();
          break;
      }

      await fetchDistanceMatrix(payload, false); // Use cache
    } catch (error) {
      console.error('Error calculating distance:', error);
    }
  };

  return (
    <Card sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Distance Matrix Example
        </Typography>

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Origin Type</InputLabel>
            <Select
              value={originType}
              label="Origin Type"
              onChange={(e) => setOriginType(e.target.value as any)}
            >
              <MenuItem value="address">Formatted Address</MenuItem>
              <MenuItem value="coordinates">Coordinates (lat,lng)</MenuItem>
              <MenuItem value="id">Address ID</MenuItem>
            </Select>
          </FormControl>

          {originType === 'address' && (
            <TextField
              fullWidth
              label="Origin Address"
              value={originAddress}
              onChange={(e) => setOriginAddress(e.target.value)}
              placeholder="e.g., 123 Main St, New York, NY 10001"
              sx={{ mb: 2 }}
            />
          )}

          {originType === 'coordinates' && (
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="Origin Coordinates"
                value={originCoordinates}
                onChange={(e) => setOriginCoordinates(e.target.value)}
                placeholder="e.g., 40.7128,-74.0060"
                sx={{ mb: 1 }}
              />
              <Button
                variant="outlined"
                onClick={handleGetCurrentLocation}
                startIcon={<DirectionsCar />}
              >
                Use Current Location
              </Button>
            </Box>
          )}

          {originType === 'id' && (
            <TextField
              fullWidth
              label="Origin Address ID"
              value={originAddressId}
              onChange={(e) => setOriginAddressId(e.target.value)}
              placeholder="e.g., uuid-address-id"
              sx={{ mb: 2 }}
            />
          )}

          <TextField
            fullWidth
            label="Destination Address IDs (comma-separated)"
            value={destinationIds}
            onChange={(e) => setDestinationIds(e.target.value)}
            placeholder="e.g., id1, id2, id3"
            sx={{ mb: 2 }}
          />

          <Button
            variant="contained"
            onClick={handleCalculateDistance}
            disabled={loading}
            startIcon={
              loading ? <CircularProgress size={20} /> : <DirectionsCar />
            }
            sx={{ mr: 2 }}
          >
            Calculate Distance Matrix
          </Button>

          <Button variant="outlined" onClick={clearCache} disabled={loading}>
            Clear Cache
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {data && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Distance Matrix Results
            </Typography>

            <Box sx={{ pl: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Origin ID:</strong> {data.origin_id || 'N/A'}
              </Typography>

              <Typography variant="body2" gutterBottom>
                <strong>Destination IDs:</strong>{' '}
                {data.destination_ids.join(', ')}
              </Typography>

              <Typography variant="body2" gutterBottom>
                <strong>Status:</strong> {data.status}
              </Typography>

              {data.rows && data.rows[0] && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Distance Information:
                  </Typography>
                  {data.rows[0].elements.map((element, index) => (
                    <Box key={index} sx={{ pl: 2, mb: 1 }}>
                      <Typography variant="body2">
                        <strong>To Destination {index + 1}:</strong>
                      </Typography>
                      {element.distance && (
                        <Typography variant="body2" color="text.secondary">
                          Distance: {element.distance.text}
                        </Typography>
                      )}
                      {element.duration && (
                        <Typography variant="body2" color="text.secondary">
                          Duration: {element.duration.text}
                        </Typography>
                      )}
                      {element.status !== 'OK' && (
                        <Typography variant="body2" color="error">
                          Status: {element.status}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default DistanceMatrixExample;
