import {
  AddPhotoAlternate as AddPhotoAlternateIcon,
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useApiClient } from '../../hooks/useApiClient';
import { useBusinessCatalogScope } from '../../hooks/useBusinessCatalogScope';
import { businessItemsApiParams } from '../../utils/businessItemsApiParams';
import AdminBusinessSelector from '../business/AdminBusinessSelector';
import { BusinessVerificationBanner } from '../business/BusinessVerificationBanner';
import { useBusinessItemsPageData } from '../../hooks/useBusinessItemsPageData';
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { useItems, type Item } from '../../hooks/useItems';
import BusinessItemCardView from '../business/BusinessItemCardView';
import ItemsFilterBar, {
  ItemsFilterState,
  ItemsSortBy,
} from '../business/ItemsFilterBar';
import {
  itemHasActiveDeal,
  itemHasActivePromotion,
} from '../../utils/businessItemListing';
import UpdateInventoryDialog from '../business/UpdateInventoryDialog';
import ManageDealsDialog from '../business/ManageDealsDialog';
import PromoteItemDialog from '../business/PromoteItemDialog';
import RefineItemWithAiDialog from '../dialogs/RefineItemWithAiDialog';
import { ManageItemCollectionsDialog } from '../dialogs/ManageItemCollectionsDialog';
import SEOHead from '../seo/SEOHead';
import { environment } from '../../config/environment';
import { buildFacebookCatalogCsvFromBusinessItems } from '../../utils/facebookCatalogCsv';
import FacebookExportSelectDialog from '../business/FacebookExportSelectDialog';

function sortBusinessItemsBy(list: Item[], sortBy: ItemsSortBy): Item[] {
  if (sortBy === 'default') return [...list];
  const next = [...list];
  const time = (a: Item, b: Item) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  switch (sortBy) {
    case 'price_asc':
      return next.sort((a, b) => a.price - b.price);
    case 'price_desc':
      return next.sort((a, b) => b.price - a.price);
    case 'created_asc':
      return next.sort(time);
    case 'created_desc':
      return next.sort((a, b) => time(b, a));
    default:
      return next;
  }
}

// Skeleton loading components
const ItemsCardsSkeleton: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'stretch' }}>
      {Array.from(new Array(6)).map((_, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: {
              xs: '1 1 100%',
              sm: '1 1 calc(50% - 12px)',
              md: '1 1 calc(33.333% - 16px)',
            },
          }}
        >
          <Card
            sx={{
              height: '100%',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                height: 280,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'grey.100',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  flex: '0 0 40px',
                  minHeight: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  pr: 1,
                  pt: 0.5,
                }}
                aria-hidden
              >
                <Skeleton variant="circular" width={34} height={34} />
              </Box>
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Skeleton
                  variant="rectangular"
                  sx={{
                    width: '100%',
                    flex: 1,
                    minHeight: 0,
                    display: 'block',
                    transform: 'none',
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    px: 1,
                    py: 0.75,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.75,
                  }}
                  aria-hidden
                >
                  <Skeleton variant="rounded" height={28} width="100%" />
                  <Skeleton variant="rounded" height={28} width="72%" />
                </Box>
              </Box>
            </Box>
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Skeleton variant="text" height={24} sx={{ mb: 1 }} />
              <Skeleton variant="text" height={20} sx={{ mb: 1 }} />
              <Skeleton variant="text" height={20} width="60%" sx={{ mb: 2 }} />
              <Skeleton variant="text" width={160} height={32} sx={{ mb: 2 }} />
              <Stack spacing={0.75} sx={{ mt: 'auto' }}>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Skeleton variant="circular" width={34} height={34} />
                  <Skeleton variant="circular" width={34} height={34} />
                  <Skeleton variant="circular" width={34} height={34} />
                  <Skeleton variant="circular" width={34} height={34} />
                </Box>
                <Box display="flex" gap={1}>
                  <Skeleton variant="circular" width={34} height={34} />
                  <Skeleton variant="circular" width={34} height={34} />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
  );
};

const BusinessItemsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useUserProfileContext();
  const {
    effectiveBusinessId,
    isPlatformAdmin,
    isViewingOtherBusiness,
    canDelete,
    canSuperUserActions,
    setSelectedBusinessId,
    ownBusinessId,
    businessQuerySuffix,
  } = useBusinessCatalogScope();
  const [showUpdateInventoryDialog, setShowUpdateInventoryDialog] =
    useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingInventoryItem, setUpdatingInventoryItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [manageDealsItem, setManageDealsItem] = useState<any | null>(null);
  const [refineAiItem, setRefineAiItem] = useState<Item | null>(null);
  const [manageCollectionsItem, setManageCollectionsItem] = useState<Item | null>(
    null
  );
  const [promoteItem, setPromoteItem] = useState<any | null>(null);
  const [facebookExportSelectOpen, setFacebookExportSelectOpen] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<ItemsFilterState>({
    searchText: '',
    statusFilter: 'all',
    categoryFilter: 'all',
    brandFilter: 'all',
    stockFilter: 'all',
    specialListingFilter: 'all',
    sortBy: 'default',
    favoritesFilter: 'all',
  });

  const apiClient = useApiClient();
  const {
    items,
    loading: pageDataLoading,
    error: pageDataError,
    refetch: refetchPageData,
    mergeItemIntoList,
    refreshListItem,
  } = useBusinessItemsPageData(effectiveBusinessId);

  const {
    brands,
    itemSubCategories,
    loading: itemsLoading,
    error: itemsError,
    fetchBrands,
    fetchItemSubCategories,
    updateItem,
  } = useItems(effectiveBusinessId, { skipInitialItemsFetch: true });

  useBusinessInventory(effectiveBusinessId, { skipInitialFetch: true });

  const navigate = useNavigate();

  const loading = pageDataLoading || itemsLoading;
  const error = pageDataError || itemsError;

  // Fetch brands and subcategories when component mounts (items/locations come from page-data)
  useEffect(() => {
    if (effectiveBusinessId) {
      fetchBrands();
      fetchItemSubCategories();
    }
  }, [effectiveBusinessId, fetchBrands, fetchItemSubCategories]);

  const itemPathSuffix = businessQuerySuffix;

  const handleEditItem = (item: any) => {
    navigate(`/business/items/edit/${item.id}${itemPathSuffix}`);
  };

  const downloadFacebookCatalogCsv = (selectedItemIds: Set<string>) => {
    if (selectedItemIds.size === 0) {
      return;
    }
    const { filename, csv, rowCount } = buildFacebookCatalogCsvFromBusinessItems({
      items: items ?? [],
      webOrigin: environment.webAppOrigin,
      quantityToSell: 5,
      currencyCode: 'XAF',
      productCategoryLanguage: i18n.language?.startsWith('fr') ? 'fr' : 'en',
      itemIds: selectedItemIds,
    });

    if (rowCount === 0) {
      enqueueSnackbar(
        t(
          'business.items.facebookExport.empty',
          'No inventory rows found to export.'
        ),
        { variant: 'warning' }
      );
      return;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);

    enqueueSnackbar(
      t(
        'business.items.facebookExport.success',
        'Exported {{count}} rows for Facebook',
        { count: rowCount }
      ),
      { variant: 'success' }
    );
  };

  const handleOpenFacebookExportSelect = () => {
    setFacebookExportSelectOpen(true);
  };

  const handleConfirmFacebookExport = (selectedItemIds: Set<string>) => {
    try {
      downloadFacebookCatalogCsv(selectedItemIds);
      setFacebookExportSelectOpen(false);
    } catch (error: any) {
      enqueueSnackbar(
        t(
          'business.items.facebookExport.error',
          'Failed to export Facebook CSV'
        ),
        { variant: 'error' }
      );
    }
  };

  const handleViewItem = (item: Item) => {
    navigate(`/business/items/${item.id}${itemPathSuffix}`, { state: { item } });
  };

  const handleDeleteItem = (item: any) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setDeleteLoading(true);
    try {
      await apiClient.delete(
        '/business-items/' + itemToDelete.id,
        businessItemsApiParams(effectiveBusinessId)
      );
      enqueueSnackbar(t('business.items.itemDeleted'), {
        variant: 'success',
      });
      setShowDeleteConfirm(false);
      setItemToDelete(null);
      await refetchPageData(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.error ?? t('business.items.deleteError');
      enqueueSnackbar(message, {
        variant: 'error',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRestockInventoryItem = (item: any) => {
    // If item has business_inventories, use the first one, otherwise use the item directly
    const inventoryItem = item.business_inventories?.[0] || item;
    setUpdatingInventoryItem(inventoryItem);
    setShowUpdateInventoryDialog(true);
  };

  const handleManageDeals = (item: any) => {
    const inventoryItem = item.business_inventories?.[0];
    if (!inventoryItem) {
      enqueueSnackbar(
        t(
          'business.items.deals.noInventory',
          'Add inventory for this item before creating deals'
        ),
        { variant: 'warning' }
      );
      return;
    }
    setManageDealsItem(inventoryItem);
  };

  const handlePromoteItem = (item: any) => {
    if (!item.business_inventories?.length) {
      enqueueSnackbar(
        t(
          'business.items.promotion.noInventory',
          'Add inventory for this item before promoting'
        ),
        { variant: 'warning' }
      );
      return;
    }
    setPromoteItem(item);
  };

  const handleToggleFavorite = useCallback(
    async (row: Item, favorited: boolean) => {
      try {
        await apiClient.put(
          `/business-items/items/${row.id}/favorite`,
          { favorited },
          businessItemsApiParams(effectiveBusinessId)
        );
        mergeItemIntoList(row.id, { is_favorite: favorited });
        enqueueSnackbar(
          t('business.items.favoriteUpdated', 'Favorites updated'),
          { variant: 'success' }
        );
      } catch (err: any) {
        enqueueSnackbar(
          t(
            'business.items.favoriteUpdateError',
            'Failed to update favorites'
          ),
          { variant: 'error' }
        );
      }
    },
    [apiClient, mergeItemIntoList, enqueueSnackbar, t, effectiveBusinessId]
  );

  const handleToggleItemActive = useCallback(
    async (row: Item, isActive: boolean) => {
      try {
        const updated = await updateItem(row.id, { is_active: isActive }, {
          skipRefetch: true,
        });
        if (updated) {
          mergeItemIntoList(row.id, updated);
        }
        enqueueSnackbar(
          t('business.items.activeStatusUpdated', 'Listing status updated'),
          { variant: 'success' }
        );
      } catch (err: any) {
        enqueueSnackbar(
          t(
            'business.items.activeStatusUpdateError',
            'Failed to update listing status'
          ),
          { variant: 'error' }
        );
      }
    },
    [updateItem, mergeItemIntoList, enqueueSnackbar, t]
  );

  const handleTogglePayOnDelivery = useCallback(
    async (row: Item, enabled: boolean) => {
      try {
        const updated = await updateItem(
          row.id,
          { pay_on_delivery_enabled: enabled },
          { skipRefetch: true }
        );
        if (updated) {
          mergeItemIntoList(row.id, updated);
        }
        enqueueSnackbar(
          t(
            'business.items.payOnDeliveryUpdated',
            'Payment at delivery setting updated'
          ),
          { variant: 'success' }
        );
      } catch (err: any) {
        enqueueSnackbar(
          t(
            'business.items.payOnDeliveryUpdateError',
            'Failed to update payment at delivery'
          ),
          { variant: 'error' }
        );
      }
    },
    [updateItem, mergeItemIntoList, enqueueSnackbar, t]
  );

  const handleTogglePayAtPickup = useCallback(
    async (row: Item, enabled: boolean) => {
      try {
        const updated = await updateItem(
          row.id,
          { pay_at_pickup_enabled: enabled },
          { skipRefetch: true }
        );
        if (updated) {
          mergeItemIntoList(row.id, updated);
        }
        enqueueSnackbar(
          t(
            'business.items.payAtPickupUpdated',
            'Store pickup setting updated'
          ),
          { variant: 'success' }
        );
      } catch (err: any) {
        enqueueSnackbar(
          t(
            'business.items.payAtPickupUpdateError',
            'Failed to update store pickup'
          ),
          { variant: 'error' }
        );
      }
    },
    [updateItem, mergeItemIntoList, enqueueSnackbar, t]
  );

  const itemMatchesSearchText = (item: Item, q: string): boolean => {
    const needle = q.toLowerCase();
    if (item.name.toLowerCase().includes(needle)) return true;
    if (item.description?.toLowerCase().includes(needle)) return true;
    if (item.sku?.toLowerCase().includes(needle)) return true;
    return (
      item.item_tags?.some((it) =>
        it.tag?.name?.toLowerCase().includes(needle)
      ) ?? false
    );
  };

  // Helper function to get stock status
  const getItemStockStatus = (item: any): string => {
    const inventory = item.business_inventories?.[0];
    if (!inventory) return 'noInventory';

    const quantity = inventory.computed_available_quantity || 0;
    const reorderPoint = inventory.reorder_point || 0;

    if (quantity === 0) return 'outOfStock';
    if (quantity <= reorderPoint) return 'lowStock';
    return 'inStock';
  };

  // Filter items based on search and filters
  const filteredItems =
    items?.filter((item) => {
      const matchesSearch =
        filters.searchText === '' ||
        itemMatchesSearchText(item, filters.searchText);

      const matchesStatus =
        filters.statusFilter === 'all' ||
        (filters.statusFilter === 'active' && item.is_active) ||
        (filters.statusFilter === 'inactive' && !item.is_active);

      const matchesCategory =
        filters.categoryFilter === 'all' ||
        (filters.categoryFilter === '_no_category' && !item.item_sub_category) ||
        item.item_sub_category?.name === filters.categoryFilter;

      const matchesBrand =
        filters.brandFilter === 'all' ||
        (filters.brandFilter === '_no_brand' && !item.brand) ||
        item.brand?.name === filters.brandFilter;

      const matchesStock =
        filters.stockFilter === 'all' ||
        getItemStockStatus(item) === filters.stockFilter;

      const sl = filters.specialListingFilter;
      let matchesSpotlight = true;
      if (sl === 'deals') matchesSpotlight = itemHasActiveDeal(item);
      else if (sl === 'promotions') matchesSpotlight = itemHasActivePromotion(item);
      else if (sl === 'deals_or_promotions') {
        matchesSpotlight =
          itemHasActiveDeal(item) || itemHasActivePromotion(item);
      }

      const fav = Boolean(item.is_favorite);
      const matchesFavorites =
        filters.favoritesFilter === 'all' ||
        (filters.favoritesFilter === 'favorites' && fav) ||
        (filters.favoritesFilter === 'not_favorites' && !fav);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesBrand &&
        matchesStock &&
        matchesSpotlight &&
        matchesFavorites
      );
    }) || [];

  const sortedItems = useMemo(
    () => sortBusinessItemsBy(filteredItems, filters.sortBy),
    [filteredItems, filters.sortBy]
  );

  // Get unique categories and brands for filters
  const categories = Array.from(
    new Set(
      items
        ?.map((item) => item.item_sub_category?.name)
        .filter((name): name is string => Boolean(name)) || []
    )
  );
  // Stats: total count and per-category count (for display at top)
  const totalItemCount = items?.length ?? 0;
  const categoryCount = new Set(
    (items ?? []).map((item) => item.item_sub_category?.name ?? '_no_category')
  ).size;

  // Inventory stats for stat cards
  const { inStockCount, lowStockCount } = (items || []).reduce(
    (acc, item) => {
      const status = getItemStockStatus(item);
      if (status === 'inStock') acc.inStockCount += 1;
      if (status === 'lowStock' || status === 'outOfStock') acc.lowStockCount += 1;
      return acc;
    },
    { inStockCount: 0, lowStockCount: 0 }
  );

  const brandsInItems = Array.from(
    new Set(
      items
        ?.map((item) => item.brand?.name)
        .filter((name): name is string => Boolean(name)) || []
    )
  );

  if (profileLoading) {
    return (
      <Container maxWidth={false} disableGutters sx={{ mt: 0, mb: 0, px: 1 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            gap: 2,
          }}
        >
          <CircularProgress size={60} />
          <Typography variant="h6" color="text.secondary">
            {t('common.loading')}
          </Typography>
        </Box>
      </Container>
    );
  }

  if (profileError) {
    return (
      <Container maxWidth={false} disableGutters sx={{ mt: 0, mb: 0, px: 1 }}>
        <Alert severity="error">
          <Typography variant="h6" gutterBottom>
            {t('common.errorLoadingData')}
          </Typography>
          <Typography variant="body2">{profileError}</Typography>
        </Alert>
      </Container>
    );
  }

  if (!profile?.business) {
    return (
      <Container maxWidth={false} disableGutters sx={{ mt: 0, mb: 0, px: 1 }}>
        <Alert severity="error">
          {t('business.dashboard.noBusinessProfile')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} disableGutters sx={{ mt: 0, mb: 0, px: 1 }}>
      <SEOHead
        title={t('seo.business-items.title')}
        description={t('seo.business-items.description')}
        keywords={t('seo.business-items.keywords')}
      />

      <BusinessVerificationBanner />

      {isPlatformAdmin && (
        <AdminBusinessSelector
          selectedBusinessId={effectiveBusinessId}
          ownBusinessId={ownBusinessId}
          ownBusinessName={profile.business.name}
          isViewingOtherBusiness={isViewingOtherBusiness}
          onChange={(businessId) => {
            setSelectedBusinessId(businessId);
          }}
        />
      )}

      {/* Title row: title + subtitle, actions */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={1}
        sx={{ mb: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" fontWeight={600} sx={{ lineHeight: 1.25 }}>
            {t('business.items.title').split(' ').slice(0, -1).join(' ')}{' '}
            <Box component="span" color="error.main">
              {t('business.items.title').split(' ').slice(-1)[0]}
            </Box>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('business.items.subtitle', {
              count: totalItemCount,
              categories: categoryCount,
            })}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<AddPhotoAlternateIcon />}
            onClick={() => navigate('/business/items/add-from-image')}
            size="small"
            sx={{ borderRadius: 0 }}
          >
            {t('business.items.addFromImage', 'Create new item')}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleOpenFacebookExportSelect}
            size="small"
            sx={{ borderRadius: 0 }}
            disabled={loading || (items?.length ?? 0) === 0}
          >
            {t(
              'business.items.facebookExport.button',
              'Export for Facebook (CSV)'
            )}
          </Button>
        </Stack>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          mb: 1.5,
          borderRadius: 0,
          px: { xs: 1.5, sm: 2 },
          py: 1,
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1, sm: 0 }}
          divider={
            <Divider
              flexItem
              orientation="vertical"
              sx={{ display: { xs: 'none', sm: 'block' }, mx: 1 }}
            />
          }
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <InventoryIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>
                {t('business.items.stats.totalItems')}
              </Typography>
              <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                {totalItemCount}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>
                {t('business.items.stats.inStock')}
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={0.75} flexWrap="wrap">
                <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                  {inStockCount}
                </Typography>
                {totalItemCount > 0 && (
                  <Typography variant="caption" color="success.main">
                    {((100 * inStockCount) / totalItemCount).toFixed(1)}%{' '}
                    {t('business.items.stats.ofCatalogue')}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <WarningIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>
                {t('business.items.stats.lowStock')}
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={0.75} flexWrap="wrap">
                <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                  {lowStockCount}
                </Typography>
                {lowStockCount > 0 && (
                  <Typography variant="caption" color="warning.main">
                    {t('business.items.stats.needsRestocking')}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </Stack>
      </Paper>

      {lowStockCount > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 1.5, borderRadius: 0, py: 0.25 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setFilters((f) => ({ ...f, stockFilter: 'lowStock' }))}
            >
              {t('business.items.viewLowStock')} →
            </Button>
          }
        >
          {t('business.items.lowStockBanner', { count: lowStockCount })}
        </Alert>
      )}

      <Paper sx={{ width: '100%' }} elevation={0}>
        <Box sx={{ pt: 0.5, pb: 0.5 }}>
          <ItemsFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            categories={categories}
            brands={brandsInItems}
            totalItems={items?.length || 0}
            filteredItemsCount={filteredItems.length}
          />

          {loading ? (
            <ItemsCardsSkeleton />
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : !filteredItems || filteredItems.length === 0 ? (
            <Alert severity="info">{t('business.items.noItemsFound')}</Alert>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                alignItems: 'stretch',
              }}
            >
              {sortedItems.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: {
                      xs: '1 1 100%',
                      sm: '1 1 calc(50% - 12px)',
                      md: '1 1 calc(33.333% - 16px)',
                    },
                  }}
                >
                  <BusinessItemCardView
                    item={item}
                    onViewItem={handleViewItem}
                    onEditItem={handleEditItem}
                    onDeleteItem={canDelete ? handleDeleteItem : undefined}
                    onRestockInventoryItem={handleRestockInventoryItem}
                    onManageDeals={
                      canSuperUserActions ? handleManageDeals : undefined
                    }
                    onPromoteItem={
                      canSuperUserActions ? handlePromoteItem : undefined
                    }
                    onRefineWithAi={(i) => setRefineAiItem(i)}
                    onToggleItemActive={handleToggleItemActive}
                    onTogglePayOnDelivery={handleTogglePayOnDelivery}
                    onTogglePayAtPickup={handleTogglePayAtPickup}
                    onToggleFavorite={handleToggleFavorite}
                    onManageCollections={
                      canSuperUserActions
                        ? (i) => setManageCollectionsItem(i)
                        : undefined
                    }
                  />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Dialogs */}
      <UpdateInventoryDialog
        open={showUpdateInventoryDialog}
        onClose={() => setShowUpdateInventoryDialog(false)}
        businessId={effectiveBusinessId}
        item={
          updatingInventoryItem
            ? items.find((item) => item.id === updatingInventoryItem.item_id) ||
              null
            : null
        }
        selectedInventory={updatingInventoryItem}
        skipFetchInventory
        onInventoryUpdated={(itemId) => {
          void refreshListItem(itemId);
        }}
      />

      <ManageDealsDialog
        open={Boolean(manageDealsItem)}
        onClose={() => setManageDealsItem(null)}
        inventoryItem={manageDealsItem}
        businessId={effectiveBusinessId}
      />

      <PromoteItemDialog
        open={Boolean(promoteItem)}
        onClose={() => setPromoteItem(null)}
        item={promoteItem}
        businessId={effectiveBusinessId}
        onSaved={() => {
          if (promoteItem?.id) void refreshListItem(promoteItem.id);
        }}
      />

      <RefineItemWithAiDialog
        open={Boolean(refineAiItem)}
        item={refineAiItem}
        brands={brands}
        itemSubCategories={itemSubCategories}
        onClose={() => setRefineAiItem(null)}
        onApplied={(itemId) => {
          void refreshListItem(itemId);
        }}
        updateItem={updateItem}
      />

      <ManageItemCollectionsDialog
        open={Boolean(manageCollectionsItem)}
        itemId={manageCollectionsItem?.id ?? null}
        businessId={effectiveBusinessId}
        onClose={() => setManageCollectionsItem(null)}
        onSaved={() => {
          if (manageCollectionsItem?.id) {
            void refreshListItem(manageCollectionsItem.id);
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <DialogTitle>{t('business.items.confirmDelete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {itemToDelete
              ? t('business.items.deleteItemConfirm', {
                  name: itemToDelete.name,
                })
              : t('business.inventory.deleteInventoryConfirm')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowDeleteConfirm(false)}
            disabled={deleteLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteLoading}
            startIcon={
              deleteLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {deleteLoading ? t('common.loading') : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <FacebookExportSelectDialog
        open={facebookExportSelectOpen}
        onClose={() => setFacebookExportSelectOpen(false)}
        items={sortedItems}
        onConfirm={handleConfirmFacebookExport}
      />
    </Container>
  );
};

export default BusinessItemsPage;
