import { Box, Chip, Skeleton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { TopRentalLocationRow } from '../../hooks/useRentalListings';

function formatDistance(meters: number | null): string | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export interface RentalLocationsStripProps {
  locations: TopRentalLocationRow[];
  loading?: boolean;
  selectedLocationId?: string;
  onSelectLocation: (locationId: string) => void;
}

export function RentalLocationsStrip({
  locations,
  loading,
  selectedLocationId,
  onSelectLocation,
}: RentalLocationsStripProps) {
  const { t } = useTranslation();

  if (loading && locations.length === 0) {
    return (
      <Stack direction="row" spacing={1} sx={{ py: 1 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" width={140} height={56} />
        ))}
      </Stack>
    );
  }

  if (locations.length === 0) return null;

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
        {t('rentals.catalog.nearYouTitle', 'Rentals near you')}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
        {locations.map((loc) => {
          const selected = loc.id === selectedLocationId;
          const distance = formatDistance(loc.distance_meters);
          const subtitle =
            [loc.city ?? loc.state, distance ? `~${distance}` : null]
              .filter(Boolean)
              .join(' · ') ||
            t('rentals.catalog.locationListingCount', '{{count}} listings', {
              count: loc.listing_count,
            });
          return (
            <Chip
              key={loc.id}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {loc.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {subtitle}
                  </Typography>
                </Box>
              }
              onClick={() => onSelectLocation(loc.id)}
              variant={selected ? 'filled' : 'outlined'}
              color={selected ? 'primary' : 'default'}
              sx={{
                height: 'auto',
                py: 1,
                '& .MuiChip-label': { display: 'block', whiteSpace: 'normal' },
                minWidth: 140,
                flexShrink: 0,
              }}
            />
          );
        })}
      </Stack>
    </Box>
  );
}

export function RentalCardSkeleton() {
  return (
    <Box>
      <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
      <Skeleton variant="text" width="80%" sx={{ mt: 1.5 }} />
      <Skeleton variant="text" width="55%" />
      <Skeleton variant="rounded" width="40%" height={28} sx={{ mt: 1 }} />
    </Box>
  );
}
