import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Inventory as InventoryIcon,
  Refresh as RefreshIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
} from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { useItems } from '../../hooks/useItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import AddItemDialog from '../business/AddItemDialog';
import BusinessItemCardView from '../business/BusinessItemCardView';
import CSVUploadDialog from '../business/CSVUploadDialog';
import EditItemDialog from '../business/EditItemDialog';
import UpdateInventoryDialog from '../business/UpdateInventoryDialog';
import SEOHead from '../seo/SEOHead';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`items-tabpanel-${index}`}
      aria-labelledby={`items-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const BusinessItemsPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfile();
  const [tabValue, setTabValue] = useState(0);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [showCSVUploadDialog, setShowCSVUploadDialog] = useState(false);
  const [showUpdateInventoryDialog, setShowUpdateInventoryDialog] =
    useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [updatingInventoryItem, setUpdatingInventoryItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  // Table state
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');

  const {
    items,
    brands,
    itemSubCategories,
    loading: itemsLoading,
    error: itemsError,
    fetchItems,
    fetchBrands,
    fetchItemSubCategories,
  } = useItems(profile?.business?.id);

  const {
    businessLocations,
    loading: inventoryLoading,
    refreshBusinessLocations,
  } = useBusinessInventory(profile?.business?.id);

  // Fetch data when component mounts
  useEffect(() => {
    if (profile?.business?.id) {
      fetchItems(false);
      fetchBrands();
      fetchItemSubCategories();
    }
  }, [profile?.business?.id]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setShowEditItemDialog(true);
  };

  const handleCloseEditItemDialog = () => {
    setShowEditItemDialog(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (item: any) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      // TODO: Implement item deletion
      enqueueSnackbar(t('business.items.itemDeleted'), {
        variant: 'success',
      });
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    } catch (error) {
      enqueueSnackbar(t('business.items.deleteError'), {
        variant: 'error',
      });
    }
  };

  const handleRestockInventoryItem = (item: any) => {
    // If item has business_inventories, use the first one, otherwise use the item directly
    const inventoryItem = item.business_inventories?.[0] || item;
    setUpdatingInventoryItem(inventoryItem);
    setShowUpdateInventoryDialog(true);
  };

  const handleRefreshLocations = async () => {
    try {
      await refreshBusinessLocations();
      enqueueSnackbar(t('business.locations.locationsRefreshed'), {
        variant: 'success',
      });
    } catch (error) {
      enqueueSnackbar(t('business.locations.refreshError'), {
        variant: 'error',
      });
    }
  };

  const downloadItemsCSV = () => {
    if (!items || items.length === 0) {
      enqueueSnackbar(t('business.items.noItemsToDownload'), {
        variant: 'warning',
      });
      return;
    }

    // Define headers in the same order as the upload template
    const headers = [
      'name',
      'description',
      'price',
      'currency',
      'sku',
      'size',
      'size_unit',
      'weight',
      'weight_unit',
      'color',
      'material',
      'model',
      'is_fragile',
      'is_perishable',
      'requires_special_handling',
      'min_order_quantity',
      'max_order_quantity',
      'is_active',
      'item_sub_category_id',
      'brand_id',
      'business_location_name',
      'quantity',
      'available_quantity',
      'reserved_quantity',
      'reorder_point',
      'reorder_quantity',
      'unit_cost',
      'selling_price',
      'image_url',
      'image_alt_text',
      'image_caption',
    ];

    // Convert items to CSV rows
    const csvRows = items.map((item) => {
      // Get the main image URL if available
      const mainImage = item.item_images?.find(
        (img) => img.image_type === 'main'
      );

      return [
        item.name || '',
        item.description || '',
        item.price?.toString() || '',
        item.currency || 'USD',
        item.sku || '',
        item.size?.toString() || '',
        item.size_unit || '',
        item.weight?.toString() || '',
        item.weight_unit || '',
        item.color || '',
        item.material || '',
        item.model || '',
        item.is_fragile?.toString() || 'false',
        item.is_perishable?.toString() || 'false',
        item.requires_special_handling?.toString() || 'false',
        item.min_order_quantity?.toString() || '1',
        item.max_order_quantity?.toString() || '',
        item.is_active?.toString() || 'true',
        item.item_sub_category_id?.toString() || '',
        item.brand_id || '',
        '', // business_location_name - will be empty for items without inventory
        '', // quantity
        '', // available_quantity
        '', // reserved_quantity
        '', // reorder_point
        '', // reorder_quantity
        '', // unit_cost
        '', // selling_price
        mainImage?.image_url || '',
        mainImage?.alt_text || '',
        mainImage?.caption || '',
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvRows.map((row) => row.join(',')),
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `items_export_${
      new Date().toISOString().split('T')[0]
    }.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    enqueueSnackbar(t('business.items.downloadSuccess'), {
      variant: 'success',
    });
  };

  const getStockStatus = (quantity: number, reorderPoint: number) => {
    if (quantity === 0)
      return { status: 'outOfStock', color: 'error' as const };
    if (quantity <= reorderPoint)
      return { status: 'lowStock', color: 'warning' as const };
    return { status: 'inStock', color: 'success' as const };
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  // DataGrid columns definition
  const columns: GridColDef[] = [
    {
      field: 'image',
      headerName: t('business.items.image'),
      width: 80,
      renderCell: (params: GridRenderCellParams) => {
        const mainImage = params.row.item_images?.find(
          (img: any) => img.image_type === 'main'
        );
        return (
          <Avatar
            src={mainImage?.image_url || '/src/assets/no-image.svg'}
            alt={params.row.name}
            sx={{ width: 40, height: 40 }}
            variant="rounded"
          />
        );
      },
      sortable: false,
      filterable: false,
    },
    {
      field: 'name',
      headerName: t('business.items.name'),
      width: 200,
      flex: 1,
    },
    {
      field: 'sku',
      headerName: t('business.items.sku'),
      width: 120,
    },
    {
      field: 'brand',
      headerName: t('business.items.brand'),
      width: 150,
      valueGetter: (value, row) => row.brand?.name || '',
    },
    {
      field: 'category',
      headerName: t('business.items.category'),
      width: 150,
      valueGetter: (value, row) => row.item_sub_category?.name || '',
    },
    {
      field: 'price',
      headerName: t('business.items.price'),
      width: 120,
      type: 'number',
      renderCell: (params: GridRenderCellParams) =>
        formatCurrency(params.row.price, params.row.currency),
    },
    {
      field: 'inventory',
      headerName: t('business.inventory.available'),
      width: 120,
      type: 'number',
      valueGetter: (value, row) =>
        row.business_inventories?.[0]?.available_quantity || 0,
    },
    {
      field: 'stock_status',
      headerName: t('business.inventory.stockStatus'),
      width: 130,
      renderCell: (params: GridRenderCellParams) => {
        const inventory = params.row.business_inventories?.[0];
        if (!inventory) {
          return (
            <Chip
              label={t('business.inventory.noInventory')}
              size="small"
              color="default"
            />
          );
        }
        const stockStatus = getStockStatus(
          inventory.available_quantity,
          inventory.reorder_point
        );
        return (
          <Chip
            label={t(`business.inventory.status.${stockStatus.status}`)}
            size="small"
            color={stockStatus.color}
          />
        );
      },
    },
    {
      field: 'is_active',
      headerName: t('business.items.status'),
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={
            params.row.is_active
              ? t('business.items.active')
              : t('business.items.inactive')
          }
          size="small"
          color={params.row.is_active ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'actions',
      headerName: t('common.actions'),
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title={t('business.items.editItem')}>
            <IconButton
              size="small"
              onClick={() => handleEditItem(params.row)}
              sx={{ color: theme.palette.primary.main }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          {params.row.business_inventories?.[0] && (
            <Tooltip title={t('business.inventory.restock')}>
              <IconButton
                size="small"
                onClick={() => handleRestockInventoryItem(params.row)}
                sx={{ color: theme.palette.warning.main }}
              >
                <InventoryIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('business.items.deleteItem')}>
            <IconButton
              size="small"
              onClick={() => handleDeleteItem(params.row)}
              sx={{ color: theme.palette.error.main }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
      sortable: false,
      filterable: false,
    },
  ];

  // Filter items based on search and filters
  const filteredItems =
    items?.filter((item) => {
      const matchesSearch =
        searchText === '' ||
        item.name.toLowerCase().includes(searchText.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchText.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.is_active) ||
        (statusFilter === 'inactive' && !item.is_active);

      const matchesCategory =
        categoryFilter === 'all' ||
        item.item_sub_category?.name === categoryFilter;

      const matchesBrand =
        brandFilter === 'all' || item.brand?.name === brandFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesBrand;
    }) || [];

  // Get unique categories and brands for filters
  const categories = Array.from(
    new Set(
      items?.map((item) => item.item_sub_category?.name).filter(Boolean) || []
    )
  );
  const brandsInItems = Array.from(
    new Set(items?.map((item) => item.brand?.name).filter(Boolean) || [])
  );

  if (!profile?.business) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {t('business.dashboard.noBusinessProfile')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('seo.business-items.title')}
        description={t('seo.business-items.description')}
        keywords={t('seo.business-items.keywords')}
      />

      <Typography variant="h4" gutterBottom>
        {t('business.items.title')}
      </Typography>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          aria-label="items tabs"
        >
          <Tab label={t('business.items.cardsView')} />
          <Tab label={t('business.items.tableView')} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {/* Cards View */}
          <Box sx={{ mb: 3 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">
                {t('business.items.cardsView')}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Tooltip title={t('business.items.downloadTemplate')}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={downloadItemsCSV}
                    disabled={itemsLoading || !items || items.length === 0}
                  >
                    {t('business.items.download')}
                  </Button>
                </Tooltip>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={() => setShowCSVUploadDialog(true)}
                >
                  {t('business.items.csvUpload')}
                </Button>
                <Tooltip title={t('business.locations.refreshLocations')}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefreshLocations}
                    disabled={inventoryLoading}
                  >
                    {t('business.locations.refresh')}
                  </Button>
                </Tooltip>
                <Tooltip title={t('business.inventory.noLocationsError')}>
                  <span>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        if (businessLocations.length === 0) {
                          enqueueSnackbar(
                            t('business.inventory.noLocationsError'),
                            { variant: 'error' }
                          );
                          return;
                        }
                        // Refresh business locations before opening dialog
                        refreshBusinessLocations();
                        setShowAddItemDialog(true);
                      }}
                      disabled={businessLocations.length === 0}
                    >
                      {t('business.items.addItem')}
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Box>

            {itemsLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <Typography>{t('common.loading')}</Typography>
              </Box>
            ) : itemsError ? (
              <Alert severity="error">{itemsError}</Alert>
            ) : !items || items.length === 0 ? (
              <Alert severity="info">{t('business.items.noItemsFound')}</Alert>
            ) : (
              <Grid container spacing={3}>
                {items.map((item) => (
                  <Grid item xs={12} sm={6} md={4} key={item.id}>
                    <BusinessItemCardView
                      item={item}
                      onEditItem={handleEditItem}
                      onDeleteItem={handleDeleteItem}
                      onRestockInventoryItem={handleRestockInventoryItem}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Table View */}
          <Box sx={{ mb: 3 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">
                {t('business.items.tableView')}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Tooltip title={t('business.items.downloadTemplate')}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={downloadItemsCSV}
                    disabled={itemsLoading || !items || items.length === 0}
                  >
                    {t('business.items.download')}
                  </Button>
                </Tooltip>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={() => setShowCSVUploadDialog(true)}
                >
                  {t('business.items.csvUpload')}
                </Button>
                <Tooltip title={t('business.locations.refreshLocations')}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefreshLocations}
                    disabled={inventoryLoading}
                  >
                    {t('business.locations.refresh')}
                  </Button>
                </Tooltip>
                <Tooltip title={t('business.inventory.noLocationsError')}>
                  <span>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        if (businessLocations.length === 0) {
                          enqueueSnackbar(
                            t('business.inventory.noLocationsError'),
                            { variant: 'error' }
                          );
                          return;
                        }
                        // Refresh business locations before opening dialog
                        refreshBusinessLocations();
                        setShowAddItemDialog(true);
                      }}
                      disabled={businessLocations.length === 0}
                    >
                      {t('business.items.addItem')}
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Box>

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack
                direction="row"
                spacing={2}
                flexWrap="wrap"
                alignItems="center"
              >
                <TextField
                  label={t('common.search')}
                  variant="outlined"
                  size="small"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  sx={{ minWidth: 200 }}
                />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>{t('business.items.status')}</InputLabel>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    label={t('business.items.status')}
                  >
                    <MenuItem value="all">{t('common.all')}</MenuItem>
                    <MenuItem value="active">
                      {t('business.items.active')}
                    </MenuItem>
                    <MenuItem value="inactive">
                      {t('business.items.inactive')}
                    </MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>{t('business.items.category')}</InputLabel>
                  <Select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    label={t('business.items.category')}
                  >
                    <MenuItem value="all">{t('common.all')}</MenuItem>
                    {categories.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>{t('business.items.brand')}</InputLabel>
                  <Select
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    label={t('business.items.brand')}
                  >
                    <MenuItem value="all">{t('common.all')}</MenuItem>
                    {brandsInItems.map((brand) => (
                      <MenuItem key={brand} value={brand}>
                        {brand}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSearchText('');
                    setStatusFilter('all');
                    setCategoryFilter('all');
                    setBrandFilter('all');
                  }}
                >
                  {t('common.clearFilters')}
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {t('common.showing')} {filteredItems.length} {t('common.of')}{' '}
                  {items?.length || 0} {t('business.items.items')}
                </Typography>
              </Stack>
            </Paper>

            {/* DataGrid */}
            {itemsLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <Typography>{t('common.loading')}</Typography>
              </Box>
            ) : itemsError ? (
              <Alert severity="error">{itemsError}</Alert>
            ) : (
              <div style={{ height: 600, width: '100%' }}>
                <DataGrid
                  rows={filteredItems}
                  columns={columns}
                  pageSizeOptions={[10, 25, 50, 100]}
                  initialState={{
                    pagination: {
                      paginationModel: {
                        pageSize: 25,
                      },
                    },
                  }}
                  disableRowSelectionOnClick
                  slots={{
                    toolbar: GridToolbar,
                  }}
                  slotProps={{
                    toolbar: {
                      showQuickFilter: true,
                      quickFilterProps: { debounceMs: 500 },
                    },
                  }}
                  sx={{
                    '& .MuiDataGrid-cell': {
                      display: 'flex',
                      alignItems: 'center',
                    },
                    '& .MuiDataGrid-row:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                />
              </div>
            )}
          </Box>
        </TabPanel>
      </Paper>

      {/* Dialogs */}
      <AddItemDialog
        open={showAddItemDialog}
        onClose={() => setShowAddItemDialog(false)}
        businessId={profile.business.id}
        businessLocations={businessLocations}
        items={items}
        brands={brands}
        itemSubCategories={itemSubCategories}
        loading={itemsLoading}
      />

      <EditItemDialog
        open={showEditItemDialog}
        onClose={handleCloseEditItemDialog}
        item={editingItem}
        businessId={profile.business.id}
      />

      <UpdateInventoryDialog
        open={showUpdateInventoryDialog}
        onClose={() => setShowUpdateInventoryDialog(false)}
        item={
          updatingInventoryItem
            ? items.find((item) => item.id === updatingInventoryItem.item_id) ||
              null
            : null
        }
        businessLocations={businessLocations}
      />

      <CSVUploadDialog
        open={showCSVUploadDialog}
        onClose={() => setShowCSVUploadDialog(false)}
        businessId={profile.business.id}
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
          <Button onClick={() => setShowDeleteConfirm(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BusinessItemsPage;
