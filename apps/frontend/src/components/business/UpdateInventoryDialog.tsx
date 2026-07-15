import {
  Alert,
  Button,
  Collapse,
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
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import { useItemVariants } from '../../hooks/useItemVariants';
import { Item } from '../../hooks/useItems';
import type { ItemVariant } from '../../types/itemVariant';

interface UpdateInventoryDialogProps {
  open: boolean;
  onClose: () => void;
  item: Item | null;
  selectedInventory?: any; // Specific inventory record to edit (optional)
  onInventoryUpdated?: (itemId: string) => void;
  /** When set, avoid refetching full business inventory; caller refreshes their own list (e.g. items page) */
  skipFetchInventory?: boolean;
  businessId?: string;
}

export default function UpdateInventoryDialog({
  open,
  onClose,
  item,
  selectedInventory,
  onInventoryUpdated,
  skipFetchInventory = false,
  businessId: businessIdProp,
}: UpdateInventoryDialogProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfileContext();
  const catalogBusinessId = businessIdProp ?? profile?.business?.id;
  const { addInventoryItem, updateInventoryItem, loading } =
    useBusinessInventory(catalogBusinessId);
  const {
    locations: businessLocations,
    loading: locationsLoading,
    error: locationsError,
  } = useBusinessLocations(catalogBusinessId);
  const { listVariants, setVariantPriceOverrides } = useItemVariants(
    item?.id ?? ''
  );

  const [formData, setFormData] = useState({
    business_location_id: '',
    quantity: 0,
    reserved_quantity: 0,
    selling_price: 0,
    unit_cost: 0,
    reorder_point: 0,
    reorder_quantity: 0,
  });
  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>(
    {}
  );
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [dirtyOverrideIds, setDirtyOverrideIds] = useState<Set<string>>(
    () => new Set()
  );

  // Track the current inventory record being edited (for the selected location)
  const [currentInventoryRecord, setCurrentInventoryRecord] =
    useState<any>(null);

  const loadVariants = useCallback(async () => {
    if (!item?.id || !open) return;
    try {
      const rows = await listVariants();
      setVariants(rows.filter((v) => v.is_active !== false));
    } catch {
      setVariants([]);
    }
  }, [item?.id, listVariants, open]);

  const seedOverrides = useCallback(
    (inventory: any | null, variantRows: ItemVariant[]) => {
      const existing = inventory?.variant_price_overrides;
      const next: Record<string, string> = {};
      for (const v of variantRows) {
        const row = Array.isArray(existing)
          ? existing.find(
              (o: { item_variant_id: string }) => o.item_variant_id === v.id
            )
          : undefined;
        next[v.id] =
          row?.selling_price != null && row.selling_price !== ''
            ? String(row.selling_price)
            : '';
      }
      setOverrideDrafts(next);
      setDirtyOverrideIds(new Set());
    },
    []
  );

  useEffect(() => {
    void loadVariants();
  }, [loadVariants]);

  // Initialize form when dialog opens / inventory selection changes — not when variants load.
  useEffect(() => {
    if (!item || !open) return;
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
      setCurrentInventoryRecord(selectedInventory);
    } else {
      setFormData({
        business_location_id: '',
        quantity: 0,
        reserved_quantity: 0,
        selling_price: item.price || 0,
        unit_cost: item.price || 0,
        reorder_point: 10,
        reorder_quantity: 50,
      });
      setCurrentInventoryRecord(null);
    }
  }, [item, selectedInventory, open]);

  // Seed / merge override drafts when variants arrive without resetting form fields.
  useEffect(() => {
    if (!open || !variants.length) return;
    const inventory = selectedInventory || currentInventoryRecord;
    setOverrideDrafts((prev) => {
      const existing = inventory?.variant_price_overrides;
      const next = { ...prev };
      for (const v of variants) {
        if (Object.prototype.hasOwnProperty.call(next, v.id)) continue;
        const row = Array.isArray(existing)
          ? existing.find(
              (o: { item_variant_id: string }) => o.item_variant_id === v.id
            )
          : undefined;
        next[v.id] =
          row?.selling_price != null && row.selling_price !== ''
            ? String(row.selling_price)
            : '';
      }
      return next;
    });
  }, [open, variants, selectedInventory, currentInventoryRecord]);

  // Helper function to find existing inventory for a location
  const findInventoryForLocation = (locationId: string) => {
    if (!item?.business_inventories || !locationId) return null;
    return item.business_inventories.find(
      (inventory: any) => inventory.business_location_id === locationId
    );
  };

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
      seedOverrides(inventory, variants);
    } else {
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
      seedOverrides(null, variants);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (field === 'business_location_id' && value) {
      const existingInventory = findInventoryForLocation(value);
      if (!selectedInventory) {
        prefillFormWithInventory(existingInventory);
        setFormData((prev) => ({
          ...prev,
          business_location_id: value,
        }));
      }
    }
  };

  const markOverrideDirty = (variantId: string, value: string) => {
    setOverrideDrafts((prev) => ({ ...prev, [variantId]: value }));
    setDirtyOverrideIds((prev) => {
      const next = new Set(prev);
      next.add(variantId);
      return next;
    });
  };

  const buildOverridePayload = () =>
    variants
      .filter((v) => dirtyOverrideIds.has(v.id))
      .map((v) => {
        const raw = (overrideDrafts[v.id] ?? '').trim();
        if (raw === '') {
          return { item_variant_id: v.id, selling_price: null as number | null };
        }
        const n = Number(raw);
        return {
          item_variant_id: v.id,
          selling_price: Number.isFinite(n) && n >= 0 ? n : null,
        };
      });

  const saveOverridesForInventory = async (inventoryId: string) => {
    const overrides = buildOverridePayload();
    if (!overrides.length) return;
    setSavingOverrides(true);
    try {
      const ok = await setVariantPriceOverrides(
        inventoryId,
        overrides,
        catalogBusinessId
      );
      if (!ok) {
        throw new Error('Failed to save variant price overrides');
      }
    } finally {
      setSavingOverrides(false);
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
      const inventoryToUpdate = selectedInventory || currentInventoryRecord;
      let inventoryId: string | null = inventoryToUpdate?.id ?? null;
      const wasUpdate = !!inventoryId;

      if (inventoryId) {
        const ok = await updateInventoryItem(
          inventoryId,
          {
            quantity: formData.quantity,
            reserved_quantity: formData.reserved_quantity,
            selling_price: formData.selling_price,
            unit_cost: formData.unit_cost,
            reorder_point: formData.reorder_point,
            reorder_quantity: formData.reorder_quantity,
            is_active: true,
          },
          { skipFetchInventory }
        );
        if (!ok) {
          throw new Error('Failed to update inventory');
        }
      } else {
        inventoryId = await addInventoryItem(
          {
            item_id: item.id,
            business_location_id: formData.business_location_id,
            quantity: formData.quantity,
            reserved_quantity: formData.reserved_quantity,
            selling_price: formData.selling_price,
            unit_cost: formData.unit_cost,
            reorder_point: formData.reorder_point,
            reorder_quantity: formData.reorder_quantity,
            is_active: true,
          },
          { skipFetchInventory }
        );
        if (!inventoryId) {
          throw new Error('Failed to add inventory');
        }
      }

      await saveOverridesForInventory(inventoryId);

      enqueueSnackbar(
        wasUpdate
          ? t('business.inventory.inventoryUpdatedSuccessfully')
          : t('business.inventory.inventoryAddedSuccessfully'),
        { variant: 'success' }
      );

      if (onInventoryUpdated && item) {
        onInventoryUpdated(item.id);
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
    setOverrideDrafts({});
    setDirtyOverrideIds(new Set());
    setOverridesOpen(false);
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

          {variants.length > 0 && (
            <Stack spacing={1}>
              <Button
                size="small"
                onClick={() => setOverridesOpen((o) => !o)}
                sx={{ alignSelf: 'flex-start' }}
              >
                {overridesOpen
                  ? t(
                      'business.variants.hideLocationOverrides',
                      'Hide variant price overrides'
                    )
                  : t(
                      'business.variants.locationOverrides',
                      'Variant price overrides'
                    )}
              </Button>
              <Collapse in={overridesOpen}>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      'business.variants.overrideHint',
                      'Leave blank to inherit the variant or inventory price. Quantity stays shared.'
                    )}
                  </Typography>
                  {variants.map((v) => (
                    <TextField
                      key={v.id}
                      fullWidth
                      type="number"
                      label={`${v.name} (${item.currency || ''})`}
                      placeholder={String(
                        v.price ?? formData.selling_price ?? item.price ?? ''
                      )}
                      value={overrideDrafts[v.id] ?? ''}
                      onChange={(e) =>
                        markOverrideDirty(v.id, e.target.value)
                      }
                      inputProps={{ min: 0, step: 0.01 }}
                      helperText={t(
                        'business.variants.overrideFieldHint',
                        'Blank = inherited'
                      )}
                    />
                  ))}
                </Stack>
              </Collapse>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={
            loading || savingOverrides || !formData.business_location_id
          }
        >
          {loading || savingOverrides
            ? t('common.saving')
            : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
