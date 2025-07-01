import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { useItems } from '../../hooks/useItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import EditItemDialog from '../business/EditItemDialog';
import ImageUploadDialog from '../business/ImageUploadDialog';
import UpdateInventoryDialog from '../business/UpdateInventoryDialog';

export default function ItemViewPage() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showUpdateInventoryDialog, setShowUpdateInventoryDialog] =
    useState(false);
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);

  const { fetchItems, fetchSingleItem, updateItem, items } = useItems(
    profile?.business?.id
  );
  const { businessLocations, fetchBusinessLocations } = useBusinessInventory();

  useEffect(() => {
    if (itemId) {
      fetchItemDetails();
    }
  }, [itemId]);

  useEffect(() => {
    if (profile?.business?.id) {
      fetchBusinessLocations();
    }
  }, [profile?.business?.id, fetchBusinessLocations]);

  const fetchItemDetails = async () => {
    if (!itemId) return;

    setLoading(true);
    setError(null);

    try {
      const foundItem = await fetchSingleItem(itemId);

      if (foundItem) {
        setItem(foundItem);
      } else {
        setError(t('business.inventory.itemNotFound'));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch item details'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = () => {
    setShowEditDialog(true);
  };

  const handleUpdateInventory = () => {
    setShowUpdateInventoryDialog(true);
  };

  const handleManageImages = () => {
    setShowImageUploadDialog(true);
  };

  const handleBack = () => {
    navigate('/business-dashboard');
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" p={4}>
          <Typography>{t('common.loading')}</Typography>
        </Box>
      </Container>
    );
  }

  if (error || !item) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || t('business.inventory.itemNotFound')}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack}>
          {t('common.back')}
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <IconButton onClick={handleBack}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {item.name}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleEditItem}
          >
            {t('business.inventory.editItemButton')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<InventoryIcon />}
            onClick={handleUpdateInventory}
          >
            {t('business.inventory.updateInventory')}
          </Button>
          <Button variant="outlined" onClick={handleManageImages}>
            {t('business.inventory.manageImages')}
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Item Details */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('business.inventory.itemDetails')}
            </Typography>

            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {t('business.inventory.description')}
                </Typography>
                <Typography variant="body1">{item.description}</Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.sku')}
                  </Typography>
                  <Typography variant="body1">
                    {item.sku || t('business.inventory.noSku')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.category')}
                  </Typography>
                  <Typography variant="body1">
                    {item.item_sub_category?.item_category?.name} -{' '}
                    {item.item_sub_category?.name}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.brand')}
                  </Typography>
                  <Typography variant="body1">
                    {item.brand?.name || t('business.inventory.noBrand')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.price')}
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {formatCurrency(item.price, item.currency)}
                  </Typography>
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          {/* Physical Properties */}
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('business.inventory.physicalProperties')}
            </Typography>

            <Grid container spacing={2}>
              {item.size && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.size')}
                  </Typography>
                  <Typography variant="body1">
                    {item.size} {item.size_unit}
                  </Typography>
                </Grid>
              )}
              {item.weight && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.weight')}
                  </Typography>
                  <Typography variant="body1">
                    {item.weight} {item.weight_unit}
                  </Typography>
                </Grid>
              )}
              {item.color && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.color')}
                  </Typography>
                  <Typography variant="body1">{item.color}</Typography>
                </Grid>
              )}
              {item.model && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.model')}
                  </Typography>
                  <Typography variant="body1">{item.model}</Typography>
                </Grid>
              )}
              {item.material && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.material')}
                  </Typography>
                  <Typography variant="body1">{item.material}</Typography>
                </Grid>
              )}
            </Grid>
          </Paper>

          {/* Special Properties */}
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('business.inventory.specialProperties')}
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              {item.is_fragile && (
                <Chip
                  label={t('business.inventory.isFragile')}
                  color="warning"
                  variant="outlined"
                />
              )}
              {item.is_perishable && (
                <Chip
                  label={t('business.inventory.isPerishable')}
                  color="warning"
                  variant="outlined"
                />
              )}
              {item.requires_special_handling && (
                <Chip
                  label={t('business.inventory.requiresSpecialHandling')}
                  color="warning"
                  variant="outlined"
                />
              )}
              {!item.is_fragile &&
                !item.is_perishable &&
                !item.requires_special_handling && (
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.noSpecialProperties')}
                  </Typography>
                )}
            </Stack>
          </Paper>

          {/* Order and Delivery Properties */}
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('business.inventory.orderAndDelivery')}
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  {t('business.inventory.minOrderQuantity')}
                </Typography>
                <Typography variant="body1">
                  {item.min_order_quantity}
                </Typography>
              </Grid>
              {item.max_order_quantity && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.maxOrderQuantity')}
                  </Typography>
                  <Typography variant="body1">
                    {item.max_order_quantity}
                  </Typography>
                </Grid>
              )}
              {item.max_delivery_distance && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.maxDeliveryDistance')}
                  </Typography>
                  <Typography variant="body1">
                    {item.max_delivery_distance} km
                  </Typography>
                </Grid>
              )}
              {item.estimated_delivery_time && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.inventory.estimatedDeliveryTime')}
                  </Typography>
                  <Typography variant="body1">
                    {item.estimated_delivery_time} hours
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            {/* Status Card */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('business.inventory.status')}
                </Typography>
                <Chip
                  label={
                    item.is_active
                      ? t('business.inventory.active')
                      : t('business.inventory.inactive')
                  }
                  color={item.is_active ? 'success' : 'default'}
                  sx={{ mb: 2 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {t('business.inventory.createdAt')}:{' '}
                  {formatDate(item.created_at)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('business.inventory.updatedAt')}:{' '}
                  {formatDate(item.updated_at)}
                </Typography>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('business.inventory.quickActions')}
                </Typography>
                <Stack spacing={1}>
                  <Button
                    variant="contained"
                    startIcon={<InventoryIcon />}
                    onClick={handleUpdateInventory}
                    fullWidth
                  >
                    {t('business.inventory.updateInventory')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={handleEditItem}
                    fullWidth
                  >
                    {t('business.inventory.editItemButton')}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* Dialogs */}
      <EditItemDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        item={item}
        businessId={profile?.business?.id}
      />

      <UpdateInventoryDialog
        open={showUpdateInventoryDialog}
        onClose={() => setShowUpdateInventoryDialog(false)}
        item={item}
        businessLocations={businessLocations}
      />

      <ImageUploadDialog
        open={showImageUploadDialog}
        onClose={() => setShowImageUploadDialog(false)}
        itemId={item.id}
        itemName={item.name}
      />
    </Container>
  );
}
