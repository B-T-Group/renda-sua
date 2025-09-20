import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Inventory as InventoryIcon,
  LocationOn as LocationOnIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Upload as UploadIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { useItems } from '../../hooks/useItems';
import AddItemDialog from '../business/AddItemDialog';
import BusinessItemCardView from '../business/BusinessItemCardView';
import CSVUploadDialog from '../business/CSVUploadDialog';
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

const ItemsTableSkeleton: React.FC = () => {
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>
              <Skeleton variant="text" width={60} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={100} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={80} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={100} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={100} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={80} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={100} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={80} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={80} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={120} />
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from(new Array(5)).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton variant="circular" width={40} height={40} />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={150} />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={80} />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={100} />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={100} />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={60} />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={80} />
              </TableCell>
              <TableCell>
                <Skeleton variant="rectangular" width={60} height={24} />
              </TableCell>
              <TableCell>
                <Skeleton variant="rectangular" width={60} height={24} />
              </TableCell>
              <TableCell>
                <Box display="flex" gap={1}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton variant="circular" width={32} height={32} />
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const BusinessItemsPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useUserProfileContext();
  const [tabValue, setTabValue] = useState(0);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showCSVUploadDialog, setShowCSVUploadDialog] = useState(false);
  const [showUpdateInventoryDialog, setShowUpdateInventoryDialog] =
    useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingInventoryItem, setUpdatingInventoryItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const navigate = useNavigate();

  // Fetch data when component mounts
  useEffect(() => {
    if (profile?.business?.id) {
      fetchItems(false);
      fetchBrands();
      fetchItemSubCategories();
      refreshBusinessLocations(); // Ensure business locations are loaded
    }
  }, [
    profile?.business?.id,
    fetchItems,
    fetchBrands,
    fetchItemSubCategories,
    refreshBusinessLocations,
  ]);

  // Refresh data when window regains focus or becomes visible (useful when returning from other pages)
  useEffect(() => {
    const handleFocus = () => {
      if (profile?.business?.id) {
        fetchItems(false);
        refreshBusinessLocations();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && profile?.business?.id) {
        fetchItems(false);
        refreshBusinessLocations();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [profile?.business?.id, fetchItems, refreshBusinessLocations]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

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
      'weight',
      'weight_unit',
      'color',
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
      'computed_available_quantity',
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
        item.weight?.toString() || '',
        item.weight_unit || '',
        item.color || '',
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
        '', // computed_available_quantity
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
        row.business_inventories?.[0]?.computed_available_quantity || 0,
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
          inventory.computed_available_quantity,
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
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title={t('business.items.viewItem')}>
            <IconButton
              size="small"
              onClick={() => handleViewItem(params.row)}
              sx={{ color: theme.palette.info.main }}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
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

  if (profileLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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
                      // Navigate to add item page
                      navigate('/business/items/add');
                    }}
                    disabled={businessLocations.length === 0}
                  >
                    {t('business.items.addItem')}
                  </Button>
                </span>
                {businessLocations.length === 0 && (
                  <Button
                    variant="outlined"
                    startIcon={<LocationOnIcon />}
                    onClick={() => navigate('/business/locations')}
                    color="primary"
                  >
                    {t('business.locations.addLocation')}
                  </Button>
                )}
              </Stack>
            </Box>

            {/* Filters */}
            <Box sx={{ mb: 3 }}>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                flexWrap="wrap"
              >
                <TextField
                  placeholder={t('business.items.filters.search')}
                  variant="outlined"
                  size="small"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  sx={{ minWidth: 200 }}
                  InputProps={{
                    startAdornment: (
                      <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />

                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>{t('business.items.filters.status')}</InputLabel>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    label={t('business.items.filters.status')}
                  >
                    <MenuItem value="all">
                      {t('business.items.filters.allStatuses')}
                    </MenuItem>
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
                    <MenuItem value="all">{t('common.allCategories')}</MenuItem>
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
                    <MenuItem value="all">{t('common.allBrands')}</MenuItem>
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
            </Box>

            {itemsLoading ? (
              <ItemsCardsSkeleton />
            ) : itemsError ? (
              <Alert severity="error">{itemsError}</Alert>
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
                    />
                  </Box>
                ))}
              </Box>
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
              <ItemsTableSkeleton />
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
          fetchItems(false); // Refresh items list
        }}
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
