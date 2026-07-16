import {
  Description as DescriptionIcon,
  Edit as EditIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { AdminBusiness } from '../../hooks/useAdminBusinesses';
import { AdminBusinessVerificationSteps } from './AdminBusinessVerificationSteps';
import { AdminLifecycleChip } from './AdminLifecycleChip';
import { formatVerificationBlocker } from './AdminBusinessVerificationDialog';

export interface AdminBusinessOverviewCardProps {
  business: AdminBusiness;
  onVerify: () => void;
  onEdit: () => void;
  onSuspend: () => void;
  onReinstate: () => void;
}

function primaryLocationLabel(business: AdminBusiness): string | null {
  const addresses = business.addresses || [];
  if (!addresses.length) return null;
  const primary =
    addresses.find((a: { is_primary?: boolean }) => a.is_primary) ||
    addresses[0];
  const city = primary?.city?.trim();
  const country = primary?.country?.trim();
  if (city && country) return `${city}, ${country}`;
  return city || country || null;
}

export const AdminBusinessOverviewCard: React.FC<
  AdminBusinessOverviewCardProps
> = ({ business, onVerify, onEdit, onSuspend, onReinstate }) => {
  const { t } = useTranslation();
  const summary = business.verificationSummary;
  const rail = summary?.rail;
  const draftBlocker =
    business.lifecycle_status === 'created'
      ? summary?.blockers?.find(
          (b) =>
            b === 'missing_signed_contract' ||
            b === 'missing_active_location' ||
            b === 'missing_approved_product'
        )
      : undefined;
  const location = primaryLocationLabel(business);
  const createdLabel = business.created_at
    ? new Date(business.created_at).toLocaleDateString()
    : null;

  return (
    <Card
      variant="outlined"
      sx={{
        width: '100%',
        overflow: 'hidden',
        borderRadius: 2,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
          borderColor: 'primary.light',
          boxShadow: 1,
        },
      }}
    >
      <CardContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          '&:last-child': { pb: 2 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'flex-start' },
            gap: 1,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontSize: { xs: '1.05rem', sm: '1.2rem' },
                fontWeight: 600,
                wordBreak: 'break-word',
              }}
            >
              {business.name || t('admin.businesses.unnamed', 'Business')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ wordBreak: 'break-word' }}
            >
              {t('admin.businesses.ownerLabel', 'Owner')}:{' '}
              {business.user.first_name} {business.user.last_name}
              {business.user.email ? ` · ${business.user.email}` : ''}
              {business.user.phone_number
                ? ` · ${business.user.phone_number}`
                : ''}
            </Typography>
            {location ? (
              <Typography variant="caption" color="text.secondary">
                {location}
              </Typography>
            ) : null}
          </Box>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <AdminLifecycleChip lifecycleStatus={business.lifecycle_status} />
            {rail ? (
              <Chip
                size="small"
                variant="outlined"
                label={
                  rail === 'stripe'
                    ? t('admin.businesses.railStripe', 'Stripe')
                    : t('admin.businesses.railMobileMoney', 'Mobile money')
                }
              />
            ) : null}
          </Stack>
        </Box>

        <AdminBusinessVerificationSteps summary={summary} dense />

        {draftBlocker ? (
          <Typography variant="caption" color="text.secondary">
            {t(
              'admin.businesses.draftNextStep',
              'Still Draft — next step: {{step}}',
              { step: formatVerificationBlocker(draftBlocker, t) }
            )}
          </Typography>
        ) : null}

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            variant="outlined"
            color={business.is_storefront_visible ? 'success' : 'default'}
            label={
              business.is_storefront_visible
                ? t('admin.businesses.meta.storefrontOn', 'Storefront on')
                : t('admin.businesses.meta.storefrontOff', 'Storefront off')
            }
          />
          <Chip
            size="small"
            variant="outlined"
            color={business.can_accept_orders ? 'success' : 'default'}
            label={
              business.can_accept_orders
                ? t('admin.businesses.meta.canAcceptOrders', 'Can accept orders')
                : t(
                    'admin.businesses.meta.cannotAcceptOrders',
                    'Cannot accept orders'
                  )
            }
          />
          {summary?.idDocumentStatus ? (
            <Chip
              size="small"
              variant="outlined"
              color={
                summary.idDocumentStatus === 'approved'
                  ? 'success'
                  : summary.idDocumentStatus === 'pending'
                    ? 'warning'
                    : summary.idDocumentStatus === 'rejected'
                      ? 'error'
                      : 'default'
              }
              label={t(
                `admin.businesses.idStatus.${summary.idDocumentStatus}`,
                summary.idDocumentStatus
              )}
            />
          ) : null}
          {createdLabel ? (
            <Chip
              size="small"
              variant="outlined"
              label={t('admin.businesses.meta.created', 'Created {{date}}', {
                date: createdLabel,
              })}
            />
          ) : null}
        </Stack>

        <Divider />

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={onVerify}
            >
              {t('admin.businesses.verification', 'Verification')}
            </Button>
            {business.lifecycle_status === 'suspended' ? (
              <Button size="small" variant="outlined" onClick={onReinstate}>
                {t('admin.businesses.reinstate', 'Reinstate')}
              </Button>
            ) : (
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={onSuspend}
              >
                {t('admin.businesses.suspend', 'Suspend')}
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              startIcon={<EditIcon />}
              onClick={onEdit}
            >
              {t('common.edit', 'Edit')}
            </Button>
          </Stack>
          {business.user_id ? (
            <Stack direction="row" spacing={0.5}>
              <Button
                size="small"
                component={RouterLink}
                to={`/admin/businesses/${business.user_id}/documents`}
                startIcon={<DescriptionIcon />}
              >
                {t('admin.businesses.docs', 'Docs')}
              </Button>
              <Button
                size="small"
                component={RouterLink}
                to={`/admin/businesses/${business.user_id}/messages`}
                startIcon={<MessageIcon />}
              >
                {t('admin.businesses.messages', 'Messages')}
              </Button>
            </Stack>
          ) : null}
        </Box>
      </CardContent>
    </Card>
  );
};
