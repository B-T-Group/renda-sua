import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '../common/ConfirmationModal';
import {
  useLocationTransfers,
  type TransferRequest,
} from '../../hooks/useLocationTransfers';

export interface TransferRequestDetailDialogProps {
  open: boolean;
  requestId: string | null;
  businessId?: string;
  viewerBusinessId?: string;
  onClose: () => void;
  onChanged?: () => void;
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
  return t('business.locations.transfer.expiresInDays', 'Expires in {{days}} days', {
    days,
  });
}

function statusLabel(
  status: string,
  t: (key: string, fallback: string) => string
): string {
  switch (status) {
    case 'accepted':
      return t('business.locations.transfer.statusAccepted', 'Accepted');
    case 'rejected':
      return t('business.locations.transfer.statusRejected', 'Rejected');
    case 'cancelled':
      return t('business.locations.transfer.statusCancelled', 'Cancelled');
    case 'expired':
      return t('business.locations.transfer.statusExpired', 'Expired');
    case 'pending':
      return t('business.locations.transfer.pendingBadge', 'Transfer pending');
    default:
      return status;
  }
}

const TransferRequestDetailDialog: React.FC<
  TransferRequestDetailDialogProps
> = ({
  open,
  requestId,
  businessId,
  viewerBusinessId,
  onClose,
  onChanged,
}) => {
  const { t } = useTranslation();
  const {
    getRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
  } = useLocationTransfers(businessId);
  const [request, setRequest] = useState<TransferRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!open || !requestId) {
      setRequest(null);
      setError(null);
      setLoadFailed(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    void getRequest(requestId)
      .then((row) => {
        if (!cancelled) setRequest(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadFailed(true);
          setError(
            (err as { message?: string })?.message ??
              t(
                'business.locations.transfer.loadFailed',
                'Could not load this transfer request'
              )
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, requestId, getRequest, t]);

  const isIncoming =
    !!request &&
    !!viewerBusinessId &&
    request.to_business_id === viewerBusinessId;
  const isOutgoing =
    !!request &&
    !!viewerBusinessId &&
    request.from_business_id === viewerBusinessId;
  const isPending = request?.status === 'pending';

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged?.();
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Action failed');
    } finally {
      setBusy(false);
      setConfirmAccept(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>
          {t('business.locations.transfer.detailTitle', 'Transfer request')}
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={28} />
            </Box>
          ) : loadFailed || !request ? (
            <Alert severity="info">
              {error ||
                t(
                  'business.locations.transfer.loadFailed',
                  'Could not load this transfer request'
                )}
            </Alert>
          ) : (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Typography variant="h6">{requestLocationName(request)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {request.transfer_mode === 'inventory_merge'
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
                {statusLabel(request.status, t)}
              </Typography>
              {isPending && (
                <Typography variant="body2" color="warning.main">
                  {formatExpiresAt(request.expires_at, t)}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                {isIncoming
                  ? t(
                      'business.locations.transfer.fromBusiness',
                      'From: {{name}}',
                      { name: request.from_business?.name || '' }
                    )
                  : t(
                      'business.locations.transfer.toBusiness',
                      'To: {{name}} ({{email}})',
                      {
                        name: request.to_business?.name || '',
                        email: businessEmail(request.to_business),
                      }
                    )}
              </Typography>
              {request.transfer_mode === 'inventory_merge' && (
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'business.locations.transfer.toLocationLine',
                    'Destination location: {{name}}',
                    {
                      name:
                        request.to_business_location?.name ||
                        String(request.metadata?.toLocationName || ''),
                    }
                  )}
                </Typography>
              )}
              <Typography variant="body2">
                {t(
                  'business.locations.transfer.summaryLine',
                  '1 location · {{items}} items · {{rentals}} rentals · {{orders}} completed orders',
                  {
                    items: request.item_count,
                    rentals: request.rental_item_count,
                    orders: request.order_count,
                  }
                )}
              </Typography>
              {!isPending && (
                <Alert severity="info">
                  {t(
                    'business.locations.transfer.resolvedHint',
                    'This request is no longer pending.'
                  )}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {!isPending || loadFailed || !request ? (
            <Button onClick={onClose}>
              {t('common.done', 'Done')}
            </Button>
          ) : (
            <>
              <Button onClick={onClose} disabled={busy}>
                {t('common.close', 'Close')}
              </Button>
              {isOutgoing && (
                <Button
                  color="inherit"
                  disabled={busy}
                  onClick={() =>
                    void run(() => cancelRequest(request.id))
                  }
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
              )}
              {isIncoming && (
                <>
                  <Button
                    color="inherit"
                    disabled={busy}
                    onClick={() =>
                      void run(() => rejectRequest(request.id))
                    }
                  >
                    {t('common.reject', 'Reject')}
                  </Button>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() => setConfirmAccept(true)}
                  >
                    {busy ? (
                      <CircularProgress size={20} />
                    ) : (
                      t('common.accept', 'Accept')
                    )}
                  </Button>
                </>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        open={confirmAccept}
        title={t(
          'business.locations.transfer.acceptTitle',
          'Accept location transfer?'
        )}
        message={
          request?.transfer_mode === 'inventory_merge'
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
        loading={busy}
        onCancel={() => setConfirmAccept(false)}
        onConfirm={() => {
          if (!request) return;
          void run(() => acceptRequest(request.id));
        }}
      />
    </>
  );
};

export default TransferRequestDetailDialog;
