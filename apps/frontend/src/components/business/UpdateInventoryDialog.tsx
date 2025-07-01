import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { Item } from '../../hooks/useItems';

interface UpdateInventoryDialogProps {
  open: boolean;
  onClose: () => void;
  item: Item | null;
  businessLocations: any[];
}

export default function UpdateInventoryDialog({
  open,
  onClose,
  item,
  businessLocations,
}: UpdateInventoryDialogProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { addInventoryItem, loading } = useBusinessInventory();

  const [formData, setFormData] = useState({
    business_location_id: '',
    quantity: 0,
    available_quantity: 0,
    reserved_quantity: 0,
    selling_price: 0,
    unit_cost: 0,
    reorder_point: 0,
    reorder_quantity: 0,
  });

  useEffect(() => {
    if (item && open) {
      setFormData({
        business_location_id: '',
        quantity: 0,
        available_quantity: 0,
        reserved_quantity: 0,
        selling_price: item.price,
        unit_cost: 0,
        reorder_point: 10,
        reorder_quantity: 50,
      });
    }
  }, [item, open]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!item || !formData.business_location_id) {
      enqueueSnackbar(t('business.inventory.selectLocationRequired'), {
        variant: 'error',
      });
      return;
    }

    try {
      await addInventoryItem({
        item_id: item.id,
        business_location_id: formData.business_location_id,
        quantity: formData.quantity,
        available_quantity: formData.available_quantity,
        reserved_quantity: formData.reserved_quantity,
        selling_price: formData.selling_price,
        unit_cost: formData.unit_cost,
        reorder_point: formData.reorder_point,
        reorder_quantity: formData.reorder_quantity,
        is_active: true,
      });

      enqueueSnackbar(t('business.inventory.inventoryUpdatedSuccessfully'), {
        variant: 'success',
      });
      onClose();
    } catch (error) {
      console.error('Failed to update inventory:', error);
      enqueueSnackbar(t('business.inventory.failedToUpdateInventory'), {
        variant: 'error',
      });
    }
  };

  const handleClose = () => {
    setFormData({
      business_location_id: '',
      quantity: 0,
      available_quantity: 0,
      reserved_quantity: 0,
      selling_price: 0,
      unit_cost: 0,
      reorder_point: 0,
      reorder_quantity: 0,
    });
    onClose();
  };

  if (!item) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('business.inventory.updateInventoryFor', { itemName: item.name })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Item Information */}
          <Stack spacing={1}>
            <Typography variant="h6" gutterBottom>
              {t('business.inventory.itemInformation')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {item.description}
            </Typography>
            <Typography variant="body2">
              <strong>{t('business.inventory.sku')}:</strong>{' '}
              {item.sku || t('business.inventory.noSku')}
            </Typography>
            <Typography variant="body2">
              <strong>{t('business.inventory.category')}:</strong>{' '}
              {item.item_sub_category?.name || ''}
            </Typography>
          </Stack>

          {/* Location Selection */}
          <FormControl fullWidth>
            <InputLabel>{t('business.inventory.selectLocation')}</InputLabel>
            <Select
              value={formData.business_location_id}
              onChange={(e) =>
                handleInputChange('business_location_id', e.target.value)
              }
              label={t('business.inventory.selectLocation')}
            >
              {businessLocations.map((location) => (
                <MenuItem key={location.id} value={location.id}>
                  {location.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Quantities */}
          <Typography variant="h6" gutterBottom>
            {t('business.inventory.quantities')}
          </Typography>

          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              type="number"
              label={t('business.inventory.totalQuantity')}
              value={formData.quantity}
              onChange={(e) =>
                handleInputChange('quantity', parseInt(e.target.value) || 0)
              }
              inputProps={{ min: 0 }}
            />

            <TextField
              fullWidth
              type="number"
              label={t('business.inventory.availableQuantity')}
              value={formData.available_quantity}
              onChange={(e) =>
                handleInputChange(
                  'available_quantity',
                  parseInt(e.target.value) || 0
                )
              }
              inputProps={{ min: 0 }}
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              type="number"
              label={t('business.inventory.reservedQuantity')}
              value={formData.reserved_quantity}
              onChange={(e) =>
                handleInputChange(
                  'reserved_quantity',
                  parseInt(e.target.value) || 0
                )
              }
              inputProps={{ min: 0 }}
            />

            <TextField
              fullWidth
              type="number"
              label={t('business.inventory.reorderPoint')}
              value={formData.reorder_point}
              onChange={(e) =>
                handleInputChange(
                  'reorder_point',
                  parseInt(e.target.value) || 0
                )
              }
              inputProps={{ min: 0 }}
            />
          </Stack>

          <TextField
            fullWidth
            type="number"
            label={t('business.inventory.reorderQuantity')}
            value={formData.reorder_quantity}
            onChange={(e) =>
              handleInputChange(
                'reorder_quantity',
                parseInt(e.target.value) || 0
              )
            }
            inputProps={{ min: 0 }}
          />

          {/* Pricing */}
          <Typography variant="h6" gutterBottom>
            {t('business.inventory.pricing')}
          </Typography>

          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              type="number"
              label={t('business.inventory.sellingPrice')}
              value={formData.selling_price}
              onChange={(e) =>
                handleInputChange(
                  'selling_price',
                  parseFloat(e.target.value) || 0
                )
              }
              inputProps={{ min: 0, step: 0.01 }}
            />

            <TextField
              fullWidth
              type="number"
              label={t('business.inventory.unitCost')}
              value={formData.unit_cost}
              onChange={(e) =>
                handleInputChange('unit_cost', parseFloat(e.target.value) || 0)
              }
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || !formData.business_location_id}
        >
          {loading ? t('common.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
