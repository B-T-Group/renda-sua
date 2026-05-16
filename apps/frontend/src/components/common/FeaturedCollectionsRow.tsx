import {
  Box,
  Button,
  Card,
  CardActionArea,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CollectionSummary } from '../../hooks/useCollections';
import { CollectionPreviewMosaic } from './CollectionPreviewMosaic';

export const COLLECTION_BROWSE_CARD_WIDTH = 252;

const CARD_PADDING = 12;

const TITLE_MIN_HEIGHT = 48;

export const COLLECTION_CARD_GRID_SIZE = COLLECTION_BROWSE_CARD_WIDTH - CARD_PADDING * 2;

export interface CollectionBrowseCardProps {
  collection: CollectionSummary;
  onClick: (slug: string) => void;
}

export function CollectionBrowseCard({
  collection,
  onClick,
}: CollectionBrowseCardProps) {
  const previewUrls = useMemo(() => {
    const fromApi = (collection.preview_image_urls ?? [])
      .map((url) => url?.trim())
      .filter((url): url is string => Boolean(url))
      .slice(0, 4);
    if (fromApi.length > 0) return fromApi;
    if (collection.image_url?.trim()) {
      return Array.from({ length: 4 }, () => collection.image_url!.trim());
    }
    return [];
  }, [collection.image_url, collection.preview_image_urls]);

  return (
    <Card
      variant="outlined"
      elevation={0}
      sx={{
        width: COLLECTION_BROWSE_CARD_WIDTH,
        flexShrink: 0,
        scrollSnapAlign: 'start',
        borderColor: 'divider',
        boxShadow: 1,
        overflow: 'hidden',
      }}
    >
      <CardActionArea
        onClick={() => onClick(collection.slug)}
        aria-label={collection.name}
        sx={{ display: 'block' }}
      >
        <Box sx={{ p: `${CARD_PADDING}px` }}>
          <CollectionPreviewMosaic imageUrls={previewUrls} gap={12} tileBorderRadius={12} />
          <Typography
            variant="subtitle2"
            fontWeight={800}
            textAlign="center"
            sx={{
              mt: 1.5,
              minHeight: TITLE_MIN_HEIGHT - 8,
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {collection.name}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
}

export interface FeaturedCollectionsRowProps {
  collections: CollectionSummary[];
  loading?: boolean;
  showTitle?: boolean;
  onCollectionClick: (slug: string) => void;
  onSeeAllCollections?: () => void;
}

export function FeaturedCollectionsRow({
  collections,
  loading = false,
  showTitle = true,
  onCollectionClick,
  onSeeAllCollections,
}: FeaturedCollectionsRowProps) {
  const { t } = useTranslation();

  if (!loading && collections.length === 0) return null;

  const scrollContent = loading ? (
    <CircularProgress size={22} />
  ) : (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        overflowX: 'auto',
        overflowY: 'hidden',
        pb: 0.5,
        scrollSnapType: collections.length > 1 ? 'x mandatory' : undefined,
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
      }}
    >
      {collections.map((collection) => (
        <CollectionBrowseCard
          key={collection.id}
          collection={collection}
          onClick={onCollectionClick}
        />
      ))}
    </Box>
  );

  if (!showTitle) {
    return <Box sx={{ mb: 1.5 }}>{scrollContent}</Box>;
  }

  return (
    <Paper
      variant="outlined"
      elevation={0}
      sx={{
        mb: 2,
        mt: 2,
        borderRadius: 2,
        borderColor: 'divider',
        boxShadow: 1,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography variant="h6" fontWeight={800} sx={{ flex: 1, minWidth: 0 }}>
            {t('collections.browseTitle', 'Collections')}
          </Typography>
          {onSeeAllCollections ? (
            <Button size="small" onClick={onSeeAllCollections} sx={{ mt: -0.5, mr: -1 }}>
              {t('collections.viewAll', 'View all')}
            </Button>
          ) : null}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          {t(
            'collections.browseSubtitle',
            'Curated groups — tap a collection to browse items'
          )}
        </Typography>
        {scrollContent}
      </Box>
    </Paper>
  );
}
