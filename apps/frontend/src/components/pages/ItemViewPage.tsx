import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Inventory as InventoryIcon,
  PhotoCamera as PhotoCameraIcon,
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
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import NoImage from '../../assets/no-image.svg';
import {
  BusinessInventoryItem,
  useBusinessInventory,
} from '../../hooks/useBusinessInventory';
import { useItemImages } from '../../hooks/useItemImages';
import { Item, useItems } from '../../hooks/useItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import { ItemImage } from '../../types/image';
import ImageUploadDialog from '../business/ImageUploadDialog';
import UpdateInventoryDialog from '../business/UpdateInventoryDialog';
import SEOHead from '../seo/SEOHead';

// Type for business_inventories from Item interface
type ItemBusinessInventory = NonNullable<Item['business_inventories']>[0];

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
      id={`item-tabpanel-${index}`}
      aria-labelledby={`item-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ItemViewPage() {
  const { t } = useTranslation();
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [showUpdateInventoryDialog, setShowUpdateInventoryDialog] =
    useState(false);
  const [selectedInventory, setSelectedInventory] = useState<
    BusinessInventoryItem | ItemBusinessInventory | null
  >(null);
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);

  const { fetchSingleItem } = useItems(profile?.business?.id);
  const { fetchBusinessLocations } = useBusinessInventory();
  const { fetchItemImages } = useItemImages();
  const [itemImages, setItemImages] = useState<ItemImage[]>([]);

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
      fetchItemImages(itemId)
        .then(setItemImages)
        .catch((error) => {
          console.error('Error fetching item images:', error);
        });
    }
  }, [itemId, fetchItemDetails, fetchItemImages]);

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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
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

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography>{t('common.loading')}</Typography>
      </Container>
    );
  }

  if (error || !item) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {error || t('business.inventory.itemNotFound')}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mt: 2 }}
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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={item.name}
        description={item.description}
        keywords={`${item.name}, ${item.brand?.name || ''}, ${
          item.item_sub_category?.name || ''
        }`}
      />

      {/* Inventory Warning */}
      {(!item.business_inventories ||
        item.business_inventories.length === 0) && (
        <Alert
          severity="warning"
          sx={{
            mb: 3,
            backgroundColor: '#fff8e1',
            borderColor: '#ffcc02',
            borderWidth: 2,
            '& .MuiAlert-icon': {
              color: '#f57c00',
            },
            '& .MuiAlert-message': {
              backgroundColor: '#fffbf0',
              borderRadius: 1,
              p: 1,
            },
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 0.5 }}>
            {t(
              'business.inventory.itemNotVisible',
              'Item Not Visible to Customers'
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'business.inventory.itemNotVisibleMessage',
              'This item will not be visible to customers until it is added to at least one business location inventory.'
            )}
          </Typography>
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            variant="outlined"
          >
            {t('common.back')}
          </Button>
          <Typography variant="h4" component="h1">
            {item.name}
          </Typography>
          <Chip
            label={item.is_active ? t('common.active') : t('common.inactive')}
            color={item.is_active ? 'success' : 'default'}
            size="small"
          />
        </Stack>

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleEditItem}
          >
            {t('business.inventory.editItemButton')}
          </Button>
        </Stack>
      </Box>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Item Images */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardMedia
              component="img"
              height="400"
              image={mainImage?.image_url || NoImage}
              alt={item.name}
              sx={{ objectFit: 'cover' }}
            />
            {galleryImages.length > 0 && (
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {t('business.items.galleryImages')}
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

            {/* Manage Images Button */}
            <Box sx={{ p: 2, pt: 0, mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<PhotoCameraIcon />}
                onClick={handleManageImages}
                fullWidth
              >
                {t('business.inventory.manageImages')}
              </Button>
            </Box>
          </Card>
        </Grid>

        {/* Item Details */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                {item.name}
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {item.description}
              </Typography>

              <Typography variant="h4" color="primary" gutterBottom>
                {formatCurrency(item.price, item.currency)}
              </Typography>

              <Stack spacing={2}>
                {item.sku && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t('business.items.sku')}
                    </Typography>
                    <Typography variant="body1">{item.sku}</Typography>
                  </Box>
                )}

                {item.brand && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t('business.items.brand')}
                    </Typography>
                    <Typography variant="body1">{item.brand.name}</Typography>
                  </Box>
                )}

                {item.item_sub_category && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t('business.items.category')}
                    </Typography>
                    <Typography variant="body1">
                      {item.item_sub_category.item_category?.name} &gt;{' '}
                      {item.item_sub_category.name}
                    </Typography>
                  </Box>
                )}

                {item.model && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t('business.items.model')}
                    </Typography>
                    <Typography variant="body1">{item.model}</Typography>
                  </Box>
                )}

                {item.color && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t('business.items.color')}
                    </Typography>
                    <Typography variant="body1">{item.color}</Typography>
                  </Box>
                )}

                {item.weight && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t('business.items.weight')}
                    </Typography>
                    <Typography variant="body1">
                      {`${item.weight} ${item.weight_unit}`}
                    </Typography>
                  </Box>
                )}

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('business.items.orderLimits')}
                  </Typography>
                  <Typography variant="body1">
                    {t('business.items.minOrder')}: {item.min_order_quantity}
                    {item.max_order_quantity &&
                      ` • ${t('business.items.maxOrder')}: ${
                        item.max_order_quantity
                      }`}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('business.items.specialHandling')}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    {item.is_fragile && (
                      <Chip
                        label={t('business.items.fragile')}
                        size="small"
                        color="warning"
                      />
                    )}
                    {item.is_perishable && (
                      <Chip
                        label={t('business.items.perishable')}
                        size="small"
                        color="error"
                      />
                    )}
                    {item.requires_special_handling && (
                      <Chip
                        label={t('business.items.specialHandling')}
                        size="small"
                        color="info"
                      />
                    )}
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('business.items.createdAt')}
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(item.created_at)}
                  </Typography>
                </Box>
              </Stack>

              {/* Add To New Location Button */}
              <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Button
                  variant="outlined"
                  startIcon={<InventoryIcon />}
                  onClick={handleUpdateInventoryClick}
                  fullWidth
                >
                  {t(
                    'business.inventory.addToNewLocation',
                    'Add To New Location'
                  )}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for Inventory and Images */}
      <Paper sx={{ mt: 4 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          aria-label="item tabs"
        >
          <Tab label={t('business.inventory.title')} />
          <Tab label={t('business.items.images')} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {/* Inventory Management */}
          <Typography variant="h6" gutterBottom>
            {t('business.inventory.inventoryManagement')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('business.inventory.inventoryDescription')}
          </Typography>

          {item.business_inventories && item.business_inventories.length > 0 ? (
            <Grid container spacing={2}>
              {item.business_inventories.map((inventory) => (
                <Grid size={{ xs: 12, md: 6 }} key={inventory.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {inventory.business_location?.name}
                      </Typography>
                      <Stack spacing={1}>
                        <Box>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {t('business.inventory.availableQuantity')}
                          </Typography>
                          <Typography variant="h5" color="primary">
                            {inventory.computed_available_quantity}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {t('business.inventory.totalQuantity')}
                          </Typography>
                          <Typography variant="body1">
                            {inventory.quantity}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {t('business.inventory.reservedQuantity')}
                          </Typography>
                          <Typography variant="body1">
                            {inventory.reserved_quantity}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {t('business.inventory.sellingPrice')}
                          </Typography>
                          <Typography variant="body1">
                            {formatCurrency(
                              inventory.selling_price,
                              item.currency
                            )}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {t('business.inventory.reorderPoint')}
                          </Typography>
                          <Typography variant="body1">
                            {inventory.reorder_point}
                          </Typography>
                        </Box>
                      </Stack>
                      <Box sx={{ mt: 2 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleUpdateInventory(inventory)}
                          startIcon={<EditIcon />}
                        >
                          {t('business.inventory.editItemButton')}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Alert severity="info">
              {t('business.inventory.noInventoryFound')}
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Image Management */}
          <Typography variant="h6" gutterBottom>
            {t('business.items.imageManagement')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('business.items.imageManagementDescription')}
          </Typography>

          {itemImages && itemImages.length > 0 ? (
            <Grid container spacing={2}>
              {itemImages.map((image: ItemImage) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={image.id}>
                  <Card>
                    <CardMedia
                      component="img"
                      height="200"
                      image={image.image_url}
                      alt={image.alt_text || item.name}
                      sx={{ objectFit: 'cover' }}
                    />
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        {t(`business.items.imageTypes.${image.image_type}`)}
                      </Typography>
                      {image.alt_text && (
                        <Typography variant="body2" color="text.secondary">
                          {image.alt_text}
                        </Typography>
                      )}
                      {image.caption && (
                        <Typography variant="body2" color="text.secondary">
                          {image.caption}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Alert severity="info">{t('business.items.noImagesFound')}</Alert>
          )}
        </TabPanel>
      </Paper>

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
