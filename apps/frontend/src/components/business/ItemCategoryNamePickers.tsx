import Autocomplete from '@mui/material/Autocomplete';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ItemCategory,
  ItemSubCategory,
  useCategories,
} from '../../hooks/useCategory';
import {
  CreateNamedOption,
  filterWithCreateOption,
  isCreateNamedOption,
} from '../../utils/namedCreateOption';

type CategoryChoice = ItemCategory | CreateNamedOption;
type SubCategoryChoice = ItemSubCategory | CreateNamedOption;

function isSameChoice(
  option: CategoryChoice | SubCategoryChoice,
  value: CategoryChoice | SubCategoryChoice
): boolean {
  if (isCreateNamedOption(option) && isCreateNamedOption(value)) {
    return (
      option.createValue.trim().toLowerCase() ===
      value.createValue.trim().toLowerCase()
    );
  }
  if (!isCreateNamedOption(option) && !isCreateNamedOption(value)) {
    return option.id === value.id;
  }
  return false;
}

export interface ItemCategoryNamePickersProps {
  categoryName: string;
  subCategoryName: string;
  onCategoryNameChange: (value: string) => void;
  onSubCategoryNameChange: (value: string) => void;
  disabled?: boolean;
}

export const ItemCategoryNamePickers: React.FC<ItemCategoryNamePickersProps> = ({
  categoryName,
  subCategoryName,
  onCategoryNameChange,
  onSubCategoryNameChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { categories, loading, getSubCategoriesByCategory } = useCategories();

  const selectedCategory = useMemo(
    () =>
      categories.find(
        (category) =>
          category.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
      ) ?? null,
    [categories, categoryName]
  );

  const subCategories = selectedCategory
    ? getSubCategoriesByCategory(selectedCategory.id)
    : [];

  const selectedSubCategory = useMemo(
    () =>
      subCategories.find(
        (sub) =>
          sub.name.trim().toLowerCase() === subCategoryName.trim().toLowerCase()
      ) ?? null,
    [subCategories, subCategoryName]
  );

  const categoryValue = useMemo((): CategoryChoice | null => {
    const trimmed = categoryName.trim();
    if (!trimmed) {
      return null;
    }
    if (selectedCategory) {
      return selectedCategory;
    }
    return {
      id: 'create-new',
      name: trimmed,
      isCreateOption: true,
      createValue: trimmed,
    };
  }, [categoryName, selectedCategory]);

  const subCategoryValue = useMemo((): SubCategoryChoice | null => {
    const trimmed = subCategoryName.trim();
    if (!trimmed) {
      return null;
    }
    if (selectedSubCategory) {
      return selectedSubCategory;
    }
    return {
      id: 'create-new',
      name: trimmed,
      isCreateOption: true,
      createValue: trimmed,
    };
  }, [selectedSubCategory, subCategoryName]);

  const hasCategory = !!categoryName.trim();

  const categoryOptions = useMemo((): CategoryChoice[] => {
    if (
      categoryValue &&
      isCreateNamedOption(categoryValue) &&
      !categories.some(
        (c) =>
          c.name.trim().toLowerCase() ===
          categoryValue.createValue.trim().toLowerCase()
      )
    ) {
      return [categoryValue, ...categories];
    }
    return categories;
  }, [categories, categoryValue]);

  const subCategoryOptions = useMemo((): SubCategoryChoice[] => {
    if (
      subCategoryValue &&
      isCreateNamedOption(subCategoryValue) &&
      !subCategories.some(
        (s) =>
          s.name.trim().toLowerCase() ===
          subCategoryValue.createValue.trim().toLowerCase()
      )
    ) {
      return [subCategoryValue, ...subCategories];
    }
    return subCategories;
  }, [subCategories, subCategoryValue]);

  const handleCategoryChange = (value: CategoryChoice | null) => {
    if (!value) {
      onCategoryNameChange('');
      onSubCategoryNameChange('');
      return;
    }
    if (isCreateNamedOption(value)) {
      onCategoryNameChange(value.createValue);
      onSubCategoryNameChange('');
      return;
    }
    onCategoryNameChange(value.name);
    onSubCategoryNameChange('');
  };

  const handleSubCategoryChange = (value: SubCategoryChoice | null) => {
    if (!value) {
      onSubCategoryNameChange('');
      return;
    }
    if (isCreateNamedOption(value)) {
      onSubCategoryNameChange(value.createValue);
      return;
    }
    onSubCategoryNameChange(value.name);
  };

  return (
    <Stack spacing={2}>
      <Autocomplete<CategoryChoice>
        options={categoryOptions}
        value={categoryValue}
        loading={loading}
        disabled={disabled || loading}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={isSameChoice}
        filterOptions={(options, state) =>
          filterWithCreateOption(
            options,
            state.inputValue,
            (name) => t('business.items.addNamedOption', 'Add "{{name}}"', { name })
          )
        }
        onChange={(_, value) => handleCategoryChange(value)}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t('business.onboarding.firstSale.create.category', 'Category')}
            placeholder={t('business.items.selectCategory', 'Select category')}
          />
        )}
      />
      <Autocomplete<SubCategoryChoice>
        options={subCategoryOptions}
        value={subCategoryValue}
        loading={loading}
        disabled={disabled || loading || !hasCategory}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={isSameChoice}
        filterOptions={(options, state) =>
          filterWithCreateOption(
            options,
            state.inputValue,
            (name) => t('business.items.addNamedOption', 'Add "{{name}}"', { name })
          )
        }
        onChange={(_, value) => handleSubCategoryChange(value)}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t(
              'business.onboarding.firstSale.create.subCategory',
              'Subcategory'
            )}
            placeholder={
              hasCategory
                ? t('business.items.selectSubCategory', 'Select sub category')
                : t('business.items.selectCategoryFirst', 'Select category first')
            }
          />
        )}
      />
    </Stack>
  );
};

export default ItemCategoryNamePickers;
