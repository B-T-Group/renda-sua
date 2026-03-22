import {
  Business,
  InfoOutlined,
  LocationOn as LocationOnIcon,
  Verified,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RentalListingRow } from '../../hooks/useRentalListings';

function formatListingPrice(amount: string | number, currency: string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) {
    return `${amount} ${currency}`;
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'XAF',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

function formatLocationAddressLines(
  addr: RentalListingRow['business_location']['address'] | undefined
): { line1: string; line2: string } {
  const line1 = [addr?.address_line_1, addr?.address_line_2]
    .filter(Boolean)
    .join(', ');
  const line2 = [addr?.city, addr?.state, addr?.postal_code, addr?.country]
    .filter(Boolean)
    .join(' · ');
  return { line1, line2 };
}

export interface RentalItemCardProps {
  listing: RentalListingRow;
  onViewDetails: () => void;
  onRequestRental: () => void;
}

export const RentalItemCard: React.FC<RentalItemCardProps> = ({
  listing,
  onViewDetails,
  onRequestRental,
}) => {
  const { t } = useTranslation();
  const item = listing.rental_item;
  const images = item.rental_item_images ?? [];
  const firstImg = images[0];
  const imgUrl = firstImg?.image_url;
  const addr = listing.business_location.address;
  const { line1, line2 } = formatLocationAddressLines(addr);
  const price = formatListingPrice(listing.base_price_per_day, item.currency);
  const hasRoute =
    Boolean(listing.distance_text?.trim()) &&
    Boolean(listing.duration_text?.trim());

  return (
    <Card
      sx={{
        height: '100%',
        width: '100%',
        maxWidth: { xs: 'none', sm: 400 },
        mx: { xs: 0, sm: 'auto' },
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
          borderColor: 'primary.main',
        },
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: 240,
          flexShrink: 0,
          overflow: 'hidden',
          position: 'relative',
          bgcolor: 'grey.300',
        }}
      >
        {imgUrl ? (
          <CardMedia
            component="img"
            height="240"
            image={imgUrl}
            alt={firstImg?.alt_text || item.name}
            loading="lazy"
            sx={{
              objectFit: 'cover',
              width: '100%',
              height: '100%',
              transition: 'transform 0.3s ease',
              '.MuiCard-root:hover &': { transform: 'scale(1.05)' },
            }}
          />
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ height: '100%', px: 2 }}
          >
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {t('rentals.noImage', 'No image')}
            </Typography>
          </Stack>
        )}
        <Chip
          label={item.rental_category.name}
          size="small"
          color="primary"
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            fontWeight: 700,
            fontSize: '0.7rem',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            px: 2,
            py: 1,
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <Typography variant="subtitle1" fontWeight={800} color="primary.main">
            {price}
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              sx={{ ml: 0.5 }}
            >
              {t('rentals.perDay', '/ day')}
            </Typography>
          </Typography>
        </Box>
      </Box>

      <CardContent
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 2,
          '&:last-child': { pb: 2 },
        }}
      >
        <Typography
          variant="h6"
          component="h2"
          sx={{
            fontWeight: 700,
            fontSize: '1.05rem',
            lineHeight: 1.35,
            mb: 0.75,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '2.7em',
          }}
        >
          {item.name}
        </Typography>

        {item.description?.trim() ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.55,
              overflowWrap: 'anywhere',
            }}
          >
            {item.description.trim()}
          </Typography>
        ) : null}

        <Box sx={{ mb: 1 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}
          >
            <Business fontSize="small" color="primary" />
            <Typography
              variant="caption"
              fontWeight="medium"
              sx={{ fontSize: '0.75rem' }}
            >
              {item.business.name}
            </Typography>
            {item.business.is_verified ? (
              <Verified fontSize="small" color="success" sx={{ ml: -0.25 }} />
            ) : null}
          </Box>
        </Box>

        <Stack direction="row" alignItems="flex-start" gap={0.5} sx={{ mb: 1, minWidth: 0 }}>
          <LocationOnIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0, mt: 0.15 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" fontWeight={700} color="text.primary" display="block">
              {listing.business_location.name}
            </Typography>
            {line1 ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                {line1}
              </Typography>
            ) : null}
            {line2 ? (
              <Typography variant="caption" color="text.secondary" display="block">
                {line2}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        {hasRoute ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.7rem', mb: 1.5, display: 'block' }}
          >
            {t('rentals.routeFromYou', '{{distance}} • {{duration}} from you', {
              distance: listing.distance_text,
              duration: listing.duration_text,
            })}
          </Typography>
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 'auto' }}>
          <Button
            variant="contained"
            fullWidth
            size="medium"
            onClick={(e) => {
              e.stopPropagation();
              onRequestRental();
            }}
            sx={{ minHeight: 44, fontWeight: 700, borderRadius: 2 }}
          >
            {t('rentals.catalog.requestRentalCta', 'Request rental')}
          </Button>
          <Button
            variant="outlined"
            fullWidth
            size="medium"
            startIcon={<InfoOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
            sx={{ minHeight: 44, fontWeight: 600, borderRadius: 2 }}
          >
            {t('rentals.catalog.viewDetails', 'View details')}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};
