import {
  Box,
  Card,
  CardActionArea,
  CircularProgress,
  Typography,
} from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CollectionSummary } from '../../hooks/useCollections';
import { CollectionPreviewMosaic } from './CollectionPreviewMosaic';

/** Matches mobile catalog collection chip width (~1.5× compact size). */
export const COLLECTION_BROWSE_CARD_WIDTH = 252;

const TITLE_MIN_HEIGHT = 57;

export interface CollectionBrowseCardProps {
  collection: CollectionSummary;
  onClick: (slug: string) => void;
}

export function CollectionBrowseCard({
  collection,
  onClick,
}: CollectionBrowseCardProps) {
  const previewUrls = useMemo(
    () =>
      (collection.preview_image_urls ?? [])
        .map((url) => url?.trim())
        .filter((url): url is string => Boolean(url))
        .slice(0, 4),
    [collection.preview_image_urls]
  );

  const preview = useMemo(() => {
    if (previewUrls.length > 0) {
      return <CollectionPreviewMosaic imageUrls={previewUrls} />;
    }
    if (collection.image_url) {
      return (
        <Box
          component="img"
          src={collection.image_url}
          alt=""
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      );
    }
    return <CollectionPreviewMosaic imageUrls={[]} />;
  }, [collection.image_url, previewUrls]);

  return (
    <Card
      variant="outlined"
      sx={{
        width: COLLECTION_BROWSE_CARD_WIDTH,
        flexShrink: 0,
        scrollSnapAlign: 'start',
        borderColor: 'divider',
        boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}
    >
      <CardActionArea
        onClick={() => onClick(collection.slug)}
        aria-label={collection.name}
        sx={{ display: 'block' }}
      >
        <Box
          sx={{
            width: '100%',
            aspectRatio: '1 / 1',
            bgcolor: 'divider',
            overflow: 'hidden',
          }}
        >
          {preview}
        </Box>
        <Box
          sx={{
            minHeight: TITLE_MIN_HEIGHT,
            px: 1.5,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="body1"
            fontWeight={600}
            textAlign="center"
            sx={{
              fontSize: '0.9375rem',
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
}

export function FeaturedCollectionsRow({
  collections,
  loading = false,
  showTitle = true,
  onCollectionClick,
}: FeaturedCollectionsRowProps) {
  const { t } = useTranslation();

  if (!loading && collections.length === 0) return null;

  return (
    <Box sx={{ mb: 1.5 }}>
      {showTitle ? (
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          {t('collections.browseTitle', 'Collections')}
        </Typography>
      ) : null}
      {loading ? (
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
      )}
    </Box>
  );
}
