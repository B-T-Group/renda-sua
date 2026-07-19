import { ShoppingCart } from '@mui/icons-material';
import { Button } from '@mui/material';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { CartItem } from '../../contexts/CartContext';
import { InventoryItem } from '../../hooks/useInventoryItems';
import { useCatalogVariantFlow } from '../../hooks/useCatalogVariantFlow';
import { catalogRequiresVariantSelection } from '../../utils/catalogVariantCart';
import CatalogVariantPickerDialog from '../common/CatalogVariantPickerDialog';

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

  const onCartBuilt = useCallback((_cartItem: CartItem, _item: InventoryItem) => {
    // OrderDialog only places orders; cart path is unused.
  }, []);

  const variantFlow = useCatalogVariantFlow({ onCartBuilt });

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
      amount
    );

  const handlePlaceOrder = () => {
    if (!selectedItem) return;
    const needsPicker = catalogRequiresVariantSelection(selectedItem);
    variantFlow.requestOrder(selectedItem);
    if (!needsPicker) onClose?.();
  };

  if (!selectedItem) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handlePlaceOrder}
        variant="contained"
        startIcon={<ShoppingCart />}
        size="large"
      >
        {t('orders.placeOrder', 'Place Order')}
      </Button>
      <CatalogVariantPickerDialog
        open={variantFlow.pickerOpen}
        item={variantFlow.pickerItem}
        onClose={variantFlow.closePicker}
        onConfirm={(selectionId) => {
          variantFlow.onPickerConfirm(selectionId);
          onClose?.();
        }}
        confirmLabel={variantFlow.confirmLabel}
        formatCurrency={formatCurrency}
      />
    </>
  );
};

export default OrderDialog;
