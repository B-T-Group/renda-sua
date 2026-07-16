import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useLocationTransfers,
  type TransferRequest,
} from '../../hooks/useLocationTransfers';
import TransferRequestDetailDialog from './TransferRequestDetailDialog';

interface LocationTransferInboxProps {
  businessId?: string;
  refreshToken?: number;
  onChanged?: () => void;
  focusRequestId?: string | null;
  onFocusHandled?: () => void;
}

function requestLocationName(req: TransferRequest): string {
  return (
    req.business_location?.name ||
    String(req.metadata?.locationName || '') ||
    '—'
  );
}

function businessEmail(
  biz?: { name?: string; user?: { email?: string } } | null
): string {
  return biz?.user?.email?.trim() || '';
}

function formatExpiresAt(
  iso: string,
  t: (key: string, fallback: string, opts?: Record<string, unknown>) => string
): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) {
    return t('business.locations.transfer.expiredLabel', 'Expired');
  }
  const days = Math.ceil(ms / 86400000);
  if (days <= 1) {
    return t('business.locations.transfer.expiresToday', 'Expires today');
  }
  return t(
    'business.locations.transfer.expiresInDays',
    'Expires in {{days}} days',
    { days }
  );
}

const LocationTransferInbox: React.FC<LocationTransferInboxProps> = ({
  businessId,
  refreshToken = 0,
  onChanged,
  focusRequestId = null,
  onFocusHandled,
}) => {
  const { t } = useTranslation();
  const { incoming, outgoing, loading, fetchPending } =
    useLocationTransfers(businessId);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending, refreshToken]);

  useEffect(() => {
    if (!focusRequestId) return;
    setDetailId(focusRequestId);
    setHighlightId(focusRequestId);
    onFocusHandled?.();
    const timer = setTimeout(() => setHighlightId(null), 4000);
    return () => clearTimeout(timer);
  }, [focusRequestId, onFocusHandled]);

  const openDetail = (id: string) => {
    setDetailId(id);
    setHighlightId(id);
  };

  const cardSx = (id: string) =>
    highlightId === id
      ? {
          outline: '2px solid',
          outlineColor: 'primary.main',
          bgcolor: 'action.hover',
        }
      : undefined;

  if (loading && !incoming.length && !outgoing.length && !detailId) {
    return (
      <Box display="flex" justifyContent="center" py={2}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!incoming.length && !outgoing.length && !detailId) {
    return null;
  }

  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      {incoming.length > 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            {t(
              'business.locations.transfer.incomingTitle',
              'Incoming location transfers'
            )}
          </Typography>
          <Stack spacing={1.5}>
            {incoming.map((req) => (
              <Card
                key={req.id}
                variant="outlined"
                sx={{ ...cardSx(req.id), cursor: 'pointer' }}
                onClick={() => openDetail(req.id)}
              >
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {requestLocationName(req)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {req.transfer_mode === 'inventory_merge'
                      ? t(
                          'business.locations.transfer.modeMergeBadge',
                          'Inventory merge'
                        )
                      : t(
                          'business.locations.transfer.modeOwnershipBadge',
                          'Location ownership'
                        )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      'business.locations.transfer.fromBusiness',
                      'From: {{name}}',
                      { name: req.from_business?.name || '' }
                    )}
                  </Typography>
                  {req.transfer_mode === 'inventory_merge' && (
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'business.locations.transfer.toLocationLine',
                        'Destination location: {{name}}',
                        {
                          name:
                            req.to_business_location?.name ||
                            String(req.metadata?.toLocationName || ''),
                        }
                      )}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      'business.locations.transfer.summaryLine',
                      '1 location · {{items}} items · {{rentals}} rentals · {{orders}} completed orders',
                      {
                        items: req.item_count,
                        rentals: req.rental_item_count,
                        orders: req.order_count,
                      }
                    )}
                  </Typography>
                  <Typography variant="caption" color="warning.main">
                    {formatExpiresAt(req.expires_at, t)}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(req.id);
                    }}
                  >
                    {t('business.locations.transfer.viewRequest', 'View')}
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {outgoing.length > 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            {t(
              'business.locations.transfer.outgoingTitle',
              'Outgoing location transfers'
            )}
          </Typography>
          <Stack spacing={1.5}>
            {outgoing.map((req) => (
              <Card
                key={req.id}
                variant="outlined"
                sx={{ ...cardSx(req.id), cursor: 'pointer' }}
                onClick={() => openDetail(req.id)}
              >
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {requestLocationName(req)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      'business.locations.transfer.toBusiness',
                      'To: {{name}} ({{email}})',
                      {
                        name: req.to_business?.name || '',
                        email: businessEmail(req.to_business),
                      }
                    )}
                  </Typography>
                  <Typography variant="caption" color="warning.main" display="block">
                    {t(
                      'business.locations.transfer.pendingBadge',
                      'Transfer pending'
                    )}
                    {' · '}
                    {formatExpiresAt(req.expires_at, t)}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(req.id);
                    }}
                  >
                    {t('business.locations.transfer.viewRequest', 'View')}
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      <TransferRequestDetailDialog
        open={!!detailId}
        requestId={detailId}
        businessId={businessId}
        viewerBusinessId={businessId}
        onClose={() => setDetailId(null)}
        onChanged={() => {
          void fetchPending();
          onChanged?.();
        }}
      />
    </Stack>
  );
};

export default LocationTransferInbox;
