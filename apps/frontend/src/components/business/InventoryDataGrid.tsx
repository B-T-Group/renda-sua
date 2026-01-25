import {
  Edit as EditIcon,
  Inventory as InventoryIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Item } from '../../hooks/useItems';

interface InventoryDataGridProps {
  items: Item[];
  loading: boolean;
  onUpdateInventory: (item: Item) => void;
  onEditItem: (item: Item) => void;
}

export default function InventoryDataGrid({
  items,
  loading,
  onUpdateInventory,
  onEditItem,
}: InventoryDataGridProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleViewItem = (item: Item) => {
    navigate(`/business/items/${item.id}`);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: t('business.inventory.itemName'),
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams<Item>) => (
        <Stack spacing={0.5}>
          <Typography variant="body2" fontWeight="medium">
            {params.value}
          </Typography>
          {params.row.sku && (
            <Typography variant="caption" color="text.secondary">
              SKU: {params.row.sku}
            </Typography>
          )}
        </Stack>
      ),
    },
    {
      field: 'category',
      headerName: t('business.inventory.category'),
      flex: 1,
      minWidth: 150,
      renderCell: (param: GridRenderCellParams<Item>) => {
        const item = param.row;
        if (item.item_sub_category?.item_category) {
          return `${item.item_sub_category.item_category.name} - ${item.item_sub_category.name}`;
        }
        return item.item_sub_category?.name || '';
      },
    },
    {
      field: 'brand',
      headerName: t('business.inventory.brand'),
      flex: 0.8,
      minWidth: 120,
      renderCell: (param: GridRenderCellParams<Item>) => {
        return param.row.brand?.name || t('business.inventory.noBrand');
      },
    },
    {
      field: 'price',
      headerName: t('business.inventory.price'),
      flex: 0.8,
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<Item>) => (
        <Typography variant="body2" fontWeight="medium">
          {formatCurrency(params.row.price, params.row.currency)}
        </Typography>
      ),
    },
    {
      field: 'physical_properties',
      headerName: t('business.inventory.physicalProperties'),
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams<Item>) => {
        const item = params.row;
        const properties = [];

        if (item.weight) {
          properties.push(`${item.weight}${item.weight_unit || ''}`);
        }
        if (item.dimensions) {
          properties.push(item.dimensions);
        }
        if (item.color) {
          properties.push(item.color);
        }

        return (
          <Stack spacing={0.5}>
            {properties.length > 0 ? (
              properties.map((prop, index) => (
                <Typography
                  key={index}
                  variant="caption"
                  color="text.secondary"
                >
                  {prop}
                </Typography>
              ))
            ) : (
              <Typography variant="caption" color="text.secondary">
                {t('business.inventory.noProperties')}
              </Typography>
            )}
          </Stack>
        );
      },
    },
    {
      field: 'special_properties',
      headerName: t('business.inventory.specialProperties'),
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams<Item>) => {
        const item = params.row;
        const properties = [];

        if (item.is_fragile) {
          properties.push(t('business.inventory.isFragile'));
        }
        if (item.is_perishable) {
          properties.push(t('business.inventory.isPerishable'));
        }
        if (item.requires_special_handling) {
          properties.push(t('business.inventory.requiresSpecialHandling'));
        }

        return (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {properties.length > 0 ? (
              properties.map((prop, index) => (
                <Chip
                  key={index}
                  label={prop}
                  size="small"
                  variant="outlined"
                  color="warning"
                />
              ))
            ) : (
              <Typography variant="caption" color="text.secondary">
                {t('business.inventory.noSpecialProperties')}
              </Typography>
            )}
          </Stack>
        );
      },
    },
    {
      field: 'order_quantities',
      headerName: t('business.inventory.orderQuantities'),
      flex: 0.8,
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<Item>) => {
        const item = params.row;
        return (
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              Min: {item.min_order_quantity}
            </Typography>
            {item.max_order_quantity && (
              <Typography variant="caption" color="text.secondary">
                Max: {item.max_order_quantity}
              </Typography>
            )}
          </Stack>
        );
      },
    },
    {
      field: 'delivery_properties',
      headerName: t('business.inventory.deliveryProperties'),
      flex: 0.8,
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<Item>) => {
        const item = params.row;
        const properties = [];

        return (
          <Stack spacing={0.5}>
            {properties.length > 0 ? (
              properties.map((prop, index) => (
                <Typography
                  key={index}
                  variant="caption"
                  color="text.secondary"
                >
                  {prop}
                </Typography>
              ))
            ) : (
              <Typography variant="caption" color="text.secondary">
                {t('business.inventory.noDeliveryProperties')}
              </Typography>
            )}
          </Stack>
        );
      },
    },
    {
      field: 'status',
      headerName: t('business.inventory.stockStatus'),
      flex: 0.6,
      minWidth: 100,
      renderCell: (params: GridRenderCellParams<Item>) => (
        <Chip
          label={
            params.row.is_active
              ? t('business.inventory.active')
              : t('business.inventory.inactive')
          }
          color={params.row.is_active ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'created_at',
      headerName: t('business.inventory.createdAt'),
      flex: 0.8,
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<Item>) => (
        <Typography variant="caption" color="text.secondary">
          {formatDate(params.row.created_at)}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: t('common.actions'),
      flex: 1,
      minWidth: 200,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<Item>) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title={t('business.inventory.viewItem')}>
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleViewItem(params.row)}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title={t('business.inventory.updateInventory')}>
            <IconButton
              size="small"
              color="secondary"
              onClick={() => onUpdateInventory(params.row)}
            >
              <InventoryIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title={t('business.inventory.editItemButton')}>
            <IconButton
              size="small"
              color="info"
              onClick={() => onEditItem(params.row)}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <DataGrid
      rows={items}
      columns={columns}
      loading={loading}
      pageSizeOptions={[10, 25, 50, 100]}
      initialState={{
        pagination: {
          paginationModel: { page: 0, pageSize: 25 },
        },
        sorting: {
          sortModel: [{ field: 'created_at', sort: 'desc' }],
        },
      }}
      disableRowSelectionOnClick
      sx={{
        height: 600,
        '& .MuiDataGrid-cell': {
          borderBottom: '1px solid #e0e0e0',
          minHeight: '120px !important',
          maxHeight: 'none !important',
          padding: '12px 16px',
        },
        '& .MuiDataGrid-columnHeaders': {
          backgroundColor: '#f5f5f5',
          borderBottom: '2px solid #e0e0e0',
        },
        '& .MuiDataGrid-row:hover': {
          backgroundColor: '#f8f8f8',
        },
        '& .MuiDataGrid-row': {
          minHeight: '120px !important',
          maxHeight: 'none !important',
        },
      }}
    />
  );
}
