import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SIZE_UNITS, WEIGHT_UNITS } from '../../constants/enums';
import { Item, useItems } from '../../hooks/useItems';
import ImageUploadDialog from './ImageUploadDialog';

interface EditItemDialogProps {
  open: boolean;
  onClose: () => void;
  item: Item | null;
  businessId?: string;
}

export default function EditItemDialog({
  open,
  onClose,
  item,
  businessId,
}: EditItemDialogProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const {
    brands,
    itemSubCategories,
    loading: itemsLoading,
    error: itemsError,
    fetchBrands,
    fetchItemSubCategories,
    updateItem,
  } = useItems(businessId);

  const [formData, setFormData] = useState<Partial<Item>>({});
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (open) {
      fetchBrands();
      fetchItemSubCategories();
      setValidationErrors({});
    }
  }, [open, fetchBrands, fetchItemSubCategories]);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        description: item.description,
        item_sub_category_id: item.item_sub_category_id,
        size: item.size,
        size_unit: item.size_unit,
        weight: item.weight,
        weight_unit: item.weight_unit,
        price: item.price,
        currency: item.currency,
        sku: item.sku,
        brand_id: item.brand_id,
        model: item.model,
        color: item.color,
        material: item.material,
        is_fragile: item.is_fragile,
        is_perishable: item.is_perishable,
        requires_special_handling: item.requires_special_handling,
        max_delivery_distance: item.max_delivery_distance,
        estimated_delivery_time: item.estimated_delivery_time,
        min_order_quantity: item.min_order_quantity,
        max_order_quantity: item.max_order_quantity,
        is_active: item.is_active,
      });
    }
  }, [item]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      errors.name = t('business.inventory.itemNameRequired');
    }

    if (!formData.description?.trim()) {
      errors.description = t('business.inventory.descriptionRequired');
    }

    if (!formData.item_sub_category_id) {
      errors.category = t('business.inventory.categoryRequired');
    }

    if (!formData.price || formData.price <= 0) {
      errors.price = t('business.inventory.priceRequired');
    }

    if (!formData.currency) {
      errors.currency = t('business.inventory.currencyRequired');
    }

    if (formData.min_order_quantity && formData.min_order_quantity <= 0) {
      errors.minOrderQuantity = t('business.inventory.minOrderQuantityInvalid');
    }

    if (formData.max_order_quantity && formData.max_order_quantity <= 0) {
      errors.maxOrderQuantity = t('business.inventory.maxOrderQuantityInvalid');
    }

    if (
      formData.min_order_quantity &&
      formData.max_order_quantity &&
      formData.min_order_quantity > formData.max_order_quantity
    ) {
      errors.maxOrderQuantity = t(
        'business.inventory.maxOrderQuantityLessThanMin'
      );
    }

    if (formData.max_delivery_distance && formData.max_delivery_distance <= 0) {
      errors.maxDeliveryDistance = t(
        'business.inventory.maxDeliveryDistanceInvalid'
      );
    }

    if (
      formData.estimated_delivery_time &&
      formData.estimated_delivery_time <= 0
    ) {
      errors.estimatedDeliveryTime = t(
        'business.inventory.estimatedDeliveryTimeInvalid'
      );
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof Item, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleSave = async () => {
    if (!item) return;

    if (!validateForm()) {
      enqueueSnackbar(t('business.inventory.pleaseFixValidationErrors'), {
        variant: 'error',
      });
      return;
    }

    setSaving(true);

    try {
      // Convert null values to undefined for optional fields
      const updateData = {
        ...formData,
        size: formData.size ?? undefined,
        size_unit: formData.size_unit ?? undefined,
        weight: formData.weight ?? undefined,
        weight_unit: formData.weight_unit ?? undefined,
        sku: formData.sku ?? undefined,
        brand_id: formData.brand_id ?? undefined,
        model: formData.model ?? undefined,
        color: formData.color ?? undefined,
        material: formData.material ?? undefined,
        max_delivery_distance: formData.max_delivery_distance ?? undefined,
        estimated_delivery_time: formData.estimated_delivery_time ?? undefined,
        max_order_quantity: formData.max_order_quantity ?? undefined,
      };

      await updateItem(item.id, updateData);
      enqueueSnackbar(t('business.inventory.itemUpdatedSuccessfully'), {
        variant: 'success',
      });
      onClose();
    } catch (error) {
      console.error('Failed to update item:', error);
      enqueueSnackbar(t('business.inventory.failedToUpdateItem'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFormData({});
    setValidationErrors({});
    setSaving(false);
    onClose();
  };

  if (!item) return null;

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h6">
              {t('business.inventory.editItem', { itemName: item.name })}
            </Typography>
            {itemsLoading && <CircularProgress size={20} />}
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Basic Information */}
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('business.inventory.basicInformation')}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  label={t('business.inventory.itemName')}
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  error={!!validationErrors.name}
                  helperText={validationErrors.name}
                  required
                />

                <TextField
                  fullWidth
                  label={t('business.inventory.sku')}
                  value={formData.sku || ''}
                  onChange={(e) => handleInputChange('sku', e.target.value)}
                  placeholder={t('business.inventory.skuPlaceholder')}
                />
              </Stack>

              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('business.inventory.description')}
                value={formData.description || ''}
                onChange={(e) =>
                  handleInputChange('description', e.target.value)
                }
                error={!!validationErrors.description}
                helperText={validationErrors.description}
                required
                sx={{ mt: 2 }}
              />

              <FormControl
                fullWidth
                sx={{ mt: 2 }}
                error={!!validationErrors.category}
              >
                <InputLabel>{t('business.inventory.category')}</InputLabel>
                <Select
                  value={formData.item_sub_category_id || ''}
                  onChange={(e) =>
                    handleInputChange(
                      'item_sub_category_id',
                      Number(e.target.value)
                    )
                  }
                  label={t('business.inventory.category')}
                  disabled={itemsLoading}
                  required
                >
                  {itemsLoading ? (
                    <MenuItem disabled>
                      {t('business.inventory.loadingCategories')}
                    </MenuItem>
                  ) : itemSubCategories.length === 0 ? (
                    <MenuItem disabled>
                      {t('business.inventory.noCategoriesFound')}
                    </MenuItem>
                  ) : (
                    itemSubCategories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {category.item_category.name} - {category.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
                {validationErrors.category && (
                  <Typography
                    variant="caption"
                    color="error"
                    sx={{ mt: 0.5, ml: 1.5 }}
                  >
                    {validationErrors.category}
                  </Typography>
                )}
              </FormControl>
            </Box>

            {/* Pricing */}
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('business.inventory.pricing')}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('business.inventory.price')}
                  value={formData.price || ''}
                  onChange={(e) =>
                    handleInputChange('price', parseFloat(e.target.value) || 0)
                  }
                  error={!!validationErrors.price}
                  helperText={validationErrors.price}
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                />

                <FormControl fullWidth error={!!validationErrors.currency}>
                  <InputLabel>{t('business.inventory.currency')}</InputLabel>
                  <Select
                    value={formData.currency || 'USD'}
                    onChange={(e) =>
                      handleInputChange('currency', e.target.value)
                    }
                    label={t('business.inventory.currency')}
                    required
                  >
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                    <MenuItem value="GBP">GBP</MenuItem>
                    <MenuItem value="XAF">XAF</MenuItem>
                  </Select>
                  {validationErrors.currency && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ mt: 0.5, ml: 1.5 }}
                    >
                      {validationErrors.currency}
                    </Typography>
                  )}
                </FormControl>
              </Stack>
            </Box>

            {/* Physical Properties */}
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('business.inventory.physicalProperties')}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('business.inventory.size')}
                  value={formData.size || ''}
                  onChange={(e) =>
                    handleInputChange(
                      'size',
                      parseFloat(e.target.value) || undefined
                    )
                  }
                  inputProps={{ min: 0, step: 0.01 }}
                />

                <FormControl fullWidth>
                  <InputLabel>{t('business.inventory.sizeUnit')}</InputLabel>
                  <Select
                    value={formData.size_unit || ''}
                    onChange={(e) =>
                      handleInputChange('size_unit', e.target.value)
                    }
                    label={t('business.inventory.sizeUnit')}
                  >
                    {SIZE_UNITS.map((unit) => (
                      <MenuItem key={unit} value={unit}>
                        {unit}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('business.inventory.weight')}
                  value={formData.weight || ''}
                  onChange={(e) =>
                    handleInputChange(
                      'weight',
                      parseFloat(e.target.value) || undefined
                    )
                  }
                  inputProps={{ min: 0, step: 0.01 }}
                />

                <FormControl fullWidth>
                  <InputLabel>{t('business.inventory.weightUnit')}</InputLabel>
                  <Select
                    value={formData.weight_unit || ''}
                    onChange={(e) =>
                      handleInputChange('weight_unit', e.target.value)
                    }
                    label={t('business.inventory.weightUnit')}
                  >
                    {WEIGHT_UNITS.map((unit) => (
                      <MenuItem key={unit} value={unit}>
                        {unit}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label={t('business.inventory.color')}
                  value={formData.color || ''}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                />

                <TextField
                  fullWidth
                  label={t('business.inventory.model')}
                  value={formData.model || ''}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                />
              </Stack>

              <TextField
                fullWidth
                label={t('business.inventory.material')}
                value={formData.material || ''}
                onChange={(e) => handleInputChange('material', e.target.value)}
                sx={{ mt: 2 }}
              />

              {/* Brand */}
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>{t('business.inventory.brand')}</InputLabel>
                <Select
                  value={formData.brand_id || ''}
                  onChange={(e) =>
                    handleInputChange('brand_id', e.target.value || undefined)
                  }
                  label={t('business.inventory.brand')}
                  disabled={itemsLoading}
                >
                  <MenuItem value="">
                    <em>{t('business.inventory.noBrand')}</em>
                  </MenuItem>
                  {itemsLoading ? (
                    <MenuItem disabled>
                      {t('business.inventory.loadingBrands')}
                    </MenuItem>
                  ) : brands.length === 0 ? (
                    <MenuItem disabled>
                      {t('business.inventory.noBrandsFound')}
                    </MenuItem>
                  ) : (
                    brands.map((brand) => (
                      <MenuItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Box>

            {/* Special Properties */}
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('business.inventory.specialProperties')}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_fragile ?? false}
                      onChange={(e) =>
                        handleInputChange('is_fragile', e.target.checked)
                      }
                    />
                  }
                  label={t('business.inventory.isFragile')}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_perishable ?? false}
                      onChange={(e) =>
                        handleInputChange('is_perishable', e.target.checked)
                      }
                    />
                  }
                  label={t('business.inventory.isPerishable')}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.requires_special_handling ?? false}
                      onChange={(e) =>
                        handleInputChange(
                          'requires_special_handling',
                          e.target.checked
                        )
                      }
                    />
                  }
                  label={t('business.inventory.requiresSpecialHandling')}
                />
              </Stack>
            </Box>

            {/* Order Quantities */}
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('business.inventory.orderQuantities')}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('business.inventory.minOrderQuantity')}
                  value={formData.min_order_quantity || ''}
                  onChange={(e) =>
                    handleInputChange(
                      'min_order_quantity',
                      parseInt(e.target.value) || 1
                    )
                  }
                  error={!!validationErrors.minOrderQuantity}
                  helperText={validationErrors.minOrderQuantity}
                  inputProps={{ min: 1 }}
                />

                <TextField
                  fullWidth
                  type="number"
                  label={t('business.inventory.maxOrderQuantity')}
                  value={formData.max_order_quantity || ''}
                  onChange={(e) =>
                    handleInputChange(
                      'max_order_quantity',
                      parseInt(e.target.value) || undefined
                    )
                  }
                  error={!!validationErrors.maxOrderQuantity}
                  helperText={validationErrors.maxOrderQuantity}
                  inputProps={{ min: 1 }}
                />
              </Stack>
            </Box>

            {/* Delivery Properties */}
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('business.inventory.deliveryProperties')}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('business.inventory.maxDeliveryDistance')}
                  value={formData.max_delivery_distance || ''}
                  onChange={(e) =>
                    handleInputChange(
                      'max_delivery_distance',
                      parseFloat(e.target.value) || undefined
                    )
                  }
                  error={!!validationErrors.maxDeliveryDistance}
                  helperText={validationErrors.maxDeliveryDistance}
                  inputProps={{ min: 0, step: 0.1 }}
                />

                <TextField
                  fullWidth
                  type="number"
                  label={t('business.inventory.estimatedDeliveryTime')}
                  value={formData.estimated_delivery_time || ''}
                  onChange={(e) =>
                    handleInputChange(
                      'estimated_delivery_time',
                      parseFloat(e.target.value) || undefined
                    )
                  }
                  error={!!validationErrors.estimatedDeliveryTime}
                  helperText={validationErrors.estimatedDeliveryTime}
                  inputProps={{ min: 0, step: 0.5 }}
                />
              </Stack>
            </Box>

            {/* Status */}
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('business.inventory.stockStatus')}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active ?? true}
                    onChange={(e) =>
                      handleInputChange('is_active', e.target.checked)
                    }
                  />
                }
                label={t('business.inventory.active')}
              />
            </Box>
          </Stack>

          {itemsError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {itemsError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => setShowImageUploadDialog(true)}
            variant="outlined"
            color="primary"
            disabled={saving}
          >
            {t('business.inventory.manageImages')}
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || itemsLoading}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Upload Dialog */}
      <ImageUploadDialog
        open={showImageUploadDialog}
        onClose={() => setShowImageUploadDialog(false)}
        itemId={item.id}
        itemName={item.name}
      />
    </>
  );
}
