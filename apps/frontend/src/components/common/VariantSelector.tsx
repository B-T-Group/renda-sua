import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  type ItemVariant,
  effectiveVariantUnitPrice,
  unitPriceWithListingDeal,
} from '../../types/itemVariant';

export interface VariantSelectorProps {
  variants: ItemVariant[];
  value: string | null;
  onChange: (variantId: string) => void;
  listingSellingPrice: number;
  hasActiveDeal?: boolean;
  originalPrice?: number;
  discountedPrice?: number;
  currency: string;
  disabled?: boolean;
  formatCurrency: (amount: number, currency?: string) => string;
}

const VariantSelector: React.FC<VariantSelectorProps> = ({
  variants,
  value,
  onChange,
  listingSellingPrice,
  hasActiveDeal,
  originalPrice,
  discountedPrice,
  currency,
  disabled,
  formatCurrency,
}) => {
  const { t } = useTranslation();

  if (variants.length <= 1) {
    return null;
  }

  const handleChange = (e: SelectChangeEvent<string>) => {
    onChange(e.target.value);
  };

  return (
    <FormControl fullWidth sx={{ mt: 2 }}>
      <InputLabel id="item-variant-select-label">
        {t('orders.variant.selectLabel', 'Option')}
      </InputLabel>
      <Select
        labelId="item-variant-select-label"
        value={value ?? ''}
        label={t('orders.variant.selectLabel', 'Option')}
        onChange={handleChange}
        disabled={disabled}
        required
      >
        {variants.map((v) => {
          const base = effectiveVariantUnitPrice(v, listingSellingPrice);
          const p = unitPriceWithListingDeal(
            base,
            listingSellingPrice,
            hasActiveDeal,
            originalPrice,
            discountedPrice
          );
          const priceLabel = p.hasDeal && p.strikeOriginal != null
            ? `${formatCurrency(p.strikeOriginal, currency)} → ${formatCurrency(p.unit, currency)}`
            : formatCurrency(p.unit, currency);
          return (
            <MenuItem key={v.id} value={v.id}>
              <Typography variant="body2" component="span">
                {v.name}{' '}
                <Typography component="span" color="primary" fontWeight={600}>
                  ({priceLabel})
                </Typography>
              </Typography>
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
};

export default VariantSelector;
