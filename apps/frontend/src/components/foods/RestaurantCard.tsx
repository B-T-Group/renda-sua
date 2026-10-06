import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { CatalogStore } from '../../hooks/useCatalogStores';
import coverKitchen from '../../assets/restaurants/cover-kitchen.jpg';
import coverTable from '../../assets/restaurants/cover-table.jpg';
import { formatDistanceKm } from '../../utils/formatDistanceKm';
import { hashStoreName, storeAvatarPalette } from '../../utils/storeAvatarPalette';

type Props = {
  store: CatalogStore;
  /** Stretch to the carousel tile so every card is the same height. */
  fill?: boolean;
};

export default function RestaurantCard({ store, fill = false }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [logoFailed, setLogoFailed] = useState(false);
  const name = store.name?.trim() || t('stores.unnamed', 'Store');
  const showLogo = Boolean(store.logo_url) && !logoFailed;
  const openMenu = () => navigate(`/store/${store.business_location_id}?menu=food`);

  return (
    <ButtonBase
      onClick={openMenu}
      aria-label={t('foods.restaurants.openMenu', 'Open {{name}} menu', { name })}
      sx={{ textAlign: 'left', borderRadius: 3, display: 'flex', width: '100%', height: '100%' }}
    >
      <Paper elevation={0} className="restaurant-card" sx={paperSx}>
        {showLogo ? (
          <LogoRestaurant name={name} logoUrl={store.logo_url!} onLogoError={() => setLogoFailed(true)} store={store} fill={fill} />
        ) : (
          <IllustratedRestaurant name={name} store={store} />
        )}
      </Paper>
    </ButtonBase>
  );
}

function LogoRestaurant({
  name,
  logoUrl,
  onLogoError,
  store,
  fill,
}: {
  name: string;
  logoUrl: string;
  onLogoError: () => void;
  store: CatalogStore;
  fill: boolean;
}) {
  const palette = storeAvatarPalette(name);
  return (
    <>
      <Box sx={{ height: fill ? 44 : 52, flexShrink: 0, bgcolor: palette.bg }} />
      <Box sx={{ px: 1.5, pb: 1.25, display: 'flex', flexDirection: 'column', gap: 0.25, flex: 1 }}>
        <LogoPlate src={logoUrl} onError={onLogoError} />
        <Typography fontWeight={800} noWrap sx={{ mt: 0.25 }}>{name}</Typography>
        <RestaurantFacts store={store} />
      </Box>
    </>
  );
}

function IllustratedRestaurant({ name, store }: { name: string; store: CatalogStore }) {
  return (
    <>
      <Box sx={coverFrameSx}>
        <Box component="img" src={coverFor(name)} alt="" sx={coverImageSx} />
        <Box sx={nameScrimSx}>
          <Typography fontWeight={800} noWrap sx={{ color: 'common.white', fontSize: '0.95rem' }}>{name}</Typography>
        </Box>
      </Box>
      <Box sx={{ px: 1.5, py: 1 }}>
        <RestaurantFacts store={store} />
      </Box>
    </>
  );
}

function coverFor(name: string): string {
  return COVERS[hashStoreName(name) % COVERS.length];
}

function LogoPlate({ src, onError }: { src: string; onError: () => void }) {
  return (
    <Box sx={plateSx}>
      <Box component="img" src={src} alt="" onError={onError} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </Box>
  );
}

function RestaurantFacts({ store }: { store: CatalogStore }) {
  const { t } = useTranslation();
  const city = store.city?.trim() || null;
  const km = formatDistanceKm(store.distance_meters);
  const dishes = t('foods.restaurants.dishCount', '{{count}} dishes', { count: store.item_count });
  const place = [city, dishes].filter(Boolean).join(' · ');
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" noWrap>{place}</Typography>
      {km ? <DistanceLabel km={km} /> : null}
    </Box>
  );
}

function DistanceLabel({ km }: { km: string }) {
  const { t } = useTranslation();
  return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
      <PlaceOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
      <Typography variant="body2" color="primary.main" fontWeight={700} noWrap>
        {t('foods.distanceFromYou', '{{km}} km from you', { km })}
      </Typography>
    </Box>
  );
}

const paperSx = {
  width: '100%',
  height: '100%',
  border: 1,
  borderColor: 'divider',
  borderRadius: 3,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  transition: 'transform 160ms ease, box-shadow 160ms ease',
  '.MuiButtonBase-root:hover &': { transform: 'translateY(-2px)', boxShadow: 3 },
} as const;

const COVERS = [coverTable, coverKitchen];

const coverFrameSx = {
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 9',
  overflow: 'hidden',
  flexShrink: 0,
  bgcolor: '#1c1410',
} as const;

const coverImageSx = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
} as const;

const plateSx = {
  width: 52,
  height: 52,
  mt: -3.25,
  p: 0.5,
  borderRadius: 1.5,
  bgcolor: 'background.paper',
  boxShadow: 2,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
} as const;

const nameScrimSx = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  px: 2,
  pt: 2,
  pb: 0.75,
  background: 'linear-gradient(transparent, rgba(0,0,0,0.62))',
} as const;
