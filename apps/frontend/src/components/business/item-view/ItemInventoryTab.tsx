import {
  Add as AddIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Item } from '../../../hooks/useItems';
import {
  AnyInventory,
  formatItemCurrency,
  getStockStatus,
  ItemBusinessInventory,
} from './itemViewHelpers';

interface ItemInventoryTabProps {
  item: Item;
  canSuperUserActions: boolean;
  onUpdateInventory: (inventory?: AnyInventory) => void;
  onAddLocation: () => void;
  onManageDeals: (inventory: AnyInventory) => void;
}

interface LocationCardProps {
  inventory: ItemBusinessInventory;
  currency: string;
  canSuperUserActions: boolean;
  onUpdateInventory: (inventory: AnyInventory) => void;
  onManageDeals: (inventory: AnyInventory) => void;
}

const LocationCard: React.FC<LocationCardProps> = ({
  inventory,
  currency,
  canSuperUserActions,
  onUpdateInventory,
  onManageDeals,
}) => {
  const { t } = useTranslation();
  const stockStatus = getStockStatus(inventory);

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderColor: `${stockStatus.color}.main`,
        borderWidth: 2,
        transition: 'all 0.3s ease',
        '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
      }}
    >
      <CardContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            {inventory.business_location?.name}
          </Typography>
          <Chip
            label={t(`business.inventory.status.${stockStatus.label}`)}
            size="small"
            color={stockStatus.color}
            sx={{ fontWeight: 600 }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              {t('business.inventory.stockLevel', 'Stock Level')}
            </Typography>
            <Typography variant="caption" fontWeight="medium">
              {Math.round(stockStatus.percentage)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={stockStatus.percentage}
            color={stockStatus.color}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={4}>
            <Typography variant="caption" color="text.secondary">
              {t('business.inventory.available', 'Available')}
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="success.main">
              {inventory.computed_available_quantity}
            </Typography>
          </Grid>
          <Grid size={4}>
            <Typography variant="caption" color="text.secondary">
              {t('business.inventory.reserved', 'Reserved')}
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="warning.main">
              {inventory.reserved_quantity}
            </Typography>
          </Grid>
          <Grid size={4}>
            <Typography variant="caption" color="text.secondary">
              {t('business.inventory.total', 'Total')}
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {inventory.quantity}
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={1} sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              {t('business.inventory.sellingPrice', 'Selling Price')}:
            </Typography>
            <Typography variant="body2" fontWeight="600" color="primary">
              {formatItemCurrency(inventory.selling_price, currency)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              {t('business.inventory.reorderPoint', 'Reorder Point')}:
            </Typography>
            <Typography variant="body2" fontWeight="600">
              {inventory.reorder_point}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => onUpdateInventory(inventory)}
            startIcon={<InventoryIcon />}
            sx={{ flex: 1 }}
          >
            {t('business.inventory.updateStock', 'Update Stock')}
          </Button>
          {canSuperUserActions && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => onManageDeals(inventory)}
            >
              {t('business.items.deals.manage', 'Manage deals')}
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

const ItemInventoryTab: React.FC<ItemInventoryTabProps> = ({
  item,
  canSuperUserActions,
  onUpdateInventory,
  onAddLocation,
  onManageDeals,
}) => {
  const { t } = useTranslation();
  const inventories = item.business_inventories ?? [];

  return (
    <Card>
      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          {t('business.inventory.locationInventory', 'Location Inventory')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAddLocation}
          size="small"
        >
          {t('business.inventory.addLocation', 'Add Location')}
        </Button>
      </Box>

      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t(
            'business.inventory.locationDescription',
            'Manage inventory levels for each business location. Customers can only order from locations with available stock.'
          )}
        </Typography>

        {inventories.length > 0 ? (
          <Grid container spacing={2}>
            {inventories.map((inventory) => (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={inventory.id}>
                <LocationCard
                  inventory={inventory}
                  currency={item.currency}
                  canSuperUserActions={canSuperUserActions}
                  onUpdateInventory={onUpdateInventory}
                  onManageDeals={onManageDeals}
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              bgcolor: 'grey.50',
              borderRadius: 2,
              border: '2px dashed',
              borderColor: 'grey.300',
            }}
          >
            <InventoryIcon sx={{ fontSize: 60, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {t('business.inventory.noInventoryFound', 'No Inventory Yet')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t(
                'business.inventory.addFirstLocation',
                'Add this item to your first location to start selling'
              )}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onAddLocation}
            >
              {t('business.inventory.addToLocation', 'Add to Location')}
            </Button>
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default ItemInventoryTab;
