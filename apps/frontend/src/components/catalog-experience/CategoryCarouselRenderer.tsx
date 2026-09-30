import { Box, Card, CardActionArea, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogCategoryTile } from './catalogExperience.types';

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
          <CategoryTile
            key={item.id}
            item={item}
            onSelect={() => onSelect(item, position)}
          />
        ))}
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
    <Card sx={{ minWidth: 148, maxWidth: 148, flex: '0 0 auto', borderRadius: 2 }}>
      <CardActionArea
        onClick={onSelect}
        aria-label={t('public.items.sections.categoryTileA11y', 'Browse {{name}}', {
          name: item.name,
        })}
      >
        <CategoryArt name={item.name} imageUrl={item.imageUrl} />
        <Typography sx={{ px: 1.25, py: 1 }} fontWeight={700} noWrap>
          {item.name}
        </Typography>
      </CardActionArea>
    </Card>
  );
}

function CategoryArt({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    return (
      <Box
        component="img"
        src={imageUrl}
        alt=""
        sx={{ width: '100%', height: 112, objectFit: 'cover', display: 'block' }}
      />
    );
  }
  return (
    <Box
      sx={{
        height: 112,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="h4" color="text.secondary">
        {name.trim().slice(0, 1).toUpperCase()}
      </Typography>
    </Box>
  );
}
