import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { KeyboardAwareScrollView } from '../../layout/KeyboardAwareScrollView';
import {
  getOtherRentalCategoryId,
  useRentalCategories,
} from '../../../hooks/useRentalCategories';
import { useSupportedCurrencies } from '../../../hooks/business/useSupportedCurrencies';
import { rentalItemImagesApi } from '../../../services/rentalItemImagesApi';
import type { RentalOperationMode } from '../../../types/rentals';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  ItemFormOptionDialog,
  type FormOption,
} from '../item-form/ItemFormOptionDialog';
import type { AddRentalDetailsForm } from '../../../hooks/business/useBusinessAddRentalFromImage';

function rentalFormHasValues(
  name: string,
  description: string,
  tagsText: string,
  categoryIsDefaultOther: boolean
): boolean {
  return (
    name.trim() !== '' ||
    description.trim() !== '' ||
    tagsText.trim() !== '' ||
    !categoryIsDefaultOther
  );
}

export interface AddRentalDetailsStepProps {
  imageIds: string[];
  busy: boolean;
  onSubmit: (form: AddRentalDetailsForm) => void;
}

type PickerKind = 'category' | null;

export function AddRentalDetailsStep({
  imageIds,
  busy,
  onSubmit,
}: AddRentalDetailsStepProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { categories, createCategory } = useRentalCategories();
  const { defaultCurrency } = useSupportedCurrencies();

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [operationMode, setOperationMode] =
    useState<RentalOperationMode>('business_operated');
  const [picker, setPicker] = useState<PickerKind>(null);
  const [sugLoading, setSugLoading] = useState(false);
  const [sugError, setSugError] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState(false);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const aiAttemptedKey = useRef<string | null>(null);
  const fieldsRef = useRef({
    name: '',
    description: '',
    tagsText: '',
    categoryId: '',
  });
  const otherCategoryId = getOtherRentalCategoryId(categories);

  fieldsRef.current = { name, description, tagsText, categoryId };

  useEffect(() => {
    if (defaultCurrency) setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  useEffect(() => {
    if (categoryId || categories.length === 0) return;
    if (otherCategoryId) setCategoryId(otherCategoryId);
  }, [categoryId, categories.length, otherCategoryId]);

  const applyAi = useCallback(
    async (overwrite: boolean) => {
      const primary = imageIds[0];
      if (!primary) return;
      setSugLoading(true);
      setSugError(null);
      try {
        const res = await rentalItemImagesApi.rentalFromImageSuggestions(primary);
        const data = res.data;
        if (!res.success || !data) {
          throw new Error(res.error || 'No suggestions');
        }
        const current = fieldsRef.current;
        let applied = false;
        if (data.name && (overwrite || !current.name.trim())) {
          setName(data.name);
          applied = true;
        }
        if (data.description && (overwrite || !current.description.trim())) {
          setDescription(data.description);
          applied = true;
        }
        if (
          data.rental_category_id &&
          (overwrite ||
            !current.categoryId ||
            current.categoryId === otherCategoryId)
        ) {
          setCategoryId(data.rental_category_id);
          applied = true;
        }
        if (data.suggested_tags?.length && (overwrite || !current.tagsText.trim())) {
          setTagsText(data.suggested_tags.join(', '));
          applied = true;
        }
        if (applied) setAiFilled(true);
      } catch (e: unknown) {
        setSugError(
          e instanceof Error
            ? e.message
            : t(
                'business.rentals.wizard.details.aiError',
                'Could not analyze your photo'
              )
        );
      } finally {
        setSugLoading(false);
      }
    },
    [imageIds, otherCategoryId, t]
  );

  useEffect(() => {
    const key = imageIds[0] ?? '';
    if (!key || aiAttemptedKey.current === key) return;
    aiAttemptedKey.current = key;
    void applyAi(false);
  }, [applyAi, imageIds]);

  const onAiPress = useCallback(() => {
    const isDefaultOther = !categoryId || categoryId === otherCategoryId;
    if (rentalFormHasValues(name, description, tagsText, isDefaultOther)) {
      setOverwriteOpen(true);
      return;
    }
    void applyAi(false);
  }, [applyAi, categoryId, description, name, otherCategoryId, tagsText]);

  const handleCreateCategory = useCallback(
    async (nameValue: string) => {
      try {
        const created = await createCategory(nameValue);
        setCategoryId(created.id);
        setPicker(null);
      } catch {
        // keep picker closed; user can retry
      }
    },
    [createCategory]
  );

  const categoryOptions: FormOption[] = categories.map((c) => ({
    id: c.id,
    label: c.name,
  }));
  const selectedCategory = categories.find((c) => c.id === categoryId);

  const canSubmit = !!name.trim() && !!categoryId && !busy;

  const modes: Array<{
    id: RentalOperationMode;
    title: string;
    body: string;
  }> = [
    {
      id: 'business_operated',
      title: t(
        'business.rentals.modes.operatedTitle',
        'Operated at your location'
      ),
      body: t(
        'business.rentals.modes.operatedBody',
        'You run the rental with the customer on-site (vehicles, engines, operator gear).'
      ),
    },
    {
      id: 'take_home',
      title: t('business.rentals.modes.takeHomeTitle', 'Take-home'),
      body: t(
        'business.rentals.modes.takeHomeBody',
        'Customer picks up, uses off-site, and returns by the booked end time (tools, small equipment).'
      ),
    },
  ];

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      avoidingViewStyle={styles.flex}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      wrapAvoidingView={false}
    >
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginBottom: spacing.md }}
      >
        {t(
          'business.rentals.wizard.details.hint',
          'We fill details from your photos automatically. Edit anything before continuing.'
        )}
      </Text>

      {aiFilled && !sugLoading ? (
        <Text
          variant="labelMedium"
          style={{
            color: colors.primary.main,
            backgroundColor: colors.primaryTint,
            marginBottom: spacing.sm,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: borderRadius.sm,
            overflow: 'hidden',
          }}
        >
          {t(
            'business.rentals.wizard.details.aiFilledBanner',
            'Filled from your photos — edit anything'
          )}
        </Text>
      ) : null}
      {sugError ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.error.main, marginBottom: spacing.sm }}
        >
          {sugError}
        </Text>
      ) : null}

      <Button
        mode="outlined"
        icon="auto-fix"
        loading={sugLoading}
        disabled={busy || sugLoading || !imageIds[0]}
        onPress={onAiPress}
        style={{ marginBottom: spacing.md }}
      >
        {sugLoading
          ? t('business.rentals.wizard.details.aiWorking', 'Analyzing your image…')
          : aiFilled
            ? t('business.rentals.wizard.details.rerunAi', 'Re-run AI')
            : t('business.rentals.wizard.details.aiFill', 'Fill with AI')}
      </Button>

      <TextInput
        label={t('business.rentals.wizard.details.name', 'Name')}
        value={name}
        onChangeText={setName}
        mode="outlined"
        disabled={busy}
        style={styles.field}
      />

      <View style={styles.field}>
        <Text
          variant="labelMedium"
          style={{ marginBottom: 4, color: colors.text.secondary }}
        >
          {t('business.rentals.wizard.details.category', 'Category')}
        </Text>
        <Button
          mode="outlined"
          onPress={() => setPicker('category')}
          disabled={busy}
        >
          {selectedCategory?.name ??
            t(
              'business.rentals.wizard.details.selectCategory',
              'Select category'
            )}
        </Button>
      </View>

      <Text
        variant="labelMedium"
        style={{ marginBottom: spacing.sm, color: colors.text.secondary }}
      >
        {t(
          'business.rentals.wizard.details.mode',
          'How does this rental work?'
        )}
      </Text>
      {modes.map((m) => {
        const selected = operationMode === m.id;
        return (
          <Pressable
            key={m.id}
            onPress={() => setOperationMode(m.id)}
            disabled={busy}
            style={[
              styles.modeCard,
              {
                borderRadius: borderRadius.md,
                borderColor: selected ? colors.primary.main : colors.divider,
                backgroundColor: selected
                  ? colors.primaryTint
                  : colors.surface,
              },
            ]}
          >
            <Text variant="titleSmall" style={{ color: colors.text.primary }}>
              {m.title}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: colors.text.secondary, marginTop: 4 }}
            >
              {m.body}
            </Text>
          </Pressable>
        );
      })}

      <TextInput
        label={t('business.rentals.wizard.details.description', 'Description')}
        value={description}
        onChangeText={setDescription}
        mode="outlined"
        multiline
        numberOfLines={3}
        disabled={busy}
        style={styles.field}
      />

      <TextInput
        label={t('business.rentals.wizard.details.currency', 'Currency')}
        value={currency || (defaultCurrency ?? '—')}
        mode="outlined"
        editable={false}
        disabled
        style={styles.field}
      />
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginTop: -6, marginBottom: 10 }}
      >
        {t(
          'business.items.currencyLockedToCountry',
          'Locked to your business country'
        )}
      </Text>

      <TextInput
        label={t(
          'business.rentals.wizard.details.tags',
          'Tags (comma-separated)'
        )}
        value={tagsText}
        onChangeText={setTagsText}
        mode="outlined"
        disabled={busy}
        style={styles.field}
      />

      <Button
        mode="contained"
        loading={busy}
        disabled={!canSubmit}
        onPress={() =>
          onSubmit({
            name: name.trim(),
            rental_category_id: categoryId,
            description: description.trim() || undefined,
            currency: currency || defaultCurrency || undefined,
            tags: tagsText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            operation_mode: operationMode,
          })
        }
        style={{ marginTop: spacing.md }}
      >
        {t('business.rentals.wizard.details.continue', 'Continue')}
      </Button>

      <ItemFormOptionDialog
        visible={picker === 'category'}
        title={t('business.rentals.wizard.details.category', 'Category')}
        options={categoryOptions}
        selectedId={categoryId}
        onSelect={(id) => {
          setCategoryId(id);
          setPicker(null);
        }}
        onDismiss={() => setPicker(null)}
        onCreateNew={(value) => {
          void handleCreateCategory(value);
        }}
      />

      <Portal>
        <Dialog visible={overwriteOpen} onDismiss={() => setOverwriteOpen(false)}>
          <Dialog.Title>
            {t('business.rentals.wizard.details.aiOverwriteTitle', 'Replace current details?')}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t(
                'business.rentals.wizard.details.aiOverwriteBody',
                'AI will overwrite the fields you already filled.'
              )}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOverwriteOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onPress={() => {
                setOverwriteOpen(false);
                void applyAi(true);
              }}
            >
              {t('business.rentals.wizard.details.aiOverwriteConfirm', 'Replace')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
  field: { marginBottom: 12 },
  modeCard: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
});
