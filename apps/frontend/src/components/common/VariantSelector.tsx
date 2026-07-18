import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  type ItemVariant,
  type VariantPriceOverride,
  effectiveVariantUnitPrice,
  primaryVariantImageUrl,
  unitPriceWithListingDeal,
} from '../../types/itemVariant';

export interface VariantSelectorProps {
  variants: ItemVariant[];
  value: string | null;
  onChange: (variantId: string) => void;
  listingSellingPrice: number;
  priceOverrides?: VariantPriceOverride[] | null;
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
  priceOverrides,
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

  return (
    <Box sx={{ mt: 2 }} role="radiogroup" aria-label={t('orders.variant.selectLabel', 'Option')}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
        {t('orders.variant.chooseOption', 'Choose an option')}
      </Typography>
      {!value ? (
        <Typography variant="caption" color="warning.dark" sx={{ display: 'block', mb: 1 }}>
          {t('orders.variant.selectRequired', 'Select an option')}
        </Typography>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(3, minmax(0, 1fr))',
          },
          gap: 1.25,
        }}
      >
        {variants.map((v) => {
          const selected = v.id === value;
          const base = effectiveVariantUnitPrice(
            v,
            listingSellingPrice,
            priceOverrides
          );
          const p = unitPriceWithListingDeal(
            base,
            listingSellingPrice,
            hasActiveDeal,
            originalPrice,
            discountedPrice
          );
          const thumb = primaryVariantImageUrl(v);
          const priceLabel = formatCurrency(p.unit, currency);
          const colorHint = v.color?.trim();

          return (
            <ButtonBase
              key={v.id}
              onClick={() => onChange(v.id)}
              disabled={disabled}
              role="radio"
              aria-checked={selected}
              aria-label={`${v.name}, ${priceLabel}`}
              sx={{
                display: 'block',
                textAlign: 'left',
                borderRadius: 2,
                border: '2px solid',
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: selected ? 'action.selected' : 'background.paper',
                overflow: 'hidden',
                minHeight: 44,
                opacity: disabled ? 0.6 : 1,
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                '&:hover': {
                  borderColor: selected ? 'primary.dark' : 'primary.light',
                  boxShadow: 1,
                },
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  pt: '72%',
                  bgcolor: 'grey.200',
                }}
              >
                {thumb ? (
                  <Box
                    component="img"
                    src={thumb}
                    alt=""
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'text.disabled',
                    }}
                  >
                    <ImageNotSupportedOutlinedIcon fontSize="small" />
                  </Box>
                )}
                {selected ? (
                  <CheckCircleIcon
                    color="primary"
                    sx={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      bgcolor: 'background.paper',
                      borderRadius: '50%',
                      fontSize: 22,
                    }}
                  />
                ) : null}
              </Box>
              <Stack spacing={0.25} sx={{ p: 1 }}>
                <Typography variant="body2" fontWeight={700} noWrap>
                  {v.name}
                </Typography>
                {colorHint && colorHint !== v.name ? (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {colorHint}
                  </Typography>
                ) : null}
                <Typography variant="body2" color="primary" fontWeight={700}>
                  {priceLabel}
                </Typography>
              </Stack>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
};

export default VariantSelector;
