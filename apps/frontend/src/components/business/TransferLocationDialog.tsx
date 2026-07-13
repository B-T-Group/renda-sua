import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BusinessLocation } from '../../hooks/useBusinessLocations';
import {
  useBusinessSearch,
  type TransferBusinessOption,
} from '../../hooks/useBusinessSearch';
import {
  useLocationTransfers,
  type TransferPreview,
} from '../../hooks/useLocationTransfers';

interface TransferLocationDialogProps {
  open: boolean;
  location: BusinessLocation | null;
  businessId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const BLOCK_REASON_KEYS: Record<string, [string, string]> = {
  DESTINATION_SAME_AS_SOURCE: [
    'business.locations.transfer.block.sameBusiness',
    'Cannot transfer to the same business',
  ],
  PRIMARY_LOCATION: [
    'business.locations.transfer.block.primary',
    'Cannot transfer the primary location',
  ],
  ONLY_LOCATION: [
    'business.locations.transfer.block.only',
    'Cannot transfer the only location',
  ],
  ITEMS_USED_IN_OTHER_LOCATIONS: [
    'business.locations.transfer.block.sharedItems',
    'Some items are used in other locations',
  ],
  RENTALS_USED_IN_OTHER_LOCATIONS: [
    'business.locations.transfer.block.sharedRentals',
    'Some rental items are listed at other locations',
  ],
  ONGOING_ORDERS: [
    'business.locations.transfer.block.ongoingOrders',
    'This location has ongoing orders',
  ],
  ONGOING_RENTALS: [
    'business.locations.transfer.block.ongoingRentals',
    'This location has ongoing rentals',
  ],
  SKU_COLLISION: [
    'business.locations.transfer.block.skuCollision',
    'Destination already has items with the same SKU',
  ],
};

const TransferLocationDialog: React.FC<TransferLocationDialogProps> = ({
  open,
  location,
  businessId,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { previewTransfer, createRequest } = useLocationTransfers(businessId);
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TransferBusinessOption | null>(null);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { options, loading: searchLoading } = useBusinessSearch(
    open && step === 0,
    search,
    businessId
  );

  useEffect(() => {
    if (!open) {
      setStep(0);
      setSearch('');
      setSelected(null);
      setPreview(null);
      setConfirmName('');
      setError(null);
    }
  }, [open]);

  const handleNextFromSearch = async () => {
    if (!location || !selected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await previewTransfer(location.id, selected.id);
      setPreview(data);
      setStep(1);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!location || !selected || !preview?.canTransfer) return;
    setLoading(true);
    setError(null);
    try {
      await createRequest(location.id, selected.id, confirmName);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { error?: string; blockReasons?: string[] } };
        message?: string;
      };
      setError(
        ax.response?.data?.error || ax.message || 'Failed to create request'
      );
    } finally {
      setLoading(false);
    }
  };

  const nameMatches =
    !!preview &&
    confirmName.trim().toLowerCase() ===
      preview.toBusiness.name.trim().toLowerCase();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('business.locations.transfer.title', 'Transfer location')}
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ mb: 3, mt: 1 }}>
          <Step>
            <StepLabel>
              {t('business.locations.transfer.stepSelect', 'Select business')}
            </StepLabel>
          </Step>
          <Step>
            <StepLabel>
              {t('business.locations.transfer.stepSummary', 'Summary')}
            </StepLabel>
          </Step>
          <Step>
            <StepLabel>
              {t('business.locations.transfer.stepConfirm', 'Confirm')}
            </StepLabel>
          </Step>
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {step === 0 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t(
                'business.locations.transfer.selectHint',
                'Search for the business that should receive "{{name}}".',
                { name: location?.name }
              )}
            </Typography>
            <Autocomplete
              options={options}
              loading={searchLoading}
              value={selected}
              onChange={(_, value) => setSelected(value)}
              onInputChange={(_, value) => setSearch(value)}
              filterOptions={(x) => x}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body1">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.email}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t(
                    'business.locations.transfer.searchLabel',
                    'Business name or email'
                  )}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {searchLoading ? (
                          <CircularProgress color="inherit" size={18} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Stack>
        )}

        {step === 1 && preview && (
          <Stack spacing={1.5}>
            {!preview.canTransfer && (
              <Alert severity="warning">
                {(preview.blockReasons || []).map((code) => {
                  const [key, fallback] = BLOCK_REASON_KEYS[code] || [
                    'business.locations.transfer.block.unknown',
                    code,
                  ];
                  return <div key={code}>{t(key, fallback)}</div>;
                })}
              </Alert>
            )}
            <Typography variant="body1">
              {t(
                'business.locations.transfer.summaryLine',
                '1 location · {{items}} items · {{rentals}} rentals · {{orders}} completed orders',
                {
                  items: preview.itemCount,
                  rentals: preview.rentalItemCount,
                  orders: preview.completedOrderCount,
                }
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'business.locations.transfer.toBusiness',
                'To: {{name}} ({{email}})',
                {
                  name: preview.toBusiness.name,
                  email: preview.toBusiness.email,
                }
              )}
            </Typography>
          </Stack>
        )}

        {step === 2 && preview && (
          <Stack spacing={2}>
            <Typography variant="body2">
              {t(
                'business.locations.transfer.confirmHint',
                'Type the destination business name "{{name}}" to send the transfer request.',
                { name: preview.toBusiness.name }
              )}
            </Typography>
            <TextField
              fullWidth
              label={t(
                'business.locations.transfer.confirmLabel',
                'Destination business name'
              )}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoFocus
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {t('common.cancel', 'Cancel')}
        </Button>
        {step > 0 && (
          <Button onClick={() => setStep((s) => s - 1)} disabled={loading}>
            {t('common.back', 'Back')}
          </Button>
        )}
        {step === 0 && (
          <Button
            variant="contained"
            onClick={handleNextFromSearch}
            disabled={!selected || loading}
          >
            {loading ? (
              <CircularProgress size={20} />
            ) : (
              t('common.next', 'Next')
            )}
          </Button>
        )}
        {step === 1 && (
          <Button
            variant="contained"
            onClick={() => setStep(2)}
            disabled={!preview?.canTransfer}
          >
            {t('common.next', 'Next')}
          </Button>
        )}
        {step === 2 && (
          <Button
            variant="contained"
            color="error"
            onClick={handleSubmit}
            disabled={!nameMatches || loading}
          >
            {loading ? (
              <CircularProgress size={20} />
            ) : (
              t(
                'business.locations.transfer.sendRequest',
                'Send transfer request'
              )
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TransferLocationDialog;
