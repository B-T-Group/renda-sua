import { Box, Card, Grid, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import NoImage from '../../../assets/no-image.svg';
import { Item } from '../../../hooks/useItems';
import { ItemImage } from '../../../types/image';
import ItemDetailsCard from './ItemDetailsCard';
import ItemInventorySummary from './ItemInventorySummary';
import { InventorySummary } from './itemViewHelpers';

interface ItemOverviewTabProps {
  item: Item;
  images: ItemImage[];
  activeImage: ItemImage | undefined;
  summary: InventorySummary | null;
  canSuperUserActions: boolean;
  onSelectThumb: (imageId: string) => void;
  onOpenLightbox: (index: number) => void;
  onManageCollections: () => void;
  onRefineWithAi: () => void;
}

const ItemOverviewTab: React.FC<ItemOverviewTabProps> = ({
  item,
  images,
  activeImage,
  summary,
  canSuperUserActions,
  onSelectThumb,
  onOpenLightbox,
  onManageCollections,
  onRefineWithAi,
}) => {
  const { t } = useTranslation();

  const handleHeroClick = () => {
    if (!activeImage || images.length === 0) return;
    const idx = images.findIndex((i) => i.id === activeImage.id);
    onOpenLightbox(idx >= 0 ? idx : 0);
  };

  return (
    <Stack spacing={3}>
      {summary && summary.totalLocations > 0 && (
        <ItemInventorySummary summary={summary} />
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <Box
              onClick={handleHeroClick}
              sx={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.50',
                overflow: 'hidden',
                cursor: images.length > 0 ? 'zoom-in' : 'default',
              }}
            >
              <Box
                component="img"
                src={activeImage?.image_url || NoImage}
                alt={activeImage?.alt_text || item.name}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </Box>
            {images.length > 0 && (
              <Box sx={{ p: 2 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 1 }}
                >
                  <Typography variant="subtitle2">
                    {t('business.items.gallery', 'Gallery')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('business.items.galleryHint', 'Tap a photo to preview')}
                  </Typography>
                </Stack>
                <Box
                  sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}
                >
                  {images.map((image) => {
                    const isActive = activeImage?.id === image.id;
                    return (
                      <Box
                        key={image.id}
                        component="img"
                        src={image.image_url}
                        alt={image.alt_text || item.name}
                        onClick={() => onSelectThumb(image.id)}
                        sx={{
                          flex: '0 0 auto',
                          width: 64,
                          height: 64,
                          borderRadius: 1,
                          objectFit: 'cover',
                          cursor: 'pointer',
                          border: 2,
                          borderColor: isActive ? 'primary.main' : 'transparent',
                          boxShadow: isActive ? 2 : 0,
                          opacity: isActive ? 1 : 0.85,
                          transition:
                            'opacity 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                          '&:hover': {
                            opacity: 1,
                            borderColor: 'primary.light',
                          },
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <ItemDetailsCard
            item={item}
            canSuperUserActions={canSuperUserActions}
            onManageCollections={onManageCollections}
            onRefineWithAi={onRefineWithAi}
          />
        </Grid>
      </Grid>
    </Stack>
  );
};

export default ItemOverviewTab;
