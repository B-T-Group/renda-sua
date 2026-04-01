import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Brand, Item } from '../../hooks/useItems';
import { useTags, type Tag } from '../../hooks/useTags';
import {
  useItemRefinementSuggestions,
  type ItemRefinementSuggestionData,
} from '../../hooks/useItemRefinementSuggestions';

function resolveSubCategoryId(
  itemSubCategories: Array<{
    id: number;
    name: string;
    item_category: { name: string };
  }>,
  categoryName?: string,
  subCategoryName?: string
): number | undefined {
  if (!categoryName?.trim() || !subCategoryName?.trim()) {
    return undefined;
  }
  const c = categoryName.trim().toLowerCase();
  const s = subCategoryName.trim().toLowerCase();
  const found = itemSubCategories.find(
    (sc) =>
      sc.item_category?.name?.trim().toLowerCase() === c &&
      sc.name?.trim().toLowerCase() === s
  );
  return found?.id;
}

function resolveBrandId(
  brands: Brand[],
  brandName?: string
): string | undefined {
  if (!brandName?.trim()) {
    return undefined;
  }
  const n = brandName.trim().toLowerCase();
  return brands.find((b) => b.name?.trim().toLowerCase() === n)?.id;
}

interface RefineItemWithAiDialogProps {
  open: boolean;
  item: Item | null;
  brands: Brand[];
  itemSubCategories: Array<{
    id: number;
    name: string;
    item_category: { name: string };
  }>;
  onClose: () => void;
  onApplied: () => void;
  updateItem: (
    id: string,
    data: Partial<Record<string, unknown>>,
    options?: { skipRefetch?: boolean }
  ) => Promise<unknown>;
}

