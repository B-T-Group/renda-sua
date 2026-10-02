import { Button, Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceHoursEditor } from '../../admin/ServiceHoursEditor';
import {
  copyMondayToOpenDays,
  editorHoursAreValid,
  editorValueToOperatingHours,
  formatOperatingHoursSummary,
  operatingHoursEqual,
  operatingHoursToEditorValue,
} from '../../../utils/operatingHours';
import SettingToggleRow from './SettingToggleRow';
import SettingsSection from './SettingsSection';
import { LocationSectionActions } from './sectionTypes';

const OpenClosedSection: React.FC<
  LocationSectionActions & { startEditing?: boolean }
> = ({
  location,
  updateLocation,
  startEditing = false,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [active, setActive] = useState(location.is_active);
  useEffect(() => setActive(location.is_active), [location.is_active]);
  const [editing, setEditing] = useState(startEditing);
  useEffect(() => {
    if (!startEditing) return;
    setEditing(true);
    document.getElementById('opening-hours')?.scrollIntoView({ block: 'start' });
  }, [startEditing]);
  const [hours, setHours] = useState(() =>
    operatingHoursToEditorValue(location.operating_hours)
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = operatingHoursToEditorValue(location.operating_hours);
  const dirty = !operatingHoursEqual(
    editorValueToOperatingHours(hours),
    editorValueToOperatingHours(saved)
  );

  const commitActive = async (next: boolean) => {
    const previous = active;
    setActive(next);
    try {
      await updateLocation(location.id, { is_active: next });
      enqueueSnackbar(savedToast(next, t), { variant: 'success' });
    } catch {
      setActive(previous);
      enqueueSnackbar(
        t('business.locations.statusUpdateError', 'Failed to update location status'),
        { variant: 'error' }
      );
    }
  };

  const saveHours = async () => {
    if (!editorHoursAreValid(hours)) {
      setError(
        t(
          'business.locations.hours.closeAfterOpen',
          'Closing time must be after opening time.'
        )
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateLocation(location.id, {
        operating_hours: editorValueToOperatingHours(hours),
      });
      setEditing(false);
      enqueueSnackbar(
        t('business.locations.hours.saved', 'Opening hours saved'),
        { variant: 'success' }
      );
    } catch {
      setError(
        t(
          'business.locations.hours.saveFailed',
          "Couldn't save your opening hours. Please try again."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <SettingToggleRow
        label={t(
          'business.locations.openClosed.showLabel',
          'Show this location to customers'
        )}
        consequence={activeConsequence(active, t)}
        checked={active}
        onCommit={(next) => void commitActive(next)}
        confirmFor={(next) => (next ? null : hideConfirm(t))}
      />
      <SettingsSection
        id="opening-hours"
        title={t('business.locations.openClosed.hoursTitle', 'Opening hours')}
        summary={<HoursSummary location={location} />}
        editing={editing}
        onEdit={() => {
          setHours(operatingHoursToEditorValue(location.operating_hours));
          setError(null);
          setEditing(true);
        }}
        onCancel={() => setEditing(false)}
        onSave={() => void saveHours()}
        saveLabel={t('business.locations.hours.save', 'Save hours')}
        saving={saving}
        saveDisabled={!dirty}
        error={error}
      >
        <ServiceHoursEditor
          embedded
          value={hours}
          onChange={setHours}
          offDayLabel={t('common.closed', 'Closed')}
        />
        <Button variant="text" onClick={() => setHours(copyMondayToOpenDays(hours))}>
          {t(
            'business.locations.hours.copyMonday',
            'Copy Monday to all open days'
          )}
        </Button>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {t(
              'business.locations.openClosed.hoursHelp',
              "Customers can only choose pickup or delivery times when you're open. Orders for 'as soon as possible' stop a little before closing, so there's time to prepare."
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {t(
              'business.locations.openClosed.cookedFoodNote',
              'Cooked food uses the serving times set on each food item.'
            )}
          </Typography>
        </Stack>
      </SettingsSection>
    </Stack>
  );
};

function HoursSummary({
  location,
}: {
  location: LocationSectionActions['location'];
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
        {formatOperatingHoursSummary(location.operating_hours, t)}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
        {t(
          'business.locations.openClosed.hoursHelp',
          "Customers can only choose pickup or delivery times when you're open. Orders for 'as soon as possible' stop a little before closing, so there's time to prepare."
        )}
      </Typography>
    </Stack>
  );
}

function activeConsequence(
  active: boolean,
  t: (key: string, fallback: string) => string
): string {
  return active
    ? t(
        'business.locations.openClosed.showOn',
        "Customers can see this location's items and order from it."
      )
    : t(
        'business.locations.openClosed.showOff',
        "This location is hidden. Customers can't see its items or order from it until you turn it back on."
      );
}

function hideConfirm(t: (key: string, fallback: string) => string) {
  return {
    title: t('business.locations.openClosed.hideTitle', 'Hide this location?'),
    body: t(
      'business.locations.openClosed.showOff',
      "This location is hidden. Customers can't see its items or order from it until you turn it back on."
    ),
    confirmLabel: t('business.locations.openClosed.hideConfirm', 'Hide it'),
  };
}

function savedToast(
  active: boolean,
  t: (key: string, fallback: string) => string
): string {
  return active
    ? t('business.locations.locationActivated', 'Location activated successfully')
    : t(
        'business.locations.locationDeactivated',
        'Location deactivated successfully'
      );
}

export default OpenClosedSection;
