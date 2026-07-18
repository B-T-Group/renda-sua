import { ShoppingCart } from '@mui/icons-material';
import { Button } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { InventoryItem } from '../../hooks/useInventoryItems';
import {
  catalogRequiresVariantSelection,
  defaultCatalogVariantId,
} from '../../utils/catalogVariantCart';

interface OrderDialogProps {
  selectedItem: InventoryItem | null;
  onClose?: () => void;
}

/**
 * OrderDialog - Simplified component that navigates to PlaceOrderPage
 *
 * This component has been simplified to redirect users to the dedicated
 * PlaceOrderPage instead of showing a modal dialog. This provides a better
 * user experience with more space for order details, address selection,
 * and payment information.
 */
const OrderDialog: React.FC<OrderDialogProps> = ({ selectedItem, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const handlePlaceOrder = () => {
    if (!selectedItem) return;
    if (catalogRequiresVariantSelection(selectedItem)) {
      enqueueSnackbar(t('cart.chooseOption', 'Choose an option'), {
        variant: 'info',
      });
      navigate(`/items/${selectedItem.id}`);
      onClose?.();
      return;
    }
    const variantId = defaultCatalogVariantId(selectedItem);
    const qs = variantId
      ? `?variantId=${encodeURIComponent(variantId)}`
      : '';
    navigate(`/items/${selectedItem.id}/place_order${qs}`);
    onClose?.();
  };

  if (!selectedItem) {
    return null;
  }

  return (
    <Button
      onClick={handlePlaceOrder}
      variant="contained"
      startIcon={<ShoppingCart />}
      size="large"
    >
      {t('orders.placeOrder', 'Place Order')}
    </Button>
  );
};

export default OrderDialog;
