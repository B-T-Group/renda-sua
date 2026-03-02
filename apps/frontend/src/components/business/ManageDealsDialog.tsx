import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BusinessInventoryItem } from '../../hooks/useBusinessInventory';
import { ItemDeal, useItemDeals } from '../../hooks/useItemDeals';

interface ManageDealsDialogProps {
  open: boolean;
  onClose: () => void;
  inventoryItem: BusinessInventoryItem | null;
}

const formatDateTimeLocal = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
};

const ManageDealsDialog: React.FC<ManageDealsDialogProps> = ({
  open,
  onClose,
  inventoryItem,
}) => {
  const { t } = useTranslation();
  const inventoryId = inventoryItem?.id ?? null;
  const { deals, loading, createDeal, deleteDeal } = useItemDeals(inventoryId);

  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(
    'percentage'
  );
  const [discountValue, setDiscountValue] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');

  const activeDeals = useMemo(
    () => deals.filter((d) => d.is_active),
    [deals]
  );

  const resetForm = () => {
    setDiscountType('percentage');
    setDiscountValue('');
    setStartAt('');
    setEndAt('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!inventoryId) return;
    if (!discountValue || !startAt || !endAt) return;
    await createDeal({
      discountType,
      discountValue: Number(discountValue),
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
    });
    resetForm();
  };

  const handleDelete = async (deal: ItemDeal) => {
    await deleteDeal(deal.id);
  };

  if (!inventoryItem) {
    return null;
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t(
          'business.items.deals.title',
          'Manage deals for {{name}}',
          { name: inventoryItem.item?.name ?? '' }
        )}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {t('business.items.deals.current', 'Current deals')}
            </Typography>
            {loading && (
              <Typography variant="body2" color="text.secondary">
                {t('common.loading', 'Loading...')}
              </Typography>
            )}
            {!loading && deals.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('business.items.deals.none', 'No deals configured for this item')}
              </Typography>
            )}
            {!loading && deals.length > 0 && (
              <Stack spacing={1}>
                {deals.map((deal) => (
                  <Box
                    key={deal.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'background.default',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {deal.discount_type === 'percentage'
                          ? t(
                              'business.items.deals.percentOff',
                              '{{value}}% off',
                              { value: deal.discount_value }
                            )
                          : t(
                              'business.items.deals.fixedOff',
                              '{{value}} off',
                              { value: deal.discount_value }
                            )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTimeLocal(deal.start_at)} →{' '}
                        {formatDateTimeLocal(deal.end_at)}
                      </Typography>
                      {!deal.is_active && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          {t('business.items.deals.inactive', 'Inactive')}
                        </Typography>
                      )}
                    </Box>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => void handleDelete(deal)}
                    >
                      {t('common.delete', 'Delete')}
                    </Button>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {t('business.items.deals.add', 'Add new deal')}
            </Typography>
            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t(
                    'business.items.deals.discountType',
                    'Discount type'
                  )}
                </InputLabel>
                <Select
                  value={discountType}
                  label={t(
                    'business.items.deals.discountType',
                    'Discount type'
                  )}
                  onChange={(e) =>
                    setDiscountType(e.target.value as 'percentage' | 'fixed')
                  }
                >
                  <MenuItem value="percentage">
                    {t('business.items.deals.percentage', 'Percentage')}
                  </MenuItem>
                  <MenuItem value="fixed">
                    {t('business.items.deals.fixed', 'Fixed amount')}
                  </MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                type="number"
                label={t(
                  'business.items.deals.discountValue',
                  'Discount value'
                )}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                inputProps={{ min: 0, step: '0.01' }}
                fullWidth
              />

              <TextField
                size="small"
                label={t('business.items.deals.startAt', 'Start time')}
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />

              <TextField
                size="small"
                label={t('business.items.deals.endAt', 'End time')}
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={() => void handleCreate()}
          variant="contained"
          disabled={
            !discountValue || !startAt || !endAt || activeDeals.length > 0
          }
        >
          {t('business.items.deals.create', 'Create deal')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManageDealsDialog;

