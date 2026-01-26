import {
  Add as AddIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Inventory as InventoryIcon,
  LocationOn as LocationOnIcon,
  Refresh as RefreshIcon,
  Upload as UploadIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
} from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { useItems, type Item } from '../../hooks/useItems';
import AddItemDialog from '../business/AddItemDialog';
import BusinessItemCardView from '../business/BusinessItemCardView';
import { CSV_ITEMS_TEMPLATE_HEADERS } from '../business/csvItemsTemplate';
import CSVUploadDialog from '../business/CSVUploadDialog';
import ItemsFilterBar, { ItemsFilterState } from '../business/ItemsFilterBar';
import UpdateInventoryDialog from '../business/UpdateInventoryDialog';
import SEOHead from '../seo/SEOHead';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

type InlineDraft = {
  name: string;
  sku: string | null;
  brand_id: string | null;
  price: number;
  item_sub_category_id: number;
};

type EditableField = 'name' | 'sku' | 'brand' | 'price' | 'category';

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`items-tabpanel-${index}`}
      aria-labelledby={`items-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 0 }}>{children}</Box>}
    </div>
  );
}

// Skeleton loading components
const ItemsCardsSkeleton: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {Array.from(new Array(6)).map((_, index) => (
        <Box
          key={index}
          sx={{
            flex: {
              xs: '1 1 100%',
              sm: '1 1 calc(50% - 12px)',
              md: '1 1 calc(33.333% - 16px)',
            },
          }}
        >
          <Card>
            <Skeleton variant="rectangular" height={200} />
            <CardContent>
              <Skeleton variant="text" height={24} sx={{ mb: 1 }} />
              <Skeleton variant="text" height={20} sx={{ mb: 1 }} />
              <Skeleton variant="text" height={20} width="60%" sx={{ mb: 2 }} />
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <Skeleton variant="rectangular" width={80} height={32} />
                <Box display="flex" gap={1}>
                  <Skeleton variant="circular" width={40} height={40} />
                  <Skeleton variant="circular" width={40} height={40} />
                  <Skeleton variant="circular" width={40} height={40} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
  );
};

const ItemsTableSkeleton: React.FC = () => {
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>
              <Skeleton variant="text" width={60} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={100} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={80} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={100} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={100} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={80} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={100} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={80} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={80} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={120} />
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from(new Array(5)).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton variant="circular" width={40} height={40} />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={150} />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={80} />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={100} />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={100} />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={60} />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" width={80} />
              </TableCell>
              <TableCell>
                <Skeleton variant="rectangular" width={60} height={24} />
              </TableCell>
              <TableCell>
                <Skeleton variant="rectangular" width={60} height={24} />
              </TableCell>
              <TableCell>
                <Box display="flex" gap={1}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton variant="circular" width={32} height={32} />
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const BusinessItemsPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useUserProfileContext();
  const [tabValue, setTabValue] = useState(0);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showCSVUploadDialog, setShowCSVUploadDialog] = useState(false);
  const [showUpdateInventoryDialog, setShowUpdateInventoryDialog] =
    useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingInventoryItem, setUpdatingInventoryItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [downloadLocationDialogOpen, setDownloadLocationDialogOpen] =
    useState(false);
  const [selectedDownloadLocationId, setSelectedDownloadLocationId] = useState<
    string | null
  >(null);

  // Filter state
  const [filters, setFilters] = useState<ItemsFilterState>({
    searchText: '',
    statusFilter: 'all',
    categoryFilter: 'all',
    brandFilter: 'all',
    stockFilter: 'all',
  });

  const {
    items,
    brands,
    itemSubCategories,
    loading: itemsLoading,
    error: itemsError,
    fetchItems,
    fetchBrands,
    fetchItemSubCategories,
    updateItem,
  } = useItems(profile?.business?.id);

  // Inline-edit state (Table View) – per-field, triggered by cell click
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    field: EditableField;
  } | null>(null);
  const [draftValues, setDraftValues] = useState<InlineDraft | null>(null);
  const [inlineUpdateLoading, setInlineUpdateLoading] = useState(false);

  const {
    businessLocations,
    loading: inventoryLoading,
    refreshBusinessLocations,
  } = useBusinessInventory(profile?.business?.id);

  const navigate = useNavigate();

  // Fetch data when component mounts
  useEffect(() => {
    if (profile?.business?.id) {
      fetchItems(false);
      fetchBrands();
      fetchItemSubCategories();
      refreshBusinessLocations(); // Ensure business locations are loaded
    }
  }, [
    profile?.business?.id,
    fetchItems,
    fetchBrands,
    fetchItemSubCategories,
    refreshBusinessLocations,
  ]);

  // Refresh data when window regains focus or becomes visible (useful when returning from other pages)
  useEffect(() => {
    const handleFocus = () => {
      if (profile?.business?.id) {
        fetchItems(false);
        refreshBusinessLocations();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && profile?.business?.id) {
        fetchItems(false);
        refreshBusinessLocations();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [profile?.business?.id, fetchItems, refreshBusinessLocations]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEditItem = (item: any) => {
    // Navigate to the edit page instead of opening dialog
    navigate(`/business/items/edit/${item.id}`);
  };

  const handleViewItem = (item: any) => {
    // Navigate to the view page
    navigate(`/business/items/${item.id}`);
  };

  const handleDeleteItem = (item: any) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setDeleteLoading(true);
    try {
      // TODO: Implement item deletion
      enqueueSnackbar(t('business.items.itemDeleted'), {
        variant: 'success',
      });
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    } catch (error) {
      enqueueSnackbar(t('business.items.deleteError'), {
        variant: 'error',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRestockInventoryItem = (item: any) => {
    // If item has business_inventories, use the first one, otherwise use the item directly
    const inventoryItem = item.business_inventories?.[0] || item;
    setUpdatingInventoryItem(inventoryItem);
    setShowUpdateInventoryDialog(true);
  };

  const handleRefreshLocations = async () => {
    try {
      await refreshBusinessLocations();
      enqueueSnackbar(t('business.locations.locationsRefreshed'), {
        variant: 'success',
      });
    } catch (error) {
      enqueueSnackbar(t('business.locations.refreshError'), {
        variant: 'error',
      });
    }
  };

  const startInlineEdit = (row: Item, field: EditableField) => {
    setEditingCell({ rowId: row.id, field });
    setDraftValues({
      name: row.name,
      sku: row.sku ?? '',
      brand_id: row.brand_id ?? null,
      price: row.price,
      item_sub_category_id: row.item_sub_category_id,
    });
  };

  const cancelInlineEdit = () => {
    setEditingCell(null);
    setDraftValues(null);
  };

  const applyInlineEdit = async () => {
    if (!editingCell || !draftValues) return;
    const { rowId, field } = editingCell;

    if (field === 'name') {
      const trimmed = draftValues.name.trim();
      if (!trimmed) {
        enqueueSnackbar(t('business.items.nameRequired'), {
          variant: 'warning',
        });
        return;
      }
    }
    if (field === 'price' && draftValues.price < 0) {
      enqueueSnackbar(t('business.items.price', 'Price') + ' must be ≥ 0', {
        variant: 'warning',
      });
      return;
    }

    const payload: Record<string, unknown> = {};
    if (field === 'name') payload.name = draftValues.name.trim();
    else if (field === 'sku')
      payload.sku = draftValues.sku?.trim() || undefined;
    else if (field === 'brand')
      payload.brand_id =
        draftValues.brand_id === null
          ? null
          : (draftValues.brand_id || undefined);
    else if (field === 'price') payload.price = draftValues.price;
    else if (field === 'category')
      payload.item_sub_category_id = draftValues.item_sub_category_id;

    setInlineUpdateLoading(true);
    try {
      await updateItem(
        rowId,
        payload as Parameters<typeof updateItem>[1],
        { skipRefetch: true }
      );
      enqueueSnackbar(t('business.items.itemUpdated'), { variant: 'success' });
      cancelInlineEdit();
    } catch (err) {
      enqueueSnackbar(
        err instanceof Error ? err.message : t('business.items.updateItem') + ' failed',
        { variant: 'error' }
      );
    } finally {
      setInlineUpdateLoading(false);
    }
  };

  const escapeCsvValue = (v: string | number | boolean | undefined | null): string => {
    const s = String(v ?? '');
    if (/[,\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const downloadItemsCSV = (locationId: string | null) => {
    if (!items || items.length === 0) {
      enqueueSnackbar(t('business.items.noItemsToDownload'), {
        variant: 'warning',
      });
      return;
    }

    const headers = [...CSV_ITEMS_TEMPLATE_HEADERS];
    const rows: string[][] = [];

    for (const item of items) {
      let invs = item.business_inventories ?? [];
      if (locationId) {
        invs = invs.filter((inv) => inv.business_location_id === locationId);
        if (invs.length === 0) continue;
      }

      const mainImage = item.item_images?.find((img) => img.image_type === 'main');

      if (invs.length === 0) {
        rows.push([
          escapeCsvValue(item.name ?? ''),
          escapeCsvValue(item.description ?? ''),
          escapeCsvValue(item.price ?? ''),
          escapeCsvValue(item.currency ?? 'USD'),
          escapeCsvValue(item.sku ?? ''),
          escapeCsvValue(item.weight ?? ''),
          escapeCsvValue(item.weight_unit ?? ''),
          escapeCsvValue(item.dimensions ?? ''),
          escapeCsvValue(item.color ?? ''),
          escapeCsvValue(item.model ?? ''),
          escapeCsvValue(item.is_fragile ?? false),
          escapeCsvValue(item.is_perishable ?? false),
          escapeCsvValue(item.requires_special_handling ?? false),
          escapeCsvValue(item.min_order_quantity ?? 1),
          escapeCsvValue(item.max_order_quantity ?? ''),
          escapeCsvValue(item.is_active ?? true),
          escapeCsvValue(item.item_sub_category_id ?? ''),
          escapeCsvValue(item.brand_id ?? ''),
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          escapeCsvValue(mainImage?.image_url ?? ''),
          escapeCsvValue(mainImage?.alt_text ?? ''),
          '',
        ]);
        continue;
      }

      for (const inv of invs) {
        const loc = inv.business_location;
        rows.push([
          escapeCsvValue(item.name ?? ''),
          escapeCsvValue(item.description ?? ''),
          escapeCsvValue(item.price ?? ''),
          escapeCsvValue(item.currency ?? 'USD'),
          escapeCsvValue(item.sku ?? ''),
          escapeCsvValue(item.weight ?? ''),
          escapeCsvValue(item.weight_unit ?? ''),
          escapeCsvValue(item.dimensions ?? ''),
          escapeCsvValue(item.color ?? ''),
          escapeCsvValue(item.model ?? ''),
          escapeCsvValue(item.is_fragile ?? false),
          escapeCsvValue(item.is_perishable ?? false),
          escapeCsvValue(item.requires_special_handling ?? false),
          escapeCsvValue(item.min_order_quantity ?? 1),
          escapeCsvValue(item.max_order_quantity ?? ''),
          escapeCsvValue(item.is_active ?? true),
          escapeCsvValue(item.item_sub_category_id ?? ''),
          escapeCsvValue(item.brand_id ?? ''),
          escapeCsvValue(loc?.name ?? ''),
          escapeCsvValue(inv.quantity ?? ''),
          escapeCsvValue(inv.reserved_quantity ?? ''),
          escapeCsvValue(inv.reorder_point ?? ''),
          escapeCsvValue(inv.reorder_quantity ?? ''),
          escapeCsvValue(inv.unit_cost ?? ''),
          escapeCsvValue(inv.selling_price ?? ''),
          escapeCsvValue(mainImage?.image_url ?? ''),
          escapeCsvValue(mainImage?.alt_text ?? ''),
          escapeCsvValue(''),
        ]);
      }
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `items_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    enqueueSnackbar(t('business.items.downloadSuccess'), { variant: 'success' });
  };

  const getStockStatus = (quantity: number, reorderPoint: number) => {
    if (quantity === 0)
      return { status: 'outOfStock', color: 'error' as const };
    if (quantity <= reorderPoint)
      return { status: 'lowStock', color: 'warning' as const };
    return { status: 'inStock', color: 'success' as const };
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  // DataGrid columns definition
  const columns: GridColDef[] = [
    {
      field: 'image',
      headerName: t('business.items.image'),
      width: 80,
      renderCell: (params: GridRenderCellParams) => {
        const mainImage = params.row.item_images?.find(
          (img: any) => img.image_type === 'main'
        );
        return (
          <Avatar
            src={mainImage?.image_url || '/src/assets/no-image.svg'}
            alt={params.row.name}
            sx={{ width: 40, height: 40 }}
            variant="rounded"
          />
        );
      },
      sortable: false,
      filterable: false,
    },
    {
      field: 'name',
      headerName: t('business.items.name'),
      width: 320,
      flex: 1,
      renderCell: (params: GridRenderCellParams) => {
        const isEditing =
          editingCell?.rowId === params.row.id &&
          editingCell?.field === 'name' &&
          draftValues;
        if (isEditing) {
          return (
            <TextField
              size="small"
              value={draftValues.name}
              onChange={(e) =>
                setDraftValues({ ...draftValues, name: e.target.value })
              }
              onClick={(e) => e.stopPropagation()}
              fullWidth
              variant="outlined"
              sx={{ minWidth: 140 }}
            />
          );
        }
        return (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              startInlineEdit(params.row, 'name');
            }}
            sx={{
              cursor: 'pointer',
              width: '100%',
              minHeight: 24,
              display: 'flex',
              alignItems: 'center',
              '&:hover': { bgcolor: 'action.hover' },
              borderRadius: 0.5,
              px: 0.5,
              mx: -0.5,
            }}
          >
            {params.row.name}
          </Box>
        );
      },
    },
    {
      field: 'sku',
      headerName: t('business.items.sku'),
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const isEditing =
          editingCell?.rowId === params.row.id &&
          editingCell?.field === 'sku' &&
          draftValues;
        if (isEditing) {
          return (
            <TextField
              size="small"
              value={draftValues.sku ?? ''}
              onChange={(e) =>
                setDraftValues({ ...draftValues, sku: e.target.value || null })
              }
              onClick={(e) => e.stopPropagation()}
              fullWidth
              variant="outlined"
              sx={{ minWidth: 100 }}
            />
          );
        }
        return (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              startInlineEdit(params.row, 'sku');
            }}
            sx={{
              cursor: 'pointer',
              width: '100%',
              minHeight: 24,
              display: 'flex',
              alignItems: 'center',
              '&:hover': { bgcolor: 'action.hover' },
              borderRadius: 0.5,
              px: 0.5,
              mx: -0.5,
            }}
          >
            {params.row.sku ?? ''}
          </Box>
        );
      },
    },
    {
      field: 'brand',
      headerName: t('business.items.brand'),
      width: 150,
      valueGetter: (value, row) => row.brand?.name || '',
      renderCell: (params: GridRenderCellParams) => {
        const isEditing =
          editingCell?.rowId === params.row.id &&
          editingCell?.field === 'brand' &&
          draftValues;
        if (isEditing) {
          return (
            <FormControl size="small" sx={{ minWidth: 120 }} fullWidth>
              <Select
                value={draftValues.brand_id ?? ''}
                onChange={(e) =>
                  setDraftValues({
                    ...draftValues,
                    brand_id: e.target.value || null,
                  })
                }
                onClick={(e) => e.stopPropagation()}
                displayEmpty
              >
                <MenuItem value="">
                  {t('business.inventory.noBrand')}
                </MenuItem>
                {brands.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        }
        return (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              startInlineEdit(params.row, 'brand');
            }}
            sx={{
              cursor: 'pointer',
              width: '100%',
              minHeight: 24,
              display: 'flex',
              alignItems: 'center',
              '&:hover': { bgcolor: 'action.hover' },
              borderRadius: 0.5,
              px: 0.5,
              mx: -0.5,
            }}
          >
            {params.row.brand?.name || t('business.inventory.noBrand')}
          </Box>
        );
      },
    },
    {
      field: 'category',
      headerName: t('business.items.category'),
      width: 150,
      valueGetter: (value, row) => row.item_sub_category?.name || '',
      renderCell: (params: GridRenderCellParams) => {
        const isEditing =
          editingCell?.rowId === params.row.id &&
          editingCell?.field === 'category' &&
          draftValues;
        if (isEditing) {
          return (
            <FormControl size="small" sx={{ minWidth: 140 }} fullWidth>
              <Select
                value={draftValues.item_sub_category_id ?? ''}
                onChange={(e) =>
                  setDraftValues({
                    ...draftValues,
                    item_sub_category_id: Number(e.target.value) || 0,
                  })
                }
                onClick={(e) => e.stopPropagation()}
                displayEmpty
              >
                {itemSubCategories.length === 0 ? (
                  <MenuItem disabled>
                    {t('business.inventory.noCategoriesFound')}
                  </MenuItem>
                ) : (
                  itemSubCategories.map(
                    (sc: {
                      id: number;
                      name: string;
                      item_category: { name: string };
                    }) => (
                      <MenuItem key={sc.id} value={sc.id}>
                        {sc.item_category?.name} - {sc.name}
                      </MenuItem>
                    )
                  )
                )}
              </Select>
            </FormControl>
          );
        }
        return (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              startInlineEdit(params.row, 'category');
            }}
            sx={{
              cursor: 'pointer',
              width: '100%',
              minHeight: 24,
              display: 'flex',
              alignItems: 'center',
              '&:hover': { bgcolor: 'action.hover' },
              borderRadius: 0.5,
              px: 0.5,
              mx: -0.5,
            }}
          >
            {params.row.item_sub_category?.name || ''}
          </Box>
        );
      },
    },
    {
      field: 'price',
      headerName: t('business.items.price'),
      width: 120,
      type: 'number',
      renderCell: (params: GridRenderCellParams) => {
        const isEditing =
          editingCell?.rowId === params.row.id &&
          editingCell?.field === 'price' &&
          draftValues;
        if (isEditing) {
          return (
            <TextField
              size="small"
              type="number"
              value={draftValues.price}
              onChange={(e) =>
                setDraftValues({
                  ...draftValues,
                  price: parseFloat(e.target.value) || 0,
                })
              }
              onClick={(e) => e.stopPropagation()}
              inputProps={{ min: 0, step: 0.01 }}
              sx={{ minWidth: 90 }}
            />
          );
        }
        return (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              startInlineEdit(params.row, 'price');
            }}
            sx={{
              cursor: 'pointer',
              width: '100%',
              minHeight: 24,
              display: 'flex',
              alignItems: 'center',
              '&:hover': { bgcolor: 'action.hover' },
              borderRadius: 0.5,
              px: 0.5,
              mx: -0.5,
            }}
          >
            {formatCurrency(params.row.price, params.row.currency)}
          </Box>
        );
      },
    },
    {
      field: 'inventory',
      headerName: t('business.inventory.available'),
      width: 120,
      type: 'number',
      valueGetter: (value, row) =>
        row.business_inventories?.[0]?.computed_available_quantity || 0,
    },
    {
      field: 'stock_status',
      headerName: t('business.inventory.stockStatus'),
      width: 130,
      renderCell: (params: GridRenderCellParams) => {
        const inventory = params.row.business_inventories?.[0];
        if (!inventory) {
          return (
            <Chip
              label={t('business.inventory.noInventory')}
              size="small"
              color="default"
            />
          );
        }
        const stockStatus = getStockStatus(
          inventory.computed_available_quantity,
          inventory.reorder_point
        );
        return (
          <Chip
            label={t(`business.inventory.status.${stockStatus.status}`)}
            size="small"
            color={stockStatus.color}
          />
        );
      },
    },
    {
      field: 'is_active',
      headerName: t('business.items.status'),
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={
            params.row.is_active
              ? t('business.items.active')
              : t('business.items.inactive')
          }
          size="small"
          color={params.row.is_active ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'actions',
      headerName: t('common.actions'),
      width: 180,
      renderCell: (params: GridRenderCellParams) => {
        const isEditing = editingCell?.rowId === params.row.id && draftValues;
        if (isEditing) {
          return (
            <Stack direction="row" spacing={1}>
              <Tooltip title={t('business.items.accept')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={applyInlineEdit}
                    disabled={inlineUpdateLoading}
                    sx={{ color: theme.palette.success.main }}
                  >
                    {inlineUpdateLoading ? (
                      <CircularProgress size={20} />
                    ) : (
                      <CheckIcon />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('business.items.cancel')}>
                <IconButton
                  size="small"
                  onClick={cancelInlineEdit}
                  disabled={inlineUpdateLoading}
                  sx={{ color: theme.palette.grey[600] }}
                >
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          );
        }
        return (
          <Stack direction="row" spacing={1}>
            <Tooltip title={t('business.items.viewItem')}>
              <IconButton
                size="small"
                onClick={() => handleViewItem(params.row)}
                sx={{ color: theme.palette.info.main }}
              >
                <ViewIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('business.items.editItem')}>
              <IconButton
                size="small"
                onClick={() => handleEditItem(params.row)}
                sx={{ color: theme.palette.primary.main }}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
            {params.row.business_inventories?.[0] && (
              <Tooltip title={t('business.inventory.restock')}>
                <IconButton
                  size="small"
                  onClick={() => handleRestockInventoryItem(params.row)}
                  sx={{ color: theme.palette.warning.main }}
                >
                  <InventoryIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={t('business.items.deleteItem')}>
              <IconButton
                size="small"
                onClick={() => handleDeleteItem(params.row)}
                sx={{ color: theme.palette.error.main }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
      sortable: false,
      filterable: false,
    },
  ];

  // Helper function to get stock status
  const getItemStockStatus = (item: any): string => {
    const inventory = item.business_inventories?.[0];
    if (!inventory) return 'noInventory';

    const quantity = inventory.computed_available_quantity || 0;
    const reorderPoint = inventory.reorder_point || 0;

    if (quantity === 0) return 'outOfStock';
    if (quantity <= reorderPoint) return 'lowStock';
    return 'inStock';
  };

  // Filter items based on search and filters
  const filteredItems =
    items?.filter((item) => {
      const matchesSearch =
        filters.searchText === '' ||
        item.name.toLowerCase().includes(filters.searchText.toLowerCase()) ||
        item.description
          ?.toLowerCase()
          .includes(filters.searchText.toLowerCase()) ||
        item.sku?.toLowerCase().includes(filters.searchText.toLowerCase());

      const matchesStatus =
        filters.statusFilter === 'all' ||
        (filters.statusFilter === 'active' && item.is_active) ||
        (filters.statusFilter === 'inactive' && !item.is_active);

      const matchesCategory =
        filters.categoryFilter === 'all' ||
        (filters.categoryFilter === '_no_category' && !item.item_sub_category) ||
        item.item_sub_category?.name === filters.categoryFilter;

      const matchesBrand =
        filters.brandFilter === 'all' ||
        (filters.brandFilter === '_no_brand' && !item.brand) ||
        item.brand?.name === filters.brandFilter;

      const matchesStock =
        filters.stockFilter === 'all' ||
        getItemStockStatus(item) === filters.stockFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesBrand &&
        matchesStock
      );
    }) || [];

  // Get unique categories and brands for filters
  const categories = Array.from(
    new Set(
      items
        ?.map((item) => item.item_sub_category?.name)
        .filter((name): name is string => Boolean(name)) || []
    )
  );
  const brandsInItems = Array.from(
    new Set(
      items
        ?.map((item) => item.brand?.name)
        .filter((name): name is string => Boolean(name)) || []
    )
  );

  if (profileLoading) {
    return (
      <Container maxWidth={false} disableGutters sx={{ mt: 0, mb: 0, px: 1 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            gap: 2,
          }}
        >
          <CircularProgress size={60} />
          <Typography variant="h6" color="text.secondary">
            {t('common.loading')}
          </Typography>
        </Box>
      </Container>
    );
  }

  if (profileError) {
    return (
      <Container maxWidth={false} disableGutters sx={{ mt: 0, mb: 0, px: 1 }}>
        <Alert severity="error">
          <Typography variant="h6" gutterBottom>
            {t('common.errorLoadingData')}
          </Typography>
          <Typography variant="body2">{profileError}</Typography>
        </Alert>
      </Container>
    );
  }

  if (!profile?.business) {
    return (
      <Container maxWidth={false} disableGutters sx={{ mt: 0, mb: 0, px: 1 }}>
        <Alert severity="error">
          {t('business.dashboard.noBusinessProfile')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} disableGutters sx={{ mt: 0, mb: 0, px: 1 }}>
      <SEOHead
        title={t('seo.business-items.title')}
        description={t('seo.business-items.description')}
        keywords={t('seo.business-items.keywords')}
      />

      <Typography variant="h4" sx={{ mb: 0.5 }}>
        {t('business.items.title')}
      </Typography>

      <Paper sx={{ width: '100%', mb: 0.5 }} elevation={0}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          aria-label="items tabs"
          sx={{ px: 0, minHeight: 40 }}
        >
          <Tab label={t('business.items.tableView')} />
          <Tab label={t('business.items.cardsView')} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {/* Table View */}
          <Box sx={{ mb: 0.5 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={0.5}
            >
              <Typography variant="h6">
                {t('business.items.tableView')}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Tooltip title={t('business.items.downloadTemplate')}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => {
                      setSelectedDownloadLocationId(null);
                      setDownloadLocationDialogOpen(true);
                    }}
                    disabled={itemsLoading || !items || items.length === 0}
                  >
                    {t('business.items.download')}
                  </Button>
                </Tooltip>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={() => setShowCSVUploadDialog(true)}
                >
                  {t('business.items.csvUpload')}
                </Button>
                <Tooltip title={t('business.locations.refreshLocations')}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefreshLocations}
                    disabled={inventoryLoading}
                  >
                    {t('business.locations.refresh')}
                  </Button>
                </Tooltip>
                <span>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      if (businessLocations.length === 0) {
                        enqueueSnackbar(
                          t('business.inventory.noLocationsError'),
                          { variant: 'error' }
                        );
                        return;
                      }
                      refreshBusinessLocations();
                      setShowAddItemDialog(true);
                    }}
                    disabled={businessLocations.length === 0}
                  >
                    {t('business.items.addItem')}
                  </Button>
                </span>
              </Stack>
            </Box>

            {/* Filters */}
            <ItemsFilterBar
              filters={filters}
              onFiltersChange={setFilters}
              categories={categories}
              brands={brandsInItems}
              totalItems={items?.length || 0}
              filteredItemsCount={filteredItems.length}
            />

            {/* DataGrid */}
            {itemsLoading ? (
              <ItemsTableSkeleton />
            ) : itemsError ? (
              <Alert severity="error">{itemsError}</Alert>
            ) : (
              <div style={{ height: 'calc(100vh - 200px)', minHeight: 400, width: '100%' }}>
                <DataGrid
                  rows={filteredItems}
                  columns={columns}
                  pageSizeOptions={[10, 25, 50, 100]}
                  initialState={{
                    pagination: {
                      paginationModel: {
                        pageSize: 25,
                      },
                    },
                  }}
                  disableRowSelectionOnClick
                  slots={{
                    toolbar: GridToolbar,
                  }}
                  slotProps={{
                    toolbar: {
                      showQuickFilter: true,
                      quickFilterProps: { debounceMs: 500 },
                    },
                  }}
                  sx={{
                    '& .MuiDataGrid-cell': {
                      display: 'flex',
                      alignItems: 'center',
                    },
                    '& .MuiDataGrid-row:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                />
              </div>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Cards View */}
          <Box sx={{ mb: 3 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">
                {t('business.items.cardsView')}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Tooltip title={t('business.items.downloadTemplate')}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => {
                      setSelectedDownloadLocationId(null);
                      setDownloadLocationDialogOpen(true);
                    }}
                    disabled={itemsLoading || !items || items.length === 0}
                  >
                    {t('business.items.download')}
                  </Button>
                </Tooltip>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={() => setShowCSVUploadDialog(true)}
                >
                  {t('business.items.csvUpload')}
                </Button>
                <Tooltip title={t('business.locations.refreshLocations')}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefreshLocations}
                    disabled={inventoryLoading}
                  >
                    {t('business.locations.refresh')}
                  </Button>
                </Tooltip>
                <span>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      if (businessLocations.length === 0) {
                        enqueueSnackbar(
                          t('business.inventory.noLocationsError'),
                          { variant: 'error' }
                        );
                        return;
                      }
                      navigate('/business/items/add');
                    }}
                    disabled={businessLocations.length === 0}
                  >
                    {t('business.items.addItem')}
                  </Button>
                </span>
                {businessLocations.length === 0 && (
                  <Button
                    variant="outlined"
                    startIcon={<LocationOnIcon />}
                    onClick={() => navigate('/business/locations')}
                    color="primary"
                  >
                    {t('business.locations.addLocation')}
                  </Button>
                )}
              </Stack>
            </Box>

            {/* Filters */}
            <ItemsFilterBar
              filters={filters}
              onFiltersChange={setFilters}
              categories={categories}
              brands={brandsInItems}
              totalItems={items?.length || 0}
              filteredItemsCount={filteredItems.length}
            />

            {itemsLoading ? (
              <ItemsCardsSkeleton />
            ) : itemsError ? (
              <Alert severity="error">{itemsError}</Alert>
            ) : !filteredItems || filteredItems.length === 0 ? (
              <Alert severity="info">{t('business.items.noItemsFound')}</Alert>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {filteredItems.map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      flex: {
                        xs: '1 1 100%',
                        sm: '1 1 calc(50% - 12px)',
                        md: '1 1 calc(33.333% - 16px)',
                      },
                    }}
                  >
                    <BusinessItemCardView
                      item={item}
                      onViewItem={handleViewItem}
                      onEditItem={handleEditItem}
                      onDeleteItem={handleDeleteItem}
                      onRestockInventoryItem={handleRestockInventoryItem}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </TabPanel>
      </Paper>

      {/* Dialogs */}
      <AddItemDialog
        open={showAddItemDialog}
        onClose={() => setShowAddItemDialog(false)}
        businessId={profile.business.id}
        businessLocations={businessLocations}
        items={items}
        brands={brands}
        itemSubCategories={itemSubCategories}
        loading={itemsLoading}
      />

      <UpdateInventoryDialog
        open={showUpdateInventoryDialog}
        onClose={() => setShowUpdateInventoryDialog(false)}
        item={
          updatingInventoryItem
            ? items.find((item) => item.id === updatingInventoryItem.item_id) ||
              null
            : null
        }
        selectedInventory={updatingInventoryItem}
        onInventoryUpdated={() => {
          fetchItems(false); // Refresh items list
        }}
      />

      <CSVUploadDialog
        open={showCSVUploadDialog}
        onClose={() => setShowCSVUploadDialog(false)}
        businessId={profile.business.id}
      />

      {/* Download CSV – location select */}
      <Dialog
        open={downloadLocationDialogOpen}
        onClose={() => setDownloadLocationDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('business.items.downloadSelectLocation')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('business.items.downloadSelectLocationDescription')}
          </DialogContentText>
          <FormControl fullWidth>
            <InputLabel>{t('business.locations.location', 'Location')}</InputLabel>
            <Select
              value={selectedDownloadLocationId ?? ''}
              label={t('business.locations.location', 'Location')}
              onChange={(e) =>
                setSelectedDownloadLocationId(
                  e.target.value === '' ? null : (e.target.value as string)
                )
              }
            >
              <MenuItem value="">
                {t('business.items.allLocations')}
              </MenuItem>
              {businessLocations.map((loc: { id: string; name: string }) => (
                <MenuItem key={loc.id} value={loc.id}>
                  {loc.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDownloadLocationDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              downloadItemsCSV(selectedDownloadLocationId ?? null);
              setDownloadLocationDialogOpen(false);
            }}
          >
            {t('business.items.download')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <DialogTitle>{t('business.items.confirmDelete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {itemToDelete
              ? t('business.items.deleteItemConfirm', {
                  name: itemToDelete.name,
                })
              : t('business.inventory.deleteInventoryConfirm')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowDeleteConfirm(false)}
            disabled={deleteLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteLoading}
            startIcon={
              deleteLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {deleteLoading ? t('common.loading') : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BusinessItemsPage;
