import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import {
  Box,
  Button,
  ButtonBase,
  Skeleton,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogStore } from '../../hooks/useCatalogStores';
import { StoreDefaultAvatar } from '../illustrations/StoreDefaultAvatar';
import { storeAvatarPalette } from '../../utils/storeAvatarPalette';

export interface BrowseStoresStripProps {
  stores: CatalogStore[];
  loading: boolean;
  onStoreClick: (businessLocationId: string) => void;
  onSeeAll?: () => void;
}

function StorePill({
  store,
  onSelect,
  unnamedLabel,
  cityLabel,
  metaLabel,
  openingSoonLabel,
}: {
  store: CatalogStore;
  onSelect: () => void;
  unnamedLabel: string;
  cityLabel: string | null;
  metaLabel: string;
  openingSoonLabel: string;
}) {
  const theme = useTheme();
  const name = store.name?.trim() || unnamedLabel;
  const openingSoon =
    store.is_storefront_visible && !store.can_accept_orders;
  const palette = storeAvatarPalette(name);

  return (
    <ButtonBase
      onClick={onSelect}
      focusRipple
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
        borderColor: alpha(palette.bg, 0.28),
        bgcolor: alpha(theme.palette.background.paper, 0.95),
        boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.06)}`,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, 0.1)}`,
          borderColor: palette.accent,
        },
      }}
    >
      <Box
        sx={{
          height: 52,
          bgcolor: palette.bgSoft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${alpha(palette.accent, 0.35)}`,
        }}
      >
        {store.logo_url ? (
          <img
            src={store.logo_url}
            alt={name}
            width={40}
            height={40}
            style={{
              flexShrink: 0,
              objectFit: 'contain',
              display: 'block',
              borderRadius: 8,
              background: '#fff',
            }}
          />
        ) : (
          <StoreDefaultAvatar name={name} size={40} />
        )}
      </Box>
      <Box sx={{ p: 1.25, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} noWrap>
          {name}
        </Typography>
        {cityLabel ? (
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.15, color: 'text.secondary' }}
            noWrap
          >
            {cityLabel}
          </Typography>
        ) : null}
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 0.25, color: 'text.secondary' }}
        >
          {metaLabel}
        </Typography>
        {openingSoon ? (
          <Typography
            variant="caption"
            sx={{ color: 'warning.main', fontWeight: 600 }}
          >
            {openingSoonLabel}
          </Typography>
        ) : null}
      </Box>
    </ButtonBase>
  );
}

const BrowseStoresStrip: React.FC<BrowseStoresStripProps> = ({
  stores,
  loading,
  onStoreClick,
  onSeeAll,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  if (!loading && stores.length === 0) return null;

  const itemCountLabel = (n: number) =>
    t('stores.itemCount', '{{count}} items', { count: n });

  const metaFor = (store: CatalogStore) => {
    const itemPhrase = itemCountLabel(store.item_count);
    if (
      store.distance_meters != null &&
      Number.isFinite(store.distance_meters)
    ) {
      const km =
        store.distance_meters < 1000
          ? (store.distance_meters / 1000).toFixed(1)
          : Math.round(store.distance_meters / 1000).toString();
      const distanceStr = t('stores.approxKm', '~{{km}} km', { km });
      return `${distanceStr} · ${itemPhrase}`;
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
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1.75,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorefrontOutlinedIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography
            component="h2"
            variant="overline"
            sx={{ fontWeight: 700, letterSpacing: '0.1em', color: 'text.secondary' }}
          >
            {t('stores.rowTitle', 'Browse by store locations')}
          </Typography>
        </Box>
        {onSeeAll ? (
          <Button size="small" onClick={onSeeAll}>
            {t('stores.seeAll', 'See all')}
          </Button>
        ) : null}
      </Box>

      <Box
        sx={{
          display: { xs: 'grid', sm: 'flex' },
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'none' },
          gap: 1.5,
          flexWrap: { xs: 'unset', sm: 'wrap' },
          justifyContent: { sm: 'flex-start' },
        }}
      >
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                variant="rounded"
                sx={{
                  width: { xs: '100%', sm: 184 },
                  height: 76,
                  borderRadius: 2.5,
                }}
              />
            ))
          : stores.map((store) => (
              <StorePill
                key={store.business_location_id}
                store={store}
                onSelect={() => onStoreClick(store.business_location_id)}
                unnamedLabel={t('stores.unnamed', 'Store')}
                cityLabel={store.city?.trim() || null}
                metaLabel={metaFor(store)}
                openingSoonLabel={t(
                  'business.lifecycle.openingSoonBadge',
                  'Opening Soon'
                )}
              />
            ))}
      </Box>
    </Box>
  );
};

export default BrowseStoresStrip;
