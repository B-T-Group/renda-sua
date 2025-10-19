import {
  Alert,
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
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import { Item } from '../../hooks/useItems';

interface UpdateInventoryDialogProps {
  open: boolean;
  onClose: () => void;
  item: Item | null;
  selectedInventory?: any; // Specific inventory record to edit (optional)
  onInventoryUpdated?: () => void;
}

export default function UpdateInventoryDialog({
  open,
  onClose,
  item,
  selectedInventory,
  onInventoryUpdated,
}: UpdateInventoryDialogProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfileContext();
  const { addInventoryItem, updateInventoryItem, loading } =
    useBusinessInventory();
  const {
    locations: businessLocations,
    loading: locationsLoading,
    error: locationsError,
  } = useBusinessLocations(profile?.business?.id);

  const [formData, setFormData] = useState({
    business_location_id: '',
    quantity: 0,
    reserved_quantity: 0,
    selling_price: 0,
    unit_cost: 0,
    reorder_point: 0,
    reorder_quantity: 0,
  });

  // Track the current inventory record being edited (for the selected location)
  const [currentInventoryRecord, setCurrentInventoryRecord] =
    useState<any>(null);

  useEffect(() => {
    if (item && open) {
      // If we have selectedInventory, prefill with existing data
      if (selectedInventory) {
        setFormData({
          business_location_id: selectedInventory.business_location_id || '',
          quantity: selectedInventory.quantity || 0,
          reserved_quantity: selectedInventory.reserved_quantity || 0,
          selling_price: selectedInventory.selling_price || item.price || 0,
          unit_cost: selectedInventory.unit_cost || item.price || 0,
          reorder_point: selectedInventory.reorder_point || 10,
          reorder_quantity: selectedInventory.reorder_quantity || 50,
        });
      } else {
        // New inventory - use defaults
        setFormData({
          business_location_id: '',
          quantity: 0,
          reserved_quantity: 0,
          selling_price: item.price || 0,
          unit_cost: item.price || 0,
          reorder_point: 10,
          reorder_quantity: 50,
        });
      }
    }
  }, [item, selectedInventory, open, businessLocations]);

  // Helper function to find existing inventory for a location
  const findInventoryForLocation = (locationId: string) => {
    if (!item?.business_inventories || !locationId) return null;
    return item.business_inventories.find(
      (inventory: any) => inventory.business_location_id === locationId
    );
  };

  // Helper function to prefill form with inventory data
  const prefillFormWithInventory = (inventory: any) => {
    if (inventory) {
      setFormData({
        business_location_id: inventory.business_location_id || '',
        quantity: inventory.quantity || 0,
        reserved_quantity: inventory.reserved_quantity || 0,
        selling_price: inventory.selling_price || item?.price || 0,
        unit_cost: inventory.unit_cost || item?.price || 0,
        reorder_point: inventory.reorder_point || 10,
        reorder_quantity: inventory.reorder_quantity || 50,
      });
      setCurrentInventoryRecord(inventory);
    } else {
      // No existing inventory - use defaults
      setFormData((prev) => ({
        ...prev,
        quantity: 0,
        reserved_quantity: 0,
        selling_price: item?.price || 0,
        unit_cost: item?.price || 0,
        reorder_point: 10,
        reorder_quantity: 50,
      }));
      setCurrentInventoryRecord(null);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Special handling for location selection
    if (field === 'business_location_id' && value) {
      const existingInventory = findInventoryForLocation(value);

      // Only auto-prefill if we're not already editing a specific inventory
      // (i.e., when selectedInventory is null)
      if (!selectedInventory) {
        prefillFormWithInventory(existingInventory);
        // Update just the location in formData since prefillFormWithInventory sets it
        setFormData((prev) => ({
          ...prev,
          business_location_id: value,
        }));
      }
    }
  };

  const handleSave = async () => {
    if (!item || !formData.business_location_id) {
      enqueueSnackbar(t('business.inventory.selectLocationRequired'), {
        variant: 'error',
      });
      return;
    }

    try {
      // Determine if we're updating existing inventory or adding new
      const inventoryToUpdate = selectedInventory || currentInventoryRecord;

      if (inventoryToUpdate?.id) {
        // Update existing inventory - only pass updatable fields
        const updateData = {
          quantity: formData.quantity,
          reserved_quantity: formData.reserved_quantity,
          selling_price: formData.selling_price,
          unit_cost: formData.unit_cost,
          reorder_point: formData.reorder_point,
          reorder_quantity: formData.reorder_quantity,
          is_active: true,
        };
        await updateInventoryItem(inventoryToUpdate.id, updateData);
      } else {
        // Add new inventory - include all required fields
        const addData = {
          item_id: item.id,
          business_location_id: formData.business_location_id,
          quantity: formData.quantity,
          reserved_quantity: formData.reserved_quantity,
          selling_price: formData.selling_price,
          unit_cost: formData.unit_cost,
          reorder_point: formData.reorder_point,
          reorder_quantity: formData.reorder_quantity,
          is_active: true,
        };
        await addInventoryItem(addData);
      }

      enqueueSnackbar(
        inventoryToUpdate?.id
          ? t('business.inventory.inventoryUpdatedSuccessfully')
          : t('business.inventory.inventoryAddedSuccessfully'),
        { variant: 'success' }
      );

      // Refresh item data after successful inventory update
      if (onInventoryUpdated) {
        onInventoryUpdated();
      }

      onClose();
    } catch (error) {
      console.error('Failed to save inventory:', error);
      const inventoryToUpdate = selectedInventory || currentInventoryRecord;
      enqueueSnackbar(
        inventoryToUpdate?.id
          ? t('business.inventory.failedToUpdateInventory')
          : t('business.inventory.failedToAddInventory'),
        { variant: 'error' }
      );
    }
  };

  const handleClose = () => {
    setFormData({
      business_location_id: '',
      quantity: 0,
      reserved_quantity: 0,
      selling_price: 0,
      unit_cost: 0,
      reorder_point: 0,
      reorder_quantity: 0,
    });
    setCurrentInventoryRecord(null);
    onClose();
  };

  if (!item) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {selectedInventory || currentInventoryRecord
          ? t('business.inventory.updateInventoryFor', { itemName: item.name })
          : t('business.inventory.addInventoryFor', { itemName: item.name })}
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
              disabled={
                locationsLoading ||
                !businessLocations ||
                businessLocations.length === 0
              }
            >
              {businessLocations && businessLocations.length > 0 ? (
                businessLocations.map((location) => (
                  <MenuItem key={location.id} value={location.id}>
                    {location.name}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value="" disabled>
                  {t('business.inventory.noLocationsAvailable')}
                </MenuItem>
              )}
            </Select>
          </FormControl>

          {locationsLoading && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('common.loading')}...
            </Typography>
          )}

          {locationsError && (
            <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
              {locationsError}
            </Typography>
          )}

          {!locationsLoading &&
            !locationsError &&
            (!businessLocations || businessLocations.length === 0) && (
              <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                {t('business.inventory.noLocationsError')}
              </Typography>
            )}

          {/* Show alert when existing inventory is found and loaded */}
          {currentInventoryRecord && !selectedInventory && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('business.inventory.existingInventoryLoaded', {
                locationName:
                  businessLocations?.find(
                    (loc: any) =>
                      loc.id === currentInventoryRecord.business_location_id
                  )?.name || 'this location',
              })}
            </Alert>
          )}

          {/* Quantities */}
          <Typography variant="h6" gutterBottom>
            {t('business.inventory.quantities')}
          </Typography>

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
