import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { Box, ButtonBase, Skeleton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TopInventoryLocationRow } from '../../hooks/useTopInventoryLocations';

export interface TopLocationsStripProps {
  locations: TopInventoryLocationRow[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (loc: { id: string; name: string }) => void;
}

function LocationPill({
  loc,
  selected,
  onSelect,
  unnamedLabel,
  subtitle,
}: {
  loc: TopInventoryLocationRow;
  selected: boolean;
  onSelect: () => void;
  unnamedLabel: string;
  subtitle: string;
}) {
  const theme = useTheme();
  const name = loc.name?.trim() || unnamedLabel;

  return (
    <ButtonBase
      onClick={onSelect}
      focusRipple
      aria-pressed={selected}
      sx={{
        touchAction: 'manipulation',
        display: 'block',
        width: { xs: '100%', sm: 184 },
        minWidth: 0,
        flexShrink: 0,
        textAlign: 'left',
        borderRadius: 2.5,
        overflow: 'hidden',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected
          ? 'primary.main'
          : alpha(theme.palette.background.paper, 0.9),
        boxShadow: selected
          ? `0 4px 14px ${alpha(theme.palette.primary.main, 0.35)}`
          : `0 1px 3px ${alpha(theme.palette.common.black, 0.06)}`,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: selected
            ? `0 6px 20px ${alpha(theme.palette.primary.main, 0.4)}`
            : `0 4px 16px ${alpha(theme.palette.common.black, 0.1)}`,
          borderColor: 'primary.light',
        },
        '&.Mui-focusVisible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          p: 1.25,
          color: selected ? 'primary.contrastText' : 'text.primary',
        }}
      >
        {loc.logo_url ? (
          <img
            src={loc.logo_url}
            alt={name}
            width={44}
            height={44}
            style={{
              flexShrink: 0,
              objectFit: 'contain',
              display: 'block',
            }}
          />
        ) : (
          <Box
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: selected
                ? alpha(theme.palette.common.white, 0.2)
                : alpha(theme.palette.primary.main, 0.12),
              color: selected ? 'primary.contrastText' : 'primary.main',
              border: '1px solid',
              borderColor: selected
                ? alpha(theme.palette.common.white, 0.35)
                : alpha(theme.palette.primary.main, 0.2),
              fontSize: '1.1rem',
              fontWeight: 700,
            }}
          >
            {name.slice(0, 1).toUpperCase()}
          </Box>
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            fontWeight={700}
            noWrap
            sx={{
              color: 'inherit',
              lineHeight: 1.3,
              letterSpacing: '-0.01em',
            }}
          >
            {name}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.25,
              color: selected
                ? alpha(theme.palette.primary.contrastText, 0.85)
                : 'text.secondary',
              fontWeight: 500,
            }}
          >
            {subtitle}
          </Typography>
        </Box>
      </Box>
    </ButtonBase>
  );
}

function LoadingPills() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          sx={{
            width: { xs: '100%', sm: 184 },
            minWidth: 0,
            height: 76,
            flexShrink: 0,
            borderRadius: 2.5,
          }}
        />
      ))}
    </>
  );
}

const TopLocationsStrip: React.FC<TopLocationsStripProps> = ({
  locations,
  loading,
  selectedId,
  onSelect,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  if (!loading && locations.length === 0) {
    return null;
  }

  const itemCountLabel = (n: number) =>
    t('public.items.topLocationsItemCount', '{{count}} items', {
      count: n,
    });

  const locationSubtitle = (loc: TopInventoryLocationRow) => {
    const itemPhrase = itemCountLabel(loc.item_count);
    if (
      loc.distance_meters != null &&
      Number.isFinite(loc.distance_meters)
    ) {
      const km =
        loc.distance_meters < 1000
          ? (loc.distance_meters / 1000).toFixed(1)
          : Math.round(loc.distance_meters / 1000).toString();
      const distanceStr = t('public.items.topLocationsApproxKm', '~{{km}} km', {
        km,
      });
      return t(
        'public.items.topLocationsDistanceAndItems',
        '{{distance}} · {{itemPhrase}}',
        { distance: distanceStr, itemPhrase }
      );
    }
    return itemPhrase;
  };

  return (
    <Box
      sx={{
        mb: 2.5,
        borderRadius: 3,
        p: { xs: 1.75, sm: 2.25 },
        background:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.primary.main, 0.08)
            : `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 45%, ${alpha(theme.palette.secondary?.main ?? theme.palette.primary.main, 0.04)} 100%)`,
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.9),
        boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, 0.06)}`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 0.75, sm: 1 },
          mb: 1.75,
          textAlign: { xs: 'center', sm: 'left' },
          px: { xs: 0.5, sm: 0 },
        }}
      >
        <StorefrontOutlinedIcon
          sx={{
            fontSize: { xs: 22, sm: 20 },
            color: 'primary.main',
            opacity: 0.9,
            flexShrink: 0,
          }}
        />
        <Typography
          component="h2"
          variant="overline"
          sx={{
            fontWeight: 700,
            letterSpacing: { xs: '0.08em', sm: '0.12em' },
            color: 'text.secondary',
            lineHeight: 1.25,
            maxWidth: { xs: '100%', sm: 'none' },
            whiteSpace: { xs: 'normal', sm: 'nowrap' },
          }}
        >
          {t(
            'public.items.topLocationsTitle',
            'Stores closest to you'
          )}
        </Typography>
      </Box>

      <Box
        sx={{
          display: { xs: 'grid', sm: 'flex' },
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'none',
          },
          gap: 1.5,
          flexWrap: { xs: 'unset', sm: 'wrap' },
          justifyContent: { sm: 'center' },
          alignItems: 'stretch',
        }}
      >
        {loading ? (
          <LoadingPills />
        ) : (
          locations.map((loc) => (
            <LocationPill
              key={loc.id}
              loc={loc}
              selected={selectedId === loc.id}
              onSelect={() => onSelect({ id: loc.id, name: loc.name })}
              unnamedLabel={t('public.items.unnamedLocation', 'Store')}
              subtitle={locationSubtitle(loc)}
            />
          ))
        )}
      </Box>

      <Typography
        variant="caption"
        sx={{
          display: 'block',
          textAlign: 'center',
          mt: 1.25,
          color: 'text.secondary',
          opacity: 0.85,
        }}
      >
        {t(
          'public.items.topLocationsHint',
          'Tap a location to filter the catalog.'
        )}
      </Typography>
    </Box>
  );
};

export default TopLocationsStrip;
