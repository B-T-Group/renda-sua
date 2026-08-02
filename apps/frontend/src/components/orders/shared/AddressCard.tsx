import { LocationOn, Navigation } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface AddressFields {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  instructions?: string | null;
}

export interface AddressCardProps {
  title: string;
  address?: AddressFields | null;
  instructions?: string | null;
  showNavigate?: boolean;
  onNavigate?: () => void;
  emptyLabel?: string;
}

function formatAddress(address: AddressFields): string {
  return [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ]
    .filter(Boolean)
    .join(', ');
}

function openMaps(address: AddressFields) {
  const query =
    address.latitude != null && address.longitude != null
      ? `${address.latitude},${address.longitude}`
      : formatAddress(address);
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`,
    '_blank'
  );
}

export const AddressCard: React.FC<AddressCardProps> = ({
  title,
  address,
  instructions,
  showNavigate = false,
  onNavigate,
  emptyLabel,
}) => {
  const { t } = useTranslation();
  const notes = instructions ?? address?.instructions;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LocationOn color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>
              {title}
            </Typography>
          </Stack>
          {address ? (
            <Typography variant="body2">{formatAddress(address)}</Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {emptyLabel ?? t('orders.address.unavailable', 'Address unavailable')}
            </Typography>
          )}
          {notes ? (
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('orders.address.instructions', 'Instructions')}
              </Typography>
              <Typography variant="body2">{notes}</Typography>
            </Box>
          ) : null}
          {showNavigate && address ? (
            <Button
              variant="contained"
              startIcon={<Navigation />}
              onClick={onNavigate ?? (() => openMaps(address))}
              size="small"
            >
              {t('orders.address.navigate', 'Navigate')}
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default AddressCard;
