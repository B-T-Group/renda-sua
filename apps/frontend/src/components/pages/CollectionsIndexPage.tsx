import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Container,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useCollections } from '../../hooks/useCollections';
import { usePublicBrowserGeo } from '../../hooks/usePublicBrowserGeo';
import SEOHead from '../seo/SEOHead';

const CollectionsIndexPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const browserGeo = usePublicBrowserGeo(!isAuthenticated);
  const [search, setSearch] = useState('');
  const { collections, loading } = useCollections({
    search,
    anonymousOrigin: browserGeo,
  });

  const sorted = useMemo(
    () => [...collections].sort((a, b) => a.sort_order - b.sort_order),
    [collections]
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4, px: { xs: 1, sm: 2 } }}>
      <SEOHead
        title={t('collections.indexTitle', 'Collections')}
        description={t(
          'collections.indexDescription',
          'Browse curated product collections'
        )}
      />
      <Typography variant="h4" fontWeight={800} gutterBottom>
        {t('collections.indexTitle', 'Collections')}
      </Typography>
      <TextField
        fullWidth
        size="small"
        placeholder={t('collections.searchPlaceholder', 'Search collections')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3, maxWidth: 480 }}
      />
      {loading ? (
        <Typography>{t('common.loading', 'Loading...')}</Typography>
      ) : (
        <Grid container spacing={2}>
          {sorted.map((c) => (
            <Grid item xs={12} sm={6} md={4} key={c.id}>
              <Card variant="outlined">
                <CardActionArea onClick={() => navigate(`/collections/${c.slug}`)}>
                  {c.image_url ? (
                    <CardMedia
                      component="img"
                      height={140}
                      image={c.image_url}
                      alt={c.name}
                    />
                  ) : (
                    <Box sx={{ height: 140, bgcolor: 'action.hover' }} />
                  )}
                  <CardContent>
                    <Typography variant="h6" fontWeight={700}>
                      {c.name}
                    </Typography>
                    {c.description ? (
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {c.description}
                      </Typography>
                    ) : null}
                    <Typography variant="caption" color="text.secondary">
                      {t('collections.productCount', '{{count}} products', {
                        count: c.listing_count,
                      })}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default CollectionsIndexPage;
