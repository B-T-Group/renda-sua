import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Inventory as InventoryIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import { useItems } from '../../hooks/useItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import AddItemDialog from '../business/AddItemDialog';
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
    inventory,
    businessLocations,
    loading: inventoryLoading,
    error: inventoryError,
  } = useBusinessInventory(profile?.business?.id);

  const { loading: locationsLoading } = useBusinessLocations();

  // Fetch data when component mounts
  useEffect(() => {
    if (profile?.business?.id) {
      fetchItems();
      fetchBrands();
      fetchItemSubCategories();
    }
  }, [profile?.business?.id, fetchItems, fetchBrands, fetchItemSubCategories]);

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

  const handleDeleteInventoryItem = (item: any) => {
    setUpdatingInventoryItem(item);
    setShowDeleteConfirm(true);
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
                {items.map((item) => {
                  const mainImage = item.item_images?.find(
                    (img) => img.image_type === 'main'
                  );
                  const itemInventory = item.business_inventories?.[0];
                  const stockStatus = itemInventory
                    ? getStockStatus(
                        itemInventory.available_quantity,
                        itemInventory.reorder_point
                      )
                    : null;

                  return (
                    <Grid item xs={12} sm={6} md={4} key={item.id}>
                      <Card
                        sx={{
                          height: '100%',
                          width: '100%',
                          minHeight: 400,
                          display: 'flex',
                          flexDirection: 'column',
                          transition:
                            'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: theme.shadows[8],
                          },
                        }}
                      >
                        {/* Image Section */}
                        <CardMedia
                          component="img"
                          height="200"
                          image={
                            mainImage?.image_url || '/src/assets/no-image.svg'
                          }
                          alt={mainImage?.alt_text || item.name}
                          sx={{
                            objectFit: 'cover',
                            backgroundColor: theme.palette.grey[100],
                          }}
                        />

                        <CardContent
                          sx={{
                            flexGrow: 1,
                            p: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                          }}
                        >
                          {/* Item Section */}
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="h6" gutterBottom noWrap>
                              {item.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mb: 1,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {item.description}
                            </Typography>
                            <Typography
                              variant="h6"
                              color="primary"
                              gutterBottom
                            >
                              {formatCurrency(item.price, item.currency)}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                              <Chip
                                label={item.sku}
                                size="small"
                                variant="outlined"
                              />
                              {item.is_active ? (
                                <Chip
                                  label={t('business.items.active')}
                                  size="small"
                                  color="success"
                                />
                              ) : (
                                <Chip
                                  label={t('business.items.inactive')}
                                  size="small"
                                  color="default"
                                />
                              )}
                            </Stack>
                          </Box>

                          {/* Inventory Section */}
                          <Box sx={{ mb: 2 }}>
                            <Typography
                              variant="subtitle2"
                              color="text.secondary"
                              gutterBottom
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <InventoryIcon fontSize="small" />
                              {t('business.inventory.title')}
                            </Typography>
                            {itemInventory ? (
                              <Stack spacing={1}>
                                <Box
                                  display="flex"
                                  justifyContent="space-between"
                                >
                                  <Typography variant="body2">
                                    {t('business.inventory.available')}:
                                  </Typography>
                                  <Typography variant="body2" fontWeight="bold">
                                    {itemInventory.available_quantity}
                                  </Typography>
                                </Box>
                                <Box
                                  display="flex"
                                  justifyContent="space-between"
                                >
                                  <Typography variant="body2">
                                    {t('business.inventory.sellingPrice')}:
                                  </Typography>
                                  <Typography variant="body2" fontWeight="bold">
                                    {formatCurrency(
                                      itemInventory.selling_price,
                                      item.currency
                                    )}
                                  </Typography>
                                </Box>
                                <Chip
                                  label={t(
                                    `business.inventory.status.${stockStatus?.status}`
                                  )}
                                  size="small"
                                  color={stockStatus?.color}
                                  sx={{ alignSelf: 'flex-start' }}
                                />
                              </Stack>
                            ) : (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontStyle: 'italic' }}
                              >
                                {t('business.inventory.noInventory')}
                              </Typography>
                            )}
                          </Box>

                          {/* Actions */}
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ mt: 'auto' }}
                          >
                            <Tooltip title={t('business.items.editItem')}>
                              <IconButton
                                size="small"
                                onClick={() => handleEditItem(item)}
                                sx={{ color: theme.palette.primary.main }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            {itemInventory && (
                              <Tooltip title={t('business.inventory.restock')}>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    handleRestockInventoryItem(item)
                                  }
                                  sx={{ color: theme.palette.warning.main }}
                                >
                                  <InventoryIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title={t('business.items.deleteItem')}>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteItem(item)}
                                sx={{ color: theme.palette.error.main }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Table View - TODO: Implement table view */}
          <Box display="flex" justifyContent="center" p={3}>
            <Typography color="text.secondary">
              {t('business.items.tableViewComingSoon')}
            </Typography>
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
