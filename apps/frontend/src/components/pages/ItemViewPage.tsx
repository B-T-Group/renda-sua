import {
  ArrowBack as ArrowBackIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Skeleton,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAws } from '../../hooks/useAws';
import { useBusinessCatalogScope } from '../../hooks/useBusinessCatalogScope';
import { useBusinessImages } from '../../hooks/useBusinessImages';
import {
  BusinessInventoryItem,
  useBusinessInventory,
} from '../../hooks/useBusinessInventory';
import { Item, useItems } from '../../hooks/useItems';
import { ItemImage } from '../../types/image';
import {
  getPrimaryOrFirstItemImage,
  orderedItemImages,
} from '../../utils/orderedItemImages';
import ImageUploadDialog from '../business/ImageUploadDialog';
import ManageDealsDialog from '../business/ManageDealsDialog';
import UpdateInventoryDialog from '../business/UpdateInventoryDialog';
import ItemImageLightbox from '../business/item-view/ItemImageLightbox';
import ItemImagesTab from '../business/item-view/ItemImagesTab';
import ItemInventoryTab from '../business/item-view/ItemInventoryTab';
import ItemOverviewTab from '../business/item-view/ItemOverviewTab';
import ItemViewHeader from '../business/item-view/ItemViewHeader';
import {
  AnyInventory,
  buildInventorySummary,
} from '../business/item-view/itemViewHelpers';
import ImageCleanupPreviewDialog from '../dialogs/ImageCleanupPreviewDialog';
import { ManageItemCollectionsDialog } from '../dialogs/ManageItemCollectionsDialog';
import RefineItemWithAiDialog from '../dialogs/RefineItemWithAiDialog';
import SEOHead from '../seo/SEOHead';

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
  const { itemId } = useParams<{ itemId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, updateBusinessAiTokens } = useUserProfileContext();
  const { effectiveBusinessId, canSuperUserActions, businessQuerySuffix } =
    useBusinessCatalogScope();
  const listItem = (location.state as { item?: Item } | null)?.item;

  const [item, setItem] = useState<Item | null>(
    listItem?.id === itemId ? listItem : null
  );
  const [loading, setLoading] = useState(!listItem || listItem.id !== itemId);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showUpdateInventoryDialog, setShowUpdateInventoryDialog] =
    useState(false);
  const [selectedInventory, setSelectedInventory] =
    useState<AnyInventory | null>(null);
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);
  const [manageDealsInventory, setManageDealsInventory] =
    useState<AnyInventory | null>(null);
  const [showRefineAiDialog, setShowRefineAiDialog] = useState(false);
  const [showCollectionsDialog, setShowCollectionsDialog] = useState(false);
  const [imageLightboxIndex, setImageLightboxIndex] = useState<number | null>(
    null
  );
  const [viewerImageId, setViewerImageId] = useState<string | null>(null);
  const [itemActiveToggling, setItemActiveToggling] = useState(false);
  const [publishing, setPublishing] = useState(false);

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
    publishItem,
  } = useItems(effectiveBusinessId);
  const { fetchBusinessLocations } = useBusinessInventory(effectiveBusinessId);

  const fetchItemDetails = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!itemId) return;
      if (!options?.silent) setLoading(true);
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
    },
    [itemId, fetchSingleItem, t]
  );

  useEffect(() => {
    if (!itemId) return;
    const hasListPreview = listItem?.id === itemId;
    void fetchItemDetails({ silent: hasListPreview });
  }, [itemId, listItem?.id, fetchItemDetails]);

  useEffect(() => {
    if (effectiveBusinessId) {
      fetchBusinessLocations();
    }
  }, [effectiveBusinessId, fetchBusinessLocations]);

  useEffect(() => {
    if (effectiveBusinessId) {
      fetchBrands().catch(() => undefined);
      fetchItemSubCategories().catch(() => undefined);
    }
  }, [effectiveBusinessId, fetchBrands, fetchItemSubCategories]);

  const handleEditItem = () => {
    if (item?.id) {
      navigate(`/business/items/edit/${item.id}${businessQuerySuffix}`);
    }
  };

  const handleUpdateInventory = (inventory?: AnyInventory) => {
    setSelectedInventory(inventory || null);
    setShowUpdateInventoryDialog(true);
  };

  const handleBack = () => {
    navigate('/business/items');
  };

  const inventorySummary = useMemo(
    () => buildInventorySummary(item?.business_inventories),
    [item?.business_inventories]
  );

  const sortedItemImages = useMemo(
    () => orderedItemImages(item?.item_images),
    [item?.item_images]
  );

  const heroImage = getPrimaryOrFirstItemImage(sortedItemImages);
  const activeImage = useMemo(
    () => sortedItemImages.find((i) => i.id === viewerImageId) ?? heroImage,
    [sortedItemImages, viewerImageId, heroImage]
  );

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
        enqueueSnackbar(error?.message || t('common.error', 'Something went wrong'), {
          variant: 'error',
        });
      }
    },
    [enqueueSnackbar, fetchItemDetails, setImageAsMain, t]
  );

  const handleToggleItemActive = useCallback(
    async (nextActive: boolean) => {
      if (!item?.id) return;
      if (nextActive && item.moderation_status !== 'approved') {
        enqueueSnackbar(
          t(
            'business.items.moderation.activateRequiresApproval',
            'Item must be approved before it can be activated.'
          ),
          { variant: 'warning' }
        );
        return;
      }
      if (nextActive && sortedItemImages.length < 2) {
        enqueueSnackbar(
          t(
            'business.images.validation.activateMinPhotos',
            'At least {{count}} photos are required to activate this listing.',
            { count: 2 }
          ),
          { variant: 'warning' }
        );
        return;
      }
      setItemActiveToggling(true);
      try {
        await updateItem(item.id, { is_active: nextActive }, { skipRefetch: true });
        setItem((prev) => (prev ? { ...prev, is_active: nextActive } : prev));
        enqueueSnackbar(
          t('business.items.activeStatusUpdated', 'Listing status updated'),
          { variant: 'success' }
        );
      } catch (error: any) {
        enqueueSnackbar(error?.message || t('common.error', 'Something went wrong'), {
          variant: 'error',
        });
      } finally {
        setItemActiveToggling(false);
      }
    },
    [
      sortedItemImages.length,
      enqueueSnackbar,
      item?.id,
      item?.moderation_status,
      t,
      updateItem,
    ]
  );

  const handlePublishItem = useCallback(async () => {
    if (!item?.id) return;
    setPublishing(true);
    try {
      const published = await publishItem(item.id);
      setItem((prev) =>
        prev
          ? {
              ...prev,
              moderation_status: published?.moderation_status ?? 'pending',
              is_active: false,
            }
          : prev
      );
      enqueueSnackbar(
        t(
          'business.items.moderation.publishSuccess',
          'Item submitted for approval'
        ),
        { variant: 'success' }
      );
    } catch (error: any) {
      enqueueSnackbar(
        error?.message ||
          t('business.items.moderation.publishFailed', 'Could not publish item'),
        { variant: 'error' }
      );
    } finally {
      setPublishing(false);
    }
  }, [enqueueSnackbar, item?.id, publishItem, t]);

  const handleSetImageAsGallery = useCallback(
    async (imageId: string) => {
      try {
        await setImageAsGallery(imageId);
        await fetchItemDetails();
        setImageLightboxIndex(null);
        enqueueSnackbar(
          t('business.items.secondaryImageUpdated', 'This image is now secondary.'),
          { variant: 'success' }
        );
      } catch (error: any) {
        enqueueSnackbar(error?.message || t('common.error', 'Something went wrong'), {
          variant: 'error',
        });
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
          t('business.images.upload.presignError', 'Failed to prepare image upload')
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
        if (typeof result.ai_tokens_remaining === 'number') {
          updateBusinessAiTokens(result.ai_tokens_remaining);
        }
      }
      if (!cancelled) setCleanupLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [imageToCleanup, cleanupImage, updateBusinessAiTokens]);

  const handleOpenItemImageCleanup = useCallback(
    (img: ItemImage) => {
      if (img.is_ai_cleaned) {
        enqueueSnackbar(
          t('business.images.cleanup.alreadyCleaned', 'Image was already cleaned with AI'),
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
      await updateImage(imageToCleanup.id, { ...uploaded, is_ai_cleaned: true });
      enqueueSnackbar(
        t('business.images.cleanup.success', 'Image replaced with cleaned version'),
        { variant: 'success' }
      );
      setImageToCleanup(null);
      setCleanedB64(null);
      await fetchItemDetails();
    } catch (e: any) {
      enqueueSnackbar(
        e?.message || t('business.images.cleanup.error', 'Failed to cleanup image'),
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

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 2, mb: 3 }} />
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
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
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack}>
          {t('common.back')}
        </Button>
      </Container>
    );
  }

  const hasNoInventory =
    !item.business_inventories || item.business_inventories.length === 0;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
      <SEOHead
        title={item.name}
        description={item.description}
        keywords={`${item.name}, ${item.brand?.name || ''}, ${
          item.item_sub_category?.name || ''
        }`}
      />

      <ItemViewHeader
        name={item.name}
        sku={item.sku}
        isActive={Boolean(item.is_active)}
        moderationStatus={item.moderation_status}
        canToggleActive={item.moderation_status === 'approved'}
        toggling={itemActiveToggling}
        onToggleActive={(next) => void handleToggleItemActive(next)}
        onBack={handleBack}
        onEdit={handleEditItem}
      />

      {(item.moderation_status === 'draft' ||
        item.moderation_status === 'proposal_pending' ||
        item.moderation_status === 'rejected') && (
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {item.moderation_status === 'draft' ? (
            <Button
              variant="contained"
              disabled={publishing}
              onClick={() => void handlePublishItem()}
            >
              {t('business.items.moderation.publishItem', 'Publish item')}
            </Button>
          ) : null}
          {item.moderation_status === 'proposal_pending' ? (
            <Button
              variant="contained"
              onClick={() =>
                navigate(`/business/items/${item.id}/ai-proposal`)
              }
            >
              {t(
                'business.items.aiProposal.reviewCta',
                'Review AI suggestions'
              )}
            </Button>
          ) : null}
          {item.moderation_status === 'rejected' ? (
            <Alert severity="warning" sx={{ flex: 1, minWidth: 240 }}>
              {t(
                'business.items.moderation.resubmitHint',
                'If this item was rejected, saving name or description changes will send it for review again.'
              )}
            </Alert>
          ) : null}
        </Box>
      )}

      {hasNoInventory && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          icon={<WarningIcon />}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setActiveTab(1);
                handleUpdateInventory();
              }}
            >
              {t('business.inventory.addNow', 'Add Now')}
            </Button>
          }
        >
          <Typography variant="subtitle2" fontWeight={600}>
            {t('business.inventory.itemNotVisible', 'Item Not Visible to Customers')}
          </Typography>
          <Typography variant="body2">
            {t(
              'business.inventory.itemNotVisibleMessage',
              'This item will not be visible to customers until it is added to at least one business location inventory.'
            )}
          </Typography>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab label={t('business.items.tabs.overview', 'Overview')} />
        <Tab
          label={`${t('business.items.tabs.inventory', 'Inventory')} (${
            item.business_inventories?.length ?? 0
          })`}
        />
        <Tab
          label={`${t('business.items.tabs.images', 'Images')} (${
            sortedItemImages.length
          })`}
        />
      </Tabs>

      {activeTab === 0 && (
        <ItemOverviewTab
          item={item}
          images={sortedItemImages}
          activeImage={activeImage}
          summary={inventorySummary}
          canSuperUserActions={canSuperUserActions}
          onSelectThumb={setViewerImageId}
          onOpenLightbox={openImageLightbox}
          onManageCollections={() => setShowCollectionsDialog(true)}
          onRefineWithAi={() => setShowRefineAiDialog(true)}
        />
      )}

      {activeTab === 1 && (
        <ItemInventoryTab
          item={item}
          canSuperUserActions={canSuperUserActions}
          onUpdateInventory={handleUpdateInventory}
          onAddLocation={() => handleUpdateInventory()}
          onManageDeals={(inventory) => setManageDealsInventory(inventory)}
        />
      )}

      {activeTab === 2 && (
        <ItemImagesTab
          images={sortedItemImages}
          itemName={item.name}
          imageActionsBusy={imageActionsBusy}
          cleanupEnabled={(profile?.business?.ai_tokens ?? 0) > 0}
          onOpenLightbox={openImageLightbox}
          onSetPrimary={(id) => void handleSetImageAsMain(id)}
          onSetSecondary={(id) => void handleSetImageAsGallery(id)}
          onOpenCleanup={handleOpenItemImageCleanup}
          onBuyTokens={() => navigate('/business/ai-tokens')}
          onManageImages={() => setShowImageUploadDialog(true)}
        />
      )}

      <ItemImageLightbox
        images={sortedItemImages}
        index={imageLightboxIndex}
        itemName={item.name}
        onClose={closeImageLightbox}
        onNavigate={goLightbox}
      />

      <UpdateInventoryDialog
        open={showUpdateInventoryDialog}
        onClose={() => setShowUpdateInventoryDialog(false)}
        businessId={effectiveBusinessId}
        item={item}
        selectedInventory={selectedInventory}
        onInventoryUpdated={() => {
          void fetchItemDetails();
        }}
      />

      <ImageUploadDialog
        open={showImageUploadDialog}
        onClose={(refresh) => {
          setShowImageUploadDialog(false);
          if (refresh) {
            fetchItemDetails();
          }
        }}
        itemId={itemId || ''}
        itemName={item?.name || ''}
      />

      <ManageDealsDialog
        open={Boolean(manageDealsInventory)}
        onClose={() => setManageDealsInventory(null)}
        inventoryItem={(manageDealsInventory as unknown as BusinessInventoryItem) || null}
        businessId={effectiveBusinessId}
      />

      <RefineItemWithAiDialog
        open={showRefineAiDialog}
        item={item}
        brands={brands}
        itemSubCategories={itemSubCategories}
        onClose={() => setShowRefineAiDialog(false)}
        onApplied={() => {
          void fetchItemDetails();
        }}
        updateItem={updateItem}
      />

      <ManageItemCollectionsDialog
        open={showCollectionsDialog}
        itemId={itemId ?? null}
        businessId={effectiveBusinessId}
        onClose={() => setShowCollectionsDialog(false)}
        onSaved={() => {
          void fetchItemDetails();
        }}
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
        onReject={() => {
          setImageToCleanup(null);
          setCleanedB64(null);
        }}
      />
    </Container>
  );
}
