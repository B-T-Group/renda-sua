import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { Item, useItems } from '../../hooks/useItems';
import ImageUploadDialog from './ImageUploadDialog';

interface EditItemDialogProps {
  open: boolean;
  onClose: () => void;
  item: Item | null;
}

export default function EditItemDialog({
  open,
  onClose,
  item,
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
  } = useItems();

  const [formData, setFormData] = useState<Partial<Item>>({});
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);

  useEffect(() => {
    if (open) {
      fetchBrands();
      fetchItemSubCategories();
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

  const handleInputChange = (field: keyof Item, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!item) return;

    try {
      await updateItem(item.id, formData);
      enqueueSnackbar(t('business.inventory.itemUpdatedSuccessfully'), {
        variant: 'success',
      });
      onClose();
    } catch (error) {
      console.error('Failed to update item:', error);
      enqueueSnackbar(t('business.inventory.failedToUpdateItem'), {
        variant: 'error',
      });
    }
  };

  const handleClose = () => {
    setFormData({});
    onClose();
  };

  if (!item) return null;

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {t('business.inventory.editItem', { itemName: item.name })}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Basic Information */}
            <Typography variant="h6" gutterBottom>
              {t('business.inventory.basicInformation')}
            </Typography>

            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label={t('business.inventory.itemName')}
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />

              <TextField
                fullWidth
                label={t('business.inventory.sku')}
                value={formData.sku || ''}
                onChange={(e) => handleInputChange('sku', e.target.value)}
              />
            </Stack>

            <TextField
              fullWidth
              multiline
              rows={3}
              label={t('business.inventory.description')}
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
            />

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
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
              </FormControl>
            </Stack>

            {/* Pricing */}
            <Typography variant="h6" gutterBottom>
              {t('business.inventory.pricing')}
            </Typography>

            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                type="number"
                label={t('business.inventory.price')}
                value={formData.price || ''}
                onChange={(e) =>
                  handleInputChange('price', parseFloat(e.target.value) || 0)
                }
              />

              <FormControl fullWidth>
                <InputLabel>{t('business.inventory.currency')}</InputLabel>
                <Select
                  value={formData.currency || 'USD'}
                  onChange={(e) =>
                    handleInputChange('currency', e.target.value)
                  }
                  label={t('business.inventory.currency')}
                >
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                  <MenuItem value="GBP">GBP</MenuItem>
                  <MenuItem value="XAF">XAF</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {/* Physical Properties */}
            <Typography variant="h6" gutterBottom>
              {t('business.inventory.physicalProperties')}
            </Typography>

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
                  <MenuItem value="cm">cm</MenuItem>
                  <MenuItem value="m">m</MenuItem>
                  <MenuItem value="in">in</MenuItem>
                  <MenuItem value="ft">ft</MenuItem>
                  <MenuItem value="mm">mm</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={2}>
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
                  <MenuItem value="kg">kg</MenuItem>
                  <MenuItem value="g">g</MenuItem>
                  <MenuItem value="lb">lb</MenuItem>
                  <MenuItem value="oz">oz</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={2}>
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
            />

            {/* Brand */}
            <FormControl fullWidth>
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

            {/* Special Properties */}
            <Typography variant="h6" gutterBottom>
              {t('business.inventory.specialProperties')}
            </Typography>

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

            {/* Order Quantities */}
            <Typography variant="h6" gutterBottom>
              {t('business.inventory.orderQuantities')}
            </Typography>

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
              />
            </Stack>

            {/* Delivery Properties */}
            <Typography variant="h6" gutterBottom>
              {t('business.inventory.deliveryProperties')}
            </Typography>

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
              />
            </Stack>

            {/* Status */}
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
          </Stack>

          {itemsError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {itemsError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
          <Button
            onClick={() => setShowImageUploadDialog(true)}
            variant="outlined"
            color="primary"
          >
            {t('business.inventory.manageImages')}
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={itemsLoading}
          >
            {itemsLoading ? t('common.saving') : t('common.save')}
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
