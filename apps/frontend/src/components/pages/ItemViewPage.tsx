import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  AutoFixHigh as AutoFixHighIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
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
  Dialog,
  DialogContent,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import NoImage from '../../assets/no-image.svg';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAws } from '../../hooks/useAws';
import { useBusinessImages } from '../../hooks/useBusinessImages';
import {
  BusinessInventoryItem,
  useBusinessInventory,
} from '../../hooks/useBusinessInventory';
import { Item, useItems } from '../../hooks/useItems';
import { useSwipeImageNavigation } from '../../hooks/useSwipeImageNavigation';
import { ItemImage } from '../../types/image';
import ImageUploadDialog from '../business/ImageUploadDialog';
import UpdateInventoryDialog from '../business/UpdateInventoryDialog';
import ManageDealsDialog from '../business/ManageDealsDialog';
import { ImageLightboxTapZones } from '../common/ImageLightboxTapZones';
import ImageCleanupPreviewDialog from '../dialogs/ImageCleanupPreviewDialog';
import RefineItemWithAiDialog from '../dialogs/RefineItemWithAiDialog';
import SEOHead from '../seo/SEOHead';

// Type for business_inventories from Item interface
type ItemBusinessInventory = NonNullable<Item['business_inventories']>[0];

function cleanedPngB64ToFile(b64: string): File {
  const byteCharacters = atob(b64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new File([new Uint8Array(byteNumbers)], 'cleaned-image.png', {
    type: 'image/png',
  });
}

export default function ItemViewPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpdateInventoryDialog, setShowUpdateInventoryDialog] =
    useState(false);
  const [selectedInventory, setSelectedInventory] = useState<
    BusinessInventoryItem | ItemBusinessInventory | null
  >(null);
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);
  const [manageDealsInventory, setManageDealsInventory] =
    useState<BusinessInventoryItem | ItemBusinessInventory | null>(null);
  const [showRefineAiDialog, setShowRefineAiDialog] = useState(false);
  const [imageLightboxIndex, setImageLightboxIndex] = useState<number | null>(
    null
  );
  const [itemActiveToggling, setItemActiveToggling] = useState(false);

  const { enqueueSnackbar } = useSnackbar();
  const {
    setImageAsMain,
    setImageAsGallery,
    cleanupImage,
    updateImage,
    submitting: imageActionsBusy,
  } = useBusinessImages();
  const { generateImageUploadUrl } = useAws();

  const bucketName = useMemo(
    () => process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads',
    []
  );

  const [imageToCleanup, setImageToCleanup] = useState<ItemImage | null>(null);
  const [cleanedB64, setCleanedB64] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const {
    fetchSingleItem,
    brands,
    itemSubCategories,
    fetchBrands,
    fetchItemSubCategories,
    updateItem,
  } = useItems(profile?.business?.id);
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

  useEffect(() => {
    if (profile?.business?.id) {
      fetchBrands().catch(() => undefined);
      fetchItemSubCategories().catch(() => undefined);
    }
  }, [profile?.business?.id, fetchBrands, fetchItemSubCategories]);

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

  const handleManageDeals = (
    inventory: BusinessInventoryItem | ItemBusinessInventory
  ) => {
    setManageDealsInventory(inventory);
  };

  const handleRefineWithAi = () => {
    setShowRefineAiDialog(true);
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

  const sortedItemImages = useMemo(() => {
    const imgs = item?.item_images ?? [];
    return [...imgs].sort((a, b) => {
      if (a.image_type === 'main') return -1;
      if (b.image_type === 'main') return 1;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    });
  }, [item?.item_images]);

  const heroImage =
    sortedItemImages.find((i) => i.image_type === 'main') ?? sortedItemImages[0];
  const galleryThumbs = sortedItemImages.filter((i) => i.image_type !== 'main');

  const openImageLightbox = useCallback((index: number) => {
    setImageLightboxIndex(index);
  }, []);

  const closeImageLightbox = useCallback(() => {
    setImageLightboxIndex(null);
  }, []);

  const goLightbox = useCallback(
    (delta: number) => {
      setImageLightboxIndex((prev) => {
        if (prev === null || sortedItemImages.length === 0) return prev;
        const n = sortedItemImages.length;
        return (prev + delta + n) % n;
      });
    },
    [sortedItemImages.length]
  );

  const handleSetImageAsMain = useCallback(
    async (imageId: string) => {
      try {
        await setImageAsMain(imageId);
        await fetchItemDetails();
        setImageLightboxIndex(null);
        enqueueSnackbar(
          t('business.items.mainImageUpdated', 'Main image updated'),
          { variant: 'success' }
        );
      } catch (error: any) {
        enqueueSnackbar(
          error?.message ||
            t('common.error', 'Something went wrong'),
          { variant: 'error' }
        );
      }
    },
    [enqueueSnackbar, fetchItemDetails, setImageAsMain, t]
  );

  const handleToggleItemActive = useCallback(
    async (nextActive: boolean) => {
      if (!item?.id) return;
      setItemActiveToggling(true);
      try {
        await updateItem(item.id, { is_active: nextActive }, {
          skipRefetch: true,
        });
        setItem((prev) =>
          prev ? { ...prev, is_active: nextActive } : prev
        );
        enqueueSnackbar(
          t(
            'business.items.activeStatusUpdated',
            'Listing status updated'
          ),
          { variant: 'success' }
        );
      } catch (error: any) {
        enqueueSnackbar(
          error?.message || t('common.error', 'Something went wrong'),
          { variant: 'error' }
        );
      } finally {
        setItemActiveToggling(false);
      }
    },
    [enqueueSnackbar, item?.id, t, updateItem]
  );

  const handleSetImageAsGallery = useCallback(
    async (imageId: string) => {
      try {
        await setImageAsGallery(imageId);
        await fetchItemDetails();
        setImageLightboxIndex(null);
        enqueueSnackbar(
          t(
            'business.items.secondaryImageUpdated',
            'This image is now secondary.'
          ),
          { variant: 'success' }
        );
      } catch (error: any) {
        enqueueSnackbar(
          error?.message || t('common.error', 'Something went wrong'),
          { variant: 'error' }
        );
      }
    },
    [enqueueSnackbar, fetchItemDetails, setImageAsGallery, t]
  );

  const uploadFileToS3 = useCallback(
    async (file: File) => {
      const presigned = await generateImageUploadUrl({
        bucketName,
        originalFileName: file.name,
        contentType: file.type,
        prefix: `businesses/${profile?.business?.id || 'unknown'}/images`,
      });
      if (!presigned?.success || !presigned.data) {
        throw new Error(
          t(
            'business.images.upload.presignError',
            'Failed to prepare image upload'
          )
        );
      }
      await axios.put(presigned.data.url, file, {
        headers: { 'Content-Type': file.type },
      });
      const imageUrl = `https://${bucketName}.s3.amazonaws.com/${presigned.data.key}`;
      return {
        image_url: imageUrl,
        s3_key: presigned.data.key,
        file_size: file.size,
        format: file.type,
      };
    },
    [bucketName, generateImageUploadUrl, profile?.business?.id, t]
  );

  useEffect(() => {
    if (!imageToCleanup) return;
    let cancelled = false;
    cleanupImage(imageToCleanup.id).then((result) => {
      if (!cancelled && result?.b64_json) {
        setCleanedB64(result.b64_json);
      }
      if (!cancelled) setCleanupLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [imageToCleanup, cleanupImage]);

  const handleOpenItemImageCleanup = useCallback(
    (img: ItemImage) => {
      if (img.is_ai_cleaned) {
        enqueueSnackbar(
          t(
            'business.images.cleanup.alreadyCleaned',
            'Image was already cleaned with AI'
          ),
          { variant: 'info' }
        );
        return;
      }
      setImageToCleanup(img);
      setCleanedB64(null);
      setCleanupLoading(true);
    },
    [enqueueSnackbar, t]
  );

  const handleCleanupAccept = useCallback(async () => {
    if (!imageToCleanup || !cleanedB64) return;
    try {
      const file = cleanedPngB64ToFile(cleanedB64);
      const uploaded = await uploadFileToS3(file);
      await updateImage(imageToCleanup.id, {
        ...uploaded,
        is_ai_cleaned: true,
      });
      enqueueSnackbar(
        t(
          'business.images.cleanup.success',
          'Image replaced with cleaned version'
        ),
        { variant: 'success' }
      );
      setImageToCleanup(null);
      setCleanedB64(null);
      await fetchItemDetails();
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t('business.images.cleanup.error', 'Failed to cleanup image'),
        { variant: 'error' }
      );
    }
  }, [
    cleanedB64,
    enqueueSnackbar,
    fetchItemDetails,
    imageToCleanup,
    t,
    updateImage,
    uploadFileToS3,
  ]);

  const handleCleanupReject = useCallback(() => {
    setImageToCleanup(null);
    setCleanedB64(null);
  }, []);

  useEffect(() => {
    if (imageLightboxIndex === null) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goLightbox(-1);
      if (e.key === 'ArrowRight') goLightbox(1);
      if (e.key === 'Escape') closeImageLightbox();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imageLightboxIndex, goLightbox, closeImageLightbox]);

  const lightboxSwipeEnabled =
    imageLightboxIndex !== null && sortedItemImages.length > 1;
  const lightboxSwipe = useSwipeImageNavigation(
    () => goLightbox(1),
    () => goLightbox(-1),
    lightboxSwipeEnabled
  );

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
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(item.is_active)}
                  onChange={(_, checked) => void handleToggleItemActive(checked)}
                  disabled={itemActiveToggling}
                  color="success"
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  {t('business.items.listingActive', 'Listing active')}
                </Typography>
              }
              sx={{ ml: 0, mr: 0 }}
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
                image={heroImage?.image_url || NoImage}
                alt={item.name}
                onClick={() => {
                  if (!heroImage || sortedItemImages.length === 0) return;
                  const idx = sortedItemImages.findIndex(
                    (i) => i.id === heroImage.id
                  );
                  openImageLightbox(idx >= 0 ? idx : 0);
                }}
                sx={{
                  objectFit: 'cover',
                  cursor:
                    sortedItemImages.length > 0 ? 'pointer' : 'default',
                }}
              />
              {galleryThumbs.length > 0 && (
                <Box sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('business.items.gallery', 'Gallery')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {galleryThumbs.slice(0, 4).map((image: ItemImage) => (
                      <Avatar
                        key={image.id}
                        src={image.image_url}
                        alt={image.alt_text || item.name}
                        onClick={() =>
                          openImageLightbox(
                            sortedItemImages.findIndex((i) => i.id === image.id)
                          )
                        }
                        sx={{ width: 60, height: 60, cursor: 'pointer' }}
                        variant="rounded"
                      />
                    ))}
                    {galleryThumbs.length > 4 && (
                      <Avatar
                        sx={{ width: 60, height: 60, bgcolor: 'grey.300' }}
                        variant="rounded"
                      >
                        <Typography variant="caption">
                          +{galleryThumbs.length - 4}
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
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    {t('business.items.details', 'Item Details')}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AutoFixHighIcon />}
                    onClick={handleRefineWithAi}
                    sx={{ mb: 0.5 }}
                  >
                    {t('business.items.refineWithAi.title', 'Refine with AI')}
                  </Button>
                </Stack>
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

                  {item.item_tags && item.item_tags.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t('business.items.tags', 'Tags')}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 0.5,
                          mt: 0.5,
                        }}
                      >
                        {item.item_tags.map((it) => (
                          <Chip
                            key={it.tag.id}
                            label={it.tag.name}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
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

                  {item.dimensions && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t('business.items.dimensions', 'Dimensions')}
                      </Typography>
                      <Typography variant="body2">{item.dimensions}</Typography>
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

                            {/* Action Buttons */}
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ mt: 1 }}
                            >
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleUpdateInventory(inventory)}
                                startIcon={<InventoryIcon />}
                                sx={{ flex: 1 }}
                              >
                                {t(
                                  'business.inventory.updateStock',
                                  'Update Stock'
                                )}
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleManageDeals(inventory)}
                              >
                                {t('business.items.deals.manage', 'Manage deals')}
                              </Button>
                            </Stack>
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
                  'Upload and manage photos. Tap a picture to open it full screen and use arrows or keyboard to browse. Use “Set as primary” or “Set as secondary” to choose which photo is the main listing image.'
                )}
              </Typography>

              {sortedItemImages.length > 0 ? (
                <Grid container spacing={2}>
                  {sortedItemImages.map((image: ItemImage, idx: number) => {
                    const isMain = image.image_type === 'main';
                    const showSetPrimary = !isMain;
                    const showSetSecondary =
                      isMain && sortedItemImages.length > 1;
                    return (
                      <Grid size={{ xs: 12, md: 6 }} key={image.id}>
                        <Card
                          variant="outlined"
                          sx={{
                            borderColor: isMain ? 'primary.main' : 'divider',
                            borderWidth: isMain ? 2 : 1,
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
                            onClick={() => openImageLightbox(idx)}
                            sx={{
                              objectFit: 'cover',
                              cursor: 'pointer',
                            }}
                          />
                          <CardContent>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ mb: 1 }}
                              flexWrap="wrap"
                              gap={1}
                            >
                              <Typography variant="subtitle2" fontWeight="bold">
                                {isMain
                                  ? t('business.items.mainImage', 'Main Image')
                                  : t(
                                      'business.items.galleryImage',
                                      'Gallery Image'
                                    )}
                              </Typography>
                              <Chip
                                label={
                                  isMain
                                    ? t('business.items.primary', 'Primary')
                                    : t('business.items.secondary', 'Secondary')
                                }
                                size="small"
                                color={isMain ? 'primary' : 'default'}
                                variant={isMain ? 'filled' : 'outlined'}
                              />
                            </Stack>
                            {showSetPrimary || showSetSecondary ? (
                              <Stack spacing={1} sx={{ mb: 1 }}>
                                {showSetPrimary ? (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={imageActionsBusy}
                                    onClick={() =>
                                      void handleSetImageAsMain(image.id)
                                    }
                                  >
                                    {t(
                                      'business.items.setAsPrimaryImage',
                                      'Set as primary'
                                    )}
                                  </Button>
                                ) : null}
                                {showSetSecondary ? (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={imageActionsBusy}
                                    onClick={() =>
                                      void handleSetImageAsGallery(image.id)
                                    }
                                  >
                                    {t(
                                      'business.items.setAsSecondaryImage',
                                      'Set as secondary'
                                    )}
                                  </Button>
                                ) : null}
                              </Stack>
                            ) : null}
                            {profile?.business?.image_cleanup_enabled ? (
                              <Button
                                size="small"
                                variant="outlined"
                                fullWidth
                                startIcon={<AutoFixHighIcon />}
                                onClick={() =>
                                  handleOpenItemImageCleanup(image)
                                }
                                disabled={
                                  imageActionsBusy || !!image.is_ai_cleaned
                                }
                                sx={{ mb: 1 }}
                              >
                                {t(
                                  'business.images.actions.cleanup',
                                  'Cleanup picture'
                                )}
                              </Button>
                            ) : null}
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
      <Dialog
        open={
          imageLightboxIndex !== null && sortedItemImages.length > 0
        }
        onClose={closeImageLightbox}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { bgcolor: 'grey.900', m: { xs: 1, sm: 2 } },
        }}
      >
        <DialogContent
          sx={{ p: 0, position: 'relative', bgcolor: 'grey.900' }}
        >
          <IconButton
            onClick={closeImageLightbox}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              zIndex: 2,
              color: 'common.white',
              bgcolor: 'rgba(0,0,0,0.45)',
            }}
            aria-label={t('common.close', 'Close')}
          >
            <CloseIcon />
          </IconButton>
          {imageLightboxIndex !== null &&
            sortedItemImages[imageLightboxIndex] && (
              <>
                <ImageLightboxTapZones
                  showTapZones={sortedItemImages.length > 1}
                  onPrevious={() => goLightbox(-1)}
                  onNext={() => goLightbox(1)}
                  previousLabel={t('common.previous', 'Previous')}
                  nextLabel={t('common.next', 'Next')}
                  onTouchStart={lightboxSwipe.onTouchStart}
                  onTouchEnd={lightboxSwipe.onTouchEnd}
                  wrapperSx={{ mx: 'auto', pt: 5, px: 1 }}
                >
                  <Box
                    component="img"
                    src={sortedItemImages[imageLightboxIndex].image_url}
                    alt={
                      sortedItemImages[imageLightboxIndex].alt_text || item.name
                    }
                    sx={{
                      width: '100%',
                      maxHeight: { xs: '70vh', sm: '85vh' },
                      objectFit: 'contain',
                      display: 'block',
                      touchAction: 'pan-y',
                    }}
                  />
                </ImageLightboxTapZones>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="center"
                  spacing={2}
                  sx={{ py: 2, px: 2 }}
                >
                  <IconButton
                    onClick={() => goLightbox(-1)}
                    sx={{ color: 'common.white' }}
                    aria-label={t('common.previous', 'Previous')}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                  <Typography variant="body2" sx={{ color: 'grey.300' }}>
                    {t(
                      'business.items.imageLightboxCounter',
                      '{{current}} of {{total}}',
                      {
                        current: imageLightboxIndex + 1,
                        total: sortedItemImages.length,
                      }
                    )}
                  </Typography>
                  <IconButton
                    onClick={() => goLightbox(1)}
                    sx={{ color: 'common.white' }}
                    aria-label={t('common.next', 'Next')}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </Stack>
              </>
            )}
        </DialogContent>
      </Dialog>

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

      <ManageDealsDialog
        open={Boolean(manageDealsInventory)}
        onClose={() => setManageDealsInventory(null)}
        inventoryItem={
          (manageDealsInventory as unknown as BusinessInventoryItem) || null
        }
      />

      <RefineItemWithAiDialog
        open={showRefineAiDialog}
        item={item}
        brands={brands}
        itemSubCategories={itemSubCategories}
        onClose={() => setShowRefineAiDialog(false)}
        onApplied={() => {
          fetchItemDetails();
        }}
        updateItem={updateItem}
      />

      <ImageCleanupPreviewDialog
        open={imageToCleanup != null}
        onClose={() => {
          setImageToCleanup(null);
          setCleanedB64(null);
        }}
        originalUrl={imageToCleanup?.image_url ?? ''}
        cleanedB64={cleanedB64}
        loading={cleanupLoading}
        onAccept={() => void handleCleanupAccept()}
        onReject={handleCleanupReject}
      />
    </Container>
  );
}
