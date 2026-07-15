import {
  Alert,
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
import ConfirmationModal from '../common/ConfirmationModal';

interface LocationTransferInboxProps {
  businessId?: string;
  refreshToken?: number;
  onChanged?: () => void;
}

const LocationTransferInbox: React.FC<LocationTransferInboxProps> = ({
  businessId,
  refreshToken = 0,
  onChanged,
}) => {
  const { t } = useTranslation();
  const {
    incoming,
    outgoing,
    loading,
    fetchPending,
    acceptRequest,
    rejectRequest,
    cancelRequest,
  } = useLocationTransfers(businessId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<TransferRequest | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending, refreshToken]);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await fetchPending();
      onChanged?.();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Action failed');
    } finally {
      setBusyId(null);
      setAcceptTarget(null);
    }
  };

  if (loading && !incoming.length && !outgoing.length) {
    return (
      <Box display="flex" justifyContent="center" py={2}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!incoming.length && !outgoing.length) {
    return null;
  }

  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      {error && <Alert severity="error">{error}</Alert>}

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
              <Card key={req.id} variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {req.business_location?.name ||
                      String(req.metadata?.locationName || '')}
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
                </CardContent>
                <CardActions>
                  <Button
                    color="inherit"
                    disabled={busyId === req.id}
                    onClick={() => run(req.id, () => rejectRequest(req.id))}
                  >
                    {t('common.reject', 'Reject')}
                  </Button>
                  <Button
                    variant="contained"
                    disabled={busyId === req.id}
                    onClick={() => setAcceptTarget(req)}
                  >
                    {t('common.accept', 'Accept')}
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
              <Card key={req.id} variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {req.business_location?.name ||
                      String(req.metadata?.locationName || '')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      'business.locations.transfer.toBusiness',
                      'To: {{name}} ({{email}})',
                      {
                        name: req.to_business?.name || '',
                        email: '',
                      }
                    )}
                  </Typography>
                  <Typography variant="caption" color="warning.main">
                    {t(
                      'business.locations.transfer.pendingBadge',
                      'Transfer pending'
                    )}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    color="inherit"
                    disabled={busyId === req.id}
                    onClick={() => run(req.id, () => cancelRequest(req.id))}
                  >
                    {t('common.cancel', 'Cancel')}
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      <ConfirmationModal
        open={!!acceptTarget}
        title={t(
          'business.locations.transfer.acceptTitle',
          'Accept location transfer?'
        )}
        message={
          acceptTarget?.transfer_mode === 'inventory_merge'
            ? t(
                'business.locations.transfer.acceptMergeMessage',
                'This will move eligible items and inventory into the selected location. Duplicates stay on the source.'
              )
            : t(
                'business.locations.transfer.acceptMessage',
                'This will move the location, its items, addresses, and account to your business.'
              )
        }
        confirmText={t('common.accept', 'Accept')}
        confirmColor="primary"
        loading={!!busyId}
        onCancel={() => setAcceptTarget(null)}
        onConfirm={() => {
          if (!acceptTarget) return;
          void run(acceptTarget.id, () => acceptRequest(acceptTarget.id));
        }}
      />
    </Stack>
  );
};

export default LocationTransferInbox;
