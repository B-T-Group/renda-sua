import { Box, CircularProgress, Container, TextField, Typography } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import {
  CollectionBrowseCard,
  FeaturedCollectionsRow,
} from '../common/FeaturedCollectionsRow';
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

  const onCollectionClick = (slug: string) => navigate(`/collections/${slug}`);

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
        <CircularProgress size={24} />
      ) : sorted.length === 0 ? (
        <Typography color="text.secondary">
          {t('common.noResults', 'No results found')}
        </Typography>
      ) : (
        <>
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <FeaturedCollectionsRow
              collections={sorted}
              showTitle={false}
              onCollectionClick={onCollectionClick}
            />
          </Box>
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            {sorted.map((collection) => (
              <CollectionBrowseCard
                key={collection.id}
                collection={collection}
                onClick={onCollectionClick}
              />
            ))}
          </Box>
        </>
      )}
    </Container>
  );
};

export default CollectionsIndexPage;
