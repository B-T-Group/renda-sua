import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Button,
  Chip,
  IconButton,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { KeyboardAwareScrollView } from '../../layout/KeyboardAwareScrollView';
import type {
  DuplicateCandidate,
  ImageItemSuggestionConfidence,
  ListingQualityScore,
  SuggestionFieldConfidence,
} from '../../../types/business/items';
import { useTheme } from '../../../contexts/ThemeContext';
import { ListingPreviewSheet } from '../ListingPreviewSheet';
import { NoticeBanner } from '../../common/NoticeBanner';
import { StatusPill } from '../../common/StatusPill';
import {
  ItemFormOptionDialog,
  type FormOption,
} from '../item-form/ItemFormOptionDialog';
import { fetchItemFormCategories } from '../../../services/businessItemFormService';
import type { ItemFormCategory } from '../../../types/business/itemForm';

type PickerKind = 'category' | 'subCategory' | null;

function PickerField({
  label,
  valueLabel,
  onPress,
  disabled,
}: {
  label: string;
  valueLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.pickerWrap}>
      <Text variant="labelMedium" style={styles.pickerLabel}>
        {label}
      </Text>
      <Button
        mode="outlined"
        onPress={onPress}
        disabled={disabled}
        contentStyle={styles.pickerBtn}
      >
        {valueLabel}
      </Button>
    </View>
  );
}

export interface AiReviewFormValues {
  name: string;
  description: string;
  categoryName: string;
  subCategoryName: string;
  brandName: string;
  price: string;
  quantity: string;
  locationId: string;
  isUsed: boolean;
  payAtPickupEnabled: boolean;
  shippingEnabled: boolean;
  shippingPrice: string;
}

export interface AddItemAiReviewStepProps {
  previewImageUri?: string | null;
  /** True when previewImageUri is the auto-applied AI cleaned photo. */
  previewIsEnhanced?: boolean;
  currency: string;
  aiLoading: boolean;
  aiError?: string | null;
  confidence?: ImageItemSuggestionConfidence | null;
  listingQuality?: ListingQualityScore | null;
  duplicateCandidates?: DuplicateCandidate[];
  categoryAlternates?: string[];
  initialValues: AiReviewFormValues;
  busy?: boolean;
  onChange: (values: AiReviewFormValues) => void;
  onContinue: () => void;
  onRetryAi?: () => void;
  onAddStockToDuplicate?: (itemId: string) => void;
  onPreviewOpened?: () => void;
}

function confidenceColors(
  level: SuggestionFieldConfidence | undefined,
  colors: {
    success: { main: string };
    warning: { main: string };
    text: { secondary: string };
    background: { paper: string };
  }
): { backgroundColor: string; textColor: string } {
  if (level === 'high') {
    return {
      backgroundColor: `${colors.success.main}22`,
      textColor: colors.success.main,
    };
  }
  if (level === 'low') {
    return {
      backgroundColor: `${colors.warning.main}22`,
      textColor: colors.warning.main,
    };
  }
  return {
    backgroundColor: colors.surface,
    textColor: colors.text.secondary,
  };
}

