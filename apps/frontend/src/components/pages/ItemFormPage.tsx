import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
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
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { CURRENCIES, WEIGHT_UNITS } from '../../constants/enums';
import { useAi } from '../../hooks/useAi';
import { useBrands } from '../../hooks/useBrands';
import { useCategories } from '../../hooks/useCategory';
import { useGraphQLRequest } from '../../hooks/useGraphQLRequest';
import { CreateItemData, Item, useItems } from '../../hooks/useItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import SEOHead from '../seo/SEOHead';

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
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfile();
  const { generateDescription, loading: aiLoading } = useAi();

  const isEditMode = !!itemId;

  const [formData, setFormData] = useState<ItemFormData>({
    name: '',
    description: '',
    price: 0,
    currency: 'XAF',
    sku: '',
    weight: null,
    weight_unit: 'g',
    brand_id: null,
    model: '',
    color: '#000000',
    is_fragile: false,
    is_perishable: false,
    requires_special_handling: false,
    min_order_quantity: 1,
    max_order_quantity: 1,
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
              brand_id: foundItem.brand_id || null,
              model: foundItem.model || '',
              color: foundItem.color || '#000000',
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

  const handleBack = () => {
    navigate('/business/items');
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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            variant="outlined"
          >
            {t('common.back')}
          </Button>
          <Typography variant="h4" component="h1">
            {isEditMode
              ? t('business.items.editItem')
              : t('business.items.addItem')}
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          {isEditMode
            ? t('business.items.editItemDescription')
            : t('business.items.addItemDescription')}
        </Typography>
      </Box>

      {/* Form */}
      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid size={12}>
              <Typography variant="h6" gutterBottom>
                {t('business.items.basicInformation')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                label={t('business.items.name')}
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                disabled={loading}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                label={t('business.items.sku')}
                value={formData.sku}
                onChange={(e) => handleInputChange('sku', e.target.value)}
                disabled={loading || skusLoading}
                error={!!skuError}
                helperText={skuError || t('business.items.skuHelper')}
              />
            </Grid>

            {/* Category Selection */}
            <Grid size={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                {t('business.items.category', 'Category')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth disabled={loading || categoriesLoading}>
                <InputLabel>
                  {t('business.items.category', 'Category')}
                </InputLabel>
                <Select
                  value={selectedCategoryId || ''}
                  onChange={(e) => {
                    const categoryId = e.target.value;
                    setSelectedCategoryId(categoryId);
                    // Clear subcategory when category changes
                    handleInputChange('item_sub_category_id', null);
                    setSelectedSubCategoryId(null);
                  }}
                  label={t('business.items.category', 'Category')}
                >
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth disabled={loading || categoriesLoading}>
                <InputLabel>
                  {t('business.items.subCategory', 'Sub Category')}
                </InputLabel>
                <Select
                  value={selectedSubCategoryId || ''}
                  onChange={(e) => {
                    handleInputChange(
                      'item_sub_category_id',
                      e.target.value as unknown as number
                    );
                    setSelectedSubCategoryId(
                      e.target.value as unknown as number
                    );
                  }}
                  label={t('business.items.subCategory', 'Sub Category')}
                >
                  {categoriesLoading && (
                    <MenuItem value="" disabled>
                      {t(
                        'business.items.loadingSubCategories',
                        'Loading subcategories...'
                      )}
                    </MenuItem>
                  )}
                  {!categoriesLoading && !selectedCategoryId && (
                    <MenuItem value="" disabled>
                      {t(
                        'business.items.selectCategoryFirst',
                        'Select a category first'
                      )}
                    </MenuItem>
                  )}
                  {!categoriesLoading &&
                    selectedCategoryId &&
                    getSubCategoriesByCategory(selectedCategoryId).length ===
                      0 && (
                      <MenuItem value="" disabled>
                        {t(
                          'business.items.noSubCategories',
                          'No subcategories available'
                        )}
                      </MenuItem>
                    )}
                  {!categoriesLoading && selectedCategoryId
                    ? getSubCategoriesByCategory(selectedCategoryId).map(
                        (subCategory) => (
                          <MenuItem key={subCategory.id} value={subCategory.id}>
                            {subCategory.name}
                          </MenuItem>
                        )
                      )
                    : !categoriesLoading &&
                      categories.flatMap((category) =>
                        category.item_sub_categories.map((subCategory) => (
                          <MenuItem key={subCategory.id} value={subCategory.id}>
                            {subCategory.name}
                          </MenuItem>
                        ))
                      )}
                </Select>
              </FormControl>
            </Grid>

            {/* Pricing */}
            <Grid size={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                {t('business.items.pricing')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label={t('business.items.price')}
                type="number"
                value={formData.price}
                onChange={(e) =>
                  handleInputChange('price', parseFloat(e.target.value) || 0)
                }
                required
                disabled={loading}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth required disabled={loading}>
                <InputLabel>{t('business.items.currency')}</InputLabel>
                <Select
                  value={formData.currency}
                  onChange={(e) =>
                    handleInputChange('currency', e.target.value)
                  }
                  label={t('business.items.currency')}
                >
                  {CURRENCIES.map((currency) => (
                    <MenuItem key={currency} value={currency}>
                      {currency}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Specifications */}
            <Grid size={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                {t('business.items.specifications')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label={t('business.items.weight')}
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

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth disabled={loading}>
                <InputLabel>{t('business.items.weightUnit')}</InputLabel>
                <Select
                  value={formData.weight_unit}
                  onChange={(e) =>
                    handleInputChange('weight_unit', e.target.value)
                  }
                  label={t('business.items.weightUnit')}
                >
                  {WEIGHT_UNITS.map((unit) => (
                    <MenuItem key={unit} value={unit}>
                      {unit.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                label={t('business.items.model')}
                value={formData.model}
                onChange={(e) => handleInputChange('model', e.target.value)}
                disabled={loading}
              />
            </Grid>

            <Grid size={12}>
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
                  brands.find((brand) => brand.id === formData.brand_id) || null
                }
                onChange={async (_, newValue) => {
                  if (typeof newValue === 'string' && newValue.trim()) {
                    // User typed a new brand name
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
                      // Keep the brand_id as null if creation fails
                      handleInputChange('brand_id', null as unknown as string);
                    }
                  } else if (newValue && typeof newValue === 'object') {
                    // User selected an existing brand
                    handleInputChange(
                      'brand_id',
                      newValue.id as unknown as string
                    );
                  } else {
                    // User cleared the selection
                    handleInputChange('brand_id', null);
                  }
                }}
                onInputChange={(_, newInputValue) => {
                  // This handles the case where user types but doesn't select/create
                  // We don't need to do anything here as the onChange will handle selection/creation
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label={t('business.items.brand')}
                    disabled={loading || brandsLoading}
                    helperText={
                      brandsLoading
                        ? 'Loading brands...'
                        : 'Type to search or create a new brand'
                    }
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box>
                      <Typography variant="body1">{option.name}</Typography>
                      {option.description && (
                        <Typography variant="caption" color="text.secondary">
                          {option.description}
                        </Typography>
                      )}
                    </Box>
                  </li>
                )}
                loading={brandsLoading}
                filterOptions={(options, { inputValue }) => {
                  const filtered = options.filter((option) =>
                    option.name.toLowerCase().includes(inputValue.toLowerCase())
                  );
                  return filtered;
                }}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                label={t('business.items.color')}
                type="color"
                value={formData.color}
                onChange={(e) => handleInputChange('color', e.target.value)}
                disabled={loading}
                sx={{
                  '& input[type="color"]': {
                    height: '56px',
                    cursor: 'pointer',
                  },
                }}
              />
            </Grid>

            {/* Special Handling Properties */}
            <Grid size={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                {t('business.items.specialHandling', 'Special Handling')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid size={12}>
              <Stack
                direction="row"
                spacing={2}
                sx={{ flexWrap: 'wrap', gap: 2 }}
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
            </Grid>

            {/* Order Settings */}
            <Grid size={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                {t('business.items.orderSettings')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label={t('business.items.minOrderQuantity')}
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

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label={t('business.items.maxOrderQuantity')}
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
                helperText={t('business.items.maxOrderQuantityHelper')}
              />
            </Grid>

            {/* Description Section */}
            <Grid size={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                {t('business.items.description', 'Description')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid size={12}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <TextField
                  fullWidth
                  label={t('business.items.description')}
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange('description', e.target.value)
                  }
                  multiline
                  rows={3}
                  required
                  disabled={loading}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="outlined"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={handleGenerateDescription}
                  disabled={loading || aiLoading || !formData.name}
                  sx={{
                    minWidth: '140px',
                    height: '56px',
                    alignSelf: 'flex-start',
                  }}
                >
                  {aiLoading ? 'Generating...' : 'Generate'}
                </Button>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: 'block' }}
              >
                {t(
                  'business.items.generateDescriptionHelper',
                  'Click "Generate" to create an AI-powered description based on your product details'
                )}
              </Typography>
            </Grid>

            {/* Error Display */}
            {error && (
              <Grid size={12}>
                <Alert severity="error">{error}</Alert>
              </Grid>
            )}

            {/* Submit Button */}
            <Grid size={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleBack}
                  disabled={loading}
                >
                  {t('common.cancel')}
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
                >
                  {loading
                    ? t('common.saving')
                    : isEditMode
                    ? t('business.items.updateItem')
                    : t('business.items.createItem')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
  );
};

export default ItemFormPage;
