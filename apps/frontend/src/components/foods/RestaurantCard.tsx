import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { CatalogStore } from '../../hooks/useCatalogStores';
import { StoreDefaultAvatar } from '../illustrations/StoreDefaultAvatar';
import { formatDistanceKm } from '../../utils/formatDistanceKm';
import { storeAvatarPalette } from '../../utils/storeAvatarPalette';

type Props = {
  store: CatalogStore;
  /** Stretch to the carousel tile so every card is the same height. */
  fill?: boolean;
};

export default function RestaurantCard({ store, fill = false }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const name = store.name?.trim() || t('stores.unnamed', 'Store');
  const city = store.city?.trim() || null;
  const km = formatDistanceKm(store.distance_meters);
  const palette = storeAvatarPalette(name);
  const openMenu = () => {
    navigate(`/store/${store.business_location_id}?menu=food`);
  };

  return (
    <ButtonBase
      onClick={openMenu}
      sx={{
        textAlign: 'left',
        borderRadius: 2,
        display: 'flex',
        width: '100%',
        height: fill ? '100%' : undefined,
      }}
      aria-label={t('foods.restaurants.openMenu', 'Open {{name}} menu', { name })}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          height: fill ? '100%' : undefined,
          p: 2,
          border: 1,
          borderColor: alpha(palette.bg, 0.28),
          borderRadius: 2,
          display: 'flex',
          gap: 1.5,
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        <RestaurantLogo store={store} name={name} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={700} noWrap>
            {name}
          </Typography>
          {city ? (
            <Typography variant="body2" color="text.secondary" noWrap>
              {city}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            {t('foods.restaurants.dishCount', '{{count}} dishes', {
              count: store.item_count,
            })}
          </Typography>
          {km ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <PlaceOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="body2" color="primary.main" fontWeight={600}>
                {t('foods.distanceFromYou', '{{km}} km from you', { km })}
              </Typography>
            </Box>
          ) : null}
        </Box>
      </Paper>
    </ButtonBase>
  );
}

function RestaurantLogo({ store, name }: { store: CatalogStore; name: string }) {
  if (!store.logo_url) return <StoreDefaultAvatar name={name} size={64} />;
  return (
    <Box
      component="img"
      src={store.logo_url}
      alt=""
      sx={{
        width: 64,
        height: 64,
        objectFit: 'contain',
        borderRadius: 1.5,
        bgcolor: 'common.white',
        flexShrink: 0,
      }}
    />
  );
}
