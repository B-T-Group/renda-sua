import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { Country, State } from 'country-state-city';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Address,
  AddressFormData,
  EntityType,
  useAddressManager,
} from '../../hooks/useAddressManager';
import AddressDialog, {
  AddressFormData as DialogAddressFormData,
} from '../dialogs/AddressDialog';
import ConfirmationModal from './ConfirmationModal';

interface AddressManagerProps {
  entityType: EntityType;
  entityId: string;
  title?: string;
  showAddressType?: boolean;
  showIsPrimary?: boolean;
  showCoordinates?: boolean;
  addressTypeOptions?: Array<{ value: string; label: string }>;
  maxAddresses?: number;
  allowDelete?: boolean;
  emptyStateMessage?: string;
  onAccountCreated?: (account: { id: string; [key: string]: unknown }) => void;
  /** When true, do not render outer Card (for embedding inside another card) */
  embedded?: boolean;
}

const defaultAddressTypeOptions = [
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'billing', label: 'Billing' },
  { value: 'store', label: 'Store' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'office', label: 'Office' },
];

const AddressManager: React.FC<AddressManagerProps> = ({
  entityType,
  entityId,
  title,
  showAddressType = true,
  showIsPrimary = true,
  showCoordinates = false,
  addressTypeOptions = defaultAddressTypeOptions,
  maxAddresses,
  allowDelete = true,
  emptyStateMessage,
  onAccountCreated,
  embedded = false,
}) => {
  const { t } = useTranslation();

  // Address manager hook
  const {
    addresses,
    loading,
    error,
    successMessage,
    warning,
    addAddress,
    updateAddress,
    deleteAddress,
    clearMessages,
  } = useAddressManager({ entityType, entityId, onAccountCreated });

  // Dialog states
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);

  // Form state - using the dialog's AddressFormData type
  const [addressForm, setAddressForm] = useState<DialogAddressFormData>({
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    address_type: 'home',
    is_primary: false,
  });

  // Handle add address
  const handleAddAddress = () => {
    clearMessages(); // Clear warnings when opening dialog
    setAddressForm({
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      address_type: 'home',
      is_primary: false,
    });
    setEditingAddress(null);
    setAddressDialogOpen(true);
  };

  // Handle edit address
  const handleEditAddress = (address: Address) => {
    clearMessages(); // Clear warnings when opening dialog
    setAddressForm({
      address_line_1: address.address_line_1,
      address_line_2: address.address_line_2 || '',
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country,
      address_type: address.address_type,
      is_primary: address.is_primary,
      latitude: address.latitude,
      longitude: address.longitude,
    });
    setEditingAddress(address);
    setAddressDialogOpen(true);
  };

  // Handle delete address
  const handleDeleteAddress = (address: Address) => {
    setAddressToDelete(address);
    setDeleteConfirmOpen(true);
  };

  // Handle save address
  const handleSaveAddress = async () => {
    try {
      // Convert dialog form data to hook form data
      const hookFormData: AddressFormData = {
        address_line_1: addressForm.address_line_1,
        address_line_2: addressForm.address_line_2,
        city: addressForm.city,
        state: addressForm.state,
        postal_code: addressForm.postal_code ?? '00000',
        country: addressForm.country,
        address_type: addressForm.address_type || 'home',
        is_primary: addressForm.is_primary || false,
        latitude: addressForm.latitude,
        longitude: addressForm.longitude,
      };

      if (editingAddress) {
        await updateAddress(editingAddress.id, hookFormData);
      } else {
        await addAddress(hookFormData);
      }
      setAddressDialogOpen(false);
      setEditingAddress(null);
    } catch (error) {
      // Error is handled by the hook
      console.error('Error saving address:', error);
    }
  };

  // Handle confirm delete
  const handleConfirmDelete = async () => {
    if (!addressToDelete) return;

    try {
      await deleteAddress(addressToDelete.id);
      setDeleteConfirmOpen(false);
      setAddressToDelete(null);
    } catch (error) {
      // Error is handled by the hook
      console.error('Error deleting address:', error);
    }
  };

  // Format address for display
  // Converts country codes (e.g., 'US') to country names (e.g., 'United States')
  // Converts state codes (e.g., 'CA') to state names (e.g., 'California')
  const formatAddress = (address: Address) => {
    // Get country name from country code
    // Example: 'US' -> 'United States', 'CA' -> 'Canada'
    const countryName = address.country
      ? Country.getCountryByCode(address.country)?.name || address.country
      : '';

    // Get state name from state code and country code
    // Example: 'CA' + 'US' -> 'California', 'ON' + 'CA' -> 'Ontario'
    const stateName =
      address.state && address.country
        ? State.getStateByCodeAndCountry(address.state, address.country)
            ?.name || address.state
        : address.state || '';

    const parts = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      stateName && address.postal_code
        ? `${stateName} ${address.postal_code}`
        : stateName || address.postal_code,
      countryName,
    ].filter(Boolean);

    return parts.join(', ');
  };

  // Capitalize entity type for display
  const capitalizeEntityType = (type: EntityType) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Check if max addresses reached
  const canAddMore = !maxAddresses || addresses.length < maxAddresses;

  // Loading skeleton
  if (loading && addresses.length === 0) {
    const skeletonContent = (
      <>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Skeleton variant="text" width={150} height={32} />
          <Skeleton variant="rectangular" width={120} height={36} />
        </Box>
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={100} />
          ))}
        </Stack>
      </>
    );
    if (embedded) {
      return <Box>{skeletonContent}</Box>;
    }
    return (
      <Card>
        <CardContent>{skeletonContent}</CardContent>
      </Card>
    );
  }

  const content = (
    <>
          {/* Header */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6">
              {title ||
                `${capitalizeEntityType(entityType)} ${t('addresses.title')}`}
            </Typography>
            {canAddMore && (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddAddress}
                disabled={loading}
              >
                {t('addresses.addAddress')}
              </Button>
            )}
          </Box>

          {/* Messages */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={clearMessages}>
              {error}
            </Alert>
          )}
          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={clearMessages}>
              {successMessage}
            </Alert>
          )}
          {warning && (
            <Alert severity="warning" sx={{ mb: 2 }} onClose={clearMessages}>
              {warning}
            </Alert>
          )}

          {/* Address List */}
          {addresses.length === 0 ? (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={4}
            >
              <LocationIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
              />
              <Typography
                variant="body1"
                color="text.secondary"
                textAlign="center"
              >
                {emptyStateMessage || t('addresses.noAddresses')}
              </Typography>
              {canAddMore && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddAddress}
                  sx={{ mt: 2 }}
                >
                  {t('addresses.addFirstAddress')}
                </Button>
              )}
            </Box>
          ) : (
            <Stack spacing={2}>
              {addresses.map((addressWrapper) => {
                const address = addressWrapper.address;
                return (
                  <Card key={address.id} variant="outlined">
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="flex-start"
                      >
                        <Box flex={1}>
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            mb={1}
                          >
                            <Typography variant="subtitle1" fontWeight="medium">
                              {t(
                                `addresses.types.${address.address_type}`,
                                address.address_type
                              )}
                            </Typography>
                            {address.is_primary && (
                              <Chip
                                label={t('addresses.primary')}
                                size="small"
                                color="primary"
                              />
                            )}
                          </Box>

                          <Typography variant="body2" color="text.secondary">
                            {formatAddress(address)}
                          </Typography>

                          {address.latitude && address.longitude && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {t('addresses.coordinates')}: {address.latitude},{' '}
                              {address.longitude}
                            </Typography>
                          )}
                        </Box>

                        <Box display="flex" gap={1}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditAddress(address)}
                            disabled={loading}
                          >
                            <EditIcon />
                          </IconButton>
                          {allowDelete && (
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteAddress(address)}
                              disabled={loading}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}

          {/* Max addresses warning */}
          {maxAddresses && addresses.length >= maxAddresses && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('addresses.maxAddressesReached', { max: maxAddresses })}
            </Alert>
          )}
    </>
  );

  return (
    <>
      {embedded ? (
        <Box>{content}</Box>
      ) : (
        <Card>
          <CardContent>{content}</CardContent>
        </Card>
      )}

      {/* Address Dialog */}
      <AddressDialog
        open={addressDialogOpen}
        title={
          editingAddress
            ? t('addresses.editAddress')
            : t('addresses.addAddress')
        }
        addressData={addressForm}
        loading={loading}
        showAddressType={showAddressType}
        showIsPrimary={showIsPrimary}
        showCoordinates={showCoordinates}
        addressTypeOptions={addressTypeOptions}
        onClose={() => {
          setAddressDialogOpen(false);
          setEditingAddress(null);
        }}
        onSave={handleSaveAddress}
        onAddressChange={setAddressForm}
      />

      {/* Delete Confirmation */}
      <ConfirmationModal
        open={deleteConfirmOpen}
        title={t('addresses.deleteConfirmTitle')}
        message={t('addresses.deleteConfirmMessage')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setAddressToDelete(null);
        }}
        loading={loading}
        confirmColor="error"
      />
    </>
  );
};

export default AddressManager;
