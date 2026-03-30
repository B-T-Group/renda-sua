import {
  AccountBalance as AccountBalanceIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Store as StoreIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BusinessLocation } from '../../hooks/useBusinessLocations';

/** Minimal account info for display on the card */
export interface LocationAccountInfo {
  currency: string;
  available_balance: number;
  total_balance: number;
  withheld_balance?: number;
}

interface LocationCardProps {
  location: BusinessLocation;
  /** When present, shows this location's account balance on the card */
  account?: LocationAccountInfo | null;
  onEdit: (location: BusinessLocation) => void;
  onDelete: (location: BusinessLocation) => void;
  onToggleStatus: (location: BusinessLocation) => void;
}

const LocationCard: React.FC<LocationCardProps> = ({
  location,
  account,
  onEdit,
  onDelete,
  onToggleStatus,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const formatAddress = (address: BusinessLocation['address']) => {
    if (!address) return '';
    const parts = [
      address.address_line_1,
      address.city,
      address.state,
      address.postal_code,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const formatBalance = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        opacity: location.is_active ? 1 : 0.65,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: location.is_active ? 'translateY(-4px)' : 'none',
          boxShadow: location.is_active ? theme.shadows[8] : theme.shadows[2],
        },
        borderLeft: `4px solid ${
          location.is_active
            ? theme.palette.success.main
            : theme.palette.grey[400]
        }`,
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1, px: 2, pt: 2 }}>
        {/* Header: logo, name, delete */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={2}
          gap={1.5}
        >
          <Avatar
            src={location.logo_url?.trim() || undefined}
            variant="rounded"
            alt=""
            sx={{
              width: 56,
              height: 56,
              flexShrink: 0,
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <StoreIcon sx={{ color: 'text.secondary' }} />
          </Avatar>
          <Typography
            variant="h6"
            component="div"
            sx={{
              fontWeight: 700,
              fontSize: '1.1rem',
              flex: 1,
              minWidth: 0,
              pr: 1,
              wordBreak: 'break-word',
            }}
          >
            {location.name}
          </Typography>
          <Tooltip
            title={
              location.is_primary
                ? t(
                    'business.locations.cannotDeletePrimary',
                    'Cannot delete primary location'
                  )
                : t('business.locations.deleteLocation', 'Delete Location')
            }
          >
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={() => onDelete(location)}
                disabled={location.is_primary}
                sx={{
                  opacity: location.is_primary ? 0.3 : 1,
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Stack spacing={2}>
          {/* Address - full width for readability */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <LocationIcon
                sx={{ fontSize: 20, color: 'text.secondary', mt: 0.25 }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ lineHeight: 1.5, flex: 1, minWidth: 0 }}
              >
                {formatAddress(location.address)}
              </Typography>
            </Stack>
          </Box>

          {/* Commission */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              {t('business.locations.commissionLabel', 'RendaSua commission')}:{' '}
              {location.rendasua_item_commission_percentage != null
                ? `${location.rendasua_item_commission_percentage}%`
                : t('business.locations.commissionDefault', '5% (default)')}
            </Typography>
          </Box>

          {/* Auto-withdraw to mobile (commission payouts) */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="body2" color="text.secondary">
                {t(
                  'business.locations.autoWithdrawStatus',
                  'Auto payouts to phone'
                )}
                :
              </Typography>
              <Chip
                size="small"
                label={
                  location.auto_withdraw_commissions !== false
                    ? t('business.locations.autoWithdrawOn', 'On')
                    : t('business.locations.autoWithdrawOff', 'Off')
                }
                color={
                  location.auto_withdraw_commissions !== false
                    ? 'success'
                    : 'default'
                }
                variant={
                  location.auto_withdraw_commissions !== false
                    ? 'filled'
                    : 'outlined'
                }
                sx={{ height: 22, fontWeight: 600, fontSize: '0.75rem' }}
              />
            </Stack>
            {location.auto_withdraw_commissions !== false &&
              !location.phone?.trim() && (
                <Typography
                  variant="caption"
                  color="warning.main"
                  display="block"
                  sx={{ mt: 0.5 }}
                >
                  {t(
                    'business.locations.autoWithdrawNeedsPhone',
                    'Add a phone number above for automatic payouts to work.'
                  )}
                </Typography>
              )}
          </Box>

          {/* Location account balance */}
          {account && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                <AccountBalanceIcon
                  sx={{ fontSize: 18, color: 'primary.main' }}
                />
                <Typography variant="subtitle2" color="text.secondary">
                  {t('business.locations.locationAccount', 'Location account')}
                </Typography>
              </Stack>
              <Typography variant="h6" color="primary.main" fontWeight={600}>
                {formatBalance(account.total_balance, account.currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('accounts.availableBalance', 'Available')}:{' '}
                {formatBalance(account.available_balance, account.currency)}
                {account.withheld_balance != null &&
                  account.withheld_balance > 0 && (
                    <>
                      {' · '}
                      {t('accounts.withheld', 'Withheld')}:{' '}
                      {formatBalance(account.withheld_balance, account.currency)}
                    </>
                  )}
              </Typography>
            </Box>
          )}

          {/* Contact - phone on its own line, note below */}
          {location.phone && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {location.phone}
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.25, ml: 3.5, fontStyle: 'italic' }}
              >
                {t('business.locations.phoneWithdrawalNote', 'Used for withdrawals from this location\'s account')}
              </Typography>
            </Box>
          )}

          {location.email && (
            <Stack direction="row" spacing={1} alignItems="center">
              <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ wordBreak: 'break-word', minWidth: 0 }}
              >
                {location.email}
              </Typography>
            </Stack>
          )}
        </Stack>

        {/* Badges */}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} sx={{ mt: 2 }}>
          {location.is_primary && (
            <Chip
              label={t('business.locations.primary', 'Primary')}
              color="primary"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          )}
          <Chip
            label={t(
              `business.locations.${location.location_type}`,
              location.location_type
            )}
            color="secondary"
            size="small"
            variant="outlined"
          />
          <Chip
            label={
              location.is_active
                ? t('business.locations.active', 'Active')
                : t('business.locations.inactive', 'Inactive')
            }
            color={location.is_active ? 'success' : 'default'}
            size="small"
          />
        </Stack>
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2, pt: 0 }}>
        <Button
          size="small"
          startIcon={<EditIcon />}
          onClick={() => onEdit(location)}
          sx={{ textTransform: 'none' }}
        >
          {t('business.locations.edit', 'Edit')}
        </Button>
        <Button
          size="small"
          onClick={() => onToggleStatus(location)}
          variant="outlined"
          sx={{ textTransform: 'none' }}
        >
          {location.is_active
            ? t('business.locations.deactivate', 'Deactivate')
            : t('business.locations.activate', 'Activate')}
        </Button>
      </CardActions>
    </Card>
  );
};

export default LocationCard;
