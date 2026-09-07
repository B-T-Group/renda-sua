import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Chip, Dialog, Portal, Switch, Text, TextInput } from 'react-native-paper';
import {
  createItemFormTag,
  fetchItemFormCategories,
  setBusinessItemTags,
} from '../../../services/businessItemFormService';
import { businessApi } from '../../../services/businessApi';
import type { ItemRefinementSuggestion } from '../../../types/business/collections';
import type { BusinessCatalogItem } from '../../../types/business/items';

type Props = {
  visible: boolean;
  item: BusinessCatalogItem;
  onDismiss: () => void;
  onApplied: () => void;
};

function resolveSubCategoryId(
  categories: Awaited<ReturnType<typeof fetchItemFormCategories>>,
  categoryName?: string,
  subCategoryName?: string
): number | undefined {
  if (!categoryName?.trim() || !subCategoryName?.trim()) return undefined;
  const c = categoryName.trim().toLowerCase();
  const s = subCategoryName.trim().toLowerCase();
  for (const cat of categories) {
    if (cat.name.trim().toLowerCase() !== c) continue;
    const sub = cat.item_sub_categories.find((sc) => sc.name.trim().toLowerCase() === s);
    if (sub) return sub.id;
  }
  return undefined;
}

export function RefineItemWithAiDialog({ visible, item, onDismiss, onApplied }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [model, setModel] = useState('');
  const [fragile, setFragile] = useState(false);
  const [perishable, setPerishable] = useState(false);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [aiData, setAiData] = useState<ItemRefinementSuggestion | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(item.name ?? '');
    setDescription(item.description ?? '');
    setSku(item.sku ?? '');
    setModel(item.model ?? '');
    setFragile(Boolean(item.is_fragile));
    setPerishable(Boolean(item.is_perishable));
    setTagNames((item.item_tags ?? []).map((it) => it.tag.name));
    setError(null);
    setAiData(null);
    setLoading(true);
    void businessApi.ai
      .itemRefinementSuggestions(item.id)
      .then((res) => {
        if (!res.success || !res.data) {
          setError(res.error ?? t('business.items.refineWithAi.error', 'Failed to get AI suggestions'));
          return;
        }
        applySuggestionToForm(res.data, item, setName, setDescription, setSku, setModel, setFragile, setPerishable, setTagNames);
        setAiData(res.data);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : t('business.items.refineWithAi.error', 'Failed to get AI suggestions'));
      })
      .finally(() => setLoading(false));
  }, [visible, item.id]);

  const toggleTag = (tag: string) => {
    setTagNames((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  };

  const handleApply = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const categories = await fetchItemFormCategories();
      const subId =
        resolveSubCategoryId(categories, aiData?.categoryName, aiData?.subCategoryName) ??
        item.item_sub_category_id;
      await businessApi.catalog.updateItem(item.id, {
        name: name.trim(),
        description: description.trim(),
        sku: sku.trim() || null,
        model: model.trim() || null,
        item_sub_category_id: subId,
        is_fragile: fragile,
        is_perishable: perishable,
        weight: aiData?.weight ?? undefined,
        weight_unit: aiData?.weightUnit ?? undefined,
        dimensions: aiData?.dimensions ?? undefined,
        requires_special_handling: aiData?.requiresSpecialHandling,
        min_order_quantity: aiData?.minOrderQuantity,
        max_order_quantity: aiData?.maxOrderQuantity ?? null,
      });
      const tagIds: string[] = [];
      for (const tagName of tagNames) {
        const created = await createItemFormTag(tagName);
        tagIds.push(created.id);
      }
      await setBusinessItemTags(item.id, tagIds);
      onApplied();
      onDismiss();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('business.items.updateError', 'Failed to update item'));
    } finally {
      setSaving(false);
    }
  };

  const suggestedTags = [
    ...(aiData?.suggestedTagsEn ?? []),
    ...(aiData?.suggestedTagsFr ?? []),
  ].filter((v, i, arr) => v.trim() && arr.indexOf(v) === i);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={saving ? undefined : onDismiss} style={styles.dialog}>
        <Dialog.Title>{t('business.items.refineWithAi.title', 'Refine with AI')}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scroll}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator />
                <Text style={styles.hint}>
                  {t('business.items.refineWithAi.loading', 'Analyzing item and images...')}
                </Text>
              </View>
            ) : (
              <>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Text variant="bodySmall" style={styles.hint}>
                  {t('business.items.refineWithAi.priceLocked', 'Price and currency are not changed here')}
                </Text>
                <TextInput label={t('business.items.name', 'Name')} value={name} onChangeText={setName} mode="outlined" style={styles.field} />
                <TextInput
                  label={t('business.items.description', 'Description')}
                  value={description}
                  onChangeText={setDescription}
                  mode="outlined"
                  multiline
                  numberOfLines={4}
                  style={styles.field}
                />
                <TextInput label={t('business.items.sku', 'SKU')} value={sku} onChangeText={setSku} mode="outlined" style={styles.field} />
                <TextInput label={t('business.items.model', 'Model')} value={model} onChangeText={setModel} mode="outlined" style={styles.field} />
                {aiData?.categoryName ? (
                  <Text variant="bodySmall" style={styles.hint}>
                    {t('business.items.category', 'Category')}: {aiData.categoryName}
                    {aiData.subCategoryName ? ` › ${aiData.subCategoryName}` : ''}
                  </Text>
                ) : null}
                <View style={styles.switchRow}>
                  <Text>{t('business.items.fragile', 'Fragile')}</Text>
                  <Switch value={fragile} onValueChange={setFragile} />
                </View>
                <View style={styles.switchRow}>
                  <Text>{t('business.items.perishable', 'Perishable')}</Text>
                  <Switch value={perishable} onValueChange={setPerishable} />
                </View>
                {suggestedTags.length > 0 ? (
                  <View style={styles.tags}>
                    <Text variant="labelMedium">
                      {t('business.items.refineWithAi.suggestedTagsLabel', 'Suggested tags')}
                    </Text>
                    <View style={styles.chipRow}>
                      {suggestedTags.map((tag) => (
                        <Chip key={tag} selected={tagNames.includes(tag)} onPress={() => toggleTag(tag)} style={styles.chip}>
                          {tag}
                        </Chip>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={saving || loading}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button mode="contained" loading={saving} disabled={loading} onPress={() => void handleApply()}>
            {t('business.items.refineWithAi.apply', 'Apply changes')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function applySuggestionToForm(
  data: ItemRefinementSuggestion,
  item: BusinessCatalogItem,
  setName: (v: string) => void,
  setDescription: (v: string) => void,
  setSku: (v: string) => void,
  setModel: (v: string) => void,
  setFragile: (v: boolean) => void,
  setPerishable: (v: boolean) => void,
  setTagNames: (v: string[]) => void
) {
  if (data.name) setName(data.name);
  if (data.descriptionSuggestion) setDescription(data.descriptionSuggestion);
  if (data.sku) setSku(data.sku);
  if (data.model) setModel(data.model);
  if (data.isFragile != null) setFragile(data.isFragile);
  if (data.isPerishable != null) setPerishable(data.isPerishable);
  const tags = [...(data.suggestedTagsEn ?? []), ...(data.suggestedTagsFr ?? [])].filter(Boolean);
  if (tags.length) setTagNames(Array.from(new Set(tags)));
  else setTagNames((item.item_tags ?? []).map((it) => it.tag.name));
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '90%' },
  scroll: { maxHeight: 480, paddingHorizontal: 8 },
  field: { marginBottom: 10 },
  hint: { color: '#64748b', marginBottom: 8 },
  error: { color: '#dc2626', marginBottom: 8 },
  center: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tags: { marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { marginBottom: 4 },
});
