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
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
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

const EditItemPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
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
    max_order_quantity: null,
    item_sub_category_id: null,
    is_active: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<any>(null);

  const {
    brands,
    itemSubCategories,
    loading: dataLoading,
    error: dataError,
    fetchBrands,
    fetchItemSubCategories,
    fetchSingleItem,
    updateItem,
  } = useItems(profile?.business?.id);

  useEffect(() => {
    if (profile?.business?.id) {
      fetchBrands();
      fetchItemSubCategories();
    }
  }, [profile?.business?.id]);

  useEffect(() => {
    if (itemId) {
      fetchItemDetails();
    }
  }, [itemId]);

  const fetchItemDetails = async () => {
    if (!itemId) return;

    setLoading(true);
    setError(null);

    try {
      const foundItem = await fetchSingleItem(itemId);
      if (foundItem) {
        setItem(foundItem);
        setFormData({
          name: foundItem.name || '',
          description: foundItem.description || '',
          price: foundItem.price || 0,
          currency: foundItem.currency || 'USD',
          sku: foundItem.sku || '',
          size: foundItem.size,
          size_unit: foundItem.size_unit || 'cm',
          weight: foundItem.weight,
          weight_unit: foundItem.weight_unit || 'g',
          brand_id: foundItem.brand_id,
          model: foundItem.model || '',
          color: foundItem.color || '',
          material: foundItem.material || '',
          is_fragile: foundItem.is_fragile || false,
          is_perishable: foundItem.is_perishable || false,
          requires_special_handling:
            foundItem.requires_special_handling || false,
          max_delivery_distance: foundItem.max_delivery_distance,
          estimated_delivery_time: foundItem.estimated_delivery_time,
          min_order_quantity: foundItem.min_order_quantity || 1,
          max_order_quantity: foundItem.max_order_quantity,
          item_sub_category_id: foundItem.item_sub_category_id,
          is_active: foundItem.is_active !== false,
        });
      } else {
        setError(t('business.items.itemNotFound'));
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch item details';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ItemFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemId || !profile?.business?.id) {
      setError('Item ID or business profile not found');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const itemData = {
        ...formData,
        business_id: profile.business.id,
      };

      await updateItem(itemId, itemData);

      enqueueSnackbar(t('business.items.itemUpdated'), {
        variant: 'success',
      });

      // Redirect to the item view page
      navigate(`/business/items/${itemId}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update item';
      setError(errorMessage);
      enqueueSnackbar(errorMessage, {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (itemId) {
      navigate(`/business/items/${itemId}`);
    } else {
      navigate('/business/items');
    }
  };

  if (dataError) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{dataError}</Alert>
      </Container>
    );
  }

  if (loading && !item) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography>{t('common.loading')}</Typography>
      </Container>
    );
  }

  if (error && !item) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('business.items.editItem')}
        description="Edit item details in your business catalog"
        keywords="edit item, update item, business catalog"
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
            {t('business.items.editItem')}
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          {t('business.items.editItemDescription')}
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
              <TextField
                fullWidth
                label={t('business.items.currency')}
                value={formData.currency}
                onChange={(e) => handleInputChange('currency', e.target.value)}
                required
                disabled={loading}
              />
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
                    : t('business.items.updateItem')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
  );
};

export default EditItemPage;
