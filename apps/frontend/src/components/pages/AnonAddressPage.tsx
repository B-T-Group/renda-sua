import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAddressManager } from '../../hooks/useAddressManager';
import { useInventoryItem } from '../../hooks/useInventoryItem';
import AddressForm from '../addresses/AddressForm';
import type { AddressFormData } from '../dialogs/AddressDialog';

const AnonAddressPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { profile, refetch: refetchProfile } = useUserProfileContext();

  const isAnonFlow = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('anon') === '1';
  }, [location.search]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressFormData, setAddressFormData] = useState<AddressFormData>({
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    address_type: 'home',
    is_primary: true,
  });

  const { inventoryItem } = useInventoryItem(id || null);
  const itemOriginCountryIso = useMemo(
    () =>
      inventoryItem?.business_location?.address?.country?.trim() ?? '',
    [inventoryItem]
  );
  const itemOriginState = useMemo(
    () => inventoryItem?.business_location?.address?.state?.trim() ?? '',
    [inventoryItem]
  );
  const itemOriginCity = useMemo(
    () => inventoryItem?.business_location?.address?.city?.trim() ?? '',
    [inventoryItem]
  );

  useEffect(() => {
    setAddressFormData((prev) => {
      return {
        ...prev,
        country: prev.country || itemOriginCountryIso,
        state: prev.state || itemOriginState,
        city: prev.city || itemOriginCity,
      };
    });
  }, [itemOriginCity, itemOriginCountryIso, itemOriginState]);

  const { addAddress } = useAddressManager({
    entityType: 'client',
    entityId: profile?.client?.id || '',
    onAddressesChanged: refetchProfile,
  });

  const canManageAddresses = Boolean(profile?.client?.id);

  const backToPlaceOrder = useCallback(() => {
    const search = isAnonFlow ? '?anon=1&anonAddressDone=1' : '';
    if (id) {
      navigate(`/items/${id}/place_order${search}`, { replace: true });
      return;
    }
    navigate(-1);
  }, [id, isAnonFlow, navigate]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (!canManageAddresses) return;
    setSaving(true);
    setError(null);
    try {
      await addAddress({
        ...addressFormData,
        address_type: 'home',
        is_primary: true,
      });
      backToPlaceOrder();
    } catch (saveErr: any) {
      console.error('Error saving anon address:', saveErr);
      setError(
        saveErr?.response?.data?.error ||
          saveErr?.response?.data?.message ||
          t('common.error', 'Something went wrong. Please try again.')
      );
    } finally {
      setSaving(false);
    }
  }, [addAddress, addressFormData, backToPlaceOrder, saving, t]);

  // Desktop/tablet should keep using the dialog flow.
  useEffect(() => {
    if (!isMobile || !isAnonFlow) backToPlaceOrder();
  }, [backToPlaceOrder, isAnonFlow, isMobile]);

  if (!isMobile || !isAnonFlow) return null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar sx={{ px: 1 }}>
          <IconButton edge="start" onClick={backToPlaceOrder} disabled={saving}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1, ml: 0.5 }}>
            {t('orders.addDeliveryAddress', 'Add Delivery Address')}
          </Typography>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || !canManageAddresses}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            {t('addresses.addressDialog.save', 'Save')}
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'orders.anonDeliveryAddressPrompt',
            'Where do you want this item delivered?'
          )}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!canManageAddresses ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
        <AddressForm
          addressData={addressFormData}
          loading={saving}
          showAddressType={false}
          showIsPrimary={false}
          showCoordinates={false}
          hideAddressLine2={true}
          hidePostalCode={true}
          recommendCurrentLocation
          onAddressChange={setAddressFormData}
        />
        )}
      </Container>
    </Box>
  );
};

export default AnonAddressPage;

