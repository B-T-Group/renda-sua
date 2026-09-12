import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';

const COLLAPSED_VISIBLE = 2;

export interface PendingWithdrawalItem {
  id: string;
  amount: number;
  currency: string;
  customer_phone?: string | null;
  transaction_id?: string | null;
  provider?: string | null;
  created_at: string;
}

interface PendingWithdrawalsPanelProps {
  items: PendingWithdrawalItem[];
  onResolved: (message: string) => void;
  compact?: boolean;
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const PendingWithdrawalsPanel: React.FC<PendingWithdrawalsPanelProps> = ({
  items,
  onResolved,
  compact = false,
}) => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleResolve = useCallback(
    async (id: string) => {
      if (!apiClient || busyId) return;
      setBusyId(id);
      try {
        const { data } = await apiClient.post<{
          success: boolean;
          outcome?: string;
          message?: string;
        }>(`/mobile-payments/withdrawals/${id}/resolve`, {});
        onResolved(
          data?.message?.trim() ||
            t(
              'accounts.pendingWithdrawals.resolveDone',
              'Withdrawal status updated.'
            )
        );
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ||
          (err as Error)?.message ||
          t(
            'accounts.pendingWithdrawals.resolveFailed',
            'Could not resolve this withdrawal. Try again.'
          );
        onResolved(message);
      } finally {
        setBusyId(null);
      }
    },
    [apiClient, busyId, onResolved, t]
  );

  if (!items.length) return null;

  const canCollapse = items.length > COLLAPSED_VISIBLE;
  const visibleItems =
    canCollapse && !expanded ? items.slice(0, COLLAPSED_VISIBLE) : items;
  const hiddenCount = items.length - COLLAPSED_VISIBLE;

  return (
    <Alert
      severity="warning"
      variant="outlined"
      sx={{ mt: compact ? 1 : 2, alignItems: 'flex-start' }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {t('accounts.pendingWithdrawals.title', 'Pending withdrawals')}
        {items.length > 1 ? ` (${items.length})` : ''}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {t(
          'accounts.pendingWithdrawals.hint',
          'Resolve these before starting a new withdrawal. Tap Resolve to check Mobile Money or cancel a stuck request.'
        )}
      </Typography>
      <Stack spacing={1}>
        {visibleItems.map((item) => {
          const busy = busyId === item.id;
          return (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'background.paper',
                borderRadius: 1,
                px: 1,
                py: 0.5,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600}>
                  {formatAmount(item.amount, item.currency)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {[
                    item.customer_phone,
                    new Date(item.created_at).toLocaleString(),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Box>
              <Tooltip
                title={t(
                  'accounts.pendingWithdrawals.resolve',
                  'Resolve pending withdrawal'
                )}
              >
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    disabled={!!busyId}
                    onClick={() => void handleResolve(item.id)}
                    aria-label={t(
                      'accounts.pendingWithdrawals.resolve',
                      'Resolve pending withdrawal'
                    )}
                  >
                    {busy ? (
                      <CircularProgress size={18} />
                    ) : (
                      <PlaylistAddCheckIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          );
        })}
      </Stack>
      {canCollapse ? (
        <Button
          size="small"
          color="primary"
          onClick={() => setExpanded((prev) => !prev)}
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ mt: 1, textTransform: 'none', fontWeight: 700 }}
        >
          {expanded
            ? t('accounts.pendingWithdrawals.showLess', 'Show less')
            : t('accounts.pendingWithdrawals.showMore', 'Show {{count}} more', {
                count: hiddenCount,
              })}
        </Button>
      ) : null}
    </Alert>
  );
};

export default PendingWithdrawalsPanel;
