import {
  Autocomplete,
  CircularProgress,
  createFilterOptions,
  TextField,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getOtherRentalCategoryId,
  RentalCategoryRow,
  useRentalCategories,
} from '../../hooks/useRentalCategories';

type CategoryOption = RentalCategoryRow & {
  isCreateOption?: boolean;
  createValue?: string;
};

const filter = createFilterOptions<CategoryOption>();

export interface RentalCategoryAutocompleteProps {
  value: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  /** When true and value is empty, select seeded "Other" once categories load. */
  defaultToOther?: boolean;
}

export const RentalCategoryAutocomplete: React.FC<
  RentalCategoryAutocompleteProps
> = ({
  value,
  onChange,
  disabled,
  required,
  label,
  defaultToOther = false,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { categories, loading, creating, createCategory } =
    useRentalCategories();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!defaultToOther || value || loading || categories.length === 0) return;
    const otherId = getOtherRentalCategoryId(categories);
    if (otherId) onChange(otherId);
  }, [defaultToOther, value, loading, categories, onChange]);

  const selected = useMemo(
    () => categories.find((c) => c.id === value) ?? null,
    [categories, value]
  );

  const fieldLabel = label ?? t('rentals.category', 'Category');

  const resolveSelection = async (name: string) => {
    setBusy(true);
    try {
      const created = await createCategory(name);
      onChange(created.id);
    } catch (e: unknown) {
      enqueueSnackbar(
        e instanceof Error
          ? e.message
          : t('rentals.createCategoryFailed', 'Could not create category'),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Autocomplete
      fullWidth
      freeSolo
      selectOnFocus
      clearOnBlur
      handleHomeEndKeys
      disabled={disabled || loading || creating || busy}
      options={categories as CategoryOption[]}
      filterOptions={(options, params) => {
        const filtered = filter(options, params);
        const input = params.inputValue.trim();
        if (!input) return filtered;
        const exists = options.some(
          (o) => o.name.toLowerCase() === input.toLowerCase()
        );
        if (!exists) {
          filtered.push({
            id: `create:${input}`,
            name: t('rentals.createCategoryOption', 'Add "{{name}}"', {
              name: input,
            }),
            slug: '',
            isCreateOption: true,
            createValue: input,
          });
        }
        return filtered;
      }}
      getOptionLabel={(option) => {
        if (typeof option === 'string') return option;
        return option.name;
      }}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      value={selected}
      onChange={async (_, newValue) => {
        if (typeof newValue === 'string') {
          const name = newValue.trim();
          if (!name) return;
          await resolveSelection(name);
          return;
        }
        if (newValue?.isCreateOption && newValue.createValue) {
          await resolveSelection(newValue.createValue);
          return;
        }
        onChange(newValue?.id ?? '');
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={fieldLabel}
          required={required}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading || creating || busy ? (
                  <CircularProgress color="inherit" size={18} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

export default RentalCategoryAutocomplete;
