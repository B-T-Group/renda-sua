import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CURRENCIES } from '../../constants/enums';
import { useItems } from '../../hooks/useItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import SEOHead from '../seo/SEOHead';

interface ItemFormData {
  name: string;
  description: string;
  price: number;
  currency: string;
  sku: string;
  size: number | null;
  size_unit: string;
  weight: number | null;
  weight_unit: string;
  brand_id: string | null;
  model: string;
  color: string;
  material: string;
  is_fragile: boolean;
  is_perishable: boolean;
  requires_special_handling: boolean;
  max_delivery_distance: number | null;
  estimated_delivery_time: number | null;
  min_order_quantity: number;
  max_order_quantity: number | null;
  item_sub_category_id: number | null;
  is_active: boolean;
}

const AddItemPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfile();

  const [formData, setFormData] = useState<ItemFormData>({
    name: '',
    description: '',
    price: 0,
    currency: 'USD',
    sku: '',
    size: null,
    size_unit: 'cm',
    weight: null,
    weight_unit: 'g',
    brand_id: null,
    model: '',
    color: '',
    material: '',
    is_fragile: false,
    is_perishable: false,
    requires_special_handling: false,
    max_delivery_distance: null,
    estimated_delivery_time: null,
    min_order_quantity: 1,
    max_order_quantity: 1,
    item_sub_category_id: null,
    is_active: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    itemSubCategories,
    error: dataError,
    fetchBrands,
    fetchItemSubCategories,
    createItem,
  } = useItems(profile?.business?.id);

  useEffect(() => {
    if (profile?.business?.id) {
      fetchBrands();
      fetchItemSubCategories();
    }
  }, [profile?.business?.id]);

  // Auto-select a default subcategory if none chosen (Option A)
  useEffect(() => {
    if (
      !formData.item_sub_category_id &&
      itemSubCategories &&
      itemSubCategories.length > 0
    ) {
      setFormData((prev) => ({
        ...prev,
        item_sub_category_id: itemSubCategories[0].id,
      }));
    }
  }, [itemSubCategories, formData.item_sub_category_id]);

  const handleInputChange = (field: keyof ItemFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile?.business?.id) {
      setError('Business profile not found');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const itemData = {
        ...formData,
        business_id: profile.business.id,
        // Coerce nullable values to undefined to satisfy CreateItemData
        size: formData.size ?? undefined,
        weight: formData.weight ?? undefined,
        brand_id: formData.brand_id ?? undefined,
        max_delivery_distance: formData.max_delivery_distance ?? undefined,
        estimated_delivery_time: formData.estimated_delivery_time ?? undefined,
        max_order_quantity: formData.max_order_quantity ?? undefined,
        item_sub_category_id: (formData.item_sub_category_id ??
          itemSubCategories?.[0]?.id) as number,
      };

      const newItem = await createItem(itemData);

      enqueueSnackbar(t('business.items.itemCreated'), {
        variant: 'success',
      });

      // Redirect to the item view page
      navigate(`/business/items/${newItem.id}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create item';
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

  if (dataError) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{dataError}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('business.items.addItem')}
        description="Add a new item to your business catalog"
        keywords="add item, create item, business catalog"
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
            {t('business.items.addItem')}
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          {t('business.items.addItemDescription')}
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
                disabled={loading}
                helperText={t('business.items.skuHelper')}
              />
            </Grid>

            <Grid size={12}>
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
              />
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
                label={t('business.items.size')}
                type="number"
                value={formData.size || ''}
                onChange={(e) =>
                  handleInputChange('size', parseFloat(e.target.value) || null)
                }
                disabled={loading}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label={t('business.items.sizeUnit')}
                value={formData.size_unit}
                onChange={(e) => handleInputChange('size_unit', e.target.value)}
                disabled={loading}
                defaultValue="cm"
              />
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
              <TextField
                fullWidth
                label={t('business.items.weightUnit')}
                value={formData.weight_unit}
                onChange={(e) =>
                  handleInputChange('weight_unit', e.target.value)
                }
                disabled={loading}
                defaultValue="g"
              />
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
              <TextField
                fullWidth
                label={t('business.items.color')}
                value={formData.color}
                onChange={(e) => handleInputChange('color', e.target.value)}
                disabled={loading}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                label={t('business.items.material')}
                value={formData.material}
                onChange={(e) => handleInputChange('material', e.target.value)}
                disabled={loading}
              />
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
                defaultValue={1}
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
                    !formData.name ||
                    !formData.description ||
                    formData.price <= 0
                  }
                >
                  {loading
                    ? t('common.saving')
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

export default AddItemPage;
