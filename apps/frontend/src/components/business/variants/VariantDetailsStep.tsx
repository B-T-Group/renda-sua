import {
  Alert,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { WEIGHT_UNITS } from '../../../constants/enums';
import type { CreateItemVariantPayload } from '../../../hooks/useItemVariants';
import type { VariantParentDefaults } from '../../../types/itemVariant';

export interface VariantDetailsStepProps {
  form: CreateItemVariantPayload;
  parentItem: VariantParentDefaults;
  namePlaceholder: string;
  skuError: string | null;
  onChange: (patch: Partial<CreateItemVariantPayload>) => void;
  onNameManualEdit: () => void;
  aiLoading?: boolean;
  aiFilled?: boolean;
}

const VariantDetailsStep: React.FC<VariantDetailsStepProps> = ({
  form,
  parentItem,
  namePlaceholder,
  skuError,
  onChange,
  onNameManualEdit,
  aiLoading = false,
  aiFilled = false,
}) => {
  const { t } = useTranslation();
  const currency = parentItem.currency || 'XAF';
  const priceLabel = t('business.variants.priceWithCurrency', 'Price ({{currency}})', {
    currency,
  });

  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      {aiLoading ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            {t('business.variants.aiAnalyzing', 'Analyzing variant photo…')}
          </Typography>
        </Stack>
      ) : null}
      {aiFilled && !aiLoading ? (
        <Alert severity="info" sx={{ py: 0.5 }}>
          {t(
            'business.variants.aiFilledBanner',
            'Filled from variant photo — edit anything'
          )}
        </Alert>
      ) : null}
      <TextField
        label={t('business.variants.name', 'Variant name')}
        value={form.name}
        placeholder={namePlaceholder}
        onChange={(e) => {
          onNameManualEdit();
          onChange({ name: e.target.value });
        }}
        required
        fullWidth
        helperText={t(
          'business.variants.nameHelp',
          'Leave empty to use the product name, or enter a color to auto-suggest.'
        )}
      />
      <TextField
        label={t('business.variants.color', 'Color')}
        value={form.color ?? ''}
        onChange={(e) => onChange({ color: e.target.value || null })}
        fullWidth
      />
      <TextField
        label={t('business.variants.sku', 'SKU (optional)')}
        value={form.sku ?? ''}
        onChange={(e) => onChange({ sku: e.target.value || null })}
        fullWidth
        error={!!skuError}
        helperText={skuError || undefined}
      />
      <TextField
        type="number"
        label={priceLabel}
        value={form.price ?? ''}
        onChange={(e) =>
          onChange({
            price: e.target.value === '' ? null : Number(e.target.value),
          })
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
            onChange({
              weight: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          fullWidth
        />
        <TextField
          select
          label={t('business.variants.weightUnit', 'Unit')}
          value={form.weight_unit ?? 'g'}
          onChange={(e) => onChange({ weight_unit: e.target.value })}
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
        onChange={(e) => onChange({ dimensions: e.target.value || null })}
        fullWidth
      />
      <FormControlLabel
        control={
          <Switch
            checked={form.is_active !== false}
            onChange={(_, v) => onChange({ is_active: v })}
          />
        }
        label={t('business.variants.active', 'Active')}
      />
      <FormControlLabel
        control={
          <Switch
            checked={!!form.is_default}
            onChange={(_, v) => onChange({ is_default: v })}
          />
        }
        label={t('business.variants.default', 'Default option')}
      />
    </Stack>
  );
};

export default VariantDetailsStep;
