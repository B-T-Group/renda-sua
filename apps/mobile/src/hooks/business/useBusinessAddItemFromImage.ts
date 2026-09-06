import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert } from 'react-native';
import { businessApi } from '../../services/businessApi';
import { uploadSingleBusinessImage } from '../../services/businessImageUpload';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type {
  CreatedSaleItemSummary,
  ImageItemSuggestionConfidence,
  ImageItemSuggestions,
  ListingQualityScore,
  DuplicateCandidate,
  UpdateBusinessItemPayload,
} from '../../types/business/items';
import type { AiReviewFormValues } from '../../components/business/add-item/AddItemAiReviewStep';
import {
  buildListingWizardDraft,
  clearListingWizardDraft,
  draftHasRestorableContent,
  migrateListingWizardDraftStep,
  readListingWizardDraft,
  writeListingWizardDraft,
} from '../../utils/listingWizardDraftStorage';
import {
  filterSupportedImageAssets,
  IMAGE_LIBRARY_PICKER_OPTIONS,
} from '../../utils/supportedImageFormats';
import { trackProductCreateEvent } from '../../utils/productCreateAnalytics';
import { resolveEnhancedPreviewUrl } from '../../utils/resolveEnhancedPreviewUrl';
import { isShippingPriceValid, parseShippingPrice } from '../../utils/itemFulfillment';
import {
  buildCleanupSelections,
  cleanupKindsFromDraft,
  hasAnyCleanupSelection,
  removeCleanupKindAt,
  reorderCleanupKindsToMain,
  toggleCleanupKindAt,
  type CleanupKindsByIndex,
} from '../../utils/imageCleanupKinds';
import type { ImageCleanupKindSelection } from '../../types/imageCleanup';
import {
  PROCESSING_TIMEOUTS_MS,
  PACED_STAGE_MS,
  delay,
  initialProcessingStages,
  withTimeout,
  type ProcessingStageKey,
  type ProcessingStageState,
} from '../../utils/productCreateProcessing';
import {
  FOOD_CATEGORY_NAME,
  FOOD_SUB_CATEGORY_NAME,
} from '../../utils/foodAvailability';
import { useProfileMe } from '../useProfileMe';
import { useImageItemSuggestions } from './useImageItemSuggestions';
import { useSupportedCurrencies } from './useSupportedCurrencies';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

/** Photos → Description → Processing → Review → Fulfillment → Publish → Done */
export const SALE_STEP = {
  photos: 0,
  description: 1,
  processing: 2,
  review: 3,
  fulfillment: 4,
  publish: 5,
  done: 6,
} as const;

export const SALE_STEP_COUNT = 7;

const EMPTY_FORM: AiReviewFormValues = {
  name: '',
  description: '',
  categoryName: '',
  subCategoryName: '',
  brandName: '',
  price: '',
  quantity: '1',
  locationId: '',
  isUsed: false,
  payAtPickupEnabled: true,
  shippingEnabled: false,
  shippingPrice: '',
};

