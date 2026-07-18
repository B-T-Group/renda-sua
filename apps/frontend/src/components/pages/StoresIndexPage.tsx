import {
  Box,
  Container,
  TextField,
  Typography,
  InputAdornment,
  Paper,
  ButtonBase,
  Skeleton,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useCatalogStores } from '../../hooks/useCatalogStores';
import { usePublicBrowserGeo } from '../../hooks/usePublicBrowserGeo';
import SEOHead from '../seo/SEOHead';
import { StoreDefaultAvatar } from '../illustrations/StoreDefaultAvatar';
import { storeAvatarPalette } from '../../utils/storeAvatarPalette';
import { alpha } from '@mui/material/styles';

const StoresIndexPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const browserGeo = usePublicBrowserGeo(!isAuthenticated);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchDraft.trim()), 400);
    return () => window.clearTimeout(id);
  }, [searchDraft]);

  const { stores, loading, error } = useCatalogStores({
    limit: 50,
    search,
    anonymousOrigin: browserGeo,
  });

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <SEOHead
        title={t('stores.listTitle', 'Store locations')}
        description={t(
          'stores.listSeoDescription',
          'Browse local store locations on Rendasua.'
        )}
      />
      <Typography variant="h4" fontWeight={800} gutterBottom>
        {t('stores.listTitle', 'Store locations')}
      </Typography>
      <TextField
        fullWidth
        size="small"
        value={searchDraft}
        onChange={(e) => setSearchDraft(e.target.value)}
        placeholder={t('stores.searchPlaceholder', 'Search store locations')}
        sx={{ mb: 2, maxWidth: 420 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        }}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={88} />
            ))
          : stores.map((store) => {
              const name = store.name?.trim() || t('stores.unnamed', 'Store');
              const city = store.city?.trim() || null;
              const palette = storeAvatarPalette(name);
              const itemPhrase = t('stores.itemCount', '{{count}} items', {
                count: store.item_count,
              });
              let meta = itemPhrase;
              if (
                store.distance_meters != null &&
                Number.isFinite(store.distance_meters)
              ) {
                const km =
                  store.distance_meters < 1000
                    ? (store.distance_meters / 1000).toFixed(1)
                    : Math.round(store.distance_meters / 1000).toString();
                meta = `${t('stores.approxKm', '~{{km}} km', { km })} · ${itemPhrase}`;
              }
              return (
                <ButtonBase
                  key={store.business_location_id}
                  onClick={() =>
                    navigate(`/store/${store.business_location_id}`)
                  }
                  sx={{ textAlign: 'left', borderRadius: 2 }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      width: '100%',
                      p: 2,
                      pl: 2.5,
                      border: 1,
                      borderColor: alpha(palette.bg, 0.25),
                      borderRadius: 2,
                      display: 'flex',
                      gap: 1.5,
                      alignItems: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        bgcolor: palette.accent,
                      },
                    }}
                  >
                    {store.logo_url ? (
                      <Box
                        component="img"
                        src={store.logo_url}
                        alt={name}
                        sx={{
                          width: 56,
                          height: 56,
                          objectFit: 'contain',
                          borderRadius: 1.5,
                          border: `1.5px solid ${alpha(palette.bg, 0.3)}`,
                          bgcolor: 'common.white',
                        }}
                      />
                    ) : (
                      <StoreDefaultAvatar name={name} size={56} />
                    )}
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700} noWrap>
                        {name}
                      </Typography>
                      {city ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                        >
                          {city}
                        </Typography>
                      ) : null}
                      <Typography variant="body2" color="text.secondary">
                        {meta}
                      </Typography>
                    </Box>
                  </Paper>
                </ButtonBase>
              );
            })}
      </Box>
      {!loading && stores.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
          {t('stores.empty', 'No store locations to show yet.')}
        </Typography>
      ) : null}
    </Container>
  );
};

export default StoresIndexPage;
