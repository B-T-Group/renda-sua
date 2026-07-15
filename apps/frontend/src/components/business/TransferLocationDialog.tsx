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
  FormControl,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Radio,
  RadioGroup,
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
  type TransferMode,
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
  NO_MOVABLE_INVENTORY: [
    'business.locations.transfer.block.noMovable',
    'No inventory can be moved (all items skipped or empty)',
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
  const { previewTransfer, createRequest, listDestLocations } =
    useLocationTransfers(businessId);
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TransferBusinessOption | null>(null);
  const [mode, setMode] = useState<TransferMode>('location_ownership');
  const [destLocations, setDestLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [toLocationId, setToLocationId] = useState('');
  const [locationsLoading, setLocationsLoading] = useState(false);
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
      setMode('location_ownership');
      setDestLocations([]);
      setToLocationId('');
      setPreview(null);
      setConfirmName('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || step !== 1 || !selected || mode !== 'inventory_merge') return;
    setLocationsLoading(true);
    void listDestLocations(selected.id)
      .then((locs) => {
        setDestLocations(locs);
        setToLocationId((prev) =>
          prev && locs.some((l) => l.id === prev) ? prev : locs[0]?.id || ''
        );
      })
      .catch(() => {
        setDestLocations([]);
        setToLocationId('');
      })
      .finally(() => setLocationsLoading(false));
  }, [open, step, selected, mode, listDestLocations]);

  const handleNextFromSearch = () => {
    if (!selected) return;
    setError(null);
    setStep(1);
  };

  const handleNextFromMode = async () => {
    if (!location || !selected) return;
    if (mode === 'inventory_merge' && !toLocationId) {
      setError(
        t(
          'business.locations.transfer.destLocationRequired',
          'Select a destination location'
        )
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await previewTransfer(location.id, selected.id, {
        mode,
        toLocationId:
          mode === 'inventory_merge' ? toLocationId : undefined,
      });
      setPreview(data);
      setStep(2);
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
      await createRequest(location.id, selected.id, confirmName, {
        mode,
        toLocationId:
          mode === 'inventory_merge' ? toLocationId : undefined,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { error?: string } };
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
              {t('business.locations.transfer.stepMode', 'Transfer type')}
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

        {step === 1 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t(
                'business.locations.transfer.modeHint',
                'Choose whether to move the whole location or only its inventory.'
              )}
            </Typography>
            <FormControl>
              <RadioGroup
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as TransferMode)
                }
              >
                <FormControlLabel
                  value="location_ownership"
                  control={<Radio />}
                  label={t(
                    'business.locations.transfer.modeOwnership',
                    'Transfer entire location (ownership)'
                  )}
                />
                <FormControlLabel
                  value="inventory_merge"
                  control={<Radio />}
                  label={t(
                    'business.locations.transfer.modeMerge',
                    'Move inventory into an existing location'
                  )}
                />
              </RadioGroup>
            </FormControl>
            {mode === 'inventory_merge' && (
              <TextField
                select
                fullWidth
                label={t(
                  'business.locations.transfer.destLocation',
                  'Destination location'
                )}
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                disabled={locationsLoading}
                helperText={
                  locationsLoading
                    ? t('common.loading', 'Loading...')
                    : destLocations.length
                      ? undefined
                      : t(
                          'business.locations.transfer.noDestLocations',
                          'This business has no active locations'
                        )
                }
              >
                {destLocations.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        )}

        {step === 2 && preview && (
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
            <Typography variant="body2" color="text.secondary">
              {preview.mode === 'inventory_merge'
                ? t(
                    'business.locations.transfer.modeMergeBadge',
                    'Inventory merge'
                  )
                : t(
                    'business.locations.transfer.modeOwnershipBadge',
                    'Location ownership'
                  )}
            </Typography>
            <Typography variant="body1">
              {preview.mode === 'inventory_merge'
                ? t(
                    'business.locations.transfer.mergeSummaryLine',
                    '{{items}} items · {{rentals}} rentals will move · {{skipped}} skipped',
                    {
                      items: preview.movableItemCount,
                      rentals: preview.movableRentalItemCount,
                      skipped:
                        preview.skippedDuplicateCount +
                        preview.skippedSharedCount,
                    }
                  )
                : t(
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
            {preview.toLocation && (
              <Typography variant="body2" color="text.secondary">
                {t(
                  'business.locations.transfer.toLocationLine',
                  'Destination location: {{name}}',
                  { name: preview.toLocation.name }
                )}
              </Typography>
            )}
            {preview.skippedDuplicates?.length > 0 && (
              <Box>
                <Typography variant="subtitle2">
                  {t(
                    'business.locations.transfer.skippedDuplicates',
                    'Skipped duplicates (left on source)'
                  )}
                </Typography>
                <List dense>
                  {preview.skippedDuplicates.map((item) => (
                    <ListItem key={item.itemId} disableGutters>
                      <ListItemText
                        primary={item.name}
                        secondary={item.sku || undefined}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            {preview.skippedShared?.length > 0 && (
              <Box>
                <Typography variant="subtitle2">
                  {t(
                    'business.locations.transfer.skippedShared',
                    'Skipped (used at other locations)'
                  )}
                </Typography>
                <List dense>
                  {preview.skippedShared.map((item) => (
                    <ListItem key={item.itemId} disableGutters>
                      <ListItemText primary={item.name} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Stack>
        )}

        {step === 3 && preview && (
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
            {t('common.next', 'Next')}
          </Button>
        )}
        {step === 1 && (
          <Button
            variant="contained"
            onClick={handleNextFromMode}
            disabled={
              loading ||
              (mode === 'inventory_merge' &&
                (!toLocationId || locationsLoading))
            }
          >
            {loading ? (
              <CircularProgress size={20} />
            ) : (
              t('common.next', 'Next')
            )}
          </Button>
        )}
        {step === 2 && (
          <Button
            variant="contained"
            onClick={() => setStep(3)}
            disabled={!preview?.canTransfer}
          >
            {t('common.next', 'Next')}
          </Button>
        )}
        {step === 3 && (
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
