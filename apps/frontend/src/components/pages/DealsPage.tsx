import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Box,
  Container,
  Pagination,
  Paper,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../contexts/CartContext';
import { InventoryItem, useInventoryItems } from '../../hooks/useInventoryItems';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import { useMetaPixel } from '../../hooks/useMetaPixel';
import {
  metaPixelContentCategoryFromItem,
  metaPixelGoogleProductCategoryFromItem,
} from '../../utils/metaPixelContentCategory';
import DashboardItemCard from '../common/DashboardItemCard';
import SEOHead from '../seo/SEOHead';

const DealsPage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const { addToCart } = useCart();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const { inventoryItems, loading, error } = useInventoryItems({
    page: 1,
    limit: 1000,
    is_active: true,
  });

  const dealItems = useMemo(
    () =>
      inventoryItems
        .filter(
          (item) =>
            item.hasActiveDeal &&
            typeof item.original_price === 'number' &&
            typeof item.discounted_price === 'number' &&
            item.original_price > 0
        )
        .slice()
        .sort((a, b) => {
          const aPct =
            ((a.original_price! - a.discounted_price!) / a.original_price!) *
            100;
          const bPct =
            ((b.original_price! - b.discounted_price!) / b.original_price!) *
            100;
          return bPct - aPct;
        }),
    [inventoryItems]
  );

  const { trackView } = useTrackItemView(null);
  const { trackAddToCart } = useMetaPixel();

  const handleLogin = () => {
    loginWithRedirect({
      appState: {
        returnTo: window.location.pathname,
      },
    });
  };

  const handleOrderClick = (item: InventoryItem) => {
    trackView(item.id);
    handleLogin();
  };

  const handleAddToCart = (item: InventoryItem) => {
    trackView(item.id);
    if (!isAuthenticated) {
      handleLogin();
      return;
    }

    const hasDeal =
      item.hasActiveDeal &&
      typeof item.original_price === 'number' &&
      typeof item.discounted_price === 'number' &&
      item.original_price > 0;

    const unitPrice = hasDeal ? item.discounted_price! : item.selling_price;
    const contentCategory = metaPixelContentCategoryFromItem(item.item);
    const googleCategory = metaPixelGoogleProductCategoryFromItem(item.item);

    trackAddToCart({
      content_type: 'product',
      content_ids: [item.id],
      contents: [{ id: item.id, quantity: 1, item_price: unitPrice }],
      value: unitPrice,
      currency: item.item.currency || 'USD',
      content_name: item.item.name,
      ...(contentCategory && { content_category: contentCategory }),
      ...(googleCategory && { google_product_category: googleCategory }),
    });

    addToCart({
      inventoryItemId: item.id,
      quantity: 1,
      businessId: item.business_location.business_id,
      businessLocationId: item.business_location_id,
      itemData: {
        name: item.item.name,
        price: unitPrice,
        currency: item.item.currency,
        ...(contentCategory && { contentCategory }),
        ...(googleCategory && { googleProductCategory: googleCategory }),
        imageUrl: item.item.item_images?.[0]?.image_url,
        weight: item.item.weight,
        maxOrderQuantity: item.item.max_order_quantity || undefined,
        minOrderQuantity: item.item.min_order_quantity || undefined,
        originalPrice: hasDeal ? item.original_price! : undefined,
        discountedPrice: hasDeal ? item.discounted_price! : undefined,
        hasActiveDeal: hasDeal,
        dealEndAt: hasDeal ? item.deal_end_at : undefined,
      },
    });
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const totalPages = Math.ceil(dealItems.length / itemsPerPage) || 1;
  const paginatedItems = dealItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setCurrentPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Container
      maxWidth="lg"
      sx={{ mt: 4, mb: 4, px: { xs: 0, sm: 2 } }}
    >
      <SEOHead
        title={t('seo.deals.title', 'Deals')}
        description={t(
          'seo.deals.description',
          'Discover all items that are currently on deal.'
        )}
        keywords={t('seo.deals.keywords', 'deals, discounts, offers')}
      />

      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            mb: 1,
            fontSize: { xs: '1.75rem', sm: '2.125rem' },
          }}
        >
          {t('public.deals.title', 'Current Deals')}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
        >
          {t(
            'public.deals.subtitle',
            'Browse all items with active deals and special prices.'
          )}
        </Typography>
      </Box>

      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        {loading && (
          <Typography variant="body1">
            {t('common.loading', 'Loading...')}
          </Typography>
        )}
        {error && !loading && (
          <Alert severity="error">
            {t('common.errorLoadingData', 'Failed to load data')}
          </Alert>
        )}
        {!loading && !error && dealItems.length === 0 && (
          <Typography variant="body1">
            {t('public.deals.none', 'There are no active deals at the moment.')}
          </Typography>
        )}

        {!loading && !error && dealItems.length > 0 && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)',
                  lg: 'repeat(4, 1fr)',
                },
                gap: 3,
              }}
            >
              {paginatedItems.map((inventoryItem) => (
                <DashboardItemCard
                  key={inventoryItem.id}
                  item={inventoryItem}
                  viewsCount={inventoryItem.viewsCount}
                  formatCurrency={formatCurrency}
                  onOrderClick={handleOrderClick}
                  onAddToCart={handleAddToCart}
                  isPublicView={!isAuthenticated}
                  canOrder={isAuthenticated}
                  showCartButtons={isAuthenticated}
                  loginButtonText={t(
                    'public.items.login',
                    'Sign In to Order'
                  )}
                  orderButtonText={t('common.orderNow', 'Order Now')}
                  addToCartButtonText={t('cart.addToCart', 'Add to Cart')}
                  buyNowButtonText={t('cart.buyNow', 'Buy Now')}
                />
              ))}
            </Box>

            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={handlePageChange}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}
      </Paper>
    </Container>
  );
};

export default DealsPage;

