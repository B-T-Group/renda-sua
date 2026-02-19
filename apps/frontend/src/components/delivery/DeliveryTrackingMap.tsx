import Close from '@mui/icons-material/Close';
import LocalShipping from '@mui/icons-material/LocalShipping';
import LocationOn from '@mui/icons-material/LocationOn';
import Store from '@mui/icons-material/Store';
import {
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Link,
    Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';

const POLL_INTERVAL_MS = 45000;

export interface DeliveryTrackingMapProps {
  orderId: string;
  pickupAddress?: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  deliveryAddress?: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
}

function formatAddress(addr: DeliveryTrackingMapProps['pickupAddress']) {
  if (!addr) return '';
  const parts = [
    addr.address_line_1,
    addr.address_line_2,
    addr.city,
    addr.state,
    addr.postal_code,
    addr.country,
  ].filter(Boolean);
  return parts.join(', ');
}

export const DeliveryTrackingMap: React.FC<DeliveryTrackingMapProps> = ({
  orderId,
  pickupAddress,
  deliveryAddress,
}) => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const [agentLocation, setAgentLocation] = useState<{
    latitude: number;
    longitude: number;
    updatedAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);

  const fetchAgentLocation = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<{
        success: boolean;
        location?: {
          agentId: string;
          latitude: number;
          longitude: number;
          updatedAt: string;
        };
      }>(`/locations/orders/${orderId}/agent-location`);
      if (data.success && data.location) {
        setAgentLocation({
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          updatedAt: data.location.updatedAt,
        });
      } else {
        setAgentLocation(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? 'Failed to load location');
      setAgentLocation(null);
    }
  }, [orderId, apiClient]);

  useEffect(() => {
    fetchAgentLocation();
    const interval = setInterval(fetchAgentLocation, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAgentLocation]);

  const pickupLat = pickupAddress?.latitude ?? 0;
  const pickupLng = pickupAddress?.longitude ?? 0;
  const deliveryLat = deliveryAddress?.latitude ?? 0;
  const deliveryLng = deliveryAddress?.longitude ?? 0;
  const hasPickupCoords = pickupLat !== 0 || pickupLng !== 0;
  const hasDeliveryCoords = deliveryLat !== 0 || deliveryLng !== 0;
  const hasAgentCoords =
    agentLocation &&
    (agentLocation.latitude !== 0 || agentLocation.longitude !== 0);

  const googleMapsRouteUrl =
    hasPickupCoords && hasDeliveryCoords
      ? `https://www.google.com/maps/dir/${pickupLat},${pickupLng}/${deliveryLat},${deliveryLng}`
      : hasDeliveryCoords
        ? `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}`
        : null;

  const agentMapsUrl =
    hasAgentCoords && agentLocation
      ? `https://www.google.com/maps?q=${agentLocation.latitude},${agentLocation.longitude}`
      : null;

  const mapEmbedUrl = agentMapsUrl
    ? `${agentMapsUrl}&z=15&output=embed`
    : null;

  const openMapModal = () => setMapModalOpen(true);
  const closeMapModal = () => setMapModalOpen(false);

  return (
    <>
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          {t('orders.trackDelivery', 'Track your delivery')}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {pickupAddress && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Store color="primary" sx={{ mt: 0.25 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('orders.pickupLocation', 'Pickup')}
                </Typography>
                <Typography variant="body2">
                  {formatAddress(pickupAddress)}
                </Typography>
              </Box>
            </Box>
          )}

          {deliveryAddress && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <LocationOn color="secondary" sx={{ mt: 0.25 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('orders.deliveryAddress', 'Delivery address')}
                </Typography>
                <Typography variant="body2">
                  {formatAddress(deliveryAddress)}
                </Typography>
              </Box>
            </Box>
          )}

          {agentLocation && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <LocalShipping color="action" sx={{ mt: 0.25 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('orders.driverLocation', 'Driver location')}
                </Typography>
                <Typography variant="body2">
                  {t('orders.updatedAt', 'Updated')}:{' '}
                  {new Date(agentLocation.updatedAt).toLocaleTimeString()}
                </Typography>
                {agentMapsUrl && (
                  <Link
                    component="button"
                    variant="body2"
                    onClick={openMapModal}
                    sx={{ fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    {t('orders.viewOnMap', 'View on map')}
                  </Link>
                )}
              </Box>
            </Box>
          )}

          {error && (
            <Typography variant="body2" color="text.secondary">
              {error}
            </Typography>
          )}

          {googleMapsRouteUrl && (
            <Button
              component="a"
              href={googleMapsRouteUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              size="small"
              startIcon={<LocationOn />}
            >
              {t('orders.openInGoogleMaps', 'Open route in Google Maps')}
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>

    <Dialog
      open={mapModalOpen}
      onClose={closeMapModal}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh', minHeight: 400 },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        {t('orders.driverLocation', 'Driver location')}
        <IconButton aria-label="close" onClick={closeMapModal} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, overflow: 'hidden', display: 'flex' }}>
        {mapEmbedUrl && (
          <iframe
            title={t('orders.viewOnMap', 'View on map')}
            src={mapEmbedUrl}
            style={{
              border: 0,
              flex: 1,
              minHeight: 360,
              width: '100%',
            }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </DialogContent>
    </Dialog>
  </>
  );
};

export default DeliveryTrackingMap;
