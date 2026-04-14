import {
  AddPhotoAlternate as AddPhotoAlternateIcon,
  CheckCircle as CheckCircleIcon,
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
  Grid,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useApiClient } from '../../hooks/useApiClient';
import { useBusinessItemsPageData } from '../../hooks/useBusinessItemsPageData';
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { useItems, type Item } from '../../hooks/useItems';
import BusinessItemCardView from '../business/BusinessItemCardView';
import ItemsFilterBar, { ItemsFilterState } from '../business/ItemsFilterBar';
import UpdateInventoryDialog from '../business/UpdateInventoryDialog';
import ManageDealsDialog from '../business/ManageDealsDialog';
import RefineItemWithAiDialog from '../dialogs/RefineItemWithAiDialog';
import SEOHead from '../seo/SEOHead';

// Skeleton loading components
const ItemsCardsSkeleton: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {Array.from(new Array(6)).map((_, index) => (
        <Box
          key={index}
          sx={{
            flex: {
              xs: '1 1 100%',
              sm: '1 1 calc(50% - 12px)',
              md: '1 1 calc(33.333% - 16px)',
            },
          }}
        >
          <Card>
            <Skeleton variant="rectangular" height={200} />
            <CardContent>
              <Skeleton variant="text" height={24} sx={{ mb: 1 }} />
              <Skeleton variant="text" height={20} sx={{ mb: 1 }} />
              <Skeleton variant="text" height={20} width="60%" sx={{ mb: 2 }} />
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <Skeleton variant="rectangular" width={80} height={32} />
                <Box display="flex" gap={1}>
                  <Skeleton variant="circular" width={40} height={40} />
                  <Skeleton variant="circular" width={40} height={40} />
                  <Skeleton variant="circular" width={40} height={40} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
  );
};

const BusinessItemsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useUserProfileContext();
  const [showUpdateInventoryDialog, setShowUpdateInventoryDialog] =
    useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingInventoryItem, setUpdatingInventoryItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [manageDealsItem, setManageDealsItem] = useState<any | null>(null);
  const [refineAiItem, setRefineAiItem] = useState<Item | null>(null);

  // Filter state
  const [filters, setFilters] = useState<ItemsFilterState>({
    searchText: '',
    statusFilter: 'all',
    categoryFilter: 'all',
    brandFilter: 'all',
    stockFilter: 'all',
  });

  const apiClient = useApiClient();
  const {
    items,
    loading: pageDataLoading,
    error: pageDataError,
    refetch: refetchPageData,
  } = useBusinessItemsPageData(profile?.business?.id);

  const {
    brands,
    itemSubCategories,
    loading: itemsLoading,
    error: itemsError,
    fetchBrands,
    fetchItemSubCategories,
    updateItem,
  } = useItems(profile?.business?.id, { skipInitialItemsFetch: true });

  useBusinessInventory(profile?.business?.id, { skipInitialFetch: true });

  const navigate = useNavigate();

  const loading = pageDataLoading || itemsLoading;
  const error = pageDataError || itemsError;

  // Fetch brands and subcategories when component mounts (items/locations come from page-data)
  useEffect(() => {
    if (profile?.business?.id) {
      fetchBrands();
      fetchItemSubCategories();
    }
  }, [profile?.business?.id, fetchBrands, fetchItemSubCategories]);

  // Refresh page data when window regains focus or becomes visible
  useEffect(() => {
    const handleFocus = () => {
      if (profile?.business?.id) refetchPageData();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && profile?.business?.id) refetchPageData();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [profile?.business?.id, refetchPageData]);

  const handleEditItem = (item: any) => {
    // Navigate to the edit page instead of opening dialog
    navigate(`/business/items/edit/${item.id}`);
  };

  const handleViewItem = (item: any) => {
    // Navigate to the view page
    navigate(`/business/items/${item.id}`);
  };

  const handleDeleteItem = (item: any) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setDeleteLoading(true);
    try {
      await apiClient.delete('/business-items/' + itemToDelete.id);
      enqueueSnackbar(t('business.items.itemDeleted'), {
        variant: 'success',
      });
      setShowDeleteConfirm(false);
      setItemToDelete(null);
      await refetchPageData();
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

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesBrand &&
        matchesStock
      );
    }) || [];

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
  const categoryCountMap = (items || []).reduce<Record<string, number>>(
    (acc, item) => {
      const key =
        item.item_sub_category?.name ?? '_no_category';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const categoryCountEntries = Object.entries(categoryCountMap).sort(
    ([a], [b]) => a.localeCompare(b)
  );
  const categoryCount = categoryCountEntries.length;

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

      {/* Title row: title + subtitle, actions */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        gap={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>
            {t('business.items.title').split(' ').slice(0, -1).join(' ')}{' '}
            <Box component="span" color="error.main">
              {t('business.items.title').split(' ').slice(-1)[0]}
            </Box>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('business.items.subtitle', {
              count: totalItemCount,
              categories: categoryCount,
            })}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            color="error"
            startIcon={<AddPhotoAlternateIcon />}
            onClick={() => navigate('/business/items/add-from-image')}
            size="medium"
            sx={{ borderRadius: 0 }}
          >
            {t('business.items.addFromImage', 'Add from image')}
          </Button>
        </Stack>
      </Stack>

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant="outlined" sx={{ borderRadius: 0, height: '100%' }}>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    {t('business.items.stats.totalItems')}
                  </Typography>
                  <Typography variant="h4">{totalItemCount}</Typography>
                </Box>
                <InventoryIcon sx={{ color: 'warning.main', fontSize: 28 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant="outlined" sx={{ borderRadius: 0, height: '100%' }}>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    {t('business.items.stats.inStock')}
                  </Typography>
                  <Typography variant="h4">{inStockCount}</Typography>
                  <Typography variant="caption" color="success.main">
                    {totalItemCount > 0
                      ? `^ ${((100 * inStockCount) / totalItemCount).toFixed(1)}% ${t('business.items.stats.ofCatalogue')}`
                      : ''}
                  </Typography>
                </Box>
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant="outlined" sx={{ borderRadius: 0, height: '100%' }}>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    {t('business.items.stats.lowStock')}
                  </Typography>
                  <Typography variant="h4">{lowStockCount}</Typography>
                  <Typography variant="caption" color="warning.main">
                    {lowStockCount > 0 ? `v ${t('business.items.stats.needsRestocking')}` : ''}
                  </Typography>
                </Box>
                <WarningIcon sx={{ color: 'warning.main', fontSize: 28 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Low stock alert banner */}
      {lowStockCount > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 2, borderRadius: 0 }}
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

      <Paper sx={{ width: '100%', mb: 0.5 }} elevation={0}>
        {/* Category filter tabs */}
        <Tabs
          value={filters.categoryFilter}
          onChange={(_e, v) => setFilters((f) => ({ ...f, categoryFilter: v }))}
          variant="scrollable"
          scrollButtons="auto"
          indicatorColor="primary"
          textColor="primary"
          aria-label="category tabs"
          sx={{ px: 0, minHeight: 40, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={`${t('business.items.allItems')} ${totalItemCount}`} value="all" />
          {categoryCountEntries.map(([key, count]) => (
            <Tab
              key={key}
              label={`${key === '_no_category' ? t('business.items.filters.noCategory') : key} ${count}`}
              value={key}
            />
          ))}
        </Tabs>

        <Box sx={{ mb: 3 }}>
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
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {filteredItems.map((item) => (
                <Box
                  key={item.id}
                  sx={{
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
                    onDeleteItem={handleDeleteItem}
                    onRestockInventoryItem={handleRestockInventoryItem}
                    onManageDeals={handleManageDeals}
                    onRefineWithAi={(i) => setRefineAiItem(i)}
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
        item={
          updatingInventoryItem
            ? items.find((item) => item.id === updatingInventoryItem.item_id) ||
              null
            : null
        }
        selectedInventory={updatingInventoryItem}
        onInventoryUpdated={() => {
          refetchPageData();
        }}
      />

      <ManageDealsDialog
        open={Boolean(manageDealsItem)}
        onClose={() => setManageDealsItem(null)}
        inventoryItem={manageDealsItem}
      />

      <RefineItemWithAiDialog
        open={Boolean(refineAiItem)}
        item={refineAiItem}
        brands={brands}
        itemSubCategories={itemSubCategories}
        onClose={() => setRefineAiItem(null)}
        onApplied={() => {
          refetchPageData();
        }}
        updateItem={updateItem}
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
    </Container>
  );
};

export default BusinessItemsPage;
