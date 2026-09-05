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
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBusinessCatalogScope } from '../../hooks/useBusinessCatalogScope';
import { useBusinessImages } from '../../hooks/useBusinessImages';
import {
  BusinessInventoryItem,
  useBusinessInventory,
} from '../../hooks/useBusinessInventory';
import { useImageEnhancements } from '../../hooks/useImageEnhancements';
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
import VariantsManagerSection from '../business/variants/VariantsManagerSection';
import { ManageItemCollectionsDialog } from '../dialogs/ManageItemCollectionsDialog';
import RefineItemWithAiDialog from '../dialogs/RefineItemWithAiDialog';
import SEOHead from '../seo/SEOHead';

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
    submitting: imageActionsBusy,
  } = useBusinessImages();
  const { trackJob, inFlightJobIds } = useImageEnhancements();
  const prevInFlightCountRef = useRef(0);
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
    const prev = prevInFlightCountRef.current;
    prevInFlightCountRef.current = inFlightJobIds.length;
    if (prev > 0 && inFlightJobIds.length === 0) {
      void fetchItemDetails({ silent: true });
    }
  }, [inFlightJobIds.length, fetchItemDetails]);

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

  const handleOpenItemImageCleanup = useCallback(
    async (img: ItemImage) => {
      if (img.is_ai_cleaned) {
        enqueueSnackbar(
          t('business.images.cleanup.alreadyCleaned', 'Image was already cleaned with AI'),
          { variant: 'info' }
        );
        return;
      }
      enqueueSnackbar(
        t('business.aiImageCleanup.enhancing', 'Enhancing…'),
        { variant: 'info' }
      );
      const result = await cleanupImage(img.id);
      if (!result?.jobId) {
        enqueueSnackbar(
          t('business.images.cleanup.error', 'Failed to cleanup image'),
          { variant: 'error' }
        );
        return;
      }
      if (typeof result.ai_tokens_remaining === 'number') {
        updateBusinessAiTokens(result.ai_tokens_remaining);
      }
      trackJob(result.jobId);
    },
    [cleanupImage, enqueueSnackbar, t, trackJob, updateBusinessAiTokens]
  );

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
              {item.rejection_reason ? (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    {t(
                      'business.items.moderation.rejectionReason',
                      'Why this item was rejected'
                    )}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {item.rejection_reason}
                  </Typography>
                </>
              ) : null}
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
        <>
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
            onCategorySaved={() => void fetchItemDetails({ silent: true })}
          />
          {itemId ? (
            <VariantsManagerSection
              itemId={itemId}
              parentItem={{
                name: item.name,
                price: item.price,
                currency: item.currency,
                weight: item.weight,
                weight_unit: item.weight_unit,
                dimensions: item.dimensions,
                color: item.color,
              }}
            />
          ) : null}
        </>
      )}

      {activeTab === 1 && (
        <ItemInventoryTab
          item={item}
          businessId={effectiveBusinessId}
          canSuperUserActions={canSuperUserActions}
          onUpdateInventory={handleUpdateInventory}
          onAddLocation={() => handleUpdateInventory()}
          onManageDeals={(inventory) => setManageDealsInventory(inventory)}
          onInventoryChanged={() => {
            void fetchItemDetails();
          }}
        />
      )}

      {activeTab === 2 && (
        <ItemImagesTab
          images={sortedItemImages}
          itemName={item.name}
          imageActionsBusy={imageActionsBusy}
          cleanupEnabled={(profile?.business?.ai_tokens ?? 0) > 0}
          aiTokensRemaining={profile?.business?.ai_tokens ?? 0}
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
    </Container>
  );
}
