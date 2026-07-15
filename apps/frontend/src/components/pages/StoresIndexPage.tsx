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
        title={t('stores.listTitle', 'Stores')}
        description={t(
          'stores.listSeoDescription',
          'Browse local stores on Rendasua.'
        )}
      />
      <Typography variant="h4" fontWeight={800} gutterBottom>
        {t('stores.listTitle', 'Stores')}
      </Typography>
      <TextField
        fullWidth
        size="small"
        value={searchDraft}
        onChange={(e) => setSearchDraft(e.target.value)}
        placeholder={t('stores.searchPlaceholder', 'Search stores')}
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
              return (
                <ButtonBase
                  key={store.business_id}
                  onClick={() => navigate(`/store/${store.business_id}`)}
                  sx={{ textAlign: 'left', borderRadius: 2 }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      width: '100%',
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 2,
                      display: 'flex',
                      gap: 1.5,
                      alignItems: 'center',
                    }}
                  >
                    {store.logo_url ? (
                      <Box
                        component="img"
                        src={store.logo_url}
                        alt={name}
                        sx={{ width: 52, height: 52, objectFit: 'contain' }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: 1.5,
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                        }}
                      >
                        {name.slice(0, 1).toUpperCase()}
                      </Box>
                    )}
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700} noWrap>
                        {name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('stores.itemCount', '{{count}} items', {
                          count: store.item_count,
                        })}
                      </Typography>
                    </Box>
                  </Paper>
                </ButtonBase>
              );
            })}
      </Box>
      {!loading && stores.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
          {t('stores.empty', 'No stores to show yet.')}
        </Typography>
      ) : null}
    </Container>
  );
};

export default StoresIndexPage;
