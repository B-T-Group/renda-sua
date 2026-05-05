import Close from '@mui/icons-material/Close';
import LocalShipping from '@mui/icons-material/LocalShipping';
import Map from '@mui/icons-material/Map';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';

const POLL_INTERVAL_MS = 45000;

export interface TrackOrderModalProps {
  open: boolean;
  orderId: string;
  onClose: () => void;
}

type AgentLocation = { latitude: number; longitude: number; updatedAt: string };

export function TrackOrderModal({ open, orderId, onClose }: TrackOrderModalProps) {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [agentLocation, setAgentLocation] = useState<AgentLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAgentLocation = useCallback(async () => {
    if (!apiClient) {
      setAgentLocation(null);
      setError(t('common.notAuthenticated', 'Please sign in to continue.'));
      return;
    }
    try {
      setError(null);
      const { data } = await apiClient.get<{
        success: boolean;
        location?: { latitude: number; longitude: number; updatedAt: string };
        error?: string;
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
      setAgentLocation(null);
      setError(err.response?.data?.error ?? err.message ?? 'Failed to load location');
    }
  }, [apiClient, orderId, t]);

  useEffect(() => {
    if (!open) return;
    fetchAgentLocation();
    const id = setInterval(fetchAgentLocation, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [open, fetchAgentLocation]);

  const mapEmbedUrl = useMemo(() => {
    if (!agentLocation) return null;
    const { latitude, longitude } = agentLocation;
    if (!latitude && !longitude) return null;
    return `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
  }, [agentLocation]);

  const handleGoToOrder = () => {
    onClose();
    navigate(`/orders/${orderId}`);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3 } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pr: 1,
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Map color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {t('orders.trackYourOrder.title', 'Track your order')}
          </Typography>
        </Box>
        <IconButton aria-label={t('common.close', 'Close')} onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, pb: 1.25 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(8, 145, 178, 0.22)'
                    : 'rgba(8, 145, 178, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto',
              }}
            >
              <LocalShipping color="primary" fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                {t('orders.trackYourOrder.note', 'Your order is on its way.')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(
                  'orders.trackYourOrder.helper',
                  'Track your delivery agent on the map in real time.'
                )}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1 }}>
          <Button variant="contained" onClick={handleGoToOrder} sx={{ fontWeight: 700 }}>
            {t('orders.trackYourOrder.goToOrder', 'Go to order')}
          </Button>
          <Button variant="outlined" onClick={fetchAgentLocation}>
            {t('common.refresh', 'Refresh')}
          </Button>
        </Box>

        <Box sx={{ width: '100%', height: fullScreen ? 'calc(100vh - 170px)' : '70vh' }}>
          {mapEmbedUrl ? (
            <iframe
              title={t('orders.viewOnMap', 'View agent location on map')}
              src={mapEmbedUrl}
              style={{ border: 0, width: '100%', height: '100%' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <Box sx={{ px: 2, pb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {error
                  ? error
                  : t(
                      'orders.trackYourOrder.noLocation',
                      'Live location is not available yet. Please try again shortly.'
                    )}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

