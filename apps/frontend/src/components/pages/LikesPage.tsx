import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import DashboardItemCard from '../common/DashboardItemCard';
import { RestockAlertBellButton } from '../common/RestockAlertBellButton';
import { useCart } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useItemLikes } from '../../hooks/useItemLikes';
import {
  useRestockAlertsApi,
  useRestockAlertsEnabled,
} from '../../hooks/useRestockAlerts';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import type {
  ItemAlertState,
  RestockLikesResponse,
} from '../../hooks/useRestockAlerts';
import {
  SITE_EVENT_RESTOCK_ALERT_OPENED,
  SITE_EVENT_SUBJECT_INVENTORY_ITEM,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';
import { buildCartItemFromInventory } from '../../utils/catalogVariantCart';

const RESTOCK_HINT_SEEN_KEY = 'rs_restock_hint_seen';

function readHintSeen(): boolean {
  try {
    return window.localStorage.getItem(RESTOCK_HINT_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHintSeen(): void {
  try {
    window.localStorage.setItem(RESTOCK_HINT_SEEN_KEY, '1');
  } catch {
    /* private mode: the hint just shows again next visit */
  }
}

const LikesPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [hiddenItemIds, setHiddenItemIds] = useState<Set<string>>(new Set());
  const [restockData, setRestockData] = useState<RestockLikesResponse | null>(
    null
  );
  const [restockLoading, setRestockLoading] = useState(false);
  const [restockError, setRestockError] = useState<string | null>(null);
  const [hintHidden, setHintHidden] = useState(readHintSeen);

  const { enabled: restockEnabled, flagOn } = useRestockAlertsEnabled();
  const useRestockApi = restockEnabled === true;
  // Flag on and status still loading: wait instead of flashing the old list.
  const restockPending = flagOn && restockEnabled === null;
  const { data, loading, error, refresh } = useItemLikes(
    page,
    20,
    !(flagOn && restockEnabled !== false)
  );
  const { getLikes } = useRestockAlertsApi();
  const { trackSiteEvent } = useTrackSiteEvent();
  const { addToCart } = useCart();
  const { userType } = useUserProfileContext();
  const canOrder = userType === 'client';

  // `?filter=back-in-stock` (spec) and `back_in_stock` (what the digest push sends).
  const rawFilter = searchParams.get('filter');
  const backInStockFilter =
    useRestockApi && (rawFilter === 'back-in-stock' || rawFilter === 'back_in_stock');
  const filterValue: 'all' | 'back_in_stock' = backInStockFilter
    ? 'back_in_stock'
    : 'all';
  const fromAlert = searchParams.get('src') === 'restock_alert';

  const loadRestockLikes = useCallback(async () => {
    setRestockLoading(true);
    setRestockError(null);
    try {
      setRestockData(await getLikes(filterValue, page, 20));
    } catch (err: any) {
      setRestockError(
        err?.response?.data?.message ||
          err?.message ||
          t('items.likes.loadError', 'Failed to load liked items')
      );
      setRestockData(null);
    } finally {
      setRestockLoading(false);
    }
  }, [getLikes, filterValue, page, t]);

  useEffect(() => {
    if (!useRestockApi) return;
    void loadRestockLikes();
  }, [useRestockApi, loadRestockLikes]);

  useEffect(() => {
    if (!useRestockApi || !fromAlert) return;
    void trackSiteEvent({
      eventType: SITE_EVENT_RESTOCK_ALERT_OPENED,
      subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
      metadata: { surface: 'likes' },
    });
    // once per visit of the digest deep link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useRestockApi, fromAlert]);

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
    setRestockData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((item: any) =>
              item.id === itemId ? { ...item, restock_alert: newState } : item
            ),
          }
        : prev
    );
  };

  const handleDismissHint = () => {
    setHintHidden(true);
    writeHintSeen();
  };

  const handleFilterChange = (next: 'all' | 'back-in-stock') => {
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (next === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', next);
    }
    setSearchParams(params);
  };

  const isLoading = useRestockApi ? restockLoading : restockPending || loading;
  const hasError = useRestockApi ? restockError : restockPending ? null : error;
  const currentData: {
    items: any[];
    total: number;
    totalPages: number;
  } | null = useRestockApi ? restockData : data;

  const items: any[] = (currentData?.items ?? []).filter(
    (item: any) => !hiddenItemIds.has(item.item_id || item.item?.id || item.id)
  );

  // Spec §6: the hint shows once, under the first sold-out like, and is remembered.
  const firstSoldOutId: string | null = useRestockApi
    ? items.find(
        (item: any) => item.in_stock === false && item.restock_alert?.state
      )?.id ?? null
    : null;
  const showHint = !!firstSoldOutId && !hintHidden;
  useEffect(() => {
    if (showHint) writeHintSeen();
  }, [showHint]);

  if ((isLoading && !currentData) || (restockPending && !currentData)) {
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
              onClick={() =>
                useRestockApi ? void loadRestockLikes() : void refresh()
              }
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

  const renderBellForItem = (item: any) => {
    if (!useRestockApi || !item.restock_alert || item.restock_alert.state === null) {
      return null;
    }
    const catalogItemId = item.item_id || item.item?.id;
    if (!catalogItemId) return null;
    return (
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
        <RestockAlertBellButton
          itemId={catalogItemId}
          itemName={item.item?.name || ''}
          alertState={item.restock_alert}
          onAlertChange={(newState) => handleAlertChange(item.id, newState)}
          size="small"
        />
      </Box>
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
        <Stack direction="row" spacing={1} sx={{ mb: 3 }} role="group">
          <Chip
            label={t('restock.filter.all', 'All')}
            onClick={() => handleFilterChange('all')}
            aria-pressed={!backInStockFilter}
            color={!backInStockFilter ? 'primary' : 'default'}
            variant={!backInStockFilter ? 'filled' : 'outlined'}
          />
          <Chip
            label={t('restock.filter.backInStock', 'Back in stock')}
            onClick={() => handleFilterChange('back-in-stock')}
            aria-pressed={backInStockFilter}
            color={backInStockFilter ? 'primary' : 'default'}
            variant={backInStockFilter ? 'filled' : 'outlined'}
          />
        </Stack>
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
          {backInStockFilter ? (
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t('restock.emptyFilterTitle', "Nothing back yet. We'll tell you.")}
            </Typography>
          ) : (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {(currentData?.total ?? 0) > 0
                  ? t('items.likes.unavailableTitle', 'Favorites unavailable right now')
                  : t('items.likes.emptyTitle', 'No favorites yet')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {(currentData?.total ?? 0) > 0
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
            </>
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
                  {renderBellForItem(item)}
                </Box>
                {showHint && item.id === firstSoldOutId && (
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    role="status"
                    sx={{ mt: 0.5, px: 1 }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {t('restock.hint', "We'll let you know when it's back.")}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleDismissHint}
                      aria-label={t('common.close', 'Close')}
                    >
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </Stack>
                )}
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
