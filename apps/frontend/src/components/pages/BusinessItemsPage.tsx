import {
  Add as AddIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import { useItems } from '../../hooks/useItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import AddItemDialog from '../business/AddItemDialog';
import CSVUploadDialog from '../business/CSVUploadDialog';
import EditItemDialog from '../business/EditItemDialog';
import ItemsCards from '../business/ItemsCards';
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
      id={`items-tabpanel-${index}`}
      aria-labelledby={`items-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const BusinessItemsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfile();
  const [tabValue, setTabValue] = useState(0);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [showCSVUploadDialog, setShowCSVUploadDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const {
    items,
    loading: itemsLoading,
    error: itemsError,
  } = useItems(profile?.business?.id);
  const { locations, loading: locationsLoading } = useBusinessLocations();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setShowEditItemDialog(true);
  };

  const handleCloseEditItemDialog = () => {
    setShowEditItemDialog(false);
    setEditingItem(null);
  };

  const downloadItemsCSV = () => {
    if (!items || items.length === 0) {
      enqueueSnackbar(t('business.items.noItemsToDownload'), {
        variant: 'warning',
      });
      return;
    }

    // Define headers in the same order as the upload template
    const headers = [
      'name',
      'description',
      'price',
      'currency',
      'sku',
      'size',
      'size_unit',
      'weight',
      'weight_unit',
      'color',
      'material',
      'model',
      'is_fragile',
      'is_perishable',
      'requires_special_handling',
      'min_order_quantity',
      'max_order_quantity',
      'is_active',
      'item_sub_category_id',
      'brand_id',
      'business_location_name',
      'quantity',
      'available_quantity',
      'reserved_quantity',
      'reorder_point',
      'reorder_quantity',
      'unit_cost',
      'selling_price',
      'image_url',
      'image_alt_text',
      'image_caption',
    ];

    // Convert items to CSV rows
    const csvRows = items.map((item) => {
      // Get the main image URL if available
      const mainImage = item.item_images?.find(
        (img) => img.image_type === 'main'
      );

      return [
        item.name || '',
        item.description || '',
        item.price?.toString() || '',
        item.currency || 'USD',
        item.sku || '',
        item.size?.toString() || '',
        item.size_unit || '',
        item.weight?.toString() || '',
        item.weight_unit || '',
        item.color || '',
        item.material || '',
        item.model || '',
        item.is_fragile?.toString() || 'false',
        item.is_perishable?.toString() || 'false',
        item.requires_special_handling?.toString() || 'false',
        item.min_order_quantity?.toString() || '1',
        item.max_order_quantity?.toString() || '',
        item.is_active?.toString() || 'true',
        item.item_sub_category_id?.toString() || '',
        item.brand_id || '',
        '', // business_location_name - will be empty for items without inventory
        '', // quantity
        '', // available_quantity
        '', // reserved_quantity
        '', // reorder_point
        '', // reorder_quantity
        '', // unit_cost
        '', // selling_price
        mainImage?.image_url || '',
        mainImage?.alt_text || '',
        mainImage?.caption || '',
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvRows.map((row) => row.join(',')),
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `items_export_${
      new Date().toISOString().split('T')[0]
    }.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    enqueueSnackbar(t('business.items.downloadSuccess'), {
      variant: 'success',
    });
  };

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
        title={t('seo.business-items.title')}
        description={t('seo.business-items.description')}
        keywords={t('seo.business-items.keywords')}
      />

      <Typography variant="h4" gutterBottom>
        {t('business.items.title')}
      </Typography>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          aria-label="items tabs"
        >
          <Tab label={t('business.items.cardsView')} />
          <Tab label={t('business.items.tableView')} />
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
                {t('business.items.cardsView')}
              </Typography>
              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={downloadItemsCSV}
                  disabled={itemsLoading || items.length === 0}
                >
                  {t('business.items.downloadCSV')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={() => setShowCSVUploadDialog(true)}
                >
                  {t('business.csvUpload.uploadCSV')}
                </Button>
                <Tooltip title={t('business.items.noLocationsError')}>
                  <span>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        if (locations.length === 0) {
                          enqueueSnackbar(
                            t('business.items.noLocationsError'),
                            {
                              variant: 'error',
                            }
                          );
                          return;
                        }
                        setShowAddItemDialog(true);
                      }}
                      disabled={locations.length === 0}
                    >
                      {t('business.items.addItem')}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Box>

            {itemsLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <Typography>{t('common.loading')}</Typography>
              </Box>
            ) : itemsError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {itemsError}
              </Alert>
            ) : (
              <ItemsCards
                items={items}
                loading={itemsLoading}
                onEditItem={handleEditItem}
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
                {t('business.items.tableView')}
              </Typography>
              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={downloadItemsCSV}
                  disabled={itemsLoading || items.length === 0}
                >
                  {t('business.items.downloadCSV')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={() => setShowCSVUploadDialog(true)}
                >
                  {t('business.csvUpload.uploadCSV')}
                </Button>
                <Tooltip title={t('business.items.noLocationsError')}>
                  <span>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        if (locations.length === 0) {
                          enqueueSnackbar(
                            t('business.items.noLocationsError'),
                            {
                              variant: 'error',
                            }
                          );
                          return;
                        }
                        setShowAddItemDialog(true);
                      }}
                      disabled={locations.length === 0}
                    >
                      {t('business.items.addItem')}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Box>

            {itemsLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <Typography>{t('common.loading')}</Typography>
              </Box>
            ) : itemsError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {itemsError}
              </Alert>
            ) : (
              <ItemsCards
                items={items}
                loading={itemsLoading}
                onEditItem={handleEditItem}
              />
            )}
          </Box>
        </TabPanel>
      </Paper>

      {/* Add Item Dialog */}
      <AddItemDialog
        open={showAddItemDialog}
        onClose={() => setShowAddItemDialog(false)}
        businessId={profile?.business?.id || ''}
        businessLocations={locations}
      />

      {/* Edit Item Dialog */}
      <EditItemDialog
        open={showEditItemDialog}
        onClose={handleCloseEditItemDialog}
        item={editingItem}
        businessId={profile?.business?.id}
      />

      {/* CSV Upload Dialog */}
      <CSVUploadDialog
        open={showCSVUploadDialog}
        onClose={() => setShowCSVUploadDialog(false)}
        businessId={profile?.business?.id || ''}
      />
    </Container>
  );
};

export default BusinessItemsPage;
