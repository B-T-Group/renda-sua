import { useCallback, useEffect, useState } from 'react';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert } from 'react-native';
import { rentalItemImagesApi } from '../../services/rentalItemImagesApi';
import { uploadRentalImages } from '../../services/rentalImageUpload';
import { rentalsApi } from '../../services/rentalsApi';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type {
  CreatedRentalItemSummary,
  RentalOperationMode,
} from '../../types/rentals';
import { defaultWeeklyAvailability } from '../../utils/rentals';
import {
  buildListingWizardDraft,
  clearListingWizardDraft,
  draftHasRestorableContent,
  readListingWizardDraft,
  writeListingWizardDraft,
} from '../../utils/listingWizardDraftStorage';
import {
  filterSupportedImageAssets,
  IMAGE_LIBRARY_PICKER_OPTIONS,
} from '../../utils/supportedImageFormats';
import {
  buildCleanupSelections,
  removeCleanupKindAt,
  reorderCleanupKindsToMain,
  toggleCleanupKindAt,
  type CleanupKindsByIndex,
} from '../../utils/imageCleanupKinds';
import type { ImageCleanupKindSelection } from '../../types/imageCleanup';
import { useProfileMe } from '../useProfileMe';
import { useImageValidation } from './useImageValidation';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export type AddRentalDetailsForm = {
  name: string;
  rental_category_id: string;
  description?: string;
  currency?: string;
  tags?: string[];
  operation_mode: RentalOperationMode;
};

export type AddRentalLocationForm = {
  locationId: string;
  locationName?: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  security_deposit_amount?: number;
  units_available: number;
  pickup_instructions?: string;
  dropoff_instructions?: string;
};

