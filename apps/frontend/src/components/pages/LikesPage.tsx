import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import DashboardItemCard from '../common/DashboardItemCard';
import { RestockAlertBellButton } from '../common/RestockAlertBellButton';
import { useCart } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useItemLikes } from '../../hooks/useItemLikes';
import { useRestockAlerts } from '../../hooks/useRestockAlerts';
import { useClientFlags } from '../../hooks/useClientFlags';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import type { ItemAlertState } from '../../hooks/useRestockAlerts';
import { buildCartItemFromInventory } from '../../utils/catalogVariantCart';

const LikesPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [hiddenItemIds, setHiddenItemIds] = useState<Set<string>>(new Set());
  const [restockData, setRestockData] = useState<any>(null);
  const [restockLoading, setRestockLoading] = useState(false);
  const [restockError, setRestockError] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(() => {
    return localStorage.getItem('restock_hint_dismissed') === 'true';
  });

  const { data, loading, error, refresh } = useItemLikes(page, 20);
  const { enabled: restockEnabled, getLikes } = useRestockAlerts();
  const { flags } = useClientFlags();
  const { addToCart } = useCart();
  const { userType } = useUserProfileContext();
  const canOrder = userType === 'client';

  const filter = (searchParams.get('filter') as 'back-in-stock' | null) || 'all';
  const useRestockApi = flags.restock_alerts_v1 && restockEnabled;

  const filterValue: 'all' | 'back_in_stock' =
    filter === 'back-in-stock' ? 'back_in_stock' : 'all';

  useEffect(() => {
    if (!useRestockApi) return;
    const loadRestockLikes = async () => {
      setRestockLoading(true);
      setRestockError(null);
      try {
        const data = await getLikes(filterValue, page, 20);
        setRestockData(data);
      } catch (err: any) {
        setRestockError(err?.message || 'Failed to load liked items');
        setRestockData(null);
      } finally {
        setRestockLoading(false);
      }
    };
    void loadRestockLikes();
  }, [useRestockApi, getLikes, filterValue, page]);

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

  const handleAlertChange = (itemId: string, newState: ItemAlertState) => {
    if (!restockData) return;
    setRestockData({
      ...restockData,
      items: restockData.items.map((item: any) =>
        item.id === itemId ? { ...item, restock_alert: newState } : item
      ),
    });
  };

  const handleDismissHint = () => {
    setHintDismissed(true);
    localStorage.setItem('restock_hint_dismissed', 'true');
  };

  const handleFilterChange = (newFilter: 'all' | 'back-in-stock') => {
    setPage(1);
    if (newFilter === 'all') {
      searchParams.delete('filter');
    } else {
      searchParams.set('filter', newFilter);
    }
    setSearchParams(searchParams);
  };

  const isLoading = useRestockApi ? restockLoading : loading;
  const hasError = useRestockApi ? restockError : error;
  const currentData = useRestockApi ? restockData : data;

  if (isLoading && !currentData) {
    return (
      <Container maxWidth="lg" sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (hasError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => (useRestockApi ? void getLikes(filterValue, page, 20) : void refresh())}
            >
              {t('common.retry', 'Retry')}
            </Button>
          }
        >
          {hasError}
        </Alert>
      </Container>
    );
  }

  const items = (currentData?.items ?? []).filter(
    (item) => !hiddenItemIds.has(item.item_id || item.item?.id || item.id)
  );

  const hasBackInStockItems = useRestockApi
    ? items.some((item: any) => item.back_in_stock)
    : false;

  const showHint =
    useRestockApi &&
    !hintDismissed &&
    items.some((item: any) => !item.in_stock && item.restock_alert?.state !== null);

  const renderBellForItem = (item: any) => {
    if (!useRestockApi || !item.restock_alert || item.restock_alert.state === null) {
      return null;
    }
    return (
      <RestockAlertBellButton
        itemId={item.id}
        itemName={item.title || item.name || ''}
        alertState={item.restock_alert}
        onAlertChange={(newState) => handleAlertChange(item.id, newState)}
        size="small"
      />
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
        {t('items.likes.title', 'Your favorites')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: useRestockApi ? 2 : 3 }}>
        {t('items.likes.subtitle', 'Items you liked — revisit them anytime.')}
      </Typography>

      {useRestockApi && (
        <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
          <Chip
            label={t('restock.filter.all', 'All')}
            onClick={() => handleFilterChange('all')}
            color={filter === 'all' ? 'primary' : 'default'}
            variant={filter === 'all' ? 'filled' : 'outlined'}
          />
          <Chip
            label={t('restock.filter.backInStock', 'Back in stock')}
            onClick={() => handleFilterChange('back-in-stock')}
            color={filter === 'back-in-stock' ? 'primary' : 'default'}
            variant={filter === 'back-in-stock' ? 'filled' : 'outlined'}
            disabled={!hasBackInStockItems}
          />
        </Stack>
      )}

      {showHint && (
        <Alert severity="info" onClose={handleDismissHint} sx={{ mb: 3 }}>
          {t('restock.hint', "We'll let you know when it's back.")}
        </Alert>
      )}

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
            {filterValue === 'back_in_stock'
              ? t('restock.emptyFilterTitle', "Nothing back yet. We'll tell you.")
              : (currentData?.total ?? 0) > 0
              ? t('items.likes.unavailableTitle', 'Favorites unavailable right now')
              : t('items.likes.emptyTitle', 'No favorites yet')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {filterValue === 'back_in_stock'
              ? t(
                  'restock.emptyFilterMessage',
                  "When items you liked come back in stock, they'll show up here."
                )
              : (currentData?.total ?? 0) > 0
              ? t(
                  'items.likes.unavailableMessage',
                  'We could not load listings for your saved items. Try again later.'
                )
              : t(
                  'items.likes.emptyMessage',
                  'Tap the heart on any product to save it here.'
                )}
          </Typography>
          {filterValue !== 'back_in_stock' && (
            <Button component={RouterLink} to="/items" variant="contained">
              {t('items.likes.browseCta', 'Browse items')}
            </Button>
          )}
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            {items.map((item) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
                <Box position="relative">
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
                  {useRestockApi && item.back_in_stock && (
                    <Chip
                      label={t('restock.backInStockChip', 'Back in stock')}
                      color="success"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        fontWeight: 600,
                      }}
                    />
                  )}
                  {renderBellForItem(item) && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        bgcolor: 'background.paper',
                        borderRadius: '50%',
                        boxShadow: 1,
                      }}
                    >
                      {renderBellForItem(item)}
                    </Box>
                  )}
                </Box>
              </Grid>
            ))}
          </Grid>
          {(currentData?.totalPages ?? 0) > 1 && (
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
                disabled={page >= (currentData?.totalPages ?? 1)}
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
