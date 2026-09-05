import Autocomplete from '@mui/material/Autocomplete';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessCatalogScope } from '../../../hooks/useBusinessCatalogScope';
import { useCategories, ItemCategory, ItemSubCategory } from '../../../hooks/useCategory';
import { Item, useItems } from '../../../hooks/useItems';
import {
  CreateNamedOption,
  filterWithCreateOption,
  isCreateNamedOption,
} from '../../../utils/namedCreateOption';

type CategoryChoice = ItemCategory | CreateNamedOption;
type SubCategoryChoice = ItemSubCategory | CreateNamedOption;

interface ItemCategoryEditorProps {
  item: Item;
  onSaved: () => void;
}

const ItemCategoryEditor: React.FC<ItemCategoryEditorProps> = ({
  item,
  onSaved,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { effectiveBusinessId } = useBusinessCatalogScope();
  const { updateItem } = useItems(effectiveBusinessId);
  const {
    categories,
    loading: categoriesLoading,
    getSubCategoriesByCategory,
    createCategory,
    createSubcategory,
  } = useCategories();
  const [categoryId, setCategoryId] = useState<number | null>(
    item.item_sub_category?.item_category?.id ?? null
  );
  const [subCategoryId, setSubCategoryId] = useState<number | null>(
    item.item_sub_category_id ?? item.item_sub_category?.id ?? null
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCategoryId(item.item_sub_category?.item_category?.id ?? null);
    setSubCategoryId(item.item_sub_category_id ?? item.item_sub_category?.id ?? null);
  }, [item.item_sub_category, item.item_sub_category_id]);

  const subCategories = categoryId ? getSubCategoriesByCategory(categoryId) : [];
  const selectedCategory =
    categories.find((category) => category.id === categoryId) ?? null;
  const selectedSubCategory =
    subCategories.find((sub) => sub.id === subCategoryId) ?? null;
  const busy = saving || categoriesLoading;
  const needsSubcategory = categoryId != null && subCategoryId == null;

  const persistSubCategory = useCallback(
    async (id: number) => {
      if (id === item.item_sub_category_id) {
        setSubCategoryId(id);
        return;
      }
      setSaving(true);
      try {
        await updateItem(item.id, { item_sub_category_id: id }, { skipRefetch: true });
        setSubCategoryId(id);
        enqueueSnackbar(t('business.items.categoryUpdated', 'Category updated'), {
          variant: 'success',
        });
        onSaved();
      } catch (error: any) {
        enqueueSnackbar(error?.message || t('business.items.categoryUpdateFailed', 'Could not update category'), {
          variant: 'error',
        });
      } finally {
        setSaving(false);
      }
    },
    [enqueueSnackbar, item.id, item.item_sub_category_id, onSaved, t, updateItem]
  );

  const handleCategoryChange = async (value: CategoryChoice | null) => {
    if (!value) {
      setCategoryId(null);
      setSubCategoryId(null);
      return;
    }
    if (isCreateNamedOption(value)) {
      const created = await createCategory(value.createValue);
      setCategoryId(created.id);
      setSubCategoryId(null);
      return;
    }
    setCategoryId(value.id);
    setSubCategoryId(null);
  };

  const handleSubCategoryChange = async (value: SubCategoryChoice | null) => {
    if (!value || !categoryId) {
      setSubCategoryId(null);
      return;
    }
    if (isCreateNamedOption(value)) {
      const created = await createSubcategory(value.createValue, categoryId);
      await persistSubCategory(created.id);
      return;
    }
    await persistSubCategory(value.id);
  };

  return (
    <Stack spacing={1.5}>
      <Autocomplete<CategoryChoice>
        options={categories}
        value={selectedCategory}
        loading={categoriesLoading}
        disabled={busy}
        disableClearable={selectedCategory != null}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        filterOptions={(options, state) =>
          filterWithCreateOption(
            options,
            state.inputValue,
            (name) => t('business.items.addNamedOption', 'Add "{{name}}"', { name })
          )
        }
        onChange={async (_, value) => {
          try {
            await handleCategoryChange(value);
          } catch (error: any) {
            enqueueSnackbar(
              error?.message ||
                t('business.items.createCategoryError', 'Failed to create category'),
              { variant: 'error' }
            );
          }
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t('business.items.category', 'Category')}
            placeholder={t('business.items.selectCategory', 'Select category')}
          />
        )}
      />
      <Autocomplete<SubCategoryChoice>
        options={subCategories}
        value={selectedSubCategory}
        loading={categoriesLoading}
        disabled={busy || categoryId == null}
        disableClearable={selectedSubCategory != null}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        filterOptions={(options, state) =>
          filterWithCreateOption(
            options,
            state.inputValue,
            (name) => t('business.items.addNamedOption', 'Add "{{name}}"', { name })
          )
        }
        onChange={async (_, value) => {
          try {
            await handleSubCategoryChange(value);
          } catch (error: any) {
            enqueueSnackbar(
              error?.message ||
                t(
                  'business.items.createSubCategoryError',
                  'Failed to create subcategory'
                ),
              { variant: 'error' }
            );
          }
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t('business.items.subCategory', 'Sub Category')}
            placeholder={
              categoryId == null
                ? t('business.items.selectCategoryFirst', 'Select category first')
                : t('business.items.selectSubCategory', 'Select sub category')
            }
          />
        )}
      />
      {needsSubcategory ? (
        <Typography variant="caption" color="text.secondary">
          {t(
            'business.items.selectSubCategoryToSave',
            'Choose a subcategory to save'
          )}
        </Typography>
      ) : null}
    </Stack>
  );
};

export default ItemCategoryEditor;