export function AddItemAiReviewStep({
  previewImageUri,
  previewIsEnhanced = false,
  currency,
  aiLoading,
  aiError,
  confidence,
  listingQuality,
  duplicateCandidates = [],
  categoryAlternates = [],
  initialValues,
  busy = false,
  onChange,
  onContinue,
  onRetryAi,
  onAddStockToDuplicate,
  onPreviewOpened,
}: AddItemAiReviewStepProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [values, setValues] = useState(initialValues);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [categories, setCategories] = useState<ItemFormCategory[]>([]);
  const [picker, setPicker] = useState<PickerKind>(null);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const cats = await fetchItemFormCategories();
        if (!cancelled) {
          setCategories(cats);
        }
      } catch {
        // Best-effort; create-new still works in the picker.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCategory = useMemo(
    () =>
      categories.find(
        (category) =>
          category.name.trim().toLowerCase() ===
          values.categoryName.trim().toLowerCase()
      ) ?? null,
    [categories, values.categoryName]
  );

  const categoryOptions = useMemo<FormOption[]>(
    () => categories.map((category) => ({ id: category.name, label: category.name })),
    [categories]
  );

  const subCategoryOptions = useMemo<FormOption[]>(
    () =>
      (selectedCategory?.item_sub_categories ?? []).map((sub) => ({
        id: sub.name,
        label: sub.name,
      })),
    [selectedCategory]
  );

  const patch = useCallback(
    (partial: Partial<AiReviewFormValues>) => {
      setValues((prev) => {
        const next = { ...prev, ...partial };
        onChange(next);
        return next;
      });
    },
    [onChange]
  );

  const pickerConfig = useMemo(() => {
    if (picker === 'category') {
      return {
        title: t('business.onboarding.firstSale.create.category', 'Category'),
        options: categoryOptions,
        selectedId: values.categoryName || null,
        allowClear: false,
        onSelect: (value: string) => {
          patch({ categoryName: value, subCategoryName: '' });
        },
        onCreateNew: (value: string) => {
          patch({ categoryName: value, subCategoryName: '' });
        },
      };
    }
    if (picker === 'subCategory') {
      return {
        title: t(
          'business.onboarding.firstSale.create.subCategory',
          'Subcategory'
        ),
        options: subCategoryOptions,
        selectedId: values.subCategoryName || null,
        allowClear: false,
        onSelect: (value: string) => patch({ subCategoryName: value }),
        onCreateNew: (value: string) => patch({ subCategoryName: value }),
      };
    }
    return null;
  }, [
    categoryOptions,
    patch,
    picker,
    subCategoryOptions,
    t,
    values.categoryName,
    values.subCategoryName,
  ]);

  const priceNum = Number.parseFloat(values.price);
  const canContinue =
    !busy &&
    !!values.name.trim() &&
    !Number.isNaN(priceNum) &&
    priceNum > 0;

  const qualityLabel = useMemo(() => {
    if (!listingQuality) return null;
    const map: Record<ListingQualityScore['label'], string> = {
      poor: t('business.onboarding.firstSale.quality.poor', 'Needs work'),
      fair: t('business.onboarding.firstSale.quality.fair', 'Fair'),
      good: t('business.onboarding.firstSale.quality.good', 'Good'),
      great: t('business.onboarding.firstSale.quality.great', 'Great'),
    };
    return map[listingQuality.label];
  }, [listingQuality, t]);

  const topDuplicate = duplicateCandidates[0];

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      avoidingViewStyle={styles.flex}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
    >
      <View
        style={[
          styles.hero,
          shadows.sm,
          {
            backgroundColor: colors.surface,
            borderColor: colors.divider,
            borderRadius: borderRadius.lg,
          },
        ]}
      >
        {previewImageUri ? (
          <Image source={{ uri: previewImageUri }} style={styles.heroImage} />
        ) : (
          <View
            style={[
              styles.heroImage,
              { backgroundColor: colors.pageBackground },
            ]}
          />
        )}
        {previewIsEnhanced ? (
          <View style={styles.enhancedBadge}>
            <StatusPill
              label={t('business.images.cleanup.cleaned', 'Enhanced')}
              backgroundColor={`${colors.primary.main}22`}
              textColor={colors.primary.main}
              icon="auto-fix"
              compact
            />
          </View>
        ) : null}
        {listingQuality ? (
          <View style={styles.qualityRow}>
            <StatusPill
              label={`${qualityLabel} · ${listingQuality.score}`}
              backgroundColor={
                listingQuality.score >= 70
                  ? `${colors.success.main}22`
                  : listingQuality.score >= 50
                    ? `${colors.warning.main}22`
                    : `${colors.error.main}22`
              }
              textColor={
                listingQuality.score >= 70
                  ? colors.success.main
                  : listingQuality.score >= 50
                    ? colors.warning.main
                    : colors.error.main
              }
              compact
            />
          </View>
        ) : null}
      </View>

      {aiLoading ? (
        <View style={[styles.aiBanner, { marginVertical: spacing.sm }]}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.secondary, marginLeft: spacing.sm }}
          >
            {t(
              'business.onboarding.firstSale.review.analyzing',
              'Filled from your photos — finishing details…'
            )}
          </Text>
        </View>
      ) : (
        <Text
          variant="labelLarge"
          style={{ color: colors.primary.main, marginVertical: spacing.sm }}
        >
          {t(
            'business.onboarding.firstSale.review.filledBanner',
            '✨ Filled from your photos — edit anything'
          )}
        </Text>
      )}

      {aiError ? (
        <NoticeBanner
          tone="warning"
          icon="alert-circle-outline"
          title={t(
            'business.onboarding.firstSale.review.aiFailed',
            "AI couldn't read this photo"
          )}
          message={aiError}
          style={{ marginBottom: spacing.sm }}
          actionLabel={t('common.retry', 'Retry')}
          onAction={onRetryAi}
        />
      ) : null}

      {topDuplicate ? (
        <NoticeBanner
          tone="info"
          icon="content-duplicate"
          title={t(
            'business.onboarding.firstSale.review.duplicateTitle',
            'Looks familiar'
          )}
          message={t(
            'business.onboarding.firstSale.review.duplicateBody',
            '"{{name}}" may already be in your store.',
            { name: topDuplicate.name }
          )}
          style={{ marginBottom: spacing.sm }}
          actionLabel={t(
            'business.onboarding.firstSale.review.addStockInstead',
            'Add stock instead'
          )}
          onAction={() => onAddStockToDuplicate?.(topDuplicate.itemId)}
        />
      ) : null}

      <View style={styles.nameRow}>
        <TextInput
          mode="outlined"
          label={t('business.onboarding.firstSale.create.name', 'Product name')}
          value={values.name}
          onChangeText={(name) => patch({ name })}
          style={[styles.flex, { backgroundColor: colors.surface }]}
        />
        {confidence?.name && confidence.name !== 'high' ? (
          <StatusPill
            label={t(
              'business.onboarding.firstSale.review.confirm',
              'Confirm'
            )}
            {...confidenceColors(confidence.name, colors)}
            compact
            style={{ marginLeft: spacing.xs }}
          />
        ) : null}
      </View>

      <TextInput
        mode="outlined"
        label={t('business.onboarding.firstSale.create.price', 'Price')}
        value={values.price}
        onChangeText={(price) => patch({ price })}
        keyboardType="decimal-pad"
        left={<TextInput.Affix text={currency} />}
        style={{
          marginTop: spacing.sm,
          backgroundColor: colors.surface,
        }}
      />

      <View style={[styles.chipRow, { marginTop: spacing.md }]}>
        {categoryAlternates[0] ? (
          <Chip
            compact
            onPress={() =>
              patch({ categoryName: categoryAlternates[0], subCategoryName: '' })
            }
            style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
          >
            {t(
              'business.onboarding.firstSale.review.categoryAlternate',
              'Try: {{name}}',
              { name: categoryAlternates[0] }
            )}
          </Chip>
        ) : null}
        <Chip compact selected={!!values.brandName} style={{ marginBottom: spacing.xs }}>
          {values.brandName ||
            t('business.onboarding.firstSale.create.brand', 'Brand')}
        </Chip>
      </View>

      <PickerField
        label={t('business.onboarding.firstSale.create.category', 'Category')}
        valueLabel={
          values.categoryName ||
          t('business.items.selectCategory', 'Select category')
        }
        onPress={() => setPicker('category')}
        disabled={busy}
      />
      <PickerField
        label={t(
          'business.onboarding.firstSale.create.subCategory',
          'Subcategory'
        )}
        valueLabel={
          values.subCategoryName ||
          t('business.items.selectSubCategory', 'Select sub category')
        }
        onPress={() => setPicker('subCategory')}
        disabled={busy || !values.categoryName.trim()}
      />
      <TextInput
        mode="outlined"
        label={t('business.onboarding.firstSale.create.brand', 'Brand')}
        value={values.brandName}
        onChangeText={(brandName) => patch({ brandName })}
        style={{ marginTop: spacing.sm, backgroundColor: colors.surface }}
      />

      <View style={[styles.descHeader, { marginTop: spacing.md }]}>
        <Text variant="titleSmall" style={{ color: colors.text.primary }}>
          {t(
            'business.onboarding.firstSale.create.description',
            'Description'
          )}
        </Text>
        <IconButton
          icon={descExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          onPress={() => setDescExpanded((v) => !v)}
        />
      </View>
      {(descExpanded || !values.description) && (
        <TextInput
          mode="outlined"
          multiline
          numberOfLines={4}
          value={values.description}
          onChangeText={(description) => patch({ description })}
          style={{ backgroundColor: colors.surface }}
        />
      )}
      {!descExpanded && !!values.description ? (
        <Text
          variant="bodyMedium"
          numberOfLines={2}
          style={{ color: colors.text.secondary }}
        >
          {values.description}
        </Text>
      ) : null}

      <View
        style={[
          styles.usedRow,
          {
            marginTop: spacing.md,
            backgroundColor: colors.surface,
            borderColor: colors.divider,
          },
        ]}
      >
        <Text
          variant="bodyLarge"
          style={{ flex: 1, color: colors.text.primary, minWidth: 0 }}
        >
          {t(
            'business.onboarding.firstSale.review.isUsed',
            'This item is used'
          )}
        </Text>
        <Switch
          value={values.isUsed}
          onValueChange={(isUsed) => patch({ isUsed })}
        />
      </View>

      <Button
        mode="outlined"
        icon="eye"
        style={{ marginTop: spacing.lg }}
        onPress={() => {
          onPreviewOpened?.();
          setPreviewOpen(true);
        }}
      >
        {t('business.onboarding.firstSale.review.preview', 'Preview listing')}
      </Button>
      <Button
        mode="contained"
        style={{ marginTop: spacing.sm }}
        disabled={!canContinue}
        onPress={onContinue}
      >
        {t(
          'business.onboarding.firstSale.review.continuePublish',
          'Continue to publish'
        )}
      </Button>

      <ListingPreviewSheet
        visible={previewOpen}
        onDismiss={() => setPreviewOpen(false)}
        model={{
          title: values.name,
          imageUri: previewImageUri,
          priceLine:
            values.price.trim() !== '' ? `${currency} ${values.price}` : null,
          locationLine: null,
          metaLines: [],
        }}
      />

      {pickerConfig ? (
        <ItemFormOptionDialog
          visible={picker != null}
          title={pickerConfig.title}
          options={pickerConfig.options}
          selectedId={pickerConfig.selectedId}
          allowClear={pickerConfig.allowClear}
          onDismiss={() => setPicker(null)}
          onSelect={(id) => {
            pickerConfig.onSelect(id);
            setPicker(null);
          }}
          onCreateNew={
            pickerConfig.onCreateNew
              ? (value) => {
                  pickerConfig.onCreateNew?.(value);
                  setPicker(null);
                }
              : undefined
          }
        />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { borderWidth: 1, overflow: 'hidden' },
  heroImage: { width: '100%', height: 180, resizeMode: 'cover' },
  qualityRow: { position: 'absolute', bottom: 8, left: 8 },
  enhancedBadge: { position: 'absolute', top: 8, right: 8 },
  aiBanner: { flexDirection: 'row', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  pickerWrap: { marginTop: 12, marginBottom: 4 },
  pickerLabel: { marginBottom: 4 },
  pickerBtn: { justifyContent: 'flex-start' },
  descHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  usedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