export function useBusinessAddItemFromImage() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { me, loading: profileLoading, refetch: refetchMe } = useProfileMe();
  const businessId = me?.business?.id;
  const aiTokens = me?.business?.ai_tokens ?? 0;
  const { defaultCurrency } = useSupportedCurrencies();
  const currency = (
    defaultCurrency ||
    me?.currency ||
    'XAF'
  ).toUpperCase();

  const [step, setStep] = useState(0);
  const [assets, setAssets] = useState<ImagePickerAsset[]>([]);
  const [imageIds, setImageIds] = useState<(string | null)[]>([]);
  const [createdItem, setCreatedItem] = useState<CreatedSaleItemSummary | null>(
    null
  );
  const [locationName, setLocationName] = useState<string | undefined>();
  const [savedAsDraft, setSavedAsDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [isFoodItem, setIsFoodItem] = useState(false);
  const [form, setForm] = useState<AiReviewFormValues>(EMPTY_FORM);
  const [confidence, setConfidence] =
    useState<ImageItemSuggestionConfidence | null>(null);
  const [listingQuality, setListingQuality] =
    useState<ListingQualityScore | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    DuplicateCandidate[]
  >([]);
  const [categoryAlternates, setCategoryAlternates] = useState<string[]>([]);
  const [flowStartedAt, setFlowStartedAt] = useState(() => Date.now());
  const [cleanupKinds, setCleanupKinds] = useState<CleanupKindsByIndex>({});
  const [processingStages, setProcessingStages] = useState<
    ProcessingStageState[]
  >(() => initialProcessingStages(false));
  const [processingComplete, setProcessingComplete] = useState(false);
  const [processingFailed, setProcessingFailed] = useState(false);
  const [processingTimedOut, setProcessingTimedOut] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [lastProcessedHint, setLastProcessedHint] = useState('');
  const [lastProcessedIsFoodItem, setLastProcessedIsFoodItem] = useState(false);
  const [cleanupQueued, setCleanupQueued] = useState(false);
  const [cleanupJobId, setCleanupJobId] = useState<string | null>(null);
  const [enhancedPreviewUrl, setEnhancedPreviewUrl] = useState<string | null>(
    null
  );

  const {
    suggestions,
    loading: aiLoading,
    error: aiError,
    fetchSuggestions,
    reset: resetSuggestions,
  } = useImageItemSuggestions();

  const createdItemIdRef = useRef<string | undefined>(undefined);
  const cleanupJobIdRef = useRef<string | null>(null);
  /** Legacy draft AI indexes — applied once profile token balance is known. */
  const pendingLegacyAiIndexesRef = useRef<number[] | null>(null);
  const stepRef = useRef(step);
  stepRef.current = step;
  const resetOnNextFocusRef = useRef(false);
  const suppressPersistRef = useRef(false);
  const processingRunRef = useRef(0);
  const pipelineCtxRef = useRef({
    assets,
    imageIds,
    hint,
    isFoodItem,
    businessId,
    cleanupKinds,
    cleanupQueued,
    aiError,
  });
  pipelineCtxRef.current = {
    assets,
    imageIds,
    hint,
    isFoodItem,
    businessId,
    cleanupKinds,
    cleanupQueued,
    aiError,
  };
  const minPhotos = 1;

  useEffect(() => {
    trackProductCreateEvent('product_create.flow_opened', {
      entry: 'BusinessAddItemFromImage',
    });
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void refetchMe();
    });
    return unsubscribe;
  }, [navigation, refetchMe]);

  useEffect(() => {
    void restoreDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pending = pendingLegacyAiIndexesRef.current;
    if (!pending || me == null) return;
    pendingLegacyAiIndexesRef.current = null;
    const legacy: CleanupKindsByIndex = {};
    const tokenCap = Math.max(0, me.business?.ai_tokens ?? 0);
    let aiUsed = 0;
    for (const i of pending) {
      if (aiUsed >= tokenCap) break;
      legacy[i] = 'ai';
      aiUsed += 1;
    }
    setCleanupKinds(legacy);
  }, [me]);

  useEffect(() => {
    createdItemIdRef.current = createdItem?.id;
  }, [createdItem?.id]);

  useEffect(() => {
    if (suggestions) applySuggestions(suggestions, true, isFoodItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, isFoodItem]);

  useEffect(() => {
    persistDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    imageIds,
    createdItem?.id,
    assets,
    form,
    hint,
    isFoodItem,
    savedAsDraft,
    cleanupKinds,
  ]);

  const restoreDraft = async () => {
    const draft = await readListingWizardDraft('sale');
    if (!draft || !draftHasRestorableContent(draft)) return;
    const migratedStep = migrateListingWizardDraftStep(
      draft.step,
      draft.stepVersion
    );
    // Completed / draft-saved runs should not reopen as a filled form.
    if (draft.savedAsDraft || migratedStep >= SALE_STEP.done) {
      await clearListingWizardDraft('sale');
      return;
    }
    trackProductCreateEvent('product_create.draft_resumed', {
      ageHours: Math.round((Date.now() - draft.savedAt) / 3600000),
    });
    const restoredStep = mapRestoredStep({ ...draft, step: migratedStep });
    setStep(restoredStep);
    setSavedAsDraft(!!draft.savedAsDraft);
    setImageIds((draft.imageIds ?? []).map((id) => (id ? id : null)));
    if (draft.createdItemId) {
      setCreatedItem({ id: draft.createdItemId, name: draft.form?.name ?? '' });
      createdItemIdRef.current = draft.createdItemId;
    }
    if (draft.assetUris?.length) {
      setAssets(draft.assetUris.map((uri) => ({ uri, width: 0, height: 0 })));
    }
    applyDraftForm(draft.form);
    if (draft.cleanupKinds) {
      setCleanupKinds(cleanupKindsFromDraft(draft.cleanupKinds));
    } else if (draft.asyncCleanupRequested) {
      const indexes =
        draft.cleanupSelectedIndexes ??
        (draft.assetUris ?? []).map((_, i) => i);
      pendingLegacyAiIndexesRef.current = indexes;
      if (me != null) {
        const legacy: CleanupKindsByIndex = {};
        const tokenCap = Math.max(0, me.business?.ai_tokens ?? 0);
        let aiUsed = 0;
        for (const i of indexes) {
          if (aiUsed >= tokenCap) break;
          legacy[i] = 'ai';
          aiUsed += 1;
        }
        pendingLegacyAiIndexesRef.current = null;
        setCleanupKinds(legacy);
      }
    }
  };

  const mapRestoredStep = (draft: {
    step: number;
    savedAsDraft?: boolean;
    createdItemId?: string;
  }) => {
    if (draft.step >= SALE_STEP.done) return SALE_STEP.photos;
    // Legacy 3-step drafts used step 1 for AI review (now description).
    if (draft.step === 1 && draft.createdItemId) {
      return SALE_STEP.review;
    }
    // Never restore onto a live processing screen — resume via description.
    if (draft.step === SALE_STEP.processing) {
      return SALE_STEP.description;
    }
    return Math.min(draft.step, SALE_STEP.publish);
  };

  const applyDraftForm = (
    snap: {
      name?: string;
      description?: string;
      categoryName?: string;
      subCategoryName?: string;
      brandName?: string;
      price?: string;
      quantity?: string;
      locationId?: string;
      hint?: string;
      isFoodItem?: boolean;
      isUsed?: boolean;
      payAtPickupEnabled?: boolean;
      shippingEnabled?: boolean;
      shippingPrice?: string;
    } | undefined
  ) => {
    if (!snap) return;
    setForm((prev) => ({
      ...prev,
      name: snap.name ?? '',
      description: snap.description ?? '',
      categoryName: snap.categoryName ?? '',
      subCategoryName: snap.subCategoryName ?? '',
      brandName: snap.brandName ?? '',
      price: snap.price ?? '',
      quantity: snap.quantity ?? '1',
      locationId: snap.locationId ?? '',
      isUsed: snap.isUsed === true,
      payAtPickupEnabled: snap.payAtPickupEnabled !== false,
      shippingEnabled: snap.shippingEnabled === true,
      shippingPrice: snap.shippingPrice ?? '',
    }));
    setHint(snap.hint ?? '');
    setIsFoodItem(snap.isFoodItem === true);
  };

  const persistDraft = () => {
    // Never re-write a draft from the success screen (would undo clear after publish).
    if (suppressPersistRef.current || step === SALE_STEP.done) return;
    const draft = buildListingWizardDraft({
      kind: 'sale',
      step,
      imageIds,
      createdItemId: createdItem?.id,
      savedAsDraft,
      assetUris: assets.map((a) => a.uri).filter(Boolean),
      cleanupKinds: Object.fromEntries(
        Object.entries(cleanupKinds).map(([k, v]) => [k, v])
      ),
      form: {
        name: form.name,
        description: form.description,
        categoryName: form.categoryName,
        subCategoryName: form.subCategoryName,
        brandName: form.brandName,
        price: form.price,
        hint,
        isFoodItem,
        quantity: form.quantity,
        locationId: form.locationId,
        isUsed: form.isUsed,
        payAtPickupEnabled: form.payAtPickupEnabled,
        shippingEnabled: form.shippingEnabled,
        shippingPrice: form.shippingPrice,
      },
    });
    if (draft) void writeListingWizardDraft(draft);
  };

  const applySuggestions = useCallback(
    (
      data: ImageItemSuggestions,
      preferEmptyOnly = true,
      foodItem = false
    ) => {
      setConfidence(data.confidence ?? null);
      setListingQuality(data.listingQuality ?? null);
      setDuplicateCandidates(data.duplicateCandidates ?? []);
      setCategoryAlternates(data.categoryAlternates ?? []);
      setForm((prev) =>
        mergeSuggestionForm(prev, data, preferEmptyOnly, foodItem)
      );
      if ((data.duplicateCandidates?.length ?? 0) > 0) {
        trackProductCreateEvent('product_create.duplicate_warning_shown', {
          count: data.duplicateCandidates!.length,
        });
      }
    },
    []
  );

  const patchStage = useCallback(
    (key: ProcessingStageKey, patch: Partial<ProcessingStageState>) => {
      setProcessingStages((prev) =>
        prev.map((s) => (s.key === key ? { ...s, ...patch } : s))
      );
    },
    []
  );

  const runPacedStage = async (
    runId: number,
    key: ProcessingStageKey
  ): Promise<boolean> => {
    const ms = PACED_STAGE_MS[key] ?? 800;
    patchStage(key, { status: 'active' });
    await delay(ms);
    if (processingRunRef.current !== runId) return false;
    patchStage(key, { status: 'done' });
    return true;
  };

  const appendAssets = useCallback(
    (newAssets: ImagePickerAsset[], source: 'camera' | 'gallery') => {
      if (!newAssets.length) return;
      const { supported, rejectedCount } = filterSupportedImageAssets(newAssets);
      if (rejectedCount > 0) {
        setSnackbar(
          t(
            'business.images.upload.unsupportedFormat',
            'Some photos were skipped. Please use JPEG, PNG, or WebP.'
          )
        );
      }
      if (!supported.length) return;
      setLastProcessedHint('');
      setCleanupQueued(false);
      setCleanupJobId(null);
      cleanupJobIdRef.current = null;
      setEnhancedPreviewUrl(null);
      setAssets((prev) => {
        const start = prev.length;
        supported.forEach((_, i) => {
          trackProductCreateEvent('product_create.photo_captured', {
            index: start + i,
            source,
          });
        });
        return [...prev, ...supported];
      });
      setImageIds((ids) => [...ids, ...supported.map(() => null)]);
    },
    [t]
  );

  const pickImages = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setSnackbar(
        t(
          'business.onboarding.firstSale.upload.photoPermissionDenied',
          'Photo library permission is required'
        )
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      ...IMAGE_LIBRARY_PICKER_OPTIONS,
      allowsMultipleSelection: true,
      base64: false,
    });
    if (!result.canceled && result.assets.length) {
      appendAssets(result.assets, 'gallery');
    }
  }, [appendAssets, t]);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setSnackbar(
        t(
          'business.onboarding.firstSale.upload.cameraPermissionDenied',
          'Camera permission is required'
        )
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      ...IMAGE_LIBRARY_PICKER_OPTIONS,
      base64: false,
    });
    if (!result.canceled && result.assets.length) {
      appendAssets(result.assets, 'camera');
    }
  }, [appendAssets, t]);

  const removeAssetAt = useCallback((index: number) => {
    setLastProcessedHint('');
    setCleanupQueued(false);
    setCleanupJobId(null);
    cleanupJobIdRef.current = null;
    setEnhancedPreviewUrl(null);
    setAssets((prev) => prev.filter((_, i) => i !== index));
    setImageIds((prev) => prev.filter((_, i) => i !== index));
    setCleanupKinds((prev) => removeCleanupKindAt(prev, index));
  }, []);

  const setMainAt = useCallback((index: number) => {
    if (index <= 0) return;
    setLastProcessedHint('');
    const reorder = <T,>(arr: T[]) => {
      const next = [...arr];
      const [picked] = next.splice(index, 1);
      next.unshift(picked);
      return next;
    };
    setAssets(reorder);
    setImageIds((prev) => {
      const next = reorder(prev);
      const mainId = next[0];
      if (mainId) {
        void businessApi.images.setAsMain(mainId).catch(() => undefined);
      }
      return next;
    });
    setCleanupKinds((prev) => reorderCleanupKindsToMain(prev, index));
  }, []);

  const continueFromPhotos = useCallback(() => {
    if (assets.length < minPhotos) {
      setSnackbar(
        t(
          'business.images.validation.minPhotos',
          'Add at least {{count}} photos to continue.',
          { count: minPhotos }
        )
      );
      return;
    }
    setStep(SALE_STEP.description);
  }, [assets, minPhotos, t]);

  const setCleanupKindAt = useCallback(
    (index: number, kind: ImageCleanupKindSelection) => {
      setCleanupKinds((prev) => {
        if (kind === null) {
          return { ...prev, [index]: null };
        }
        return toggleCleanupKindAt(prev, index, kind, aiTokens);
      });
      if (kind === 'ai' || kind === 'rembg') {
        trackProductCreateEvent('product_create.cleanup_opted_in', {
          count: 1,
          kind,
        });
      } else {
        trackProductCreateEvent('product_create.cleanup_skipped');
      }
    },
    [aiTokens]
  );

  const startProcessing = useCallback(async () => {
    if (!hint.trim()) {
      setSnackbar(
        t(
          'business.onboarding.firstSale.description.required',
          'Add a short description of what you photographed'
        )
      );
      return;
    }
    const priceNum = Number.parseFloat(form.price.replace(',', '.'));
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      setSnackbar(
        t(
          'business.onboarding.firstSale.create.priceRequired',
          'Enter a valid price'
        )
      );
      return;
    }
    if (!businessId) {
      setSnackbar(
        t(
          'business.onboarding.firstSale.upload.businessRequired',
          'Your business profile must be loaded before uploading photos.'
        )
      );
      return;
    }
    // Resume review only when hint/cleanup already processed for these photos.
    const readyIds = imageIds.filter((id): id is string => !!id);
    const { cleanupKinds: kinds } = pipelineCtxRef.current;
    const wantCleanup = hasAnyCleanupSelection(kinds);
    const canReuse =
      !!createdItemIdRef.current &&
      assets.length > 0 &&
      readyIds.length >= assets.length &&
      lastProcessedHint === hint.trim() &&
      lastProcessedIsFoodItem === isFoodItem &&
      (!wantCleanup || cleanupQueued);
    if (canReuse) {
      setStep(SALE_STEP.review);
      return;
    }
    setStep(SALE_STEP.processing);
    setProcessingComplete(false);
    setProcessingFailed(false);
    setProcessingTimedOut(false);
    setProcessingError(null);
    setProcessingStages(initialProcessingStages(wantCleanup));
    const runId = ++processingRunRef.current;
    await runProcessingPipeline(runId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    assets.length,
    businessId,
    cleanupQueued,
    form.price,
    hint,
    imageIds,
    isFoodItem,
    lastProcessedHint,
    lastProcessedIsFoodItem,
    t,
  ]);

  const runProcessingPipeline = async (runId: number) => {
    const overallTimer = setTimeout(() => {
      if (processingRunRef.current !== runId) return;
      setProcessingTimedOut(true);
      setProcessingComplete(true);
    }, PROCESSING_TIMEOUTS_MS.overall);

    try {
      const uploadedIds = await stageUpload(runId);
      if (processingRunRef.current !== runId) return;
      if (!uploadedIds?.length) {
        setProcessingFailed(true);
        return;
      }

      await runPacedStage(runId, 'thumbnails');
      if (processingRunRef.current !== runId) return;

      const itemId = await stageDraft(runId, uploadedIds[0]);
      if (processingRunRef.current !== runId) return;
      if (!itemId) {
        setProcessingFailed(true);
        return;
      }

      await stageAssociateExtras(itemId, uploadedIds);
      await runPacedStage(runId, 'optimize');
      if (processingRunRef.current !== runId) return;

      await stageCleanup(runId, itemId, uploadedIds);
      const analyzed = await stageAnalyze(runId, uploadedIds);
      if (processingRunRef.current !== runId) return;
      if (analyzed) {
        await runPacedStage(runId, 'details');
      } else {
        patchStage('details', { status: 'skipped' });
      }

      if (processingRunRef.current === runId) {
        setLastProcessedHint(pipelineCtxRef.current.hint.trim());
        setLastProcessedIsFoodItem(pipelineCtxRef.current.isFoodItem);
        if (hasAnyCleanupSelection(pipelineCtxRef.current.cleanupKinds)) {
          setCleanupQueued(true);
          void resolveEnhancedPreviewUrl({
            itemId,
            jobId: cleanupJobIdRef.current,
          }).then((url) => {
            if (url && processingRunRef.current === runId) {
              setEnhancedPreviewUrl(url);
            }
          });
        }
        setProcessingComplete(true);
      }
    } catch (e: unknown) {
      if (processingRunRef.current !== runId) return;
      setProcessingError(e instanceof Error ? e.message : 'Processing failed');
      setProcessingFailed(true);
      setProcessingComplete(true);
    } finally {
      clearTimeout(overallTimer);
    }
  };

  const stageUpload = async (runId: number): Promise<string[] | null> => {
    patchStage('upload', { status: 'active' });
    try {
      const ids = await withTimeout(
        uploadAllAssets(),
        PROCESSING_TIMEOUTS_MS.uploadOverall,
        'Upload'
      );
      if (processingRunRef.current !== runId) return null;
      setImageIds(ids);
      patchStage('upload', { status: 'done' });
      return ids.filter((id): id is string => !!id);
    } catch (e: unknown) {
      patchStage('upload', {
        status: 'error',
        detail: e instanceof Error ? e.message : 'Upload failed',
      });
      setProcessingError(e instanceof Error ? e.message : 'Upload failed');
      return null;
    }
  };

  const uploadAllAssets = async (): Promise<(string | null)[]> => {
    const { assets: currentAssets, imageIds: currentIds, businessId: bid } =
      pipelineCtxRef.current;
    if (!bid) throw new Error('Missing business');
    const results: (string | null)[] = [];
    for (let i = 0; i < currentAssets.length; i++) {
      const asset = currentAssets[i];
      const existing = currentIds[i];
      if (existing) {
        results.push(existing);
        continue;
      }
      const id = await uploadSingleBusinessImage(asset, bid);
      results.push(id);
      trackProductCreateEvent('product_create.photo_upload_completed', {
        index: i,
      });
    }
    return results;
  };

  const stageDraft = async (
    runId: number,
    primaryId: string
  ): Promise<string | undefined> => {
    patchStage('draft', { status: 'active' });
    try {
      const { hint: currentHint } = pipelineCtxRef.current;
      if (createdItemIdRef.current) {
        try {
          await businessApi.images.setAsMain(primaryId);
        } catch {
          // non-fatal — draft already exists
        }
        patchStage('draft', { status: 'done' });
        return createdItemIdRef.current;
      }
      const res = await withTimeout(
        businessApi.catalog.createFromImage({
          imageId: primaryId,
          name: currentHint.trim() || undefined,
          hint: currentHint.trim() || undefined,
        }),
        PROCESSING_TIMEOUTS_MS.draft,
        'Draft'
      );
      if (processingRunRef.current !== runId) return undefined;
      const itemId = res.data?.item?.id;
      if (!res.success || !itemId) {
        throw new Error(res.error || 'Could not create draft');
      }
      createdItemIdRef.current = itemId;
      setCreatedItem({
        id: itemId,
        name: currentHint.trim() || 'Untitled product',
      });
      patchStage('draft', { status: 'done' });
      return itemId;
    } catch (e: unknown) {
      patchStage('draft', {
        status: 'error',
        detail: e instanceof Error ? e.message : 'Draft failed',
      });
      setProcessingError(e instanceof Error ? e.message : 'Draft failed');
      return undefined;
    }
  };

  const stageAssociateExtras = async (
    itemId: string,
    readyIds: string[]
  ) => {
    for (const imageId of readyIds.slice(1)) {
      try {
        await businessApi.images.associateItem(imageId, itemId);
      } catch {
        // non-fatal
      }
    }
  };

  const stageCleanup = async (
    runId: number,
    itemId: string,
    readyIds: string[]
  ) => {
    const { cleanupKinds: kinds, cleanupQueued: alreadyQueued } =
      pipelineCtxRef.current;
    const selections = buildCleanupSelections(readyIds, kinds);
    if (!selections.length) {
      patchStage('cleanup', { status: 'skipped' });
      return;
    }
    if (alreadyQueued) {
      patchStage('cleanup', { status: 'done' });
      return;
    }
    patchStage('cleanup', { status: 'active' });
    try {
      const res = await withTimeout(
        businessApi.aiImageCleanup.request(itemId, { selections }),
        PROCESSING_TIMEOUTS_MS.cleanup,
        'Cleanup'
      );
      if (processingRunRef.current !== runId) return;
      const jobId = res.data?.job?.id ?? null;
      if (jobId) {
        cleanupJobIdRef.current = jobId;
        setCleanupJobId(jobId);
      }
      setCleanupQueued(true);
      patchStage('cleanup', { status: 'done' });
    } catch (e: unknown) {
      patchStage('cleanup', {
        status: 'error',
        detail: e instanceof Error ? e.message : 'Cleanup queue failed',
      });
    }
  };

  const stageAnalyze = async (
    runId: number,
    readyIds: string[]
  ): Promise<boolean> => {
    const {
      hint: currentHint,
      isFoodItem: currentIsFoodItem,
      aiError: currentAiError,
    } = pipelineCtxRef.current;
    patchStage('analyze', { status: 'active' });
    try {
      const data = await withTimeout(
        fetchSuggestions(readyIds, {
          hint: currentHint.trim(),
          ...(currentIsFoodItem ? { isFoodItem: true } : {}),
        }),
        PROCESSING_TIMEOUTS_MS.analyze,
        'Analyze'
      );
      if (processingRunRef.current !== runId) return false;
      if (data) {
        applySuggestions(data, false, currentIsFoodItem);
        if (currentHint.trim() && !data.name) {
          setForm((prev) =>
            prev.name.trim() ? prev : { ...prev, name: currentHint.trim() }
          );
        }
        patchStage('analyze', { status: 'done' });
        return true;
      }
      setForm((prev) =>
        prev.name.trim() ? prev : { ...prev, name: currentHint.trim() }
      );
      patchStage('analyze', {
        status: 'error',
        detail: currentAiError || 'Could not analyze photos',
      });
      return false;
    } catch (e: unknown) {
      setForm((prev) =>
        prev.name.trim() ? prev : { ...prev, name: currentHint.trim() }
      );
      patchStage('analyze', {
        status: 'error',
        detail: e instanceof Error ? e.message : 'Analyze failed',
      });
      return false;
    }
  };

  const retryProcessing = useCallback(() => {
    const wantCleanup = hasAnyCleanupSelection(
      pipelineCtxRef.current.cleanupKinds
    );
    setProcessingFailed(false);
    setProcessingTimedOut(false);
    setProcessingComplete(false);
    setProcessingError(null);
    setProcessingStages(initialProcessingStages(wantCleanup));
    const runId = ++processingRunRef.current;
    void runProcessingPipeline(runId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueFromProcessing = useCallback(() => {
    processingRunRef.current += 1;
    setStep(SALE_STEP.review);
  }, []);

  const continueFromReview = useCallback(() => {
    setStep(SALE_STEP.fulfillment);
  }, []);

  const continueFromFulfillment = useCallback(() => {
    setStep(SALE_STEP.publish);
  }, []);

  const onFormChange = useCallback((values: AiReviewFormValues) => {
    setForm(values);
  }, []);

  const onHintChange = useCallback((value: string) => {
    setHint(value);
  }, []);

  const onFoodItemChange = useCallback((value: boolean) => {
    setIsFoodItem(value);
    if (value) {
      setForm((prev) => ({
        ...prev,
        categoryName: FOOD_CATEGORY_NAME,
        subCategoryName: FOOD_SUB_CATEGORY_NAME,
      }));
    }
  }, []);

  const onPriceChange = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, price: value }));
  }, []);

  const persistFormToServer = useCallback(
    async (values: AiReviewFormValues) => {
      const itemId = createdItemIdRef.current;
      if (!itemId) return;
      await businessApi.catalog.updateItem(
        itemId,
        saleItemUpdatePayload(values, currency)
      );
    },
    [currency]
  );

  const publish = useCallback(async () => {
    const itemId = createdItemIdRef.current;
    if (!itemId) {
      setSnackbar(
        t(
          'business.onboarding.firstSale.review.createFailed',
          'Could not create product draft'
        )
      );
      return;
    }
    if (!form.name.trim()) {
      setSnackbar(
        t(
          'business.onboarding.firstSale.create.nameRequired',
          'Product name is required'
        )
      );
      return;
    }
    if (!form.locationId) {
      setSnackbar(
        t(
          'business.onboarding.firstSale.location.pickLocation',
          'Select or add a location'
        )
      );
      return;
    }
    if (!isShippingPriceValid(form.shippingEnabled, form.shippingPrice)) {
      setSnackbar(
        t(
          'business.items.fulfillment.shippingPriceRequired',
          'Enter a shipping price. Use 0 for free shipping.'
        )
      );
      return;
    }
    const price = Number.parseFloat(form.price);
    if (Number.isNaN(price) || price <= 0) {
      setSnackbar(
        t(
          'business.onboarding.firstSale.create.priceRequired',
          'Enter a valid price'
        )
      );
      return;
    }
    setBusy(true);
    try {
      await persistFormToServer(form);
      const qty = Math.max(0, Number.parseInt(form.quantity, 10) || 0);
      const res = await businessApi.catalog.quickPublish(itemId, {
        locationId: form.locationId,
        quantity: qty,
        sellingPrice: price,
      });
      if (!res.success) throw new Error(res.error || 'Failed to publish');
      await resolveLocationName(form.locationId);
      setSavedAsDraft(false);
      setCreatedItem({
        id: itemId,
        name: form.name.trim(),
        price,
        currency,
      });
      suppressPersistRef.current = true;
      setStep(SALE_STEP.done);
      setForm(EMPTY_FORM);
      setHint('');
      setIsFoodItem(false);
      setConfidence(null);
      setListingQuality(null);
      setDuplicateCandidates([]);
      setCategoryAlternates([]);
      resetSuggestions();
      await clearListingWizardDraft('sale');
      trackProductCreateEvent('product_create.published', {
        msFromFirstPhoto: Date.now() - flowStartedAt,
        photoCount: assets.length,
        qualityScore: listingQuality?.score,
        hintUsed: !!hint.trim(),
      });
    } catch (e: unknown) {
      suppressPersistRef.current = false;
      setSnackbar(
        e instanceof Error
          ? e.message
          : t(
              'business.onboarding.firstSale.review.publishFailed',
              'Could not publish product'
            )
      );
    } finally {
      setBusy(false);
    }
  }, [
    assets.length,
    currency,
    flowStartedAt,
    form,
    hint,
    listingQuality?.score,
    persistFormToServer,
    resetSuggestions,
    t,
  ]);

  const resolveLocationName = async (locationId: string) => {
    try {
      const locs = await businessApi.locations.list();
      const loc = (locs.data?.business_locations ?? []).find(
        (l) => l.id === locationId
      );
      setLocationName(loc?.name);
    } catch {
      setLocationName(undefined);
    }
  };

  const saveForLater = useCallback(async () => {
    if (!isShippingPriceValid(form.shippingEnabled, form.shippingPrice)) {
      setSnackbar(
        t(
          'business.items.fulfillment.shippingPriceRequired',
          'Enter a shipping price. Use 0 for free shipping.'
        )
      );
      return;
    }
    setBusy(true);
    try {
      const itemId = createdItemIdRef.current;
      if (!itemId) {
        throw new Error(
          t(
            'business.onboarding.firstSale.review.createFailed',
            'Could not create product draft'
          )
        );
      }
      await persistFormToServer(form);
      const price = Number.parseFloat(form.price);
      setCreatedItem({
        id: itemId,
        name: form.name.trim() || 'Untitled product',
        price: !Number.isNaN(price) && price > 0 ? price : undefined,
        currency,
      });
      setSavedAsDraft(true);
      suppressPersistRef.current = true;
      setStep(SALE_STEP.done);
      setForm(EMPTY_FORM);
      setHint('');
      setIsFoodItem(false);
      setConfidence(null);
      setListingQuality(null);
      setDuplicateCandidates([]);
      setCategoryAlternates([]);
      resetSuggestions();
      await clearListingWizardDraft('sale');
      trackProductCreateEvent('product_create.saved_for_later', {
        step: SALE_STEP.publish,
      });
    } catch (e: unknown) {
      suppressPersistRef.current = false;
      setSnackbar(e instanceof Error ? e.message : 'Could not save draft');
    } finally {
      setBusy(false);
    }
  }, [currency, form, persistFormToServer, resetSuggestions, t]);

  const goBack = useCallback(() => {
    if (step === SALE_STEP.done) {
      navigation.goBack();
      return;
    }
    if (step === SALE_STEP.review || step === SALE_STEP.processing) {
      if (step === SALE_STEP.processing) {
        processingRunRef.current += 1;
      }
      setStep(SALE_STEP.description);
      return;
    }
    if (step > SALE_STEP.photos) {
      setStep((s) => Math.max(0, s - 1));
      return;
    }
    if (assets.length === 0) {
      void clearListingWizardDraft('sale');
      navigation.goBack();
      return;
    }
    Alert.alert(
      t('business.onboarding.firstSale.exitTitle', 'Leave?'),
      t(
        'business.onboarding.firstSale.exitBodyWithDraft',
        'Your photos are saved as a draft. Leave anyway?'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('business.onboarding.firstSale.exitLeave', 'Leave'),
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  }, [assets.length, navigation, step, t]);

  const clearWizardState = useCallback(() => {
    processingRunRef.current += 1;
    suppressPersistRef.current = true;
    setStep(0);
    setAssets([]);
    setImageIds([]);
    setCreatedItem(null);
    setLocationName(undefined);
    setSavedAsDraft(false);
    setBusy(false);
    setSnackbar(null);
    setHint('');
    setIsFoodItem(false);
    setForm(EMPTY_FORM);
    setConfidence(null);
    setListingQuality(null);
    setDuplicateCandidates([]);
    setCategoryAlternates([]);
    setFlowStartedAt(Date.now());
    setCleanupKinds({});
    setProcessingStages(initialProcessingStages(false));
    setProcessingComplete(false);
    setProcessingFailed(false);
    setProcessingTimedOut(false);
    setProcessingError(null);
    setLastProcessedHint('');
    setLastProcessedIsFoodItem(false);
    setCleanupQueued(false);
    setCleanupJobId(null);
    cleanupJobIdRef.current = null;
    setEnhancedPreviewUrl(null);
    createdItemIdRef.current = undefined;
    resetSuggestions();
    void clearListingWizardDraft('sale');
    // Allow drafts again once the merchant starts a new run.
    queueMicrotask(() => {
      suppressPersistRef.current = false;
    });
  }, [resetSuggestions]);

  const resetWizard = useCallback(() => {
    clearWizardState();
    trackProductCreateEvent('product_create.add_another_tapped');
  }, [clearWizardState]);

  // On blur after success, flag a reset; apply it in useLayoutEffect before the next paint.
  const [screenFocused, setScreenFocused] = useState(true);
  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => setScreenFocused(true));
    const unsubBlur = navigation.addListener('blur', () => {
      setScreenFocused(false);
      if (stepRef.current === SALE_STEP.done) {
        resetOnNextFocusRef.current = true;
      }
    });
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  useLayoutEffect(() => {
    if (!screenFocused || !resetOnNextFocusRef.current) return;
    resetOnNextFocusRef.current = false;
    clearWizardState();
  }, [screenFocused, clearWizardState]);

  const retryAi = useCallback(() => {
    const readyIds = imageIds.filter((id): id is string => !!id);
    void fetchSuggestions(readyIds, {
      hint: hint.trim(),
      ...(isFoodItem ? { isFoodItem: true } : {}),
    }).then((data) => {
      if (data) applySuggestions(data, false, isFoodItem);
    });
  }, [applySuggestions, fetchSuggestions, hint, imageIds, isFoodItem]);

  useEffect(() => {
    if (step !== SALE_STEP.review) return;
    if (!cleanupQueued && !hasAnyCleanupSelection(cleanupKinds)) return;
    if (enhancedPreviewUrl) return;
    const itemId = createdItemIdRef.current;
    if (!itemId) return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) return;
      const url = await resolveEnhancedPreviewUrl({
        itemId,
        jobId: cleanupJobIdRef.current,
      });
      if (cancelled) return;
      if (url) {
        setEnhancedPreviewUrl(url);
        return;
      }
      attempts += 1;
      if (attempts < 15) {
        timer = setTimeout(() => {
          void tick();
        }, 2500);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    step,
    cleanupQueued,
    cleanupKinds,
    enhancedPreviewUrl,
    cleanupJobId,
  ]);

  const previewImageUri = enhancedPreviewUrl || assets[0]?.uri || null;
  const previewIsEnhanced = !!enhancedPreviewUrl;

  const onAddStockToDuplicate = useCallback(
    (itemId: string) => {
      trackProductCreateEvent('product_create.duplicate_add_stock_chosen', {
        itemId,
      });
      navigation.replace('BusinessItemDetail', { itemId });
    },
    [navigation]
  );

  const canContinuePhotos =
    !profileLoading && !!businessId && assets.length >= minPhotos && !busy;

  return {
    step,
    stepCount: SALE_STEP_COUNT,
    assets,
    imageIds: imageIds.filter((id): id is string => !!id),
    createdItem,
    locationName,
    savedAsDraft,
    busy,
    snackbar,
    businessId,
    profileLoading,
    canContinuePhotos,
    minPhotos,
    hint,
    onHintChange,
    isFoodItem,
    onFoodItemChange,
    onPriceChange,
    aiLoading,
    aiError,
    aiTokens,
    cleanupKinds,
    setCleanupKindAt,
    buyTokens: () => navigation.navigate('BusinessAiTokens'),
    form,
    confidence,
    listingQuality,
    duplicateCandidates,
    categoryAlternates,
    currency,
    previewImageUri,
    previewIsEnhanced,
    processingStages,
    processingComplete,
    processingFailed,
    processingTimedOut,
    processingError,
    pickImages,
    takePhoto,
    removeAssetAt,
    setMainAt,
    continueFromPhotos,
    startProcessing,
    retryProcessing,
    continueFromProcessing,
    continueFromReview,
    continueFromFulfillment,
    onFormChange,
    publish,
    saveForLater,
    goBack,
    dismissSnackbar: () => setSnackbar(null),
    setSnackbarMessage: (message: string) => setSnackbar(message),
    resetWizard,
    retryAi,
    onAddStockToDuplicate,
    navigation,
  };
}

