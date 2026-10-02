import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BusinessLocation } from '../../../hooks/useBusinessLocations';
import TransferLocationDialog from '../TransferLocationDialog';
import { LocationSectionActions } from './sectionTypes';

const TYPES = ['store', 'warehouse', 'office', 'pickup_point'] as const;

const MoreOptionsSection: React.FC<LocationSectionActions> = ({
  location,
  locations,
  businessId,
  updateLocation,
  deleteLocation,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mainOpen, setMainOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const makeMain = async () => {
    const previous = locations.find(
      (item) => item.is_primary && item.id !== location.id
    );
    setMainOpen(false);
    try {
      await updateLocation(location.id, { is_primary: true });
      if (previous) await updateLocation(previous.id, { is_primary: false });
      enqueueSnackbar(
        t('business.locations.more.mainSaved', 'This is now your main location.'),
        { variant: 'success' }
      );
    } catch {
      setError(
        previous
          ? t(
              'business.locations.more.mainPartial',
              'This location is main, but the previous one could not be updated. You may have two main locations until you try again.'
            )
          : t(
              'business.locations.more.mainFailed',
              "Couldn't update the main location. Please try again."
            )
      );
    }
  };

  return (
    <Accordion variant="outlined" disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 700 }}>
          {t('business.locations.more.title', 'More options')}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <TypeSelect location={location} updateLocation={updateLocation} />
          <MainLocation
            location={location}
            onAsk={() => setMainOpen(true)}
          />
          <Button variant="text" onClick={() => setTransferOpen(true)} disabled={location.is_primary}>
            {t('business.locations.more.transfer', 'Transfer to another business')}
          </Button>
          <Typography variant="body2" color="text.secondary">
            {t(
              'business.locations.more.transferHelp',
              'Move this location and its items to another business. They must accept first.'
            )}
          </Typography>
          <Button variant="text" color="error" onClick={() => setDeleteOpen(true)} disabled={location.is_primary}>
            {t('business.locations.more.delete', 'Delete this location')}
          </Button>
          <Typography variant="body2" color="text.secondary">
            {deleteHelp(location, t)}
          </Typography>
          {error ? (
            <Typography variant="body2" color="error" role="alert">{error}</Typography>
          ) : null}
        </Stack>
      </AccordionDetails>
      <TransferLocationDialog
        open={transferOpen}
        location={location}
        businessId={businessId}
        onClose={() => setTransferOpen(false)}
        onSuccess={() => setTransferOpen(false)}
      />
      <ConfirmDialog
        open={mainOpen}
        title={t('business.locations.more.makeMain', 'Make this my main location')}
        body={t(
          'business.locations.more.mainConfirm',
          'Your current main location will no longer be main.'
        )}
        confirmLabel={t('business.locations.more.makeMain', 'Make this my main location')}
        onClose={() => setMainOpen(false)}
        onConfirm={() => void makeMain()}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={t('business.locations.deleteLocation', 'Delete Location')}
        body={t(
          'business.locations.more.deleteHelp',
          "You can only delete a location with no items and no money in its account. This can't be undone."
        )}
        confirmLabel={t('common.delete', 'Delete')}
        error={deleteError}
        busy={deleting}
        onClose={() => closeDelete(setDeleteOpen, setDeleteError)}
        onConfirm={() =>
          void confirmDelete(deleteLocation, location.id, {
            setDeleteOpen,
            setDeleteError,
            setDeleting,
            t,
          })
        }
      />
    </Accordion>
  );
};

function TypeSelect({
  location,
  updateLocation,
}: Pick<LocationSectionActions, 'location' | 'updateLocation'>) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  return (
    <Stack spacing={0.5}>
      <Typography variant="body2">
        {t('business.locations.more.kind', 'Kind of place')}
      </Typography>
      <Select
        value={location.location_type}
        onChange={(event) =>
          void saveLocationType(
            location.id,
            String(event.target.value),
            updateLocation,
            setError,
            t
          )
        }
      >
        {TYPES.map((type) => (
          <MenuItem key={type} value={type}>
            {t(`business.locations.${type}`, typeLabel(type))}
          </MenuItem>
        ))}
      </Select>
      <Typography variant="body2" color="text.secondary">
        {t(
          'business.locations.more.kindHelp',
          'Helps you tell your places apart.'
        )}
      </Typography>
      {error ? (
        <Typography variant="body2" color="error" role="alert">
          {error}
        </Typography>
      ) : null}
    </Stack>
  );
}

