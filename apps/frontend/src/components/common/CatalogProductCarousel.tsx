import { Box, Button, Skeleton, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { InventoryItem } from '../../hooks/useInventoryItems';
import DashboardItemCard from './DashboardItemCard';

function CarouselCardSkeleton() {
  return (
    <Box>
      <Skeleton variant="rectangular" height={200} />
      <Box sx={{ p: 1 }}>
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="50%" />
      </Box>
    </Box>
  );
}

const CARD_MIN_WIDTH = 240;

export interface CatalogProductCarouselProps {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  items: InventoryItem[];
  loading: boolean;
  formatCurrency: (amount: number, currency?: string) => string;
  onOrderClick: (item: InventoryItem) => void;
  onAddToCart: (item: InventoryItem) => void;
  isPublicView: boolean;
  canOrder: boolean;
  showCartButtons: boolean;
  loginButtonText: string;
  orderButtonText: string;
  addToCartButtonText: string;
  buyNowButtonText: string;
}

export function CatalogProductCarousel({
  title,
  subtitle,
  viewAllHref,
  items,
  loading,
  formatCurrency,
  onOrderClick,
  onAddToCart,
  isPublicView,
  canOrder,
  showCartButtons,
  loginButtonText,
  orderButtonText,
  addToCartButtonText,
  buyNowButtonText,
}: CatalogProductCarouselProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!loading && items.length === 0) return null;

  return (
    <Box sx={{ mb: 2.5, width: '100%', minWidth: 0 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1.5,
        }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.25 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {viewAllHref ? (
          <Button size="small" onClick={() => navigate(viewAllHref)}>
            {t('collections.viewAll', 'View all')}
          </Button>
        ) : null}
      </Box>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 1,
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Box
                key={i}
                sx={{ minWidth: CARD_MIN_WIDTH, maxWidth: CARD_MIN_WIDTH, scrollSnapAlign: 'start' }}
              >
                <CarouselCardSkeleton />
              </Box>
            ))
          : items.slice(0, 12).map((inventoryItem) => (
              <Box
                key={inventoryItem.id}
                sx={{ minWidth: CARD_MIN_WIDTH, maxWidth: CARD_MIN_WIDTH, scrollSnapAlign: 'start' }}
              >
                <DashboardItemCard
                  item={inventoryItem}
                  viewsCount={inventoryItem.viewsCount}
                  formatCurrency={formatCurrency}
                  onOrderClick={onOrderClick}
                  onAddToCart={onAddToCart}
                  estimatedDistance={inventoryItem.distance_text}
                  estimatedDuration={inventoryItem.duration_text}
                  isPublicView={isPublicView}
                  canOrder={canOrder}
                  showCartButtons={showCartButtons}
                  loginButtonText={loginButtonText}
                  orderButtonText={orderButtonText}
                  addToCartButtonText={addToCartButtonText}
                  buyNowButtonText={buyNowButtonText}
                />
              </Box>
            ))}
      </Box>
    </Box>
  );
}
