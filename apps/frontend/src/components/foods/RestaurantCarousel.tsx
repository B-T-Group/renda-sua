import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import type { CatalogStore } from '../../hooks/useCatalogStores';
import RestaurantCard from './RestaurantCard';

const TILE_WIDTH = 220;

export function RestaurantCarousel({
  stores,
  onMore,
}: {
  stores: CatalogStore[];
  onMore: () => void;
}) {
  const { t } = useTranslation();
  if (stores.length === 0) return null;
  const title = t('foods.restaurants.section', 'Restaurants');
  return (
    <Box component="section" aria-label={title} sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.25 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 0.5, alignItems: 'stretch' }}>
        {stores.map((store) => (
          <Box
            key={store.business_location_id}
            sx={{ width: TILE_WIDTH, flex: '0 0 auto', display: 'flex' }}
          >
            <RestaurantCard store={store} fill />
          </Box>
        ))}
        <MoreRestaurantsTile onMore={onMore} />
      </Box>
    </Box>
  );
}

function MoreRestaurantsTile({ onMore }: { onMore: () => void }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ width: TILE_WIDTH, flex: '0 0 auto', display: 'flex' }}>
      <Card sx={{ width: '100%', height: '100%', borderRadius: 2 }}>
        <CardActionArea
          onClick={onMore}
          aria-label={t('foods.restaurants.moreA11y', 'Browse all restaurants')}
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            bgcolor: 'action.hover',
          }}
        >
          <MoreMark />
          <Typography fontWeight={800}>{t('foods.restaurants.more', 'More')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('foods.restaurants.moreHint', 'All restaurants')}
          </Typography>
        </CardActionArea>
      </Card>
    </Box>
  );
}

function MoreMark() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 56,
        height: 56,
        mb: 0.5,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 0.75,
      }}
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <Box key={index} sx={{ borderRadius: 1, bgcolor: 'primary.main', opacity: 0.85 }} />
      ))}
    </Box>
  );
}
