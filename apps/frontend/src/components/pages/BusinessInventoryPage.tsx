import { Add as AddIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import { useUserProfile } from '../../hooks/useUserProfile';
import BusinessInventoryTable from '../business/BusinessInventoryTable';
import InventoryCards from '../business/InventoryCards';
import UpdateInventoryDialog from '../business/UpdateInventoryDialog';
import SEOHead from '../seo/SEOHead';

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
      id={`inventory-tabpanel-${index}`}
      aria-labelledby={`inventory-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const BusinessInventoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile, loading: profileLoading } = useUserProfile();
  const [tabValue, setTabValue] = useState(0);
  const [showUpdateInventoryDialog, setShowUpdateInventoryDialog] =
    useState(false);
  const [updatingInventoryItem, setUpdatingInventoryItem] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [inventoryToDelete, setInventoryToDelete] = useState<any>(null);

  const {
    inventory,
    businessLocations,
    loading: inventoryLoading,
    error: inventoryError,
    updateInventoryItem,
    deleteInventoryItem,
    refreshBusinessLocations,
  } = useBusinessInventory(profile?.business?.id);

  // Debug logging
  console.log('BusinessInventoryPage: profile:', profile);
  console.log(
    'BusinessInventoryPage: profile?.business?.id:',
    profile?.business?.id
  );
  console.log('BusinessInventoryPage: businessLocations:', businessLocations);
  console.log(
    'BusinessInventoryPage: businessLocations.length:',
    businessLocations.length
  );
  const { loading: locationsLoading } = useBusinessLocations();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDeleteInventoryItem = (item: any) => {
    setInventoryToDelete(item);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!inventoryToDelete) return;

    try {
      await deleteInventoryItem(inventoryToDelete.id);
      enqueueSnackbar(t('business.inventory.itemDeleted'), {
        variant: 'success',
      });
      setShowDeleteConfirm(false);
      setInventoryToDelete(null);
    } catch (error) {
      enqueueSnackbar(t('business.inventory.deleteError'), {
        variant: 'error',
      });
    }
  };

  const handleRestockInventoryItem = (item: any) => {
    setUpdatingInventoryItem(item);
    setShowUpdateInventoryDialog(true);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const getStockStatus = (quantity: number, reorderPoint: number) => {
    if (quantity === 0)
      return { status: 'outOfStock', color: 'error' as const };
    if (quantity <= reorderPoint)
      return { status: 'lowStock', color: 'warning' as const };
    return { status: 'inStock', color: 'success' as const };
  };

  if (profileLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" p={3}>
          <Typography>{t('common.loading')}</Typography>
        </Box>
      </Container>
    );
  }

  if (!profile?.business) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {t('business.dashboard.noBusinessProfile')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('seo.business-inventory.title')}
        description={t('seo.business-inventory.description')}
        keywords={t('seo.business-inventory.keywords')}
      />

      <Typography variant="h4" gutterBottom>
        {t('business.inventory.title')}
      </Typography>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          aria-label="inventory tabs"
        >
          <Tab label={t('business.inventory.cardsView')} />
          <Tab label={t('business.inventory.tableView')} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {/* Cards View */}
          <Box sx={{ mb: 3 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">
                {t('business.inventory.cardsView')}
              </Typography>
              <Tooltip title={t('business.inventory.noLocationsError')}>
                <span>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      if (businessLocations.length === 0) {
                        enqueueSnackbar(
                          t('business.inventory.noLocationsError'),
                          {
                            variant: 'error',
                          }
                        );
                        return;
                      }
                      // TODO: Add inventory dialog
                      enqueueSnackbar(
                        'Add inventory functionality coming soon',
                        { variant: 'info' }
                      );
                    }}
                    disabled={
                      businessLocations.length === 0 || inventoryLoading
                    }
                  >
                    {t('business.inventory.addItem')}
                  </Button>
                </span>
              </Tooltip>
            </Box>

            {inventoryLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <Typography>{t('common.loading')}</Typography>
              </Box>
            ) : inventoryError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {inventoryError}
              </Alert>
            ) : (
              <InventoryCards
                items={inventory}
                loading={inventoryLoading}
                onUpdateInventory={handleRestockInventoryItem}
                onEditItem={handleRestockInventoryItem}
                onDeleteItem={handleDeleteInventoryItem}
                onRestockItem={handleRestockInventoryItem}
              />
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Table View */}
          <Box sx={{ mb: 3 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">
                {t('business.inventory.tableView')}
              </Typography>
              <Tooltip title={t('business.inventory.noLocationsError')}>
                <span>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      if (businessLocations.length === 0) {
                        enqueueSnackbar(
                          t('business.inventory.noLocationsError'),
                          {
                            variant: 'error',
                          }
                        );
                        return;
                      }
                      // TODO: Add inventory dialog
                      enqueueSnackbar(
                        'Add inventory functionality coming soon',
                        { variant: 'info' }
                      );
                    }}
                    disabled={
                      businessLocations.length === 0 || inventoryLoading
                    }
                  >
                    {t('business.inventory.addItem')}
                  </Button>
                </span>
              </Tooltip>
            </Box>

            {inventoryLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <Typography>{t('common.loading')}</Typography>
              </Box>
            ) : inventoryError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {inventoryError}
              </Alert>
            ) : (
              <BusinessInventoryTable
                items={inventory}
                loading={inventoryLoading}
                onUpdateInventory={handleRestockInventoryItem}
                onEditItem={handleRestockInventoryItem}
                onDeleteItem={handleDeleteInventoryItem}
                onRestockItem={handleRestockInventoryItem}
              />
            )}
          </Box>
        </TabPanel>
      </Paper>

      {/* Update Inventory Dialog */}
      <UpdateInventoryDialog
        open={showUpdateInventoryDialog}
        onClose={() => setShowUpdateInventoryDialog(false)}
        item={updatingInventoryItem}
        businessLocations={businessLocations}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <DialogTitle>{t('business.inventory.confirmDelete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('business.inventory.confirmDeleteText')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BusinessInventoryPage;
