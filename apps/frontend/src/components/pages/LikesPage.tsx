import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  Typography,
} from '@mui/material';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import DashboardItemCard from '../common/DashboardItemCard';
import { useCart } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useItemLikes } from '../../hooks/useItemLikes';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import { buildCartItemFromInventory } from '../../utils/catalogVariantCart';

const LikesPage: React.FC = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [hiddenItemIds, setHiddenItemIds] = useState<Set<string>>(new Set());
  const { data, loading, error, refresh } = useItemLikes(page, 20);
  const { addToCart } = useCart();
  const { userType } = useUserProfileContext();
  const canOrder = userType === 'client';

  const formatCurrency = useMemo(
    () => (amount: number, currency = 'XAF') =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'XAF',
      }).format(amount),
    []
  );

  const handleOrderClick = (item: InventoryItem) => {
    window.location.assign(`/items/${item.id}/place_order`);
  };

  const handleAddToCart = (
    item: InventoryItem,
    selectionId?: string | null
  ) => {
    const cartItem = buildCartItemFromInventory(
      item,
      1,
      selectionId,
      t('orders.variant.defaultOption', 'Default')
    );
    if (cartItem === 'needs_variant') return;
    addToCart(cartItem);
  };

  const handleLikedChange = (itemId: string, liked: boolean) => {
    if (liked) {
      setHiddenItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      return;
    }
    setHiddenItemIds((prev) => new Set(prev).add(itemId));
  };

  if (loading && !data) {
    return (
      <Container maxWidth="lg" sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void refresh()}>
              {t('common.retry', 'Retry')}
            </Button>
          }
        >
          {error}
        </Alert>
      </Container>
    );
  }

  const items = (data?.items ?? []).filter(
    (item) => !hiddenItemIds.has(item.item_id || item.item?.id)
  );

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
        {t('items.likes.title', 'Your favorites')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {t(
          'items.likes.subtitle',
          'Items you liked — revisit them anytime.'
        )}
      </Typography>

      {items.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 2,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <FavoriteBorder sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            {(data?.total ?? 0) > 0
              ? t(
                  'items.likes.unavailableTitle',
                  'Favorites unavailable right now'
                )
              : t('items.likes.emptyTitle', 'No favorites yet')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {(data?.total ?? 0) > 0
              ? t(
                  'items.likes.unavailableMessage',
                  'We could not load listings for your saved items. Try again later.'
                )
              : t(
                  'items.likes.emptyMessage',
                  'Tap the heart on any product to save it here.'
                )}
          </Typography>
          <Button component={RouterLink} to="/items" variant="contained">
            {t('items.likes.browseCta', 'Browse items')}
          </Button>
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            {items.map((item) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
                <DashboardItemCard
                  item={item}
                  formatCurrency={formatCurrency}
                  onOrderClick={handleOrderClick}
                  onAddToCart={handleAddToCart}
                  canOrder={canOrder}
                  showCartButtons={canOrder}
                  viewsCount={item.viewsCount}
                  onLikedChange={handleLikedChange}
                />
              </Grid>
            ))}
          </Grid>
          {(data?.totalPages ?? 0) > 1 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 1,
                mt: 3,
              }}
            >
              <Button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('common.previous', 'Previous')}
              </Button>
              <Button
                disabled={page >= (data?.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('common.next', 'Next')}
              </Button>
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default LikesPage;
