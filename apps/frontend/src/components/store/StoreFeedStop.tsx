import { Box, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import { CatalogProductCarousel } from '../common/CatalogProductCarousel';
import { FeaturedCollectionsRow } from '../common/FeaturedCollectionsRow';
import type { StoreFeedStop as StoreFeedStopModel } from '../../utils/composeStoreFeed';

export interface StoreFeedStopProps {
  stop: StoreFeedStopModel;
  formatCurrency: (amount: number, currency?: string) => string;
  onOrderClick: (item: InventoryItem, selectionId?: string | null) => void;
  onAddToCart: (item: InventoryItem, selectionId?: string | null) => void;
  onSeeAllDeals?: () => void;
  onCollectionClick: (slug: string) => void;
  isPublicView: boolean;
  canOrder: boolean;
  showCartButtons: boolean;
}

const StoreFeedStop: React.FC<StoreFeedStopProps> = ({
  stop,
  formatCurrency,
  onOrderClick,
  onAddToCart,
  onSeeAllDeals,
  onCollectionClick,
  isPublicView,
  canOrder,
  showCartButtons,
}) => {
  const { t } = useTranslation();

  if (stop.type === 'collections') {
    return (
      <Box sx={{ gridColumn: '1 / -1', my: 1 }}>
        <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
          {t('stores.feed.collections', 'Collections in this store')}
        </Typography>
        <FeaturedCollectionsRow
          collections={stop.collections}
          showTitle={false}
          onCollectionClick={onCollectionClick}
        />
      </Box>
    );
  }

  const title =
    stop.type === 'deals'
      ? t('stores.feed.deals', 'Deals in this store')
      : t('stores.feed.popularIn', 'Popular in {{category}}', {
          category: stop.category_name,
        });

  return (
    <Box sx={{ gridColumn: '1 / -1', my: 1 }}>
      <CatalogProductCarousel
        title={title}
        onViewAll={stop.type === 'deals' ? onSeeAllDeals : undefined}
        items={stop.items}
        loading={false}
        formatCurrency={formatCurrency}
        onOrderClick={onOrderClick}
        onAddToCart={onAddToCart}
        isPublicView={isPublicView}
        canOrder={canOrder}
        showCartButtons={showCartButtons}
        loginButtonText={t('public.items.loginToOrder', 'Log in to order')}
        orderButtonText={t('public.items.order', 'Order')}
        addToCartButtonText={t('public.items.addToCart', 'Add to cart')}
        buyNowButtonText={t('public.items.buyNow', 'Buy now')}
      />
    </Box>
  );
};

export default StoreFeedStop;
