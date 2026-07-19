import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import { orderedItemImages } from '../../utils/orderedItemImages';
import {
  SHOPPER_BASE_VARIANT_ID,
  shopperVariantOptions,
} from '../../utils/shopperVariantSelection';
import VariantSelector from './VariantSelector';

export interface CatalogVariantPickerDialogProps {
  open: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  /** Called with shopper selection id (`__base__` or variant UUID). */
  onConfirm: (selectionId: string) => void;
  confirmLabel?: string;
  formatCurrency: (amount: number, currency?: string) => string;
}

const CatalogVariantPickerDialog: React.FC<CatalogVariantPickerDialogProps> = ({
  open,
  item,
  onClose,
  onConfirm,
  confirmLabel,
  formatCurrency,
}) => {
  const { t } = useTranslation();
  const defaultLabel = t('orders.variant.defaultOption', 'Default');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const parentImageUrl = useMemo(() => {
    if (!item) return null;
    return orderedItemImages(item.item.item_images)[0]?.image_url ?? null;
  }, [item]);

  const options = useMemo(() => {
    if (!item) return [];
    return shopperVariantOptions({
      itemName: item.item.name,
      defaultLabel,
      variants: item.item.item_variants,
      parentImageUrl,
    });
  }, [item, defaultLabel, parentImageUrl]);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      return;
    }
    setSelectedId(null);
  }, [open, item?.id]);

  if (!item) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('orders.variant.selectDialogTitle', 'Choose an option')}
      </DialogTitle>
      <DialogContent>
        <VariantSelector
          variants={options}
          value={selectedId}
          onChange={setSelectedId}
          listingSellingPrice={item.selling_price}
          priceOverrides={item.variant_price_overrides}
          hasActiveDeal={item.hasActiveDeal}
          originalPrice={item.original_price}
          discountedPrice={item.discounted_price}
          currency={item.item.currency}
          formatCurrency={formatCurrency}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return;
            onConfirm(selectedId);
          }}
        >
          {confirmLabel ||
            t('orders.variant.confirmSelection', 'Add to cart')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export { SHOPPER_BASE_VARIANT_ID };
export default CatalogVariantPickerDialog;
