import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Inventory as InventoryIcon,
  PhotoCamera as PhotoCameraIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Divider,
  Grid,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import NoImage from '../../assets/no-image.svg';
import {
  BusinessInventoryItem,
  useBusinessInventory,
} from '../../hooks/useBusinessInventory';
import { Item, useItems } from '../../hooks/useItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import { ItemImage } from '../../types/image';
import ImageUploadDialog from '../business/ImageUploadDialog';
import UpdateInventoryDialog from '../business/UpdateInventoryDialog';
import SEOHead from '../seo/SEOHead';

// Type for business_inventories from Item interface
type ItemBusinessInventory = NonNullable<Item['business_inventories']>[0];

export default function ItemViewPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpdateInventoryDialog, setShowUpdateInventoryDialog] =
    useState(false);
  const [selectedInventory, setSelectedInventory] = useState<
    BusinessInventoryItem | ItemBusinessInventory | null
  >(null);
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);

  const { fetchSingleItem } = useItems(profile?.business?.id);
  const { fetchBusinessLocations } = useBusinessInventory();

  const fetchItemDetails = useCallback(async () => {
    if (!itemId) return;

    setLoading(true);
    setError(null);

    try {
      const foundItem = await fetchSingleItem(itemId);

      if (foundItem) {
        setItem(foundItem);
      } else {
        setError(t('business.inventory.itemNotFound'));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch item details'
      );
    } finally {
      setLoading(false);
    }
  }, [itemId, fetchSingleItem, t]);

  useEffect(() => {
    if (itemId) {
      fetchItemDetails();
    }
  }, [itemId, fetchItemDetails]);

  useEffect(() => {
    if (profile?.business?.id) {
      fetchBusinessLocations();
    }
  }, [profile?.business?.id, fetchBusinessLocations]);

  const handleEditItem = () => {
    if (item?.id) {
      navigate(`/business/items/edit/${item.id}`);
    }
  };

  const handleUpdateInventory = (
    inventory?: BusinessInventoryItem | ItemBusinessInventory
  ) => {
    setSelectedInventory(inventory || null);
    setShowUpdateInventoryDialog(true);
  };

  const handleUpdateInventoryClick = () => {
    handleUpdateInventory();
  };

  const handleManageImages = () => {
    setShowImageUploadDialog(true);
  };

  const handleBack = () => {
    navigate('/business/items');
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStockStatus = (
    inventory: ItemBusinessInventory | BusinessInventoryItem
  ) => {
    const available = inventory.computed_available_quantity;
    const reorderPoint = inventory.reorder_point;

    if (available === 0) {
      return { label: 'outOfStock', color: 'error' as const, percentage: 0 };
    } else if (available <= reorderPoint) {
      return {
        label: 'lowStock',
        color: 'warning' as const,
        percentage: (available / (reorderPoint * 2)) * 100,
      };
    } else {
      return {
        label: 'inStock',
        color: 'success' as const,
        percentage: Math.min((available / (reorderPoint * 2)) * 100, 100),
      };
    }
  };

  // Calculate inventory summary
  const inventorySummary = React.useMemo(() => {
    if (!item?.business_inventories) return null;

    const totalAvailable = item.business_inventories.reduce(
      (sum, inv) => sum + inv.computed_available_quantity,
      0
    );
    const totalReserved = item.business_inventories.reduce(
      (sum, inv) => sum + inv.reserved_quantity,
      0
    );
    const totalStock = item.business_inventories.reduce(
      (sum, inv) => sum + inv.quantity,
      0
    );
    const locationsWithStock = item.business_inventories.filter(
      (inv) => inv.computed_available_quantity > 0
    ).length;
    const locationsLowStock = item.business_inventories.filter(
      (inv) =>
        inv.computed_available_quantity > 0 &&
        inv.computed_available_quantity <= inv.reorder_point
    ).length;
    const locationsOutOfStock = item.business_inventories.filter(
      (inv) => inv.computed_available_quantity === 0
    ).length;

    return {
      totalAvailable,
      totalReserved,
      totalStock,
      locationsWithStock,
      locationsLowStock,
      locationsOutOfStock,
      totalLocations: item.business_inventories.length,
    };
  }, [item?.business_inventories]);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <Skeleton
          variant="rectangular"
          width={100}
          height={40}
          sx={{ mb: 3 }}
        />
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton
              variant="rectangular"
              height={400}
              sx={{ borderRadius: 2, mb: 3 }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton
              variant="rectangular"
              height={400}
              sx={{ borderRadius: 2 }}
            />
          </Grid>
        </Grid>
      </Container>
    );
  }

  if (error || !item) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || t('business.inventory.itemNotFound')}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          {t('common.back')}
        </Button>
      </Container>
    );
  }

  const mainImage = item.item_images?.find(
    (img: ItemImage) => img.image_type === 'main'
  );
  const galleryImages =
    item.item_images?.filter(
      (img: ItemImage) => img.image_type === 'gallery'
    ) || [];

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
      <SEOHead
        title={item.name}
        description={item.description}
        keywords={`${item.name}, ${item.brand?.name || ''}, ${
          item.item_sub_category?.name || ''
        }`}
      />

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={2}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
              variant="outlined"
              size={isMobile ? 'small' : 'medium'}
            >
              {t('common.back')}
            </Button>
            <Box>
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
              >
                {item.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                SKU: {item.sku}
              </Typography>
            </Box>
            <Chip
              label={item.is_active ? t('common.active') : t('common.inactive')}
              color={item.is_active ? 'success' : 'default'}
              size="small"
            />
          </Stack>

          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={handleEditItem}
            size={isMobile ? 'small' : 'medium'}
          >
            {t('business.inventory.editItemButton')}
          </Button>
        </Stack>
      </Box>

      {/* Inventory Warning Alert */}
      {(!item.business_inventories ||
        item.business_inventories.length === 0) && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          icon={<WarningIcon />}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleUpdateInventoryClick}
            >
              {t('business.inventory.addNow', 'Add Now')}
            </Button>
          }
        >
          <Typography variant="subtitle2" fontWeight={600}>
            {t(
              'business.inventory.itemNotVisible',
              'Item Not Visible to Customers'
            )}
          </Typography>
          <Typography variant="body2">
            {t(
              'business.inventory.itemNotVisibleMessage',
              'This item will not be visible to customers until it is added to at least one business location inventory.'
            )}
          </Typography>
        </Alert>
      )}

      {/* Inventory Summary Card */}
      {inventorySummary && inventorySummary.totalLocations > 0 && (
        <Card
          sx={{
            mb: 3,
            bgcolor: 'primary.50',
            border: '1px solid',
            borderColor: 'primary.main',
          }}
        >
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              fontWeight="bold"
              color="primary"
            >
              {t('business.inventory.summary', 'Inventory Summary')}
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('business.inventory.totalAvailable', 'Total Available')}
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight="bold"
                    color="success.main"
                  >
                    {inventorySummary.totalAvailable}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('business.inventory.totalReserved', 'Reserved')}
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight="bold"
                    color="warning.main"
                  >
                    {inventorySummary.totalReserved}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('business.inventory.totalStock', 'Total Stock')}
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {inventorySummary.totalStock}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('business.inventory.locations', 'Locations')}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {inventorySummary.locationsWithStock > 0 && (
                      <Chip
                        label={inventorySummary.locationsWithStock}
                        size="small"
                        color="success"
                        sx={{ height: 24 }}
                      />
                    )}
                    {inventorySummary.locationsLowStock > 0 && (
                      <Chip
                        label={inventorySummary.locationsLowStock}
                        size="small"
                        color="warning"
                        sx={{ height: 24 }}
                        icon={<WarningIcon />}
                      />
                    )}
                    {inventorySummary.locationsOutOfStock > 0 && (
                      <Chip
                        label={inventorySummary.locationsOutOfStock}
                        size="small"
                        color="error"
                        sx={{ height: 24 }}
                      />
                    )}
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left Column - Item Details */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* Item Images */}
            <Card>
              <CardMedia
                component="img"
                height="300"
                image={mainImage?.image_url || NoImage}
                alt={item.name}
                sx={{ objectFit: 'cover' }}
              />
              {galleryImages.length > 0 && (
                <Box sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('business.items.gallery', 'Gallery')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {galleryImages.slice(0, 4).map((image: ItemImage) => (
                      <Avatar
                        key={image.id}
                        src={image.image_url}
                        alt={image.alt_text || item.name}
                        sx={{ width: 60, height: 60, cursor: 'pointer' }}
                        variant="rounded"
                      />
                    ))}
                    {galleryImages.length > 4 && (
                      <Avatar
                        sx={{ width: 60, height: 60, bgcolor: 'grey.300' }}
                        variant="rounded"
                      >
                        <Typography variant="caption">
                          +{galleryImages.length - 4}
                        </Typography>
                      </Avatar>
                    )}
                  </Box>
                </Box>
              )}
            </Card>

            {/* Item Details Card */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  {t('business.items.details', 'Item Details')}
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('business.items.description', 'Description')}
                    </Typography>
                    <Typography variant="body2">
                      {item.description ||
                        t('business.items.noDescription', 'No description')}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('business.items.price', 'Base Price')}
                    </Typography>
                    <Typography variant="h5" color="primary" fontWeight="bold">
                      {formatCurrency(item.price, item.currency)}
                    </Typography>
                  </Box>

                  {item.brand && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t('business.items.brand', 'Brand')}
                      </Typography>
                      <Typography variant="body2">{item.brand.name}</Typography>
                    </Box>
                  )}

                  {item.item_sub_category && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t('business.items.category', 'Category')}
                      </Typography>
                      <Typography variant="body2">
                        {item.item_sub_category.item_category?.name} ›{' '}
                        {item.item_sub_category.name}
                      </Typography>
                    </Box>
                  )}

                  {item.model && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t('business.items.model', 'Model')}
                      </Typography>
                      <Typography variant="body2">{item.model}</Typography>
                    </Box>
                  )}

                  {item.color && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t('business.items.color', 'Color')}
                      </Typography>
                      <Typography variant="body2">{item.color}</Typography>
                    </Box>
                  )}

                  {item.weight && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t('business.items.weight', 'Weight')}
                      </Typography>
                      <Typography variant="body2">
                        {`${item.weight} ${item.weight_unit}`}
                      </Typography>
                    </Box>
                  )}

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('business.items.orderLimits', 'Order Limits')}
                    </Typography>
                    <Typography variant="body2">
                      {t('business.items.minOrder', 'Min')}:{' '}
                      {item.min_order_quantity}
                      {item.max_order_quantity &&
                        ` • ${t('business.items.maxOrder', 'Max')}: ${
                          item.max_order_quantity
                        }`}
                    </Typography>
                  </Box>

                  {(item.is_fragile ||
                    item.is_perishable ||
                    item.requires_special_handling) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          'business.items.specialHandling',
                          'Special Handling'
                        )}
                      </Typography>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                        {item.is_fragile && (
                          <Chip
                            label={t('business.items.fragile', 'Fragile')}
                            size="small"
                            color="warning"
                          />
                        )}
                        {item.is_perishable && (
                          <Chip
                            label={t('business.items.perishable', 'Perishable')}
                            size="small"
                            color="error"
                          />
                        )}
                        {item.requires_special_handling && (
                          <Chip
                            label={t(
                              'business.items.requiresSpecial',
                              'Special'
                            )}
                            size="small"
                            color="info"
                          />
                        )}
                      </Stack>
                    </Box>
                  )}

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('business.items.createdAt', 'Created')}
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(item.created_at)}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Right Column - Inventory Management */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <Box
              sx={{
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="h6" fontWeight="bold">
                {t(
                  'business.inventory.locationInventory',
                  'Location Inventory'
                )}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleUpdateInventoryClick}
                size="small"
              >
                {t('business.inventory.addLocation', 'Add Location')}
              </Button>
            </Box>

            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t(
                  'business.inventory.locationDescription',
                  'Manage inventory levels for each business location. Customers can only order from locations with available stock.'
                )}
              </Typography>

              {item.business_inventories &&
              item.business_inventories.length > 0 ? (
                <Grid container spacing={2}>
                  {item.business_inventories.map((inventory) => {
                    const stockStatus = getStockStatus(inventory);
                    return (
                      <Grid size={{ xs: 12, md: 6 }} key={inventory.id}>
                        <Card
                          variant="outlined"
                          sx={{
                            borderColor: `${stockStatus.color}.main`,
                            borderWidth: 2,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              boxShadow: 4,
                              transform: 'translateY(-2px)',
                            },
                          }}
                        >
                          <CardContent>
                            {/* Location Header */}
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                mb: 2,
                              }}
                            >
                              <Box sx={{ flex: 1 }}>
                                <Typography
                                  variant="h6"
                                  fontWeight="bold"
                                  gutterBottom
                                >
                                  {inventory.business_location?.name}
                                </Typography>
                                <Chip
                                  label={t(
                                    `business.inventory.status.${stockStatus.label}`
                                  )}
                                  size="small"
                                  color={stockStatus.color}
                                  sx={{ fontWeight: 600 }}
                                />
                              </Box>
                            </Box>

                            {/* Stock Level Progress */}
                            <Box sx={{ mb: 2 }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  mb: 0.5,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {t(
                                    'business.inventory.stockLevel',
                                    'Stock Level'
                                  )}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  fontWeight="medium"
                                >
                                  {Math.round(stockStatus.percentage)}%
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={stockStatus.percentage}
                                color={stockStatus.color}
                                sx={{ height: 8, borderRadius: 1 }}
                              />
                            </Box>

                            {/* Inventory Stats */}
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                              <Grid size={4}>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {t(
                                      'business.inventory.available',
                                      'Available'
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    fontWeight="bold"
                                    color="success.main"
                                  >
                                    {inventory.computed_available_quantity}
                                  </Typography>
                                </Box>
                              </Grid>
                              <Grid size={4}>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {t(
                                      'business.inventory.reserved',
                                      'Reserved'
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    fontWeight="bold"
                                    color="warning.main"
                                  >
                                    {inventory.reserved_quantity}
                                  </Typography>
                                </Box>
                              </Grid>
                              <Grid size={4}>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {t('business.inventory.total', 'Total')}
                                  </Typography>
                                  <Typography variant="h5" fontWeight="bold">
                                    {inventory.quantity}
                                  </Typography>
                                </Box>
                              </Grid>
                            </Grid>

                            <Divider sx={{ my: 2 }} />

                            {/* Additional Info */}
                            <Stack spacing={1} sx={{ mb: 2 }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {t(
                                    'business.inventory.sellingPrice',
                                    'Selling Price'
                                  )}
                                  :
                                </Typography>
                                <Typography
                                  variant="body2"
                                  fontWeight="600"
                                  color="primary"
                                >
                                  {formatCurrency(
                                    inventory.selling_price,
                                    item.currency
                                  )}
                                </Typography>
                              </Box>
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {t(
                                    'business.inventory.reorderPoint',
                                    'Reorder Point'
                                  )}
                                  :
                                </Typography>
                                <Typography variant="body2" fontWeight="600">
                                  {inventory.reorder_point}
                                </Typography>
                              </Box>
                            </Stack>

                            {/* Action Button */}
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleUpdateInventory(inventory)}
                              startIcon={<InventoryIcon />}
                              fullWidth
                            >
                              {t(
                                'business.inventory.updateStock',
                                'Update Stock'
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              ) : (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 6,
                    bgcolor: 'grey.50',
                    borderRadius: 2,
                    border: '2px dashed',
                    borderColor: 'grey.300',
                  }}
                >
                  <InventoryIcon
                    sx={{ fontSize: 60, color: 'grey.400', mb: 2 }}
                  />
                  <Typography variant="h6" gutterBottom>
                    {t(
                      'business.inventory.noInventoryFound',
                      'No Inventory Yet'
                    )}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    {t(
                      'business.inventory.addFirstLocation',
                      'Add this item to your first location to start selling'
                    )}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleUpdateInventoryClick}
                  >
                    {t('business.inventory.addToLocation', 'Add to Location')}
                  </Button>
                </Box>
              )}
            </Box>
          </Card>

          {/* Image Management Section */}
          <Card sx={{ mt: 3 }}>
            <Box
              sx={{
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="h6" fontWeight="bold">
                {t('business.items.imageManagement', 'Image Management')}
              </Typography>
              <Button
                variant="contained"
                startIcon={<PhotoCameraIcon />}
                onClick={handleManageImages}
                size="small"
              >
                {t('business.inventory.manageImages', 'Manage Images')}
              </Button>
            </Box>

            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t(
                  'business.items.imageManagementDescription',
                  'Upload and manage product images. A main image is required, and you can add additional gallery images.'
                )}
              </Typography>

              {item.item_images && item.item_images.length > 0 ? (
                <Grid container spacing={2}>
                  {/* Main Image */}
                  {mainImage && (
                    <Grid size={{ xs: 12, md: 6 }} key={mainImage.id}>
                      <Card
                        variant="outlined"
                        sx={{
                          borderColor: 'primary.main',
                          borderWidth: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: 4,
                            transform: 'translateY(-2px)',
                          },
                        }}
                      >
                        <CardMedia
                          component="img"
                          height="200"
                          image={mainImage.image_url}
                          alt={mainImage.alt_text || item.name}
                          sx={{ objectFit: 'cover' }}
                        />
                        <CardContent>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ mb: 1 }}
                          >
                            <Typography variant="subtitle2" fontWeight="bold">
                              {t('business.items.mainImage', 'Main Image')}
                            </Typography>
                            <Chip
                              label={t('business.items.primary', 'Primary')}
                              size="small"
                              color="primary"
                            />
                          </Stack>
                          {mainImage.alt_text && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mb: 1 }}
                            >
                              {mainImage.alt_text}
                            </Typography>
                          )}
                          {mainImage.caption && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {mainImage.caption}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  )}

                  {/* Gallery Images */}
                  {galleryImages.map((image: ItemImage) => (
                    <Grid size={{ xs: 12, md: 6 }} key={image.id}>
                      <Card
                        variant="outlined"
                        sx={{
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: 4,
                            transform: 'translateY(-2px)',
                          },
                        }}
                      >
                        <CardMedia
                          component="img"
                          height="200"
                          image={image.image_url}
                          alt={image.alt_text || item.name}
                          sx={{ objectFit: 'cover' }}
                        />
                        <CardContent>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ mb: 1 }}
                          >
                            <Typography variant="subtitle2" fontWeight="bold">
                              {t(
                                'business.items.galleryImage',
                                'Gallery Image'
                              )}
                            </Typography>
                            <Chip
                              label={t('business.items.secondary', 'Secondary')}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>
                          {image.alt_text && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mb: 1 }}
                            >
                              {image.alt_text}
                            </Typography>
                          )}
                          {image.caption && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {image.caption}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 6,
                    bgcolor: 'grey.50',
                    borderRadius: 2,
                    border: '2px dashed',
                    borderColor: 'grey.300',
                  }}
                >
                  <PhotoCameraIcon
                    sx={{ fontSize: 60, color: 'grey.400', mb: 2 }}
                  />
                  <Typography variant="h6" gutterBottom>
                    {t('business.items.noImagesYet', 'No Images Yet')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    {t(
                      'business.items.addFirstImage',
                      'Upload images to showcase your product to customers'
                    )}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<PhotoCameraIcon />}
                    onClick={handleManageImages}
                  >
                    {t('business.items.uploadImages', 'Upload Images')}
                  </Button>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Dialogs */}
      <UpdateInventoryDialog
        open={showUpdateInventoryDialog}
        onClose={() => setShowUpdateInventoryDialog(false)}
        item={item}
        selectedInventory={selectedInventory}
        onInventoryUpdated={() => {
          fetchItemDetails(); // Refresh item details
        }}
      />

      <ImageUploadDialog
        open={showImageUploadDialog}
        onClose={(refresh) => {
          setShowImageUploadDialog(false);
          if (refresh) {
            // Refresh item images when dialog closes with refresh flag
            fetchItemDetails();
          }
        }}
        itemId={itemId || ''}
        itemName={item?.name || ''}
      />
    </Container>
  );
}
