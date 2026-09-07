import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal } from '@/components/common/AppModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfileMe } from '@/hooks/useProfileMe';
import { useVariantAiAutofill } from '@/hooks/business/useVariantAiAutofill';
import { businessApi } from '@/services/businessApi';
import { uploadBusinessImageAssets, uploadBusinessImagesWithMeta } from '@/services/businessImageUpload';
import type { BusinessCatalogItem } from '@/types/business/items';
import type { ItemVariant, ItemVariantImage, ItemVariantInput } from '@/types/business/itemVariant';
import type { ImageCleanupKindSelection } from '@/types/imageCleanup';
import {
  buildCleanupSelections,
  removeCleanupKindAt,
  toggleCleanupKindAt,
  type CleanupKindsByIndex,
} from '@/utils/imageCleanupKinds';
import { VariantDetailsStep, type VariantDraft } from './VariantDetailsStep';
import { VariantImagesStep } from './VariantImagesStep';

interface Props {
  visible: boolean;
  item: BusinessCatalogItem;
  businessId: string;
  variant?: ItemVariant | null;
  onDismiss: () => void;
  onSaved: () => void;
  onMessage: (message: string) => void;
}

const emptyDraft = (): VariantDraft => ({
  name: '',
  sku: '',
  price: '',
  weight: '',
  weightUnit: 'g',
  dimensions: '',
  color: '',
  isActive: true,
  isDefault: false,
});

function draftForVariant(variant?: ItemVariant | null): VariantDraft {
  if (!variant) return emptyDraft();
  return {
    name: variant.name,
    sku: variant.sku ?? '',
    price: variant.price != null ? String(variant.price) : '',
    weight: variant.weight != null ? String(variant.weight) : '',
    weightUnit: (variant.weight_unit ?? 'g').toLowerCase(),
    dimensions: variant.dimensions ?? '',
    color: variant.color ?? '',
    isActive: variant.is_active !== false,
    isDefault: variant.is_default === true,
  };
}

const optionalNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function inputFromDraft(draft: VariantDraft): ItemVariantInput {
  const weight = optionalNumber(draft.weight);
  const unit = draft.weightUnit.trim().toLowerCase();
  return {
    name: draft.name.trim(),
    sku: draft.sku.trim() || null,
    price: optionalNumber(draft.price),
    weight,
    weight_unit: weight != null && unit ? unit : null,
    dimensions: draft.dimensions.trim() || null,
    color: draft.color.trim() || null,
    is_active: draft.isActive,
    is_default: draft.isDefault,
  };
}

