import { Box, Card, CardActionArea, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { CatalogCategoryTile } from './catalogExperience.types';
import { CategoryPoster } from './CategoryPoster';

export function CategoryCarouselRenderer({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: CatalogCategoryTile[];
  onSelect: (item: CatalogCategoryTile, position: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <Box sx={{ mb: 2.5 }} component="section" aria-label={title}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.25 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 0.5 }}>
        {items.map((item, position) => (
          <Box key={item.id} sx={tileFrameSx}>
            <CategoryTile item={item} onSelect={() => onSelect(item, position)} />
          </Box>
        ))}
        <MoreCategoriesTile />
      </Box>
    </Box>
  );
}

function CategoryTile({
  item,
  onSelect,
}: {
  item: CatalogCategoryTile;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <CategoryPoster
      name={item.name}
      imageUrl={item.imageUrl}
      onSelect={onSelect}
      ariaLabel={t('public.items.sections.categoryTileA11y', 'Browse {{name}}', {
        name: item.name,
      })}
    />
  );
}

function MoreCategoriesTile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const label = t('public.items.sections.moreCategories', 'More');
  return (
    <Box sx={tileFrameSx}>
      <Card sx={{ width: '100%', height: '100%', borderRadius: 2 }}>
        <CardActionArea
          onClick={() => navigate('/categories')}
          aria-label={t('public.items.sections.moreCategoriesA11y', 'Browse all categories')}
          sx={moreActionSx}
        >
          <MoreCategoriesMark />
          <Typography fontWeight={800}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('public.items.sections.moreCategoriesHint', 'All categories')}
          </Typography>
        </CardActionArea>
      </Card>
    </Box>
  );
}

function MoreCategoriesMark() {
  return (
    <Box sx={moreMarkSx} aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <Box key={index} sx={moreDotSx} />
      ))}
    </Box>
  );
}

const tileFrameSx = { width: 168, height: 200, flex: '0 0 auto' };

const moreActionSx = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.5,
  bgcolor: 'action.hover',
};

const moreMarkSx = {
  width: 56,
  height: 56,
  mb: 0.5,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 0.75,
};

const moreDotSx = {
  borderRadius: 1,
  bgcolor: 'primary.main',
  opacity: 0.85,
};
