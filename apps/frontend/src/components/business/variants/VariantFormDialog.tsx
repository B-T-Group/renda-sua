import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WEIGHT_UNITS } from '../../../constants/enums';
import {
  CreateItemVariantPayload,
  useItemVariants,
} from '../../../hooks/useItemVariants';
import type { ItemVariant } from '../../../types/itemVariant';

export interface VariantFormDialogProps {
  open: boolean;
  itemId: string;
  initial: ItemVariant | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyPayload: CreateItemVariantPayload = {
  name: '',
  sku: null,
  price: null,
  weight: null,
  weight_unit: 'g',
  dimensions: null,
  color: null,
  is_default: false,
  is_active: true,
  sort_order: 0,
};

const VariantFormDialog: React.FC<VariantFormDialogProps> = ({
  open,
  itemId,
  initial,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const { createVariant, updateVariant } = useItemVariants(itemId);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateItemVariantPayload>(emptyPayload);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        name: initial.name,
        sku: initial.sku ?? null,
        price: initial.price ?? null,
        weight: initial.weight ?? null,
        weight_unit: initial.weight_unit ?? 'g',
        dimensions: initial.dimensions ?? null,
        color: initial.color ?? null,
        is_default: !!initial.is_default,
        is_active: initial.is_active !== false,
        sort_order: initial.sort_order ?? 0,
      });
    } else {
      setForm(emptyPayload);
    }
  }, [open, initial]);

  const handleSave = async () => {
    const name = form.name?.trim();
    if (!name) return;
    setSaving(true);
    try {
      if (initial?.id) {
        await updateVariant(initial.id, { ...form, name });
      } else {
        await createVariant({ ...form, name });
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initial
          ? t('business.variants.editTitle', 'Edit variant')
          : t('business.variants.addTitle', 'Add variant')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={t('business.variants.name', 'Variant name')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            fullWidth
          />
          <TextField
            label={t('business.variants.sku', 'SKU (optional)')}
            value={form.sku ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, sku: e.target.value || null }))
            }
            fullWidth
          />
          <TextField
            type="number"
            label={t('business.variants.priceOverride', 'Price override (optional)')}
            value={form.price ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                price: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            fullWidth
            helperText={t(
              'business.variants.priceHelp',
              'Leave empty to use the listing price from inventory.'
            )}
          />
          <Stack direction="row" spacing={1}>
            <TextField
              type="number"
              label={t('business.variants.weight', 'Weight')}
              value={form.weight ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  weight: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              fullWidth
            />
            <TextField
              select
              label={t('business.variants.weightUnit', 'Unit')}
              value={form.weight_unit ?? 'g'}
              onChange={(e) =>
                setForm((f) => ({ ...f, weight_unit: e.target.value }))
              }
              fullWidth
            >
              {WEIGHT_UNITS.map((u) => (
                <MenuItem key={u} value={u}>
                  {u}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label={t('business.items.dimensions', 'Dimensions')}
            value={form.dimensions ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, dimensions: e.target.value || null }))
            }
            fullWidth
          />
          <TextField
            label={t('business.variants.color', 'Color')}
            value={form.color ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, color: e.target.value || null }))
            }
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.is_active !== false}
                onChange={(_, v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            }
            label={t('business.variants.active', 'Active')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!form.is_default}
                onChange={(_, v) =>
                  setForm((f) => ({ ...f, is_default: v }))
                }
              />
            }
            label={t('business.variants.default', 'Default option')}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saving || !form.name?.trim()}
        >
          {t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VariantFormDialog;