function MainLocation({
  location,
  onAsk,
}: {
  location: BusinessLocation;
  onAsk: () => void;
}) {
  const { t } = useTranslation();
  if (location.is_primary) {
    return (
      <Typography variant="body2">
        {t(
          'business.locations.more.mainCurrent',
          "This is your main location. It can't be deleted."
        )}
      </Typography>
    );
  }
  return (
    <Button variant="text" onClick={onAsk}>
      {t('business.locations.more.makeMain', 'Make this my main location')}
    </Button>
  );
}

function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  error,
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  error?: string | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{body}</DialogContentText>
        {error ? (
          <Typography variant="body2" color="error" role="alert" sx={{ mt: 2 }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button variant="contained" onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function closeDelete(
  setOpen: (open: boolean) => void,
  setError: (message: string | null) => void
) {
  setOpen(false);
  setError(null);
}

async function confirmDelete(
  deleteLocation: (id: string) => Promise<unknown>,
  locationId: string,
  state: {
    setDeleteOpen: (open: boolean) => void;
    setDeleteError: (message: string | null) => void;
    setDeleting: (busy: boolean) => void;
    t: (key: string, fallback: string) => string;
  }
) {
  state.setDeleting(true);
  state.setDeleteError(null);
  try {
    await deleteLocation(locationId);
    state.setDeleteOpen(false);
  } catch (err: unknown) {
    state.setDeleteError(deleteFailureMessage(err, state.t));
  } finally {
    state.setDeleting(false);
  }
}

const DELETE_CODE_COPY: Record<string, readonly [string, string]> = {
  LOCATION_HAS_INVENTORY: [
    'business.locations.cannotDeleteHasInventory',
    'Cannot delete a location that still has items. Remove items from this location first.',
  ],
  LOCATION_HAS_BALANCE: [
    'business.locations.cannotDeleteHasBalance',
    'Cannot delete a location that still has account balance. Withdraw or transfer funds first.',
  ],
  ADDRESS_PRIMARY_DELETE_FORBIDDEN: [
    'business.locations.cannotDeletePrimary',
    'Cannot delete primary location',
  ],
  ADDRESS_MINIMUM_REQUIRED: [
    'business.locations.cannotDeleteOnlyLocation',
    'Cannot delete the only location. Each business must have at least one location.',
  ],
};

function deleteFailureMessage(
  err: unknown,
  t: (key: string, fallback: string) => string
): string {
  const copy = DELETE_CODE_COPY[readErrorCode(err) ?? ''];
  if (copy) return t(copy[0], copy[1]);
  if (err instanceof Error && err.message) return err.message;
  return t('business.locations.deleteError', 'Failed to delete location');
}

function readErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object' || !('code' in err)) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

async function saveLocationType(
  locationId: string,
  locationType: string,
  updateLocation: LocationSectionActions['updateLocation'],
  setError: (message: string | null) => void,
  t: (key: string, fallback: string) => string
) {
  setError(null);
  try {
    await updateLocation(locationId, {
      location_type: locationType as BusinessLocation['location_type'],
    });
  } catch {
    setError(
      t(
        'business.locations.more.kindFailed',
        "Couldn't save the kind of place. Please try again."
      )
    );
  }
}

function deleteHelp(
  location: BusinessLocation,
  t: (key: string, fallback: string) => string
): string {
  if (location.is_primary) {
    return t(
      'business.locations.cannotDeletePrimary',
      'Cannot delete primary location'
    );
  }
  return t(
    'business.locations.more.deleteHelp',
    "You can only delete a location with no items and no money in its account. This can't be undone."
  );
}

function typeLabel(type: (typeof TYPES)[number]): string {
  if (type === 'pickup_point') return 'Pickup point';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default MoreOptionsSection;
