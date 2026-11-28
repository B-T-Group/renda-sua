import { ChevronRight, Search } from '@mui/icons-material';
import { Box, Button, ButtonBase, Skeleton, Typography } from '@mui/material';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { EXPORT_SELLERS_CAROUSEL_MAX, type ExportSeller } from '../../utils/exportSellers';
import { EXPORT_BRAND_BLUE } from './ExportOnlyBadge';
import { ExportSellerAvatar, ExportSellerPlace } from './ExportSellerAvatar';

const CARD_WIDTH = 168;

const twoLineClamp = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
};

export interface ExportSellersCarouselProps {
  sellers: ExportSeller[];
  total: number;
  loading?: boolean;
  /** Seller page link. */
  sellerHref: (seller: ExportSeller) => string;
  /** All-sellers list link. */
  listHref: string;
  onSellerClick?: (seller: ExportSeller, position: number) => void;
  onMoreClick?: (source: 'header' | 'trailing_card') => void;
  onViewed?: (shown: number, total: number) => void;
}

/**
 * "Sellers" / "Vendeurs" row: at most 10 cards (logo or monogram, name, place, count) and a
 * Always shows a header See all link. Trailing More card only when total > 10. Real links so the public page is crawlable.
 * Renders nothing when the context has no seller.
 */
export const ExportSellersCarousel: React.FC<ExportSellersCarouselProps> = ({
  sellers,
  total,
  loading,
  sellerHref,
  listHref,
  onSellerClick,
  onMoreClick,
  onViewed,
}) => {
  const { t } = useTranslation();
  const shown = sellers.slice(0, EXPORT_SELLERS_CAROUSEL_MAX);
  const viewedKey = useRef<string | null>(null);
  const key = shown.map((s) => s.business_location_id).join(',');
  useEffect(() => {
    if (shown.length === 0 || viewedKey.current === key) return;
    viewedKey.current = key;
    onViewed?.(shown.length, total);
  }, [key, shown.length, total, onViewed]);

  if (loading && sellers.length === 0) {
    return (
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, overflow: 'hidden' }} aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={CARD_WIDTH} height={150} sx={{ flexShrink: 0 }} />
        ))}
      </Box>
    );
  }
  if (shown.length === 0 || total === 0) return null;
  const hasMore = total > EXPORT_SELLERS_CAROUSEL_MAX;

  return (
    <Box component="section" data-testid="export-sellers-carousel" sx={{ mb: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h6" component="h2" fontWeight={800} sx={{ fontSize: '1.05rem' }}>
          {t('exportSellers.title', 'Sellers')}
        </Typography>
        <Button
            component={RouterLink}
            to={listHref}
            onClick={() => onMoreClick?.('header')}
            data-testid="export-sellers-see-all"
            endIcon={<ChevronRight />}
            size="small"
            sx={{ fontWeight: 700, textTransform: 'none', color: EXPORT_BRAND_BLUE }}
          >
            {t('exportSellers.seeAll', 'See all')}
          </Button>
      </Box>
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          overflowX: 'auto',
          pb: 1,
          scrollSnapType: 'x proximity',
          '&::-webkit-scrollbar': { height: 6 },
        }}
      >
        {shown.map((seller, index) => (
          <ButtonBase
            key={seller.business_location_id}
            component={RouterLink}
            to={sellerHref(seller)}
            onClick={() => onSellerClick?.(seller, index)}
            data-testid={`export-seller-card-${index}`}
            aria-label={t('exportSellers.openSeller', { name: seller.name, defaultValue: 'Open {{name}}' })}
            sx={{
              width: CARD_WIDTH,
              minHeight: 156,
              flexShrink: 0,
              scrollSnapAlign: 'start',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              textAlign: 'left',
              gap: 0.75,
              p: 1.5,
              borderRadius: 2,
              bgcolor: '#fff',
              border: '1px solid #E3E8EF',
              '&:hover': { borderColor: EXPORT_BRAND_BLUE },
            }}
          >
            <ExportSellerAvatar name={seller.name} logoUrl={seller.logo_url} />
            <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, ...twoLineClamp }}>{seller.name}</Typography>
            <Box sx={{ flex: 1 }} />
            <ExportSellerPlace country={seller.country} city={seller.city} />
            <Typography sx={{ fontWeight: 700, fontSize: 12 }}>
              {t('exportSellers.itemsCount', { count: seller.item_count, defaultValue: '{{count}} items' })}
            </Typography>
          </ButtonBase>
        ))}
        {hasMore ? (
          <ButtonBase
            component={RouterLink}
            to={listHref}
            onClick={() => onMoreClick?.('trailing_card')}
            data-testid="export-sellers-more-card"
            sx={{
              width: CARD_WIDTH,
              minHeight: 156,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              borderRadius: 2,
              bgcolor: '#EAF1FB',
            }}
          >
            <Box sx={{ width: 44, height: 44, borderRadius: 1.5, bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
              <Search sx={{ color: EXPORT_BRAND_BLUE }} />
            </Box>
            <Typography fontWeight={800}>{t('exportSellers.more', 'More')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('exportSellers.allTitle', 'All sellers')}
            </Typography>
          </ButtonBase>
        ) : null}
      </Box>
    </Box>
  );
};

export default ExportSellersCarousel;