const RefineItemWithAiDialog: React.FC<RefineItemWithAiDialogProps> = ({
  open,
  item,
  brands,
  itemSubCategories,
  onClose,
  onApplied,
  updateItem,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { fetchSuggestions, loading, error } = useItemRefinementSuggestions();
  const {
    tags: availableTags,
    fetchTags,
    createTag,
    setItemTags,
  } = useTags();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [weight, setWeight] = useState<string>('');
  const [weightUnit, setWeightUnit] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [itemSubCategoryId, setItemSubCategoryId] = useState<number>(0);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [fragile, setFragile] = useState(false);
  const [perishable, setPerishable] = useState(false);
  const [specialHandling, setSpecialHandling] = useState(false);
  const [minOrder, setMinOrder] = useState<string>('1');
  const [maxOrder, setMaxOrder] = useState<string>('');
  const [lockedPrice, setLockedPrice] = useState<number>(0);
  const [lockedCurrency, setLockedCurrency] = useState('USD');
  const [applyLoading, setApplyLoading] = useState(false);
  const [aiPayload, setAiPayload] = useState<ItemRefinementSuggestionData | null>(
    null
  );
  const [suggestedTagsFr, setSuggestedTagsFr] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const itemRef = useRef(item);
  itemRef.current = item;

  useEffect(() => {
    if (!open || !item?.id) {
      setAiPayload(null);
      return;
    }
    let cancelled = false;
    (async () => {
      fetchTags().catch(() => undefined);
      const data = await fetchSuggestions(item.id);
      if (!cancelled && data) {
        setAiPayload(data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, item?.id, fetchSuggestions, fetchTags]);

  useEffect(() => {
    if (!aiPayload) {
      return;
    }
    const cur = itemRef.current;
    if (!cur) {
      return;
    }
    const data = aiPayload;
    const subId =
      resolveSubCategoryId(
        itemSubCategories,
        data.categoryName,
        data.subCategoryName
      ) ?? cur.item_sub_category_id;
    const br = resolveBrandId(brands, data.brandName) ?? cur.brand_id ?? null;

    setName(data.name ?? cur.name ?? '');
    setDescription(data.descriptionSuggestion ?? cur.description ?? '');
    setSku(data.sku ?? cur.sku ?? '');
    setModel(data.model ?? cur.model ?? '');
    setColor(data.color ?? cur.color ?? '');
    setWeight(
      data.weight != null
        ? String(data.weight)
        : cur.weight != null
          ? String(cur.weight)
          : ''
    );
    setWeightUnit(data.weightUnit ?? cur.weight_unit ?? '');
    setDimensions(data.dimensions ?? cur.dimensions ?? '');
    setItemSubCategoryId(subId || 0);
    setBrandId(br);
    setFragile(data.isFragile ?? cur.is_fragile ?? false);
    setPerishable(data.isPerishable ?? cur.is_perishable ?? false);
    setSpecialHandling(
      data.requiresSpecialHandling ?? cur.requires_special_handling ?? false
    );
    setMinOrder(String(data.minOrderQuantity ?? cur.min_order_quantity ?? 1));
    setMaxOrder(
      data.maxOrderQuantity != null
        ? String(data.maxOrderQuantity)
        : cur.max_order_quantity != null
          ? String(cur.max_order_quantity)
          : ''
    );
    setLockedPrice(data.price ?? cur.price ?? 0);
    setLockedCurrency(data.currency ?? cur.currency ?? 'USD');
    setSuggestedTagsFr(data.suggestedTagsFr ?? []);

    const existing = (cur.item_tags ?? [])
      .map((it: any) => it?.tag)
      .filter((tg: any) => tg?.id && tg?.name) as Tag[];
    const suggestedEn = (data.suggestedTagsEn ?? [])
      .map((n) => availableTags.find((t) => t.name.toLowerCase() === n.toLowerCase()))
      .filter(Boolean) as Tag[];
    setSelectedTags(suggestedEn.length ? suggestedEn : existing);
    // Intentionally only when a new AI payload arrives; brands/subcategories read from latest render.
  }, [aiPayload]);

  useEffect(() => {
    if (!open) {
      setNewTagName('');
    }
  }, [open]);

  useEffect(() => {
    if (error) {
      enqueueSnackbar(
        error ||
          t('business.items.refineWithAi.error', 'Failed to get AI suggestions'),
        { variant: 'error' }
      );
    }
  }, [error, enqueueSnackbar, t]);

  const handleClose = () => {
    if (loading || applyLoading) {
      return;
    }
    onClose();
  };

  const handleApply = async () => {
    if (!item?.id) {
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      enqueueSnackbar(t('business.items.nameRequired', 'Name is required'), {
        variant: 'warning',
      });
      return;
    }
    setApplyLoading(true);
    try {
      await updateItem(
        item.id,
        {
          name: trimmed,
          description: description.trim(),
          item_sub_category_id: itemSubCategoryId || item.item_sub_category_id,
          brand_id: brandId,
          sku: sku.trim() || null,
          model: model.trim() || null,
          color: color.trim() || null,
          weight: weight === '' ? null : Number(weight),
          weight_unit: weightUnit.trim() || null,
          dimensions: dimensions.trim() || null,
          is_fragile: fragile,
          is_perishable: perishable,
          requires_special_handling: specialHandling,
          min_order_quantity:
            minOrder === '' ? 1 : Math.max(1, Number(minOrder) || 1),
          max_order_quantity:
            maxOrder === '' ? null : Number(maxOrder) || null,
        },
        { skipRefetch: true }
      );

      await setItemTags(
        item.id,
        selectedTags
          .map((t) => t.id)
          .filter((id): id is string => typeof id === 'string' && !!id)
      );

      enqueueSnackbar(
        t('business.items.itemUpdated', 'Item updated successfully'),
        { variant: 'success' }
      );
      onApplied();
      onClose();
    } catch (e: any) {
      enqueueSnackbar(
        e?.message || t('business.items.updateItem', 'Update Item') + ' failed',
        { variant: 'error' }
      );
    } finally {
      setApplyLoading(false);
    }
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const created = await createTag(name);
      if (created) {
        setSelectedTags((prev) => {
          const merged = [...prev, created];
          const unique = Array.from(new Map(merged.map((t) => [t.id, t])).values());
          return unique;
        });
        setNewTagName('');
      }
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t('business.items.failedToCreateTag', 'Failed to create tag'),
        { variant: 'error' }
      );
    }
  };

  const formatMoney = (amount: number, currency: string) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('business.items.refineWithAi.title', 'Refine with AI')}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack alignItems="center" py={4} spacing={2}>
            <CircularProgress />
            <Typography color="text.secondary">
              {t(
                'business.items.refineWithAi.loading',
                'Analyzing item and images...'
              )}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t(
                'business.items.refineWithAi.priceLocked',
                'Price and currency are not changed here'
              )}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t('business.items.price', 'Price')}
                value={formatMoney(lockedPrice, lockedCurrency)}
                fullWidth
                disabled
                InputProps={{ readOnly: true }}
              />
              <TextField
                label={t('business.items.currency', 'Currency')}
                value={lockedCurrency}
                fullWidth
                disabled
                InputProps={{ readOnly: true }}
              />
            </Stack>
            <TextField
              label={t('business.items.name', 'Name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label={t('business.items.description', 'Description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
            <Typography variant="caption" color="text.secondary">
              {t(
                'business.items.refineWithAi.categoryHint',
                'Choose category from your catalogue; AI suggestions are hints.'
              )}
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel id="refine-subcat-label">
                {t('business.items.category', 'Category')}
              </InputLabel>
              <Select
                labelId="refine-subcat-label"
                label={t('business.items.category', 'Category')}
                value={itemSubCategoryId || ''}
                onChange={(e) =>
                  setItemSubCategoryId(Number(e.target.value) || 0)
                }
              >
                {itemSubCategories.map((sc) => (
                  <MenuItem key={sc.id} value={sc.id}>
                    {sc.item_category?.name} — {sc.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="refine-brand-label">
                {t('business.items.brand', 'Brand')}
              </InputLabel>
              <Select
                labelId="refine-brand-label"
                label={t('business.items.brand', 'Brand')}
                value={brandId ?? ''}
                onChange={(e) => setBrandId(e.target.value || null)}
              >
                <MenuItem value="">
                  {t('business.inventory.noBrand', 'No brand')}
                </MenuItem>
                {brands.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t('business.items.sku', 'SKU')}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                fullWidth
              />
              <TextField
                label={t('business.items.model', 'Model')}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                fullWidth
              />
            </Stack>
            <TextField
              label={t('business.items.color', 'Color')}
              value={color}
              onChange={(e) => setColor(e.target.value)}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t('business.items.weight', 'Weight')}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                type="number"
                fullWidth
              />
              <TextField
                label={t('business.items.weightUnit', 'Weight Unit')}
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value)}
                fullWidth
              />
            </Stack>
            <TextField
              label={t('business.items.dimensions', 'Dimensions (Optional)')}
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              fullWidth
            />
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={fragile}
                    onChange={(e) => setFragile(e.target.checked)}
                  />
                }
                label={t('business.items.fragile', 'Fragile')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={perishable}
                    onChange={(e) => setPerishable(e.target.checked)}
                  />
                }
                label={t('business.items.perishable', 'Perishable')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={specialHandling}
                    onChange={(e) => setSpecialHandling(e.target.checked)}
                  />
                }
                label={t('business.items.specialHandling', 'Special Handling')}
              />
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t('business.items.minOrderQuantity', 'Min Order Quantity')}
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                type="number"
                inputProps={{ min: 1 }}
                fullWidth
              />
              <TextField
                label={t('business.items.maxOrderQuantity', 'Max Order Quantity')}
                value={maxOrder}
                onChange={(e) => setMaxOrder(e.target.value)}
                type="number"
                fullWidth
              />
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">
                {t('business.items.tags', 'Tags')}
              </Typography>
              <Autocomplete
                multiple
                options={availableTags}
                getOptionLabel={(option) =>
                  typeof option === 'string' ? option : option.name
                }
                value={selectedTags}
                onChange={(_, newValue) =>
                  setSelectedTags(newValue as Tag[])
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('business.items.addTag', 'Add tag')}
                    placeholder={t('business.items.addTag', 'Add tag')}
                  />
                )}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  placeholder={t('business.items.createNewTag', 'Create new tag')}
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateTag();
                    }
                  }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                >
                  {t('business.items.createNewTag', 'Create new tag')}
                </Button>
              </Stack>
              {suggestedTagsFr.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'business.items.refineWithAi.suggestedTagsFr',
                    'AI suggested tags (French)'
                  )}
                  {`: ${suggestedTagsFr.join(', ')}`}
                </Typography>
              )}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading || applyLoading}>
          {t('business.items.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={loading || applyLoading}
        >
          {applyLoading ? (
            <CircularProgress size={22} color="inherit" />
          ) : (
            t('business.items.refineWithAi.apply', 'Apply changes')
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RefineItemWithAiDialog;