export function VariantWizard(props: Props) {
  const { visible, item, businessId, variant, onDismiss, onSaved, onMessage } = props;
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { me, refetch: refetchMe } = useProfileMe();
  const aiTokensRemaining = me?.business?.ai_tokens ?? 0;

  const [step, setStep] = useState<'images' | 'details'>('images');
  const [draft, setDraft] = useState(emptyDraft);
  const [assets, setAssets] = useState<ImagePickerAsset[]>([]);
  const [cleanupKinds, setCleanupKinds] = useState<CleanupKindsByIndex>({});
  const [saving, setSaving] = useState(false);
  const [uploadingForAi, setUploadingForAi] = useState(false);
  const [preUploaded, setPreUploaded] = useState<
    Array<{ id: string; image_url: string }>
  >([]);
  const { loading: aiLoading, filled: aiFilled, reset: resetAi, lockFields, fetchAndApply } =
    useVariantAiAutofill();

  useEffect(() => {
    if (!visible) return;
    setStep('images');
    setDraft(draftForVariant(variant));
    setAssets([]);
    setCleanupKinds({});
    setSaving(false);
    setUploadingForAi(false);
    setPreUploaded([]);
    resetAi();
    void refetchMe();
  }, [variant, visible, refetchMe, resetAi]);

  useEffect(() => {
    if (!visible || step !== 'details' || variant) return;
    const imageIds = preUploaded.map((row) => row.id);
    if (!imageIds.length) return;
    void fetchAndApply(item.id, imageIds, (updater) => {
      setDraft((current) => updater(current));
    });
  }, [visible, step, variant, item.id, preUploaded, fetchAndApply]);

  const goToDetails = async () => {
    if (variant) {
      setStep('details');
      return;
    }
    if (!assets.length) {
      setPreUploaded([]);
      resetAi();
      setStep('details');
      return;
    }
    setUploadingForAi(true);
    try {
      const uploaded = await uploadBusinessImagesWithMeta(assets, businessId);
      setPreUploaded(uploaded);
      resetAi();
      setStep('details');
    } catch (caught: unknown) {
      onMessage(
        caught instanceof Error
          ? caught.message
          : t('business.variants.uploadError', 'Could not upload photos')
      );
    } finally {
      setUploadingForAi(false);
    }
  };

  const finish = () => {
    onSaved();
    onDismiss();
  };

  const deleteExisting = async (imageId: string) => {
    try {
      await businessApi.variants.deleteImage(imageId);
      onMessage(t('business.variants.imageDeleted', 'Variant photo removed'));
      onSaved();
    } catch (caught: unknown) {
      onMessage(caught instanceof Error ? caught.message : t('common.error', 'Something went wrong'));
    }
  };

  const setAssetsAndKinds = useCallback((next: ImagePickerAsset[]) => {
    setPreUploaded([]);
    resetAi();
    setAssets((prev) => {
      if (next.length >= prev.length) return next;
      const removed = prev.findIndex(
        (a, i) => !next[i] || next[i].uri !== a.uri
      );
      if (removed >= 0) {
        queueMicrotask(() => {
          setCleanupKinds((kinds) => removeCleanupKindAt(kinds, removed));
        });
      }
      return next;
    });
  }, [resetAi]);

  const setCleanupKindAt = useCallback(
    (index: number, kind: ImageCleanupKindSelection) => {
      setCleanupKinds((prev) => {
        if (kind === null) return { ...prev, [index]: null };
        return toggleCleanupKindAt(prev, index, kind, aiTokensRemaining);
      });
    },
    [aiTokensRemaining]
  );

  const uploadImages = async (variantId: string): Promise<ItemVariantImage[]> => {
    const sources =
      preUploaded.length > 0
        ? preUploaded.map((row) => ({ image_url: row.image_url }))
        : await uploadBusinessImageAssets(assets, businessId);
    const created: ItemVariantImage[] = [];
    for (let index = 0; index < sources.length; index++) {
      const response = await businessApi.variants.addImage(variantId, {
        image_url: sources[index].image_url,
        display_order: (variant?.item_variant_images?.length ?? 0) + index,
        is_primary: !variant?.item_variant_images?.length && index === 0,
      });
      created.push(response.data);
    }
    return created;
  };

  const enqueueCleanup = async (
    variantId: string,
    createdImages: ItemVariantImage[]
  ) => {
    const ids = createdImages.map((img) => img.id);
    const selections = buildCleanupSelections(ids, cleanupKinds);
    if (!selections.length) return;
    try {
      await businessApi.aiImageCleanup.requestForVariant(variantId, {
        selections,
      });
      onMessage(
        t(
          'business.images.asyncCleanup.started',
          'Photo cleanup started — we’ll notify you when ready.'
        )
      );
    } catch (caught: unknown) {
      onMessage(
        caught instanceof Error
          ? caught.message
          : t('business.images.asyncCleanup.startFailed', 'Could not start cleanup')
      );
    }
  };

  const save = async () => {
    if (!draft.name.trim()) {
      onMessage(t('business.variants.nameRequired', 'Variant name is required'));
      return;
    }
    setSaving(true);
    try {
      const response = variant
        ? await businessApi.variants.update(variant.id, inputFromDraft(draft))
        : await businessApi.variants.create(item.id, inputFromDraft(draft));
      const variantId = response.data.id;
      const hasPhotos = preUploaded.length > 0 || assets.length > 0;
      const createdImages = hasPhotos ? await uploadImages(variantId) : [];
      onMessage(t('business.variants.saved', 'Variant saved'));
      if (createdImages.length) {
        await enqueueCleanup(variantId, createdImages);
      }
      finish();
    } catch (caught: unknown) {
      onMessage(
        caught instanceof Error
          ? caught.message
          : t('business.variants.saveError', 'Could not save variant')
      );
    } finally {
      setSaving(false);
    }
  };

  const stepLabel =
    step === 'images'
      ? t('business.variants.stepImages', 'Step 1 of 2 · Photos')
      : t('business.variants.stepDetails', 'Step 2 of 2 · Details');

  return (
    <AppModal
      visible={visible}
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.pageBackground }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md }}>
          <Text variant="headlineSmall">
            {variant
              ? t('business.variants.editTitle', 'Edit variant')
              : t('business.variants.addTitle', 'Add variant')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xs }}>
            {stepLabel}
          </Text>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.lg }}
        >
          {step === 'images' ? (
            <VariantImagesStep
              existingImages={variant?.item_variant_images ?? []}
              selectedAssets={assets}
              onSelectedAssetsChange={setAssetsAndKinds}
              onDeleteExisting={(id) => void deleteExisting(id)}
              aiTokens={aiTokensRemaining}
              cleanupKinds={cleanupKinds}
              onCleanupKindChange={setCleanupKindAt}
              onUnsupportedFormat={() =>
                onMessage(
                  t(
                    'business.images.upload.unsupportedFormat',
                    'Some photos were skipped. Please use JPEG, PNG, or WebP.'
                  )
                )
              }
            />
          ) : (
            <VariantDetailsStep
              item={item}
              value={draft}
              onChange={setDraft}
              aiLoading={aiLoading}
              aiFilled={aiFilled}
              onFieldLock={lockFields}
            />
          )}
        </ScrollView>
        <View style={[styles.actions, { padding: spacing.md, paddingBottom: insets.bottom + spacing.sm }]}>
          <Button mode="outlined" onPress={step === 'images' ? onDismiss : () => setStep('images')}>
            {step === 'images' ? t('common.cancel', 'Cancel') : t('common.back', 'Back')}
          </Button>
          <Button
            mode="contained"
            loading={saving || uploadingForAi}
            disabled={saving || uploadingForAi}
            onPress={
              step === 'images' ? () => void goToDetails() : () => void save()
            }
          >
            {step === 'images' ? t('common.next', 'Next') : t('common.save', 'Save')}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
});
