import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import {
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

interface LocationCardProps {
  location: BusinessLocation;
  onEdit: (location: BusinessLocation) => void;
  onDelete: (location: BusinessLocation) => void;
  onToggleStatus: (location: BusinessLocation) => void;
}

const LocationCard: React.FC<LocationCardProps> = ({
  location,
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
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Header with Name and Delete Button */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={2}
        >
          <Typography
            variant="h6"
            component="div"
            sx={{
              fontWeight: 700,
              fontSize: '1.1rem',
              flex: 1,
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

        {/* Address */}
        <Box mb={2}>
          <Stack direction="row" spacing={0.5} alignItems="flex-start" mb={1}>
            <LocationIcon
              sx={{ fontSize: 18, color: 'text.secondary', mt: 0.3 }}
            />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.5 }}
            >
              {formatAddress(location.address)}
            </Typography>
          </Stack>

          {/* Contact Info */}
          {location.phone && (
            <Stack direction="row" spacing={0.5} alignItems="center" mb={0.5}>
              <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {location.phone}
              </Typography>
            </Stack>
          )}

          {location.email && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  wordBreak: 'break-word',
                }}
              >
                {location.email}
              </Typography>
            </Stack>
          )}
        </Box>

        {/* Badges */}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
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
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
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