function mergeSuggestionForm(
  prev: AiReviewFormValues,
  data: ImageItemSuggestions,
  preferEmptyOnly: boolean,
  isFoodItem = false
): AiReviewFormValues {
  const pick = (current: string, next?: string | null) =>
    preferEmptyOnly && current.trim() ? current : next?.trim() || current;
  const treatAsFood = isFoodItem || data.isFoodItem === true;
  return {
    ...prev,
    name: pick(prev.name, data.name),
    description: pick(prev.description, data.descriptionSuggestion),
    categoryName: treatAsFood
      ? FOOD_CATEGORY_NAME
      : pick(prev.categoryName, data.categoryName),
    subCategoryName: treatAsFood
      ? FOOD_SUB_CATEGORY_NAME
      : pick(prev.subCategoryName, data.subCategoryName),
    brandName: pick(prev.brandName, data.brandName),
    price:
      preferEmptyOnly && prev.price.trim()
        ? prev.price
        : data.price != null
          ? String(data.price)
          : prev.price,
    // Default is false; treat unset as empty so AI can mark used on first fill.
    isUsed:
      preferEmptyOnly && prev.isUsed
        ? prev.isUsed
        : data.isUsed === true,
  };
}

function saleItemUpdatePayload(
  values: AiReviewFormValues,
  currency: string
): UpdateBusinessItemPayload {
  const price = Number.parseFloat(values.price);
  const shippingPrice = parseShippingPrice(values.shippingPrice);
  return {
    name: values.name.trim() || undefined,
    description: values.description.trim() || undefined,
    price: !Number.isNaN(price) && price > 0 ? price : undefined,
    categoryName: values.categoryName.trim() || undefined,
    subCategoryName: values.subCategoryName.trim() || undefined,
    brandName: values.brandName.trim() || undefined,
    is_used: values.isUsed,
    pay_at_pickup_enabled: values.payAtPickupEnabled,
    shipping_enabled: values.shippingEnabled,
    ...(values.shippingEnabled && shippingPrice != null
      ? { shipping_price: shippingPrice, shipping_currency: currency }
      : {}),
  };
}

