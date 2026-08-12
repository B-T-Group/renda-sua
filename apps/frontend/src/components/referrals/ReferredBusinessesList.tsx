import { Email, Phone } from '@mui/icons-material';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ReferredBusinessFollowUp,
  ReferredBusinessFollowUpStatus,
} from '../../types/referredBusiness';

function statusLabel(
  status: ReferredBusinessFollowUpStatus,
  t: (key: string, def: string) => string
): string {
  if (status === 'contract_pending') {
    return t('referrals.followUp.contractPending', 'Contract pending');
  }
  if (status === 'payment_setup_pending') {
    return t('referrals.followUp.paymentSetupPending', 'Payment setup pending');
  }
  if (status === 'suspended') {
    return t('referrals.followUp.suspended', 'Suspended');
  }
  return t('referrals.followUp.active', 'Active');
}

function statusColor(
  status: ReferredBusinessFollowUpStatus
): 'success' | 'warning' | 'error' {
  if (status === 'active') return 'success';
  if (status === 'suspended') return 'error';
  return 'warning';
}

interface Props {
  businesses: ReferredBusinessFollowUp[];
  loading?: boolean;
  error?: string | null;
}

export const ReferredBusinessesList: React.FC<Props> = ({
  businesses,
  loading,
  error,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="body2" color="error">
        {t(
          'referrals.followUp.loadError',
          'Could not load referred businesses. Try again.'
        )}
      </Typography>
    );
  }

  if (businesses.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t(
          'referrals.followUp.empty',
          'No referred businesses yet. Share your code to get started.'
        )}
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {businesses.map((biz) => {
        const owner = [biz.ownerFirstName, biz.ownerLastName]
          .filter(Boolean)
          .join(' ')
          .trim();
        return (
          <Box
            key={biz.businessId}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 1.5,
            }}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              {biz.businessName}
            </Typography>
            {owner ? (
              <Typography variant="body2" color="text.secondary">
                {owner}
              </Typography>
            ) : null}
            <Chip
              size="small"
              label={statusLabel(biz.followUpStatus, t)}
              color={statusColor(biz.followUpStatus)}
              sx={{ mt: 1 }}
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {t('referrals.followUp.itemCounts', {
                defaultValue:
                  '{{approved}} approved · {{pending}} pending · {{rejected}} rejected',
                approved: biz.itemsApproved,
                pending: biz.itemsPending,
                rejected: biz.itemsRejected,
              })}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
              {biz.phone ? (
                <IconButton
                  size="small"
                  component={Link}
                  href={`tel:${biz.phone}`}
                  aria-label={t('referrals.followUp.call', 'Call')}
                >
                  <Phone fontSize="small" />
                </IconButton>
              ) : null}
              {biz.email ? (
                <IconButton
                  size="small"
                  component={Link}
                  href={`mailto:${biz.email}`}
                  aria-label={t('referrals.followUp.email', 'Email')}
                >
                  <Email fontSize="small" />
                </IconButton>
              ) : null}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
};
