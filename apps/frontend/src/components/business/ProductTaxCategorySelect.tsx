import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  STRIPE_TAX_CODE_GENERAL_TANGIBLE,
  StripeTaxCodeOption,
  useStripeTaxCodes,
} from '../../hooks/useStripeTaxCodes';

export interface ProductTaxCategorySelectProps {
  value: string;
  onChange: (taxCodeId: string) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

export const ProductTaxCategorySelect: React.FC<ProductTaxCategorySelectProps> = ({
  value,
  onChange,
  disabled,
  error,
  helperText,
}) => {
  const { t } = useTranslation();
  const { codes, loading, error: loadError, search } = useStripeTaxCodes();

  const options = useMemo(() => {
    const byId = new Map(codes.map((c) => [c.id, c]));
    if (!byId.has(STRIPE_TAX_CODE_GENERAL_TANGIBLE)) {
      byId.set(STRIPE_TAX_CODE_GENERAL_TANGIBLE, {
        id: STRIPE_TAX_CODE_GENERAL_TANGIBLE,
        name: 'General - Tangible Goods',
        description:
          'A physical good that can be moved or touched. Also known as tangible personal property.',
        groupName: 'General',
      });
    }
    return Array.from(byId.values()).sort((a, b) =>
      `${a.groupName ?? ''}${a.name}`.localeCompare(
        `${b.groupName ?? ''}${b.name}`
      )
    );
  }, [codes]);

  const selected =
    options.find((o) => o.id === value) ??
    options.find((o) => o.id === STRIPE_TAX_CODE_GENERAL_TANGIBLE) ??
    null;

  return (
    <Box>
      <Autocomplete
        disabled={disabled || loading}
        options={options}
        value={selected}
        groupBy={(option) => option.groupName || t('items.taxCategory.otherGroup', 'Other')}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onInputChange={(_, inputValue, reason) => {
          if (reason === 'input') void search(inputValue);
        }}
        onChange={(_, option) => {
          onChange(option?.id ?? STRIPE_TAX_CODE_GENERAL_TANGIBLE);
        }}
        renderOption={(props, option) => (
          <li {...props} key={option.id}>
            <Box>
              <Typography variant="body2">{option.name}</Typography>
              {option.description ? (
                <Typography variant="caption" color="text.secondary">
                  {option.description}
                </Typography>
              ) : null}
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t('items.taxCategory.label', 'Product tax category')}
            error={error || !!loadError}
            helperText={
              helperText ||
              loadError ||
              t(
                'items.taxCategory.help',
                'Used to calculate sales tax at checkout. Does not affect past orders.'
              )
            }
          />
        )}
      />
    </Box>
  );
};

export default ProductTaxCategorySelect;