export function useBusinessAddRentalFromImage() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { me, loading: profileLoading, refetch: refetchMe } = useProfileMe();
  const businessId = me?.business?.id;
  const aiTokensRemaining = me?.business?.ai_tokens ?? 0;

  const [step, setStep] = useState(0);
  const [assets, setAssets] = useState<ImagePickerAsset[]>([]);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [createdItem, setCreatedItem] = useState<CreatedRentalItemSummary | null>(null);
  const [locationName, setLocationName] = useState<string | undefined>();
  const [savedAsDraft, setSavedAsDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [cleanupKinds, setCleanupKinds] = useState<CleanupKindsByIndex>({});

  const { validateAssets, metadataFromResults, validating, lastResults } =
    useImageValidation();
  const minPhotos = 2;

  useEffect(() => {
    void refetchMe();
  }, [refetchMe]);

  useEffect(() => {
    void (async () => {
      const draft = await readListingWizardDraft('rental');
      if (!draft || !draftHasRestorableContent(draft)) return;
      setStep(draft.step);
      setImageIds(draft.imageIds ?? []);
      if (draft.createdItemId) {
        setCreatedItem({
          id: draft.createdItemId,
          name: '',
          currency: 'XAF',
          operation_mode: 'business_operated',
        });
      }
      if (draft.assetUris?.length) {
        setAssets(draft.assetUris.map((uri) => ({ uri, width: 0, height: 0 })));
      }
      if (draft.cleanupKinds) {
        setCleanupKinds(
          Object.fromEntries(
            Object.entries(draft.cleanupKinds).map(([k, v]) => [Number(k), v])
          )
        );
      }
    })();
  }, []);

  useEffect(() => {
    const draft = buildListingWizardDraft({
      kind: 'rental',
      step,
      imageIds,
      createdItemId: createdItem?.id,
      assetUris: assets.map((a) => a.uri).filter(Boolean),
      cleanupKinds: Object.fromEntries(
        Object.entries(cleanupKinds).map(([k, v]) => [k, v])
      ),
    });
    if (!draft) return;
    void writeListingWizardDraft(draft);
  }, [step, imageIds, createdItem?.id, assets, cleanupKinds]);

  const setCleanupKindAt = useCallback(
    (index: number, kind: ImageCleanupKindSelection) => {
      setCleanupKinds((prev) => {
        if (kind === null) return { ...prev, [index]: null };
        return toggleCleanupKindAt(prev, index, kind, aiTokensRemaining);
      });
    },
    [aiTokensRemaining]
  );

  const appendAssets = useCallback((newAssets: ImagePickerAsset[]) => {
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
    setAssets((prev) => [...prev, ...supported]);
  }, [t]);

  const pickImages = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setSnackbar(
        t(
          'business.rentals.wizard.upload.photoPermissionDenied',
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
    if (!result.canceled && result.assets.length) appendAssets(result.assets);
  }, [appendAssets, t]);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setSnackbar(
        t(
          'business.rentals.wizard.upload.cameraPermissionDenied',
          'Camera permission is required'
        )
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      ...IMAGE_LIBRARY_PICKER_OPTIONS,
      base64: false,
    });
    if (!result.canceled && result.assets.length) appendAssets(result.assets);
  }, [appendAssets, t]);

  const removeAssetAt = useCallback((index: number) => {
    setAssets((prev) => prev.filter((_, i) => i !== index));
    setCleanupKinds((prev) => removeCleanupKindAt(prev, index));
  }, []);

  const setMainAt = useCallback((index: number) => {
    if (index <= 0) return;
    setAssets((prev) => {
      const next = [...prev];
      const [picked] = next.splice(index, 1);
      next.unshift(picked);
      return next;
    });
    setCleanupKinds((prev) => reorderCleanupKindsToMain(prev, index));
  }, []);

  const enqueueEnhancements = async (ids: string[]) => {
    const selections = buildCleanupSelections(ids, cleanupKinds);
    if (!selections.length) return;
    // Rental API is per-image today; backend may later batch into one job.
    for (const sel of selections) {
      try {
        await rentalItemImagesApi.cleanup(sel.imageId, { kind: sel.kind });
      } catch {
        // non-fatal — listing can continue without enhancement
      }
    }
  };

  const uploadAndContinue = useCallback(async () => {
    if (profileLoading) {
      setSnackbar(t('common.loading', 'Loading…'));
      return;
    }
    if (!businessId) {
      setSnackbar(
        t(
          'business.rentals.wizard.upload.businessRequired',
          'Your business profile must be loaded before uploading photos.'
        )
      );
      return;
    }
    if (assets.length < minPhotos) {
      setSnackbar(
        t('business.images.validation.minPhotos', 'Add at least {{count}} photos to continue.', {
          count: minPhotos,
        })
      );
      return;
    }
    setBusy(true);
    try {
      const validation = await validateAssets(assets);
      const meta = metadataFromResults(validation.results);
      const ids = await uploadRentalImages(assets, businessId, meta);
      setImageIds(ids);
      setStep(1);
      setSnackbar(
        t('business.rentals.wizard.upload.success', 'Images uploaded successfully')
      );
    } catch (e: unknown) {
      setSnackbar(
        e instanceof Error
          ? e.message
          : t('business.rentals.wizard.upload.error', 'Failed to upload images')
      );
    } finally {
      setBusy(false);
    }
  }, [
    assets,
    businessId,
    metadataFromResults,
    minPhotos,
    profileLoading,
    t,
    validateAssets,
  ]);

  const createItem = useCallback(
    async (form: AddRentalDetailsForm) => {
      const primaryId = imageIds[0];
      if (!primaryId || !form.name.trim() || !form.rental_category_id) return;
      setBusy(true);
      try {
        const res = await rentalItemImagesApi.createRentalFromImage({
          mode: 'manual',
          imageId: primaryId,
          name: form.name.trim(),
          rental_category_id: form.rental_category_id,
          description: form.description?.trim() || undefined,
          currency: form.currency?.trim() || undefined,
          tags: form.tags?.length ? form.tags : undefined,
          is_active: false,
          operation_mode: form.operation_mode,
        });
        const itemId = res.data?.item?.id;
        if (!res.success || !itemId) {
          throw new Error(res.error || 'Failed to create rental item');
        }
        await rentalsApi.updateBusinessItem(itemId, {
          operation_mode: form.operation_mode,
        });
        const extraIds = imageIds.slice(1);
        for (let i = 0; i < extraIds.length; i++) {
          await rentalItemImagesApi.associateRentalItem(extraIds[i], itemId);
          await rentalItemImagesApi.update(extraIds[i], { display_order: i + 1 });
        }
        await rentalItemImagesApi.update(primaryId, { display_order: 0 });
        await enqueueEnhancements(imageIds);
        setCreatedItem({
          id: itemId,
          name: form.name.trim(),
          currency: form.currency?.trim() || 'XAF',
          operation_mode: form.operation_mode,
        });
        setStep(2);
      } catch (e: unknown) {
        setSnackbar(
          e instanceof Error
            ? e.message
            : t('business.rentals.wizard.createFailed', 'Failed to create rental')
        );
      } finally {
        setBusy(false);
      }
    },
    // enqueueEnhancements closes over cleanupKinds
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aiTokensRemaining, cleanupKinds, imageIds, t]
  );

  const finishWithLocation = useCallback(
    async (form: AddRentalLocationForm, publish: boolean) => {
      if (!createdItem) return;
      setBusy(true);
      try {
        const day =
          form.base_price_per_day > 0
            ? form.base_price_per_day
            : form.base_price_per_hour * 12;
        const created = await rentalsApi.createBusinessListing({
          rental_item_id: createdItem.id,
          business_location_id: form.locationId,
          base_price_per_hour: form.base_price_per_hour,
          base_price_per_day: day,
          ...(form.security_deposit_amount != null &&
          Number.isFinite(form.security_deposit_amount)
            ? { security_deposit_amount: form.security_deposit_amount }
            : {}),
          units_available: Math.max(1, Math.floor(form.units_available) || 1),
          pickup_instructions: form.pickup_instructions?.trim() || undefined,
          dropoff_instructions: form.dropoff_instructions?.trim() || undefined,
          weekly_availability: defaultWeeklyAvailability(),
        });
        const listingId = created.data?.id;
        if (!listingId) {
          throw new Error(
            t('business.rentals.wizard.listingFailed', 'Could not create listing')
          );
        }
        if (publish) await rentalsApi.publishBusinessListing(listingId);
        await rentalsApi.updateBusinessItem(createdItem.id, { is_active: true });
        setLocationName(form.locationName);
        setSavedAsDraft(!publish);
        setStep(3);
        await clearListingWizardDraft('rental');
      } catch (e: unknown) {
        setSnackbar(
          e instanceof Error
            ? e.message
            : t('business.rentals.wizard.listingFailed', 'Could not create listing')
        );
      } finally {
        setBusy(false);
      }
    },
    [createdItem, t]
  );

  const goBack = useCallback(() => {
    if (step === 3) {
      navigation.goBack();
      return;
    }
    if (step === 2) {
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(0);
      return;
    }
    if (assets.length === 0) {
      void clearListingWizardDraft('rental');
      navigation.goBack();
      return;
    }
    Alert.alert(
      t('business.rentals.wizard.exitTitle', 'Leave?'),
      t(
        'business.rentals.wizard.exitBodyWithDraft',
        'Your photos are saved as a draft. Leave anyway?'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('business.rentals.wizard.exitLeave', 'Leave'),
          style: 'destructive',
          onPress: () => {
            const draft = buildListingWizardDraft({
              kind: 'rental',
              step,
              imageIds,
              createdItemId: createdItem?.id,
              assetUris: assets.map((a) => a.uri).filter(Boolean),
            });
            if (draft) void writeListingWizardDraft(draft);
            navigation.goBack();
          },
        },
      ]
    );
  }, [assets, createdItem?.id, imageIds, navigation, step, t]);

  const dismissSnackbar = useCallback(() => setSnackbar(null), []);

  const resetWizard = useCallback(() => {
    setStep(0);
    setAssets([]);
    setImageIds([]);
    setCreatedItem(null);
    setLocationName(undefined);
    setSavedAsDraft(false);
    setBusy(false);
    setSnackbar(null);
    setCleanupKinds({});
    void clearListingWizardDraft('rental');
  }, []);

  const canContinueUpload =
    !profileLoading && !!businessId && assets.length >= minPhotos && !busy && !validating;

  return {
    step,
    assets,
    imageIds,
    createdItem,
    locationName,
    savedAsDraft,
    busy: busy || validating,
    snackbar,
    businessId,
    profileLoading,
    canContinueUpload,
    validationResults: lastResults,
    minPhotos,
    aiTokensRemaining,
    cleanupKinds,
    setCleanupKindAt,
    buyTokens: () => navigation.navigate('BusinessAiTokens'),
    pickImages,
    takePhoto,
    removeAssetAt,
    setMainAt,
    uploadAndContinue,
    createItem,
    finishWithLocation,
    goBack,
    dismissSnackbar,
    resetWizard,
    navigation,
  };
}
