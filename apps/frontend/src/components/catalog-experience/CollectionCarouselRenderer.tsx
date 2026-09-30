import { Box, Typography } from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FeaturedCollectionsRow } from '../common/FeaturedCollectionsRow';
import type { CollectionCarouselModule } from './catalogExperience.types';

export function CollectionCarouselRenderer({
  module,
  onOpen,
}: {
  module: CollectionCarouselModule;
  onOpen: (position: number, collectionId: string) => void;
}) {
  const navigate = useNavigate();
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
        {module.title}
      </Typography>
      <FeaturedCollectionsRow
        collections={module.items}
        showTitle={false}
        onCollectionClick={(slug) => {
          const index = module.items.findIndex((item) => item.slug === slug);
          const collection = module.items[index];
          if (collection) onOpen(index, collection.id);
          navigate(`/collections/${slug}`);
        }}
        onSeeAllCollections={() => navigate('/collections')}
      />
    </Box>
  );
}
