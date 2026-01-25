import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  ExpandLess,
  ExpandMore,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Collapse,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { CURRENCIES, WEIGHT_UNITS } from '../../constants/enums';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAi } from '../../hooks/useAi';
import { useBrands } from '../../hooks/useBrands';
import {
  ItemCategory,
  ItemSubCategory,
  useCategories,
} from '../../hooks/useCategory';
import { useGraphQLRequest } from '../../hooks/useGraphQLRequest';
import { CreateItemData, Item, useItems } from '../../hooks/useItems';
import SEOHead from '../seo/SEOHead';

// Extended types for create options
interface CreateCategoryOption {
  id: string;
  name: string;
  description: string;
  status: string;
  isCreateOption: true;
  createValue: string;
}

interface CreateSubCategoryOption {
  id: string;
  name: string;
  description: string;
  status: string;
  isCreateOption: true;
  createValue: string;
}

type CategoryOption = ItemCategory | CreateCategoryOption;
type SubCategoryOption = ItemSubCategory | CreateSubCategoryOption;

const GET_ALL_SKUS = `
  query GetAllSkus {
    items {
      id
      sku
    }
  }
`;

interface ItemFormData {
  name: string;
  description: string;
  price: number;
  currency: string;
  sku: string;
  weight: number | null;
  weight_unit: string;
  dimensions: string;
  brand_id: string | null;
  model: string;
  color: string;
  is_fragile: boolean;
  is_perishable: boolean;
  requires_special_handling: boolean;
  min_order_quantity: number;
  max_order_quantity: number | null;
  item_sub_category_id: number | null;
  is_active: boolean;
}

const ItemFormPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfileContext();
  const { generateDescription, loading: aiLoading } = useAi();

  const isEditMode = !!itemId;

  // Collapsible sections state
  const [optionalDetailsOpen, setOptionalDetailsOpen] = useState(false);

  const [formData, setFormData] = useState<ItemFormData>({
    name: '',
    description: '',
    price: 0,
    currency: 'XAF',
    sku: '',
    weight: null,
    weight_unit: 'g',
    dimensions: '',
    brand_id: null,
    model: '',
    color: '',
    is_fragile: false,
    is_perishable: false,
    requires_special_handling: false,
    min_order_quantity: 1,
    max_order_quantity: null,
    item_sub_category_id: null,
    is_active: true,
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );

  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<
    number | null
  >(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);

  // SKU validation state
  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set());
  const [skuError, setSkuError] = useState<string | null>(null);
  const [skusLoading, setSkusLoading] = useState(false);
  const [feeApplied, setFeeApplied] = useState(false);

  // GraphQL request for fetching all SKUs
  const { execute: executeSkusQuery } = useGraphQLRequest(GET_ALL_SKUS);

  const {
    loading: dataLoading,
    error: dataError,
    fetchBrands: fetchBrandsFromItems,
    fetchSingleItem,
    createItem,
    updateItem,
  } = useItems(profile?.business?.id);

  const {
    brands,
    loading: brandsLoading,
    error: brandsError,
    createBrand,
  } = useBrands();

  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
    getSubCategoriesByCategory,
    createCategory,
    createSubcategory,
  } = useCategories();

  useEffect(() => {
    if (profile?.business?.id) {
      fetchBrandsFromItems();
    }
  }, [profile?.business?.id, fetchBrandsFromItems]);

  // Auto-select a default subcategory if none chosen (for add mode)
  useEffect(() => {
    if (
      !isEditMode &&
      !formData.item_sub_category_id &&
      categories &&
      categories.length > 0 &&
      categories[0].item_sub_categories &&
      categories[0].item_sub_categories.length > 0
    ) {
      setFormData((prev) => ({
        ...prev,
        item_sub_category_id: categories[0].item_sub_categories[0].id,
      }));
      setSelectedSubCategoryId(categories[0].item_sub_categories[0].id);
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, formData.item_sub_category_id, isEditMode]);

  // Fetch item data for edit mode
  useEffect(() => {
    if (isEditMode && itemId && profile?.business?.id) {
      const fetchItem = async () => {
        try {
          const foundItem = await fetchSingleItem(itemId);
          if (foundItem) {
            setItem(foundItem);
            setFormData({
              name: foundItem.name || '',
              description: foundItem.description || '',
              price: foundItem.price || 0,
              currency: foundItem.currency || 'XAF',
              sku: foundItem.sku || '',
              weight: foundItem.weight || null,
              weight_unit: foundItem.weight_unit || 'g',
              dimensions: foundItem.dimensions || '',
              brand_id: foundItem.brand_id || null,
              model: foundItem.model || '',
              color: foundItem.color || '',
              is_fragile: foundItem.is_fragile || false,
              is_perishable: foundItem.is_perishable || false,
              requires_special_handling:
                foundItem.requires_special_handling || false,
              min_order_quantity: foundItem.min_order_quantity || 1,
              max_order_quantity: foundItem.max_order_quantity || null,
              item_sub_category_id: foundItem.item_sub_category_id || null,
              is_active:
                foundItem.is_active !== undefined ? foundItem.is_active : true,
            });

            // Set category and subcategory for edit mode
            if (foundItem.item_sub_category) {
              setSelectedCategoryId(
                foundItem.item_sub_category.item_category_id
              );
              setSelectedSubCategoryId(foundItem.item_sub_category_id);
            }

            // Open optional details if color is set
            if (foundItem.color) {
              setOptionalDetailsOpen(true);
            }
          }
        } catch (err) {
          setError('Failed to fetch item details');
          console.error('Error fetching item:', err);
        }
      };

      fetchItem();
    }
  }, [isEditMode, itemId, profile?.business?.id, fetchSingleItem]);

  // Fetch all existing SKUs
  const fetchExistingSkus = useCallback(async () => {
    setSkusLoading(true);
    try {
      const result = await executeSkusQuery();
      const skus =
        result.items
          ?.map((item: { sku: string | null }) => item.sku)
          .filter(
            (sku: string | null): sku is string =>
              sku !== null && sku.trim() !== ''
          ) || [];

      setExistingSkus(new Set(skus));
    } catch (err) {
      console.error('Error fetching existing SKUs:', err);
    } finally {
      setSkusLoading(false);
    }
  }, [executeSkusQuery]);

  // Fetch existing SKUs on component mount
  useEffect(() => {
    fetchExistingSkus();
  }, [fetchExistingSkus]);

  const handleInputChange = (
    field: keyof ItemFormData,
    value: string | number | boolean | null
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Validate SKU when it changes
    if (field === 'sku' && typeof value === 'string') {
      validateSku(value);
    }
  };

  // Validate SKU uniqueness
  const validateSku = (sku: string) => {
    if (!sku || sku.trim() === '') {
      setSkuError(null);
      return true;
    }

    const trimmedSku = sku.trim();

    // In edit mode, allow the current item's SKU
    if (isEditMode && item && item.sku === trimmedSku) {
      setSkuError(null);
      return true;
    }

    // Check if SKU already exists
    if (existingSkus.has(trimmedSku)) {
      setSkuError(
        t('business.items.skuAlreadyExists', 'This SKU already exists')
      );
      return false;
    }

    setSkuError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile?.business?.id) {
      setError('Business profile not found');
      return;
    }

    // Validate SKU before submission
    if (!validateSku(formData.sku)) {
      setError('Please fix the SKU error before submitting');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result;
      if (isEditMode && itemId) {
        // For updates, exclude business_id as it's not allowed in items_set_input
        const updateData = {
          ...formData,
          // Coerce nullable values to undefined to satisfy API requirements
          weight: formData.weight ?? undefined,
          brand_id: formData.brand_id ?? undefined,
          max_order_quantity: formData.max_order_quantity ?? undefined,
          color: formData.color || undefined,
          dimensions: formData.dimensions?.trim() || undefined,
          item_sub_category_id: (formData.item_sub_category_id ??
            categories?.[0]?.item_sub_categories?.[0]?.id) as unknown as string,
        };

        result = await updateItem(
          itemId,
          updateData as unknown as Partial<CreateItemData>
        );
        enqueueSnackbar(t('business.items.itemUpdated'), {
          variant: 'success',
        });
      } else {
        // For creation, include business_id
        const createData = {
          ...formData,
          business_id: profile.business.id,
          // Coerce nullable values to undefined to satisfy API requirements
          weight: formData.weight ?? undefined,
          brand_id: formData.brand_id ?? undefined,
          max_order_quantity: formData.max_order_quantity ?? undefined,
          color: formData.color || undefined,
          dimensions: formData.dimensions?.trim() || undefined,
          item_sub_category_id: (formData.item_sub_category_id ??
            categories?.[0]?.item_sub_categories?.[0]?.id) as unknown as string,
        };

        result = await createItem(createData as unknown as CreateItemData);
        enqueueSnackbar(t('business.items.itemCreated'), {
          variant: 'success',
        });
      }

      // Redirect to the item view page
      navigate(`/business/items/${result.id}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : `Failed to ${isEditMode ? 'update' : 'create'} item`;
      setError(errorMessage);
      enqueueSnackbar(errorMessage, {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToItems = () => {
    navigate('/business/items');
  };

  const handleBackToItem = () => {
    if (itemId) {
      navigate(`/business/items/${itemId}`);
    }
  };

  const handleApplyFee = () => {
    if (formData.price > 0) {
      const fee = formData.price * 0.035; // 3.5% fee
      const newPrice = formData.price + fee;
      handleInputChange('price', newPrice);
      setFeeApplied(true);
      enqueueSnackbar(
        t('business.items.feeApplied', '3.5% payment platform fee applied'),
        { variant: 'success' }
      );
    }
  };

  const handleGenerateDescription = async () => {
    try {
      // Get category and subcategory names
      const category = categories.find((cat) => cat.id === selectedCategoryId);
      const subCategory = category?.item_sub_categories.find(
        (sub) => sub.id === selectedSubCategoryId
      );

      // Get brand name
      const brand = brands.find((b) => b.id === formData.brand_id);

      const request = {
        name: formData.name,
        sku: formData.sku || undefined,
        category: category?.name || undefined,
        subCategory: subCategory?.name || undefined,
        price: formData.price || undefined,
        currency: formData.currency || undefined,
        weight: formData.weight || undefined,
        weightUnit: formData.weight_unit || undefined,
        brand: brand?.name || undefined,
        language: 'en' as const, // You can make this configurable later
      };

      const result = await generateDescription(request);

      if (result.success) {
        handleInputChange('description', result.description);
        enqueueSnackbar('Description generated successfully!', {
          variant: 'success',
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to generate description';
      enqueueSnackbar(errorMessage, {
        variant: 'error',
      });
    }
  };

  if (dataError || brandsError || categoriesError) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {dataError || brandsError || categoriesError}
        </Alert>
      </Container>
    );
  }

  if (isEditMode && dataLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <Typography>Loading item details...</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <SEOHead
        title={
          isEditMode
            ? t('business.items.editItem')
            : t('business.items.addItem')
        }
        description={
          isEditMode
            ? 'Edit item details in your business catalog'
            : 'Add a new item to your business catalog'
        }
        keywords={
          isEditMode
            ? 'edit item, update item, business catalog'
            : 'add item, create item, business catalog'
        }
      />

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          sx={{ mb: 1 }}
          flexWrap="wrap"
        >
          {isEditMode ? (
            <>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleBackToItem}
                variant="outlined"
                size={isMobile ? 'small' : 'medium'}
              >
                {t('business.items.backToItem', 'Back to Item')}
              </Button>
              <Button
                onClick={handleBackToItems}
                variant="text"
                size={isMobile ? 'small' : 'medium'}
              >
                {t('business.items.backToItemsList', 'All Items')}
              </Button>
            </>
          ) : (
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleBackToItems}
              variant="outlined"
              size={isMobile ? 'small' : 'medium'}
            >
              {t('common.back', 'Back')}
            </Button>
          )}
        </Stack>
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' }, fontWeight: 700 }}
        >
          {isEditMode
            ? t('business.items.editItem', 'Edit Item')
            : t('business.items.addItem', 'Add New Item')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {isEditMode
            ? t(
                'business.items.editItemDescription',
                'Update item details and save changes'
              )
            : t(
                'business.items.addItemDescription',
                'Fill in the essential details to quickly add your item'
              )}
        </Typography>
      </Box>

      {/* Form */}
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={3}>
            {/* SECTION 1: Essential Information */}
            <Box>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ fontWeight: 600, mb: 2 }}
              >
                {t('business.items.essentialInfo', 'Essential Information')}
              </Typography>

              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label={t('business.items.name', 'Item Name')}
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  disabled={loading}
                  placeholder={t(
                    'business.items.namePlaceholder',
                    'e.g., Wireless Mouse, Laptop Bag, Coffee Beans'
                  )}
                  autoFocus
                />

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Autocomplete
                      freeSolo
                      selectOnFocus
                      clearOnBlur
                      handleHomeEndKeys
                      options={categories as CategoryOption[]}
                      getOptionLabel={(option) => {
                        if (typeof option === 'string') {
                          return option;
                        }
                        return option.name;
                      }}
                      value={
                        categories.find(
                          (category) => category.id === selectedCategoryId
                        ) || null
                      }
                      onChange={async (_, newValue) => {
                        if (typeof newValue === 'string' && newValue.trim()) {
                          try {
                            const newCategory = await createCategory(
                              newValue.trim()
                            );
                            setSelectedCategoryId(newCategory.id);
                            handleInputChange('item_sub_category_id', null);
                            setSelectedSubCategoryId(null);
                          } catch (err) {
                            console.error('Failed to create category:', err);
                            enqueueSnackbar('Failed to create category', {
                              variant: 'error',
                            });
                          }
                        } else if (newValue && typeof newValue === 'object') {
                          if (
                            'isCreateOption' in newValue &&
                            newValue.isCreateOption
                          ) {
                            try {
                              const newCategory = await createCategory(
                                newValue.createValue
                              );
                              setSelectedCategoryId(newCategory.id);
                              handleInputChange('item_sub_category_id', null);
                              setSelectedSubCategoryId(null);
                            } catch (err) {
                              console.error('Failed to create category:', err);
                              enqueueSnackbar('Failed to create category', {
                                variant: 'error',
                              });
                            }
                          } else {
                            setSelectedCategoryId(
                              (newValue as ItemCategory).id
                            );
                            handleInputChange('item_sub_category_id', null);
                            setSelectedSubCategoryId(null);
                          }
                        } else {
                          setSelectedCategoryId(null);
                          handleInputChange('item_sub_category_id', null);
                          setSelectedSubCategoryId(null);
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          label={t('business.items.category', 'Category')}
                          disabled={loading || categoriesLoading}
                          placeholder="Electronics, Food, Clothing..."
                        />
                      )}
                      renderOption={(props, option) => (
                        <li {...props}>
                          <Box>
                            {'isCreateOption' in option &&
                            option.isCreateOption ? (
                              <>
                                <Typography variant="body1" color="primary">
                                  {option.name}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {option.description}
                                </Typography>
                              </>
                            ) : (
                              <Typography variant="body1">
                                {option.name}
                              </Typography>
                            )}
                          </Box>
                        </li>
                      )}
                      loading={categoriesLoading}
                      filterOptions={(options, { inputValue }) => {
                        const filtered = options.filter((option) =>
                          option.name
                            .toLowerCase()
                            .includes(inputValue.toLowerCase())
                        );

                        const inputValueTrimmed = inputValue.trim();
                        const isExisting = options.some(
                          (option) =>
                            option.name.toLowerCase() ===
                            inputValueTrimmed.toLowerCase()
                        );

                        if (inputValueTrimmed && !isExisting) {
                          return [
                            ...filtered,
                            {
                              id: 'create-new',
                              name: `Add "${inputValueTrimmed}"`,
                              description: 'Create a new category',
                              status: 'draft',
                              isCreateOption: true as const,
                              createValue: inputValueTrimmed,
                            } as CreateCategoryOption,
                          ];
                        }

                        return filtered;
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Autocomplete
                      freeSolo
                      selectOnFocus
                      clearOnBlur
                      handleHomeEndKeys
                      options={
                        selectedCategoryId
                          ? (getSubCategoriesByCategory(
                              selectedCategoryId
                            ) as SubCategoryOption[])
                          : []
                      }
                      getOptionLabel={(option) => {
                        if (typeof option === 'string') {
                          return option;
                        }
                        return option.name;
                      }}
                      value={
                        selectedCategoryId
                          ? getSubCategoriesByCategory(selectedCategoryId).find(
                              (sub) => sub.id === selectedSubCategoryId
                            ) || null
                          : null
                      }
                      onChange={async (_, newValue) => {
                        if (
                          typeof newValue === 'string' &&
                          newValue.trim() &&
                          selectedCategoryId
                        ) {
                          try {
                            const newSubcategory = await createSubcategory(
                              newValue.trim(),
                              selectedCategoryId
                            );
                            setSelectedSubCategoryId(newSubcategory.id);
                            handleInputChange(
                              'item_sub_category_id',
                              newSubcategory.id
                            );
                          } catch (err) {
                            console.error('Failed to create subcategory:', err);
                            enqueueSnackbar('Failed to create subcategory', {
                              variant: 'error',
                            });
                          }
                        } else if (newValue && typeof newValue === 'object') {
                          if (
                            'isCreateOption' in newValue &&
                            newValue.isCreateOption
                          ) {
                            try {
                              const newSubcategory = await createSubcategory(
                                newValue.createValue,
                                selectedCategoryId as number
                              );
                              setSelectedSubCategoryId(newSubcategory.id);
                              handleInputChange(
                                'item_sub_category_id',
                                newSubcategory.id
                              );
                            } catch (err) {
                              console.error(
                                'Failed to create subcategory:',
                                err
                              );
                              enqueueSnackbar('Failed to create subcategory', {
                                variant: 'error',
                              });
                            }
                          } else {
                            setSelectedSubCategoryId(
                              (newValue as ItemSubCategory).id
                            );
                            handleInputChange(
                              'item_sub_category_id',
                              (newValue as ItemSubCategory).id
                            );
                          }
                        } else {
                          setSelectedSubCategoryId(null);
                          handleInputChange('item_sub_category_id', null);
                        }
                      }}
                      disabled={
                        !selectedCategoryId || loading || categoriesLoading
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          label={t(
                            'business.items.subCategory',
                            'Sub Category'
                          )}
                          disabled={
                            !selectedCategoryId || loading || categoriesLoading
                          }
                          placeholder={
                            !selectedCategoryId
                              ? 'Select category first'
                              : 'Smartphones, Laptops...'
                          }
                        />
                      )}
                      renderOption={(props, option) => (
                        <li {...props}>
                          <Box>
                            {'isCreateOption' in option &&
                            option.isCreateOption ? (
                              <>
                                <Typography variant="body1" color="primary">
                                  {option.name}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {option.description}
                                </Typography>
                              </>
                            ) : (
                              <Typography variant="body1">
                                {option.name}
                              </Typography>
                            )}
                          </Box>
                        </li>
                      )}
                      loading={categoriesLoading}
                      filterOptions={(options, { inputValue }) => {
                        const filtered = options.filter((option) =>
                          option.name
                            .toLowerCase()
                            .includes(inputValue.toLowerCase())
                        );

                        const inputValueTrimmed = inputValue.trim();
                        const isExisting = options.some(
                          (option) =>
                            option.name.toLowerCase() ===
                            inputValueTrimmed.toLowerCase()
                        );

                        if (
                          inputValueTrimmed &&
                          !isExisting &&
                          selectedCategoryId
                        ) {
                          return [
                            ...filtered,
                            {
                              id: 'create-new-subcategory',
                              name: `Add "${inputValueTrimmed}"`,
                              description: 'Create a new subcategory',
                              status: 'draft',
                              isCreateOption: true as const,
                              createValue: inputValueTrimmed,
                            } as CreateSubCategoryOption,
                          ];
                        }

                        return filtered;
                      }}
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <TextField
                      fullWidth
                      label={t('business.items.price', 'Price')}
                      type="number"
                      value={formData.price}
                      onChange={(e) => {
                        handleInputChange(
                          'price',
                          parseFloat(e.target.value) || 0
                        );
                        if (feeApplied) {
                          setFeeApplied(false);
                        }
                      }}
                      required
                      disabled={loading}
                      inputProps={{ min: 0, step: 0.01 }}
                    />

                    {/* Payment Platform Fee Section - Only for new items */}
                    {!isEditMode && formData.price > 0 && !feeApplied && (
                      <Box sx={{ mt: 1 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                        >
                          <Button
                            variant="text"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleApplyFee}
                            disabled={loading}
                            sx={{ fontSize: '0.8125rem' }}
                          >
                            {t(
                              'business.items.addPaymentFee',
                              'Add 3.5% Payment Fee'
                            )}
                          </Button>
                          <Chip
                            label={`+${(formData.price * 0.035).toFixed(2)} ${
                              formData.currency
                            }`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Stack>
                      </Box>
                    )}

                    {!isEditMode && feeApplied && (
                      <Alert severity="success" sx={{ mt: 1 }}>
                        <Typography variant="caption">
                          {t(
                            'business.items.feeAppliedSuccess',
                            'Payment fee included'
                          )}
                        </Typography>
                      </Alert>
                    )}
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth required disabled={loading}>
                      <InputLabel>
                        {t('business.items.currency', 'Currency')}
                      </InputLabel>
                      <Select
                        value={formData.currency}
                        onChange={(e) =>
                          handleInputChange('currency', e.target.value)
                        }
                        label={t('business.items.currency', 'Currency')}
                      >
                        {CURRENCIES.map((currency) => (
                          <MenuItem key={currency} value={currency}>
                            {currency}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Stack>
            </Box>

            <Divider />

            {/* SECTION 2: Product Details */}
            <Box>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ fontWeight: 600, mb: 2 }}
              >
                {t('business.items.productDetails', 'Product Details')}
              </Typography>

              <Stack spacing={2}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Autocomplete
                      freeSolo
                      options={brands}
                      getOptionLabel={(option) => {
                        if (typeof option === 'string') {
                          return option;
                        }
                        return option.name;
                      }}
                      value={
                        brands.find(
                          (brand) => brand.id === formData.brand_id
                        ) || null
                      }
                      onChange={async (_, newValue) => {
                        if (typeof newValue === 'string' && newValue.trim()) {
                          try {
                            const newBrand = await createBrand({
                              name: newValue.trim(),
                              description: '',
                            });
                            handleInputChange(
                              'brand_id',
                              newBrand.data.id as unknown as string
                            );
                          } catch (err) {
                            console.error('Failed to create brand:', err);
                            handleInputChange(
                              'brand_id',
                              null as unknown as string
                            );
                          }
                        } else if (newValue && typeof newValue === 'object') {
                          handleInputChange(
                            'brand_id',
                            newValue.id as unknown as string
                          );
                        } else {
                          handleInputChange('brand_id', null);
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          label={t('business.items.brand', 'Brand (Optional)')}
                          disabled={loading || brandsLoading}
                          placeholder="Nike, Apple, Samsung..."
                        />
                      )}
                      renderOption={(props, option) => (
                        <li {...props}>
                          <Box>
                            <Typography variant="body1">
                              {option.name}
                            </Typography>
                            {option.description && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {option.description}
                              </Typography>
                            )}
                          </Box>
                        </li>
                      )}
                      loading={brandsLoading}
                      filterOptions={(options, { inputValue }) => {
                        const filtered = options.filter((option) =>
                          option.name
                            .toLowerCase()
                            .includes(inputValue.toLowerCase())
                        );
                        return filtered;
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label={t('business.items.model', 'Model (Optional)')}
                      value={formData.model}
                      onChange={(e) =>
                        handleInputChange('model', e.target.value)
                      }
                      disabled={loading}
                      placeholder="Pro Max, XL, v2..."
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label={t('business.items.weight', 'Weight (Optional)')}
                      type="number"
                      value={formData.weight || ''}
                      onChange={(e) =>
                        handleInputChange(
                          'weight',
                          parseFloat(e.target.value) || null
                        )
                      }
                      disabled={loading}
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth disabled={loading}>
                      <InputLabel>
                        {t('business.items.weightUnit', 'Weight Unit')}
                      </InputLabel>
                      <Select
                        value={formData.weight_unit}
                        onChange={(e) =>
                          handleInputChange('weight_unit', e.target.value)
                        }
                        label={t('business.items.weightUnit', 'Weight Unit')}
                      >
                        {WEIGHT_UNITS.map((unit) => (
                          <MenuItem key={unit} value={unit}>
                            {unit.toUpperCase()}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <TextField
                  fullWidth
                  label={t('business.items.dimensions', 'Dimensions (Optional)')}
                  value={formData.dimensions}
                  onChange={(e) =>
                    handleInputChange('dimensions', e.target.value)
                  }
                  disabled={loading}
                  placeholder="e.g. 10 x 20 x 5 cm"
                />

                <TextField
                  fullWidth
                  label={t('business.items.sku', 'SKU (Optional)')}
                  value={formData.sku}
                  onChange={(e) => handleInputChange('sku', e.target.value)}
                  disabled={loading || skusLoading}
                  error={!!skuError}
                  helperText={
                    skuError ||
                    t('business.items.skuHelper', 'Stock Keeping Unit')
                  }
                  placeholder="ABC-123-XYZ"
                />
              </Stack>
            </Box>

            <Divider />

            {/* SECTION 3: Special Properties */}
            <Box>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ fontWeight: 600, mb: 2 }}
              >
                {t('business.items.specialProperties', 'Special Properties')}
              </Typography>

              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  flexWrap="wrap"
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_fragile}
                        onChange={(e) =>
                          handleInputChange('is_fragile', e.target.checked)
                        }
                        disabled={loading}
                      />
                    }
                    label={t('business.items.fragile', 'Fragile')}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_perishable}
                        onChange={(e) =>
                          handleInputChange('is_perishable', e.target.checked)
                        }
                        disabled={loading}
                      />
                    }
                    label={t('business.items.perishable', 'Perishable')}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.requires_special_handling}
                        onChange={(e) =>
                          handleInputChange(
                            'requires_special_handling',
                            e.target.checked
                          )
                        }
                        disabled={loading}
                      />
                    }
                    label={t(
                      'business.items.specialHandling',
                      'Requires Special Handling'
                    )}
                  />
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label={t(
                        'business.items.minOrderQuantity',
                        'Min Order Quantity'
                      )}
                      type="number"
                      value={formData.min_order_quantity}
                      onChange={(e) =>
                        handleInputChange(
                          'min_order_quantity',
                          parseInt(e.target.value) || 1
                        )
                      }
                      required
                      disabled={loading}
                      inputProps={{ min: 1 }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label={t(
                        'business.items.maxOrderQuantity',
                        'Max Order Quantity (Optional)'
                      )}
                      type="number"
                      value={formData.max_order_quantity || ''}
                      onChange={(e) =>
                        handleInputChange(
                          'max_order_quantity',
                          parseInt(e.target.value) || null
                        )
                      }
                      disabled={loading}
                      inputProps={{ min: 1 }}
                    />
                  </Grid>
                </Grid>
              </Stack>
            </Box>

            <Divider />

            {/* SECTION 4: Description (at the end) */}
            <Box>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ fontWeight: 600, mb: 2 }}
              >
                {t('business.items.description', 'Description')}
              </Typography>

              <Stack spacing={1}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    label={t('business.items.description', 'Description')}
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange('description', e.target.value)
                    }
                    multiline
                    rows={4}
                    required
                    disabled={loading}
                    sx={{ flex: 1 }}
                    placeholder={t(
                      'business.items.descriptionPlaceholder',
                      'Describe your product in detail...'
                    )}
                  />
                  <Button
                    variant="contained"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={handleGenerateDescription}
                    disabled={loading || aiLoading || !formData.name}
                    sx={{
                      minWidth: { xs: '100px', sm: '140px' },
                      height: '56px',
                      alignSelf: 'flex-start',
                    }}
                  >
                    {aiLoading
                      ? t('business.items.generating', 'AI...')
                      : t('business.items.generate', 'AI Generate')}
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'business.items.generateDescriptionHelper',
                    'Use AI to generate a professional description based on your product details'
                  )}
                </Typography>
              </Stack>
            </Box>

            {/* Optional Details Section - Collapsible */}
            <Box>
              <Button
                fullWidth
                onClick={() => setOptionalDetailsOpen(!optionalDetailsOpen)}
                endIcon={optionalDetailsOpen ? <ExpandLess /> : <ExpandMore />}
                sx={{
                  justifyContent: 'space-between',
                  textTransform: 'none',
                  color: 'text.secondary',
                  border: '1px dashed',
                  borderColor: 'divider',
                  py: 1.5,
                }}
              >
                <Typography variant="body2">
                  {t('business.items.optionalDetails', 'Optional Details')}
                </Typography>
              </Button>

              <Collapse in={optionalDetailsOpen}>
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label={t('business.items.color', 'Color (Optional)')}
                      type="color"
                      value={formData.color || '#000000'}
                      onChange={(e) =>
                        handleInputChange('color', e.target.value)
                      }
                      disabled={loading}
                      sx={{
                        '& input[type="color"]': {
                          height: '56px',
                          cursor: 'pointer',
                        },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        'business.items.colorHelper',
                        'Only specify if color is a key differentiator for this product'
                      )}
                    </Typography>
                  </Stack>
                </Box>
              </Collapse>
            </Box>

            {/* Error Display */}
            {error && <Alert severity="error">{error}</Alert>}

            {/* Submit Button */}
            <Box
              sx={{
                pt: 2,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 2,
                position: 'sticky',
                bottom: { xs: 0, md: 'unset' },
                bgcolor: 'background.paper',
                zIndex: 10,
                pb: { xs: 2, md: 0 },
              }}
            >
              <Button
                variant="outlined"
                onClick={isEditMode ? handleBackToItem : handleBackToItems}
                disabled={loading}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={
                  loading ||
                  skusLoading ||
                  !formData.name ||
                  !formData.description ||
                  formData.price <= 0 ||
                  !!skuError
                }
                sx={{ minWidth: 120 }}
              >
                {loading
                  ? t('common.saving', 'Saving...')
                  : isEditMode
                  ? t('business.items.updateItem', 'Update Item')
                  : t('business.items.createItem', 'Create Item')}
              </Button>
            </Box>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
};

export default ItemFormPage;
