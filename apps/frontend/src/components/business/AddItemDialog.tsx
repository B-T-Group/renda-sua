import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AddInventoryItemData,
  useBusinessInventory,
} from '../../hooks/useBusinessInventory';
import {
  CreateBrandData,
  CreateItemData,
  useItems,
} from '../../hooks/useItems';
import ImageUploadDialog from './ImageUploadDialog';

interface AddItemDialogProps {
  open: boolean;
  onClose: () => void;
  businessId: string;
  businessLocations: any[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`add-item-tabpanel-${index}`}
      aria-labelledby={`add-item-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export default function AddItemDialog({
  open,
  onClose,
  businessId,
  businessLocations,
}: AddItemDialogProps) {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [inventoryData, setInventoryData] = useState<
    Partial<AddInventoryItemData>
  >({});
  const [newItemData, setNewItemData] = useState<Partial<CreateItemData>>({
    business_id: businessId,
    is_active: true,
    min_order_quantity: 1,
  });
  const [newBrandData, setNewBrandData] = useState<CreateBrandData>({
    name: '',
    description: '',
  });
  const [showNewBrandForm, setShowNewBrandForm] = useState(false);
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);
  const [createdItem, setCreatedItem] = useState<any>(null);

  const {
    items,
    brands,
    itemSubCategories,
    loading: itemsLoading,
    error: itemsError,
    fetchItems,
    fetchBrands,
    fetchItemSubCategories,
    createItem,
    createBrand,
  } = useItems(businessId);

  const { addInventoryItem } = useBusinessInventory();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (open) {
      if (!businessId) {
        enqueueSnackbar(
          t('business.inventory.businessIdRequiredForManagement'),
          { variant: 'error' }
        );
        onClose();
        return;
      }
      fetchItems();
      fetchBrands();
      fetchItemSubCategories();
    }
  }, [
    open,
    fetchItems,
    fetchBrands,
    fetchItemSubCategories,
    businessId,
    onClose,
    enqueueSnackbar,
  ]);

  // Update business_id when businessId prop changes
  useEffect(() => {
    if (businessId) {
      setNewItemData((prev) => ({
        ...prev,
        business_id: businessId,
      }));
    }
  }, [businessId]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setSelectedItem(null);
    setInventoryData({});
  };

  const handleItemSelect = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    setSelectedItem(item);
    setInventoryData({
      item_id: itemId,
      quantity: 0,
      available_quantity: 0,
      reserved_quantity: 0,
      reorder_point: 0,
      reorder_quantity: 0,
      unit_cost: item?.price || 0,
      selling_price: item?.price || 0,
      is_active: true,
    });
  };

  const handleCreateBrand = async () => {
    try {
      const newBrand = await createBrand(newBrandData);
      setNewItemData((prev) => ({ ...prev, brand_id: newBrand.id }));
      setShowNewBrandForm(false);
      setNewBrandData({ name: '', description: '' });
      enqueueSnackbar(t('business.inventory.brandCreated'), {
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to create brand:', error);
      enqueueSnackbar(t('business.inventory.failedToCreateBrand'), {
        variant: 'error',
      });
    }
  };

  const handleCreateItem = async () => {
    // Ensure business_id is set from the profile
    if (!businessId) {
      enqueueSnackbar(t('business.inventory.businessIdRequired'), {
        variant: 'error',
      });
      return;
    }

    // Ensure business_id is set in the item data
    const itemDataWithBusinessId = {
      ...newItemData,
      business_id: businessId,
    } as CreateItemData;

    try {
      const newItem = await createItem(itemDataWithBusinessId);
      setCreatedItem(newItem);
      setSelectedItem(newItem);
      setInventoryData({
        item_id: newItem.id,
        quantity: 0,
        available_quantity: 0,
        reserved_quantity: 0,
        reorder_point: 0,
        reorder_quantity: 0,
        unit_cost: newItem.price,
        selling_price: newItem.price,
        is_active: true,
      });
      setTabValue(0); // Switch to inventory tab
      enqueueSnackbar(t('business.inventory.itemCreated'), {
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to create item:', error);
      enqueueSnackbar(t('business.inventory.failedToCreateItem'), {
        variant: 'error',
      });
    }
  };

  const handleAddToInventory = async () => {
    if (inventoryData.business_location_id && inventoryData.item_id) {
      try {
        await addInventoryItem(inventoryData as AddInventoryItemData);
        onClose();
        // Reset form
        setSelectedItem(null);
        setInventoryData({});
        setNewItemData({
          business_id: businessId,
          is_active: true,
          min_order_quantity: 1,
        });
        setTabValue(0);
        enqueueSnackbar(t('business.inventory.itemAddedToInventory'), {
          variant: 'success',
        });
      } catch (error) {
        console.error('Failed to add to inventory:', error);
        enqueueSnackbar(t('business.inventory.failedToAddToInventory'), {
          variant: 'error',
        });
      }
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('business.inventory.addItem')}</DialogTitle>
      <DialogContent>
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label={t('business.inventory.selectExisting')} />
          <Tab label={t('business.inventory.createNew')} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {/* Select Existing Item */}
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>{t('business.inventory.selectItem')}</InputLabel>
              <Select
                value={selectedItem?.id || ''}
                onChange={(e) => handleItemSelect(e.target.value)}
                label={t('business.inventory.selectItem')}
                disabled={itemsLoading}
              >
                {itemsLoading ? (
                  <MenuItem disabled>
                    {t('business.inventory.loadingItems')}
                  </MenuItem>
                ) : items.length === 0 ? (
                  <MenuItem disabled>
                    {t('business.inventory.noItemsFound')}
                  </MenuItem>
                ) : (
                  items.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name} - {formatCurrency(item.price, item.currency)}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {selectedItem && (
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle1" gutterBottom>
                  {selectedItem.name}{' '}
                  {selectedItem.sku ? `(${selectedItem.sku})` : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {selectedItem.description}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 1,
                  }}
                >
                  <Box>
                    <b>Brand:</b> {selectedItem.brand?.name || '-'}
                  </Box>
                  <Box>
                    <b>Model:</b> {selectedItem.model || '-'}
                  </Box>
                  <Box>
                    <b>Color:</b> {selectedItem.color || '-'}
                  </Box>
                  <Box>
                    <b>Material:</b> {selectedItem.material || '-'}
                  </Box>
                  <Box>
                    <b>Size:</b> {selectedItem.size} {selectedItem.size_unit}
                  </Box>
                  <Box>
                    <b>Weight:</b> {selectedItem.weight}{' '}
                    {selectedItem.weight_unit}
                  </Box>
                  <Box>
                    <b>Price:</b>{' '}
                    {formatCurrency(selectedItem.price, selectedItem.currency)}
                  </Box>
                  <Box>
                    <b>Category:</b>{' '}
                    {selectedItem.item_sub_category?.item_category?.name} -{' '}
                    {selectedItem.item_sub_category?.name}
                  </Box>
                </Box>
              </Paper>
            )}

            {/* Inventory Form */}
            {selectedItem && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>{t('business.inventory.location')}</InputLabel>
                  <Select
                    value={inventoryData.business_location_id || ''}
                    onChange={(e) =>
                      setInventoryData({
                        ...inventoryData,
                        business_location_id: e.target.value,
                      })
                    }
                    label={t('business.inventory.location')}
                    disabled={businessLocations.length === 0}
                  >
                    {businessLocations.length === 0 ? (
                      <MenuItem disabled>
                        {t('business.inventory.noLocationsAvailable')}
                      </MenuItem>
                    ) : (
                      businessLocations.map((location) => (
                        <MenuItem key={location.id} value={location.id}>
                          {location.name}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>

                <Stack direction="row" spacing={2}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t('business.inventory.quantity')}
                    value={inventoryData.quantity || ''}
                    onChange={(e) =>
                      setInventoryData({
                        ...inventoryData,
                        quantity: parseInt(e.target.value) || 0,
                      })
                    }
                  />

                  <TextField
                    fullWidth
                    type="number"
                    label={t('business.inventory.availableQuantity')}
                    value={inventoryData.available_quantity || ''}
                    onChange={(e) =>
                      setInventoryData({
                        ...inventoryData,
                        available_quantity: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </Stack>

                <Stack direction="row" spacing={2}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t('business.inventory.sellingPrice')}
                    value={inventoryData.selling_price || ''}
                    onChange={(e) =>
                      setInventoryData({
                        ...inventoryData,
                        selling_price: parseFloat(e.target.value) || 0,
                      })
                    }
                  />

                  <TextField
                    fullWidth
                    type="number"
                    label={t('business.inventory.unitCost')}
                    value={inventoryData.unit_cost || ''}
                    onChange={(e) =>
                      setInventoryData({
                        ...inventoryData,
                        unit_cost: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </Stack>

                <FormControlLabel
                  control={
                    <Switch
                      checked={inventoryData.is_active ?? true}
                      onChange={(e) =>
                        setInventoryData({
                          ...inventoryData,
                          is_active: e.target.checked,
                        })
                      }
                    />
                  }
                  label={t('business.inventory.active')}
                />
              </Stack>
            )}
          </Stack>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Create New Item */}
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label={t('business.inventory.itemName')}
                value={newItemData.name || ''}
                onChange={(e) =>
                  setNewItemData({ ...newItemData, name: e.target.value })
                }
              />

              <TextField
                fullWidth
                label={t('business.inventory.sku')}
                value={newItemData.sku || ''}
                onChange={(e) =>
                  setNewItemData({ ...newItemData, sku: e.target.value })
                }
              />
            </Stack>

            <TextField
              fullWidth
              multiline
              rows={3}
              label={t('business.inventory.description')}
              value={newItemData.description || ''}
              onChange={(e) =>
                setNewItemData({
                  ...newItemData,
                  description: e.target.value,
                })
              }
            />

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>{t('business.inventory.category')}</InputLabel>
                <Select
                  value={newItemData.item_sub_category_id || ''}
                  onChange={(e) =>
                    setNewItemData({
                      ...newItemData,
                      item_sub_category_id: Number(e.target.value) || 0,
                    })
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

            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                type="number"
                label={t('business.inventory.price')}
                value={newItemData.price || ''}
                onChange={(e) =>
                  setNewItemData({
                    ...newItemData,
                    price: parseFloat(e.target.value) || 0,
                  })
                }
              />

              <FormControl fullWidth>
                <InputLabel>{t('business.inventory.currency')}</InputLabel>
                <Select
                  value={newItemData.currency || 'USD'}
                  onChange={(e) =>
                    setNewItemData({ ...newItemData, currency: e.target.value })
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

            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                type="number"
                label={t('business.inventory.size')}
                value={newItemData.size || ''}
                onChange={(e) =>
                  setNewItemData({
                    ...newItemData,
                    size: parseFloat(e.target.value) || undefined,
                  })
                }
              />

              <FormControl fullWidth>
                <InputLabel>{t('business.inventory.sizeUnit')}</InputLabel>
                <Select
                  value={newItemData.size_unit || ''}
                  onChange={(e) =>
                    setNewItemData({
                      ...newItemData,
                      size_unit: e.target.value,
                    })
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
                value={newItemData.weight || ''}
                onChange={(e) =>
                  setNewItemData({
                    ...newItemData,
                    weight: parseFloat(e.target.value) || undefined,
                  })
                }
              />

              <FormControl fullWidth>
                <InputLabel>{t('business.inventory.weightUnit')}</InputLabel>
                <Select
                  value={newItemData.weight_unit || ''}
                  onChange={(e) =>
                    setNewItemData({
                      ...newItemData,
                      weight_unit: e.target.value,
                    })
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
                value={newItemData.color || ''}
                onChange={(e) =>
                  setNewItemData({ ...newItemData, color: e.target.value })
                }
              />

              <TextField
                fullWidth
                label={t('business.inventory.model')}
                value={newItemData.model || ''}
                onChange={(e) =>
                  setNewItemData({ ...newItemData, model: e.target.value })
                }
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newItemData.is_fragile ?? false}
                    onChange={(e) =>
                      setNewItemData({
                        ...newItemData,
                        is_fragile: e.target.checked,
                      })
                    }
                  />
                }
                label={t('business.inventory.isFragile')}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={newItemData.is_perishable ?? false}
                    onChange={(e) =>
                      setNewItemData({
                        ...newItemData,
                        is_perishable: e.target.checked,
                      })
                    }
                  />
                }
                label={t('business.inventory.isPerishable')}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={newItemData.requires_special_handling ?? false}
                    onChange={(e) =>
                      setNewItemData({
                        ...newItemData,
                        requires_special_handling: e.target.checked,
                      })
                    }
                  />
                }
                label={t('business.inventory.requiresSpecialHandling')}
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>{t('business.inventory.brand')}</InputLabel>
                <Select
                  value={newItemData.brand_id || ''}
                  onChange={(e) =>
                    setNewItemData({
                      ...newItemData,
                      brand_id: e.target.value || undefined,
                    })
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
                  <MenuItem
                    value="new"
                    onClick={() => setShowNewBrandForm(true)}
                  >
                    + {t('business.inventory.addNewBrand')}
                  </MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {showNewBrandForm && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('business.inventory.addNewBrand')}
                </Typography>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      fullWidth
                      label={t('business.inventory.brandName')}
                      value={newBrandData.name}
                      onChange={(e) =>
                        setNewBrandData({
                          ...newBrandData,
                          name: e.target.value,
                        })
                      }
                    />
                    <TextField
                      fullWidth
                      label={t('business.inventory.brandDescription')}
                      value={newBrandData.description}
                      onChange={(e) =>
                        setNewBrandData({
                          ...newBrandData,
                          description: e.target.value,
                        })
                      }
                    />
                  </Stack>
                  <Button
                    variant="contained"
                    onClick={handleCreateBrand}
                    disabled={!newBrandData.name}
                  >
                    {t('business.inventory.createBrand')}
                  </Button>
                </Stack>
              </Paper>
            )}

            <Stack direction="row" spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newItemData.is_active ?? true}
                    onChange={(e) =>
                      setNewItemData({
                        ...newItemData,
                        is_active: e.target.checked,
                      })
                    }
                  />
                }
                label={t('business.inventory.active')}
              />
            </Stack>
          </Stack>
        </TabPanel>

        {itemsError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {itemsError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        {tabValue === 0 && selectedItem && (
          <Button
            onClick={handleAddToInventory}
            variant="contained"
            disabled={!inventoryData.business_location_id}
          >
            {t('business.inventory.addToInventory')}
          </Button>
        )}
        {tabValue === 1 && (
          <Button
            onClick={handleCreateItem}
            variant="contained"
            disabled={
              !businessId ||
              !newItemData.name ||
              !newItemData.item_sub_category_id ||
              !newItemData.price
            }
          >
            {t('business.inventory.createItem')}
          </Button>
        )}
        {createdItem && (
          <Button
            onClick={() => setShowImageUploadDialog(true)}
            variant="outlined"
            color="primary"
          >
            {t('business.inventory.addImages')}
          </Button>
        )}
      </DialogActions>

      {/* Image Upload Dialog */}
      {createdItem && (
        <ImageUploadDialog
          open={showImageUploadDialog}
          onClose={() => setShowImageUploadDialog(false)}
          itemId={createdItem.id}
          itemName={createdItem.name}
        />
      )}
    </Dialog>
  );
}
